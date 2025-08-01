import gi
gi.require_version('Gst', '1.0')
from gi.repository import Gst, GLib, GObject
import threading
import boto3
import io
import redis
import os
import time
from dotenv import load_dotenv

load_dotenv()

Gst.init(None)


class S3RTPPlayer:
    def __init__(self, bucket_name, dest_ip, dest_port, endpoint_url, access_key, secret_key):
        self.bucket_name = bucket_name
        self.dest_ip = dest_ip
        self.dest_port = dest_port
        self.appsrc = None
        self.pipeline = None
        self.loop = GLib.MainLoop()
        self.pushing = True

        self.redis = redis.Redis(
            host=os.getenv('REDIS_HOST', 'redis'),
            port=int(os.getenv('REDIS_PORT', 6379)),
            db=0
        )
        self.redis_channel = os.getenv('REDIS_CHANNEL', 'current_track')

        self.s3 = boto3.client(
            's3',
            endpoint_url=endpoint_url,
            aws_access_key_id=access_key,
            aws_secret_access_key=secret_key,
        )

        self.tracks = self._list_mp3_files()
        self.last_track_list_hash = self._hash_track_list(self.tracks)
        self.track_idx = 0

    def _list_mp3_files(self):
        response = self.s3.list_objects_v2(Bucket=self.bucket_name)
        if 'Contents' not in response:
            return []
        return sorted([obj['Key'] for obj in response['Contents'] if obj['Key'].endswith('.mp3')])

    def _hash_track_list(self, track_list):
        return hash(tuple(track_list))

    def _refresh_track_list_if_changed(self):
        new_tracks = self._list_mp3_files()
        new_hash = self._hash_track_list(new_tracks)
        if new_hash != self.last_track_list_hash:
            print("Track list changed, refreshing.")
            self.tracks = new_tracks
            self.last_track_list_hash = new_hash
            self.track_idx = 0
        else:
            print("Track list unchanged, looping.")

    def _download_track(self, key):
        print(f"Downloading: {key}")
        response = self.s3.get_object(Bucket=self.bucket_name, Key=key)
        return io.BytesIO(response['Body'].read())

    def _publish_current_track(self, track_name):
        try:
            self.redis.publish("track_updates", track_name)
            self.redis.set("last_track", track_name)
            print(f"Published to Redis: {track_name}")
        except Exception as e:
            print(f"Redis error: {e}")

    def start(self):
        pipeline_str = (
            "appsrc name=src is-live=true format=time "
            " ! decodebin "
            " ! audioconvert "
            " ! audioresample "
            " ! opusenc "
            " ! rtpopuspay pt=111 ssrc=11111111 "
            " ! udpsink host={} port={}"
        ).format(self.dest_ip, self.dest_port)

        self.pipeline = Gst.parse_launch(pipeline_str)
        self.appsrc = self.pipeline.get_by_name("src")
        self.appsrc.set_property("format", Gst.Format.TIME)
        self.appsrc.set_property("block", True)

        self.pipeline.set_state(Gst.State.PLAYING)
        threading.Thread(target=self.push_loop, daemon=True).start()
        self.loop.run()

    def push_loop(self):
        while self.pushing:
            if not self.tracks:
                print("Нет треков в бакете. Ожидание...")
                time.sleep(5)
                self._refresh_track_list_if_changed()
                continue

            if self.track_idx >= len(self.tracks):
                self._refresh_track_list_if_changed()
                self.track_idx = 0
                continue

            current_key = self.tracks[self.track_idx]
            self._publish_current_track(current_key)

            try:
                track_data = self._download_track(current_key)

                while True:
                    data = track_data.read(4096)
                    if not data:
                        break
                    buf = Gst.Buffer.new_allocate(None, len(data), None)
                    buf.fill(0, data)
                    ret = self.appsrc.emit("push-buffer", buf)
                    if ret != Gst.FlowReturn.OK:
                        print("Ошибка push-buffer:", ret)
                        break  # НЕ self.pushing = False — просто пропустить этот трек

            except Exception as e:
                print(f"Ошибка при проигрывании {current_key}: {e}")

            self.track_idx += 1

        # Конец работы, завершаем поток
        print("Завершение потока")
        if self.appsrc:
            self.appsrc.emit("end-of-stream")

    def stop(self):
        self.pushing = False
        if self.appsrc:
            self.appsrc.emit("end-of-stream")
        if self.pipeline:
            self.pipeline.set_state(Gst.State.NULL)
        self.loop.quit()


if __name__ == "__main__":
    player = S3RTPPlayer(
        bucket_name=os.getenv("S3_BUCKET_NAME"),
        dest_ip=os.getenv("S3_DEST_IP"),
        dest_port=int(os.getenv("S3_DEST_PORT")),  # Преобразуем в int
        endpoint_url=os.getenv("S3_ENDPOINT_URL"),
        access_key=os.getenv("S3_ACCESS_KEY"),
        secret_key=os.getenv("S3_SECRET_KEY")
)
    try:
        player.start()
    except KeyboardInterrupt:
        player.stop()
