require('dotenv').config();
const http = require('http');
const socketIO = require('socket.io');
const mediasoup = require('mediasoup');
const express = require('express');
const path = require('path');

const app = express();
const server = http.createServer(app);

const io = socketIO(server, {
  path: '/socket.io',
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true
  }
});

app.use(express.static(path.join(__dirname, 'public')));

const mediasoupOptions = {
  worker: {
    rtcMinPort: 40000,
    rtcMaxPort: 40100,
    logLevel: 'debug'
  },
  router: {
    mediaCodecs: [{
      kind: "audio",
      mimeType: "audio/opus",
      clockRate: 48000,
      channels: 2
    }]
  },
  webRtcTransport: {
    listenIps: [
      {
        ip: "0.0.0.0",
        announcedIp: process.env.ANNOUNCED_IP || "127.0.0.1"
      }
    ],
    enableUdp: true,
    enableTcp: true,
    preferUdp: true,
    initialAvailableOutgoingBitrate: 1000000,
    iceServers: [
      {
        urls: `stun:${process.env.ANNOUNCED_IP || "127.0.0.1"}:3478`
      },
      {
        urls: `turn:${process.env.ANNOUNCED_IP || "127.0.0.1"}:3478`,
        username: process.env.TURN_USERNAME || "",
        credential: process.env.TURN_CREDENTIAL || ""
      }
    ]
  }
};

let worker;
let router;
let plainTransport;
let producer;
let producerStatsInterval;

async function createPlainTransport() {
  try {
    if (plainTransport) {
      plainTransport.close();
    }

    plainTransport = await router.createPlainTransport({
      listenIp: {
        ip: "0.0.0.0",
        announcedIp: process.env.ANNOUNCED_IP || "127.0.0.1"
      },
      rtcpMux: true,
      comedia: true,
      port: 40000,
      enableSrtp: false,
      enableRtx: false
    });

    const rtpPort = plainTransport.tuple.localPort;
    const rtcpPort = plainTransport.rtcpTuple?.localPort || (rtpPort + 1);

    console.log('✅ PlainRtpTransport created:');
    console.log('   IP:', plainTransport.tuple.localIp);
    console.log('   RTP Port:', rtpPort);
    console.log('   RTCP Port:', rtcpPort);

    plainTransport.on('tuple', async (tuple) => {
      console.log("📡 Producer connected:", tuple);

      if (!producer || producer.closed) {
        try {
          producer = await plainTransport.produce({
            kind: "audio",
            rtpParameters: {
              codecs: [{
                mimeType: "audio/opus",
                payloadType: 111,
                clockRate: 48000,
                channels: 2,
                rtcpFeedback: [],
                parameters: {}
              }],
              encodings: [{
                ssrc: 11111111
              }]
            }
          });

          console.log("✅ Producer created:", producer.id);
          io.emit('producer-available', { producerId: producer.id });

          if (producerStatsInterval) {
            clearInterval(producerStatsInterval);
          }

          producerStatsInterval = setInterval(async () => {
            if (producer && !producer.closed) {
              try {
                const stats = await producer.getStats();
                const firstStat = stats[0];
                if (firstStat) {
                  console.log('📊 Producer stats:', {
                    packetsReceived: firstStat.packetsReceived || 0,
                    bytesReceived: firstStat.bytesReceived || 0,
                    packetsLost: firstStat.packetsLost || 0,
                    timestamp: new Date().toLocaleTimeString()
                  });
                }
              } catch (err) {
                // Silently ignore stats errors
              }
            } else {
              clearInterval(producerStatsInterval);
              producerStatsInterval = null;
            }
          }, 10000);

          producer.on("trackended", () => {
            console.log("🔚 Producer track ended");
            handleProducerDisconnection();
          });

          producer.on("transportclose", () => {
            console.log("🔌 Producer transport closed");
            handleProducerDisconnection();
          });

        } catch (error) {
          console.error("❌ Error creating producer:", error);
        }
      }
    });

    plainTransport.on('rtcptuple', (rtcpTuple) => {
      console.log("📡 RTCP connection established:", rtcpTuple);
    });

    plainTransport.on('close', () => {
      console.log("🔌 PlainTransport closed");
      handleProducerDisconnection();
    });

    plainTransport.on('error', (error) => {
      console.error("❌ PlainTransport error:", error);
    });

  } catch (error) {
    console.error("❌ Error creating PlainTransport:", error);
    throw error;
  }
}

function handleProducerDisconnection() {
  console.log("🔄 Handling producer disconnection...");

  if (producerStatsInterval) {
    clearInterval(producerStatsInterval);
    producerStatsInterval = null;
  }

  if (producer && !producer.closed) {
    producer.close();
  }
  producer = null;

  io.emit('producer-unavailable');

  console.log("🔄 Recreating PlainTransport for new connection...");
  setTimeout(async () => {
    try {
      await createPlainTransport();
      console.log("✅ PlainTransport recreated, ready for new connection");
    } catch (error) {
      console.error("❌ Error recreating PlainTransport:", error);
    }
  }, 1000);
}

