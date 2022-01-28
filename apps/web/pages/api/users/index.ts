import type { NextApiRequest, NextApiResponse } from 'next';

import { listUsers, createUser } from 'lib/fauna';


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
      const created = await createUser(req.body);
      res.status(200).json(created);
    },
  };

  if (isValidMethod(req.method)) {
    const action = handlers[req.method];
    return await action();
  }

  return res.status(405).end();
}
