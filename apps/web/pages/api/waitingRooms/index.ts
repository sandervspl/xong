import type { NextApiRequest, NextApiResponse } from 'next';
import type { Server } from 'socket.io';

import { sdk } from 'lib/fauna';


function isValidMethod(method?: string): method is 'GET' | 'POST' {
  return method === 'GET' || method === 'POST';
}

const state = new Set<string>();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const handlers = {
    async GET() {
      const result = await sdk.GetWaitingRooms();
      res.status(200).json(result.waitingRooms.data);
    },

    async POST() {
      const body = req.body as { id: string };

      // const { waitingRooms } = await sdk.GetWaitingRooms();
      // const room = waitingRooms.data[0];

      // if (!room) {
      //   return res.status(500).json({
      //     error: 500,
      //     message: 'Could not find waiting room at index 0',
      //   });
      // }

      // const result = await sdk.UpdateWaitingRoom({
      //   id: room._id,
      //   data: {
      //     players: {
      //       connect: room.players.data
      //         .map((user) => user!._id)
      //         .filter(Boolean)
      //         .concat(body.id),
      //     },
      //   },
      // });

      state.add(body.id);
      console.log({ state });

      const io = (res.socket! as any).server.io as Server;

      if (state.size >= 2) {
        const [p1, p2] = [...state];
        state.delete(p1);
        state.delete(p2);
        io.emit(`game-ready-${p1}`, 'Game ready!');
        io.emit(`game-ready-${p2}`, 'Game ready!');

        console.log({ state });
      }

      res.status(200).json({});

      // res.status(200).json(result.updateWaitingRoom);
    },
  };

  if (isValidMethod(req.method)) {
    const action = handlers[req.method];
    return await action();
  }

  return res.status(405).end();
}
