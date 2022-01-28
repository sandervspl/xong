import type { NextApiRequest, NextApiResponse } from 'next';
import { Server } from 'socket.io';


export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const socket = res.socket as any;

  if (!socket?.server?.io) {
    console.info('Starting socket.io server...');

    const io = new Server(socket.server);

    io.on('connection', (socket) => {
      socket.broadcast.emit('User connected');
    });

    (res.socket! as any).server.io = io;
  } else {
    console.info('Socket.io server is already running');
  }

  res.end();
}

export const config = {
  api: {
    bodyParser: false,
  },
};
