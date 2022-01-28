import type { GetStaticProps } from 'next';
import useSWR from 'swr';

import type { GetUsersQuery } from 'faunadb/generated';

import { listUsers } from '../lib/fauna';


const fetcher = (url: string) => fetch(url).then((res) => res.json());

type Props = {
  initialUsers: GetUsersQuery;
};

export default function Page(props: Props) {
  const { data: users } = useSWR<GetUsersQuery>('/api/users', fetcher);

  return (
    <main className="bg-secondary h-full grid grid-rows-3 place-items-center">
      <div>
        <h1 className="text-primary-900 text-9xl font-light">XONG</h1>
      </div>
      <div>
        <button className="fancy">
          <span className="text-secondary text-3xl">play</span>
        </button>
      </div>

      <pre className="text-primary-900">
        {JSON.stringify(users, null, 2)}
      </pre>
    </main>
  );
}

export const getStaticProps: GetStaticProps = async () => {
  return {
    props: {
      initualUsers: await listUsers(),
    },
    revalidate: 1,
  };
};
