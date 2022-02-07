import http from 'http';
import type * as i from '@xong/types';
import * as c from '@xong/constants';
import express from 'express';
import cors from 'cors';
import { Server } from 'socket.io';

import { getGame, getPlayer, state } from './state';
import queueActions from './queue';
import gameActions from './game';
import createAPI from './api';


const CORS_DOMAIN_LIST = [
  'http://localhost:3000',
  'https://develop--xong.netlify.app',
  'https://xong.netlify.app',
  'https://xong-git-develop-sandervspl.vercel.app',
  'https://xong-sandervspl.vercel.app',
];


const app = express();
app.use(cors({
  origin: CORS_DOMAIN_LIST,
}));

createAPI(app);

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: CORS_DOMAIN_LIST,
    credentials: true,
  },
});

io.on('connect', (socket) => {
  // console.info('a user connected', socket.id);

  socket.on('disconnect', () => {
    // console.info(socket.id, 'disconnected');
    state.queue = state.queue.filter((val) => val.socket.id !== socket.id);

    for (const plr of Object.values(state.players)) {
      if (plr.socketId === socket.id) {
        getPlayer(plr.id).setState((draft) => {
          draft.connected = false;
          draft.socketId = '';
        });

        socket.leave(plr.gameId);
        socket.to(plr.gameId).emit(c.PLAYER_CONNECT_UPDATE, {
          userId: plr.id,
          connected: false,
        });
      }
    }
  });

  queueActions(socket);
  gameActions(socket, io);
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.info(`listening on ${PORT}`);
});
