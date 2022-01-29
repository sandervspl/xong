import * as React from 'react';
import axios from 'axios';
import { useMutation } from 'react-query';
import { useRouter } from 'next/router';

import type { GetUserByUsernameQuery } from 'faunadb/generated';
import { SocketIOContext } from 'lib/SocketIOContext';


type UserCreateResponse = GetUserByUsernameQuery['findUserByUsername'];
type WaitStates = null | 'waiting' | 'ready' | 'created';

export default function Page() {
  const router = useRouter();
  const io = React.useContext(SocketIOContext);
  const userMutation = useMutation((username: string) => {
    return axios.post<UserCreateResponse>('/api/users', { username });
  });
  const [username, setUsername] = React.useState('');
  const [waitState, setWaitState] = React.useState<WaitStates>(null);
  const [userId, setUserId] = React.useState('');


  React.useEffect(() => {
    if (io && userId) {
      console.info('Waiting for game...');

      io.on('game-ready', (data) => {
        console.info('game ready!', data);
        setWaitState('ready');
      });

      io.on('game-created', (gameId) => {
        setWaitState('created');

        setTimeout(() => {
          router.push(`/game/${gameId}`);
        }, 1000);
      });
    }
  }, [userId, io]);

  async function onPlayClick() {
    // - Create user if necessary
    userMutation.mutate(username, {
      async onSuccess(user) {
        if (!user.data) {
          return console.error('No user returned from API');
        }

        // - Add user to waiting room
        io?.emit('queue', user.data._id);
        setUserId(user.data._id);
        setWaitState('waiting');
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
          disabled={waitState != null}
        />

        <div className="h-5" aria-hidden="true" />

        <button
          className="fancy"
          onClick={onPlayClick}
          disabled={waitState != null}
        >
          <span className="text-secondary text-3xl">play</span>
        </button>
      </div>

      <div className="text-primary-500 text-2xl">
        {waitState === 'waiting' && <p>Waiting for an opponent...</p>}
        {waitState === 'ready' && <p>Opponent found! Creating game...</p>}
        {waitState === 'created' && <p>Game created! Get ready!</p>}
      </div>
    </main>
  );
}
