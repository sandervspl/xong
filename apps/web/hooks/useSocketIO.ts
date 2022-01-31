import React from 'react';
import type { Socket } from 'socket.io-client';
import { connect } from 'socket.io-client';


function useSocketIO() {
  const [ioClient, setIoClient] = React.useState<Socket | null>(null);

  React.useEffect(() => {
    // Get socket.io connection on client started
    const socket = connect(process.env.NEXT_PUBLIC_WEBSOCKET_URL!);

    socket.on('connect', () => {
      console.info('connected to socket server!');
    });

    setIoClient(socket);
  }, []);

  return ioClient;
}

export default useSocketIO;
