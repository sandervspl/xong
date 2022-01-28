import http from 'http';
import express from 'express';
import cors from 'cors';
import { Server } from 'socket.io';

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: [
      'http://localhost:3000',
      'https://develop--xong.netlify.app/',
      'https://xong.netlify.app/',
    ],
    credentials: true,
  },
});

const state = new Set();

app.get('/', (req, res) => {
  res.send('<h1>Hello world</h1>');
});

io.on('connection', (socket) => {
  console.info('a user connected');

  socket.on('queue', (data) => {
    state.add(data);
    console.info([...state]);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.info(`listening on ${PORT}`);
});
