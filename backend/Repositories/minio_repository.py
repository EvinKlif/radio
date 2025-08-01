from minio import Minio
from minio.error import S3Error
import os

class MinioRepository:
    def __init__(self):
        self.client = Minio(
            os.getenv("MINIO_ENDPOINT", "localhost:9000"),
            access_key=os.getenv("MINIO_ACCESS_KEY"),
            secret_key=os.getenv("MINIO_SECRET_KEY"),
            secure=False
        )
        self.ensure_buckets_exist()

    def ensure_buckets_exist(self):
        try:
            if not self.client.bucket_exists("media"):
                self.client.make_bucket("media")
            if not self.client.bucket_exists("image"):
                self.client.make_bucket("image")
                self.client.set_bucket_policy("image", self.get_public_policy())
        except S3Error as e:
            print(f"Error creating buckets: {e}")
            raise

    def get_public_policy(self):
        return """{
            "Version": "2012-10-17",
            "Statement": [
                {
                    "Effect": "Allow",
                    "Principal": "*",
                    "Action": ["s3:GetObject"],
                    "Resource": ["arn:aws:s3:::image/*"]
                }
            ]
        }"""

    async def upload_mp3(self, file, filename):
        try:
            self.client.put_object(
                "media",  # Бакет media
                filename,  # Имя файла без префикса
                file,
                length=-1,
                part_size=10 * 1024 * 1024
            )
            return filename  # Возвращаем только имя файла
        except S3Error as e:
            print(f"Error uploading MP3: {e}")
            raise

    async def upload_image(self, file, filename):
        try:
            self.client.put_object(
                "image",  # Бакет image
                filename,  # Имя файла без префикса
                file,
                length=-1,
                part_size=10 * 1024 * 1024
            )
            return filename  # Возвращаем только имя файла
        except S3Error as e:
            print(f"Error uploading image: {e}")
            raise

    async def delete_file(self, file_path: str):
        try:
            # Извлекаем имя бакета и объекта из пути
            if file_path.startswith("/"):
                file_path = file_path[1:]

            bucket_name, object_name = file_path.split("/", 1)
            self.client.remove_object(bucket_name, object_name)
        except S3Error as e:
            print(f"Error deleting file {file_path}: {e}")
            raise