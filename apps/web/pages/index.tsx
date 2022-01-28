import type { GetStaticProps } from 'next';

import type { GetUsersQuery } from 'faunadb/generated';
import { listUsers } from 'lib/fauna';


type Props = {
  initialUsers: GetUsersQuery['users']['data'];
};

export default function Page(props: Props) {
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
        {JSON.stringify(props.initialUsers, null, 2)}
      </pre>
    </main>
  );
}

export const getStaticProps: GetStaticProps<Props> = async () => {
  const users = await listUsers();

  return {
    props: {
      initialUsers: users,
    },
    revalidate: 1,
  };
};
