import { useEffect, useState, useRef } from "react";
import { io } from "socket.io-client";
import * as mediasoupClient from "mediasoup-client";

export default function RadioPlayer({ children }) {
  const [playStream, setPlayStream] = useState(null);

  const socketRef = useRef(null);
  const deviceRef = useRef(null);
  const recvTransportRef = useRef(null);
  const consumerRef = useRef(null);

  useEffect(() => {
    let isComponentMounted = true;

    const run = async () => {
      try {
        const socketUrl = import.meta.env.VITE_SOCKET_IO_URL || (window.location.origin + '/socket.io');
          const socket = io(socketUrl, { 
              path: "/socket.io",
              transports: ["websocket"],
              timeout: 10000,   
        });
        socketRef.current = socket;

        socket.on("router-rtp-capabilities", async (rtpCapabilities) => {
          if (!isComponentMounted) return;
          try {
            const device = new mediasoupClient.Device();
            deviceRef.current = device;
            await device.load({ routerRtpCapabilities: rtpCapabilities });

            await createTransportAndConsumer(socket, device);
          } catch {
            
          }
        });

        socket.on('producer-available', async () => {
          if (deviceRef.current && recvTransportRef.current && !consumerRef.current) {
            await createConsumer(socket, deviceRef.current);
          }
        });

        socket.on('producer-unavailable', () => {
          setPlayStream(null);
          if (consumerRef.current) {
            consumerRef.current.close();
            consumerRef.current = null;
          }
        });

      } catch (error) {
        
      }
    };

    const createTransportAndConsumer = async (socket, device) => {
      return new Promise((resolve, reject) => {
        socket.emit("createWebRtcTransport", {}, async (transportData) => {
          if (transportData.error) {
            reject(new Error(transportData.error));
            return;
          }
          try {
            const recvTransport = device.createRecvTransport({
            id: transportData.id,
            iceParameters: transportData.iceParameters,
            iceCandidates: transportData.iceCandidates,
            dtlsParameters: transportData.dtlsParameters,
            sctpParameters: transportData.sctpParameters,
            iceServers: [

              { urls: import.meta.env.VITE_STUN_SERVER },
              

              { 
                urls: import.meta.env.VITE_TURN_SERVER,
                username: import.meta.env.VITE_TURN_USERNAME || 'your-username',
                credential: import.meta.env.VITE_TURN_CREDENTIAL || 'your-password',
              },
              
              { urls: "stun:stun.l.google.com:19302" }
            ],

            iceTransportPolicy: 'all' 
          });

recvTransportRef.current = recvTransport;

            recvTransport.on("connect", ({ dtlsParameters }, callback, errback) => {
              socket.emit("connectWebRtcTransport", { dtlsParameters }, (response) => {
                if (response?.error) {
                  errback(new Error(response.error));
                } else {
                  callback();
                }
              });
            });

            await createConsumer(socket, device);
            resolve();
          } catch (err) {
            reject(err);
          }
        });
      });
    };

    const createConsumer = async (socket, device) => {
      return new Promise((resolve, reject) => {
        socket.emit("consume", { rtpCapabilities: device.rtpCapabilities }, async (data) => {
          if (data.error || !data.producerId) {
            reject(new Error(data.error || "No producerId"));
            return;
          }

          try {
            const consumer = await recvTransportRef.current.consume({
              id: data.id,
              producerId: data.producerId,
              kind: data.kind,
              rtpParameters: data.rtpParameters
            });

            consumerRef.current = consumer;

            const stream = new MediaStream();
            stream.addTrack(consumer.track);

            if (isComponentMounted) {
              setPlayStream(stream);
            }

            consumer.on('transportclose', () => {
              setPlayStream(null);
            });

            consumer.on('trackended', () => {
              setPlayStream(null);
            });

            resolve();
          } catch (err) {
            reject(err);
          }
        });
      });
    };

    run();

    return () => {
      isComponentMounted = false;
      if (consumerRef.current) {
        consumerRef.current.close();
        consumerRef.current = null;
      }
      if (recvTransportRef.current) {
        recvTransportRef.current.close();
        recvTransportRef.current = null;
      }
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      setPlayStream(null);
    };
  }, []);

  return children({ playStream });
}

