import type { NextApiRequest, NextApiResponse } from 'next';

import { listUsers, sdk } from 'lib/fauna';


function isValidMethod(method?: string): method is 'GET' | 'POST' {
  return method === 'GET' || method === 'POST';
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const handlers = {
    async GET() {
      const users = await listUsers();
      res.status(200).json(users);
    },

    async POST() {
      const findUser = await sdk.GetUserByUsername({ username: req.body.username });
      if (findUser.findUserByUsername) {
        return res.status(200).json(findUser.findUserByUsername);
      }

      const result = await sdk.CreateUser({
        data: {
          username: req.body.username,
        },
      });
      return res.status(200).json(result.createUser);
    },
  };

  if (isValidMethod(req.method)) {
    const action = handlers[req.method];
    return await action();
  }

  return res.status(405).end();
}
