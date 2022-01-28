import type { GetStaticProps } from 'next';
import { useMutation } from 'react-query';
import axios from 'axios';

import type { GetUsersQuery } from 'faunadb/generated';
import { listUsers } from 'lib/fauna';
import { useRouter } from 'next/router';


type Props = {
  initialUsers: GetUsersQuery['users']['data'];
};

export default function Page(props: Props) {
  const router = useRouter();
  const mutation = useMutation((playerIds: string[]) => {
    return axios.post('/api/games', playerIds);
  });

  async function onPlayClick() {
    const userIds = props.initialUsers.map((user) => user?._id).filter(Boolean) as string[];

    if (userIds.length >= 2) {
      mutation.mutate([userIds[0], userIds[1]], {
        onSuccess(data) {
          router.push(`/game/${data.data._id}`);
        },
      });
    }
  }

  return (
    <main className="bg-secondary h-full grid grid-rows-3 place-items-center">
      <div>
        <h1 className="text-primary-900 text-9xl font-light">XONG</h1>
      </div>
      <div>
        <button className="fancy" onClick={onPlayClick}>
          <span className="text-secondary text-3xl">play</span>
        </button>
      </div>

      <div className="text-primary-900">
        {mutation.isLoading && <div>Creating game...</div>}
        {mutation.isError && <div>An error occurred: {(mutation.error as any).message}</div>}
        {mutation.isSuccess && <div>Game created!</div>}
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
