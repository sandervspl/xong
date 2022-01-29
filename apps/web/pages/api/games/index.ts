import type { NextApiRequest, NextApiResponse } from 'next';

import { createGame } from 'lib/fauna';


function isValidMethod(method?: string): method is 'GET' | 'POST' {
  return method === 'GET' || method === 'POST';
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const handlers = {
    // Get all games?
    async GET() {
      res.status(200).json({});
    },

    // Create game
    async POST() {
      const game = await createGame(req.body);
      res.status(200).json(game);
    },
  };

  if (isValidMethod(req.method)) {
    const action = handlers[req.method];
    return await action();
  }

  return res.status(405).end();
}
