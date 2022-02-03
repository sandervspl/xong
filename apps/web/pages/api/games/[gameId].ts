import type { NextApiRequest, NextApiResponse } from 'next';

import { sdk } from 'lib/fauna';


function isValidMethod(method?: string): method is 'GET' {
  return method === 'GET';
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const handlers = {
    async GET() {
      const game = await sdk.GetGameById({ id: req.query!.gameId as string });

      if (!game.findGameByID) {
        return res.send(null);
      }

      res.status(200).json(game.findGameByID);
    },
  };

  if (isValidMethod(req.method)) {
    const action = handlers[req.method];
    return await action();
  }

  return res.status(405).end();
}