(async () => {
  try {
    worker = await mediasoup.createWorker(mediasoupOptions.worker);
    console.log('✅ Worker created');

    router = await worker.createRouter({
      mediaCodecs: mediasoupOptions.router.mediaCodecs
    });
    console.log('✅ Router created');

    await createPlainTransport();

  } catch (error) {
    console.error("❌ Initialization error:", error);
    process.exit(1);
  }
})();

io.on("connection", async (socket) => {
  console.log("🔗 Client connected:", socket.id);

  socket.emit("router-rtp-capabilities", router.rtpCapabilities);

  if (producer && !producer.closed) {
    socket.emit('producer-available', { producerId: producer.id });
  }

  socket.on("createWebRtcTransport", async (data, callback) => {
    try {
      const webRtcTransport = await router.createWebRtcTransport(mediasoupOptions.webRtcTransport);

      console.log(`✅ WebRTC Transport created for ${socket.id}:`, webRtcTransport.id);

      callback({
        id: webRtcTransport.id,
        iceParameters: webRtcTransport.iceParameters,
        iceCandidates: webRtcTransport.iceCandidates,
        dtlsParameters: webRtcTransport.dtlsParameters
      });

      socket.webRtcTransport = webRtcTransport;

      webRtcTransport.on('dtlsstatechange', (dtlsState) => {
        console.log(`DTLS state: ${dtlsState} for ${socket.id}`);
        if (dtlsState === 'failed') {
          console.log(`❌ DTLS failed for ${socket.id}`);
        }
      });

      webRtcTransport.on('close', () => {
        console.log(`WebRTC Transport closed for ${socket.id}`);
      });

      webRtcTransport.on('error', (error) => {
        console.error(`❌ WebRTC Transport error for ${socket.id}:`, error);
      });

    } catch (err) {
      console.error("❌ createWebRtcTransport error:", err);
      callback({ error: err.message });
    }
  });

  socket.on("connectWebRtcTransport", async ({ dtlsParameters }, callback) => {
    try {
      await socket.webRtcTransport.connect({ dtlsParameters });
      console.log(`✅ WebRTC Transport connected for ${socket.id}`);
      callback({ success: true });
    } catch (err) {
      console.error("❌ connectWebRtcTransport error:", err);
      callback({ error: err.message });
    }
  });

  socket.on("consume", async ({ rtpCapabilities }, callback) => {
    if (!producer || producer.closed) {
      console.error("❌ Producer not available");
      callback({ error: "Producer not available" });
      return;
    }

    if (!router.canConsume({ producerId: producer.id, rtpCapabilities })) {
      console.error("❌ Cannot consume - incompatible RTP capabilities");
      callback({ error: "Cannot consume - incompatible RTP capabilities" });
      return;
    }

    try {
      const consumer = await socket.webRtcTransport.consume({
        producerId: producer.id,
        rtpCapabilities,
        paused: false
      });

      console.log(`✅ Consumer created for ${socket.id}:`, consumer.id);

      const consumerStatsInterval = setInterval(async () => {
        if (consumer && !consumer.closed) {
          try {
            const stats = await consumer.getStats();
            const firstStat = stats[0];
            if (firstStat && firstStat.packetsReceived > 0) {
              console.log(`📊 Consumer ${socket.id}:`, {
                packets: firstStat.packetsReceived,
                bytes: firstStat.bytesReceived,
                lost: firstStat.packetsLost || 0
              });
            }
          } catch (err) {
            // Silently ignore stats errors
          }
        } else {
          clearInterval(consumerStatsInterval);
        }
      }, 15000);

      consumer.on('close', () => {
        console.log(`🔌 Consumer closed for ${socket.id}`);
        clearInterval(consumerStatsInterval);
      });

      consumer.on('pause', () => {
        console.log(`⏸️ Consumer paused for ${socket.id}`);
      });

      consumer.on('resume', () => {
        console.log(`▶️ Consumer resumed for ${socket.id}`);
      });

      consumer.on('error', (error) => {
        console.error(`❌ Consumer error for ${socket.id}:`, error);
        clearInterval(consumerStatsInterval);
      });

      callback({
        id: consumer.id,
        kind: consumer.kind,
        rtpParameters: consumer.rtpParameters,
        producerId: producer.id
      });

      socket.consumer = consumer;

    } catch (err) {
      console.error("❌ consume error:", err);
      callback({ error: err.message });
    }
  });

  socket.on('recreate-plain-transport', async (callback) => {
    try {
      console.log("🔄 Forcing PlainTransport recreation by client request");
      await createPlainTransport();
      callback({ success: true });
    } catch (error) {
      console.error("❌ Error recreating PlainTransport:", error);
      callback({ error: error.message });
    }
  });

  socket.on('disconnect', () => {
    console.log(`🔌 Client disconnected: ${socket.id}`);
    if (socket.webRtcTransport) {
      socket.webRtcTransport.close();
      socket.webRtcTransport = null;
    }
    if (socket.consumer) {
      socket.consumer.close();
      socket.consumer = null;
    }
  });
});

server.listen(3000, '0.0.0.0', () => {
  console.log('🚀 Mediasoup server listening on 0.0.0.0:3000');
});
