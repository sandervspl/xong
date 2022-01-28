import React from 'react';
import axios from 'axios';
import type { Socket } from 'socket.io-client';
import { io } from 'socket.io-client';


function useSocketIO() {
  const [ioClient, setIoClient] = React.useState<Socket | null>(null);

  React.useEffect(() => {
    axios.get('/api/socketio').finally(() => {
      const socket = io();

      socket.on('connect', () => {
        console.info('Connected!');
      });

      socket.on('disconnect', () => {
        console.info('Disconnect!');
      });

      setIoClient(socket);
    });
  }, []);

  return ioClient;
}

export default useSocketIO;
