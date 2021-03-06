import { connect } from 'socket.io-client';

import isServer from 'utils/isServer';


// Get socket.io connection on client started
const socket = connect(process.env.NEXT_PUBLIC_WEBSOCKET_URL!);

if (!isServer) {
  socket.on('connect', () => {
    console.info('connected to socket server!');
  });
}

export default socket;
