import * as React from 'react';
import axios from 'axios';
import { useMutation } from 'react-query';
import { useRouter } from 'next/router';

import type { GetUserByUsernameQuery } from 'faunadb/generated';
import { SocketIOContext } from 'lib/SocketIOContext';


type UserCreateResponse = GetUserByUsernameQuery['findUserByUsername'];

export default function Page() {
  const router = useRouter();
  const io = React.useContext(SocketIOContext);
  const gamesMutation = useMutation((playerIds: string[]) => {
    return axios.post('/api/games', playerIds);
  });
  const userMutation = useMutation((username: string) => {
    return axios.post<UserCreateResponse>('/api/users', { username });
  });
  const [username, setUsername] = React.useState('');
  const [waiting, setWaiting] = React.useState(false);
  const [userId, setUserId] = React.useState('');


  React.useEffect(() => {
    if (io && userId) {
      console.info('Waiting for game...');

      io.on('game-ready', (data) => {
        console.info('game ready!', data);
        setWaiting(false);
        router.push('/game/322041539697050185');
      });
    }
  }, [userId, io]);

  async function onPlayClick() {
    if (gamesMutation.isLoading || gamesMutation.isSuccess) {
      return;
    }

    // - Create user if necessary
    userMutation.mutate(username, {
      async onSuccess(user) {
        if (!user.data) {
          return console.error('No user returned from API');
        }

        // - Add user to waiting room
        io?.emit('queue', user.data._id);
        setUserId(user.data._id);
        setWaiting(true);
      },
    });
  }

  return (
    <main className="bg-secondary h-full grid grid-rows-3 place-items-center text-base">
      <div>
        <h1 className="text-primary-500 text-9xl font-light">XONG</h1>
      </div>
      <div className="flex flex-col text-base">
        <input
          className="h-8 rounded-lg p-5 text-xl text-secondary bg-gray-300 placeholder-gray-400 focus:outline-primary-300"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.currentTarget.value)}
          disabled={waiting}
        />

        <div className="h-5" aria-hidden="true" />

        <button className="fancy" onClick={onPlayClick} disabled={waiting}>
          <span className="text-secondary text-3xl">play</span>
        </button>
      </div>

      <div className="text-primary-500 text-2xl">
        {waiting && <p>Waiting for an opponent...</p>}
        {gamesMutation.isLoading && <p>Creating game...</p>}
        {gamesMutation.isError && <p>An error occurred: {(gamesMutation.error as any).message}</p>}
        {gamesMutation.isSuccess && <p>Game created!</p>}
      </div>
    </main>
  );
}
