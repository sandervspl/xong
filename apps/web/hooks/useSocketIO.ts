import React from 'react';
import type { Socket } from 'socket.io-client';
import { connect } from 'socket.io-client';


function useSocketIO() {
  const [ioClient, setIoClient] = React.useState<Socket | null>(null);

  React.useEffect(() => {
    const socket = connect(process.env.NEXT_PUBLIC_WEBSOCKET_URL!);

    socket.on('connect', () => {
      console.info('connected!');
    });

    setIoClient(socket);
  }, []);

  return ioClient;
}

export default useSocketIO;
