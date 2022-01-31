import * as React from 'react';
import axios from 'axios';
import { useMutation } from 'react-query';
import { useRouter } from 'next/router';

import type { GetUserByUsernameQuery } from 'faunadb/generated';
import { SocketIOContext } from 'lib/SocketIOContext';
import useLocalStorage from 'hooks/userLocalStorage';


export default function Page() {
  const router = useRouter();
  const io = React.useContext(SocketIOContext);
  const { getItem, setItem, updateItem } = useLocalStorage();
  const userMutation = useMutation((username: string) => {
    setError('');
    return axios.post<UserCreateResponse>('/api/users', { username });
  });
  const [username, setUsername] = React.useState(
    getItem('usernames')?.find((v) => v.active)?.name || '',
  );
  const [waitState, setWaitState] = React.useState<WaitStates>(null);
  const [error, setError] = React.useState('');


  async function onPlayClick() {
    // Create user if necessary
    userMutation.mutate(username, {
      async onSuccess(response) {
        const { data } = response;
        const { user } = data;

        if (user == null) {
          return console.error('No user returned from API');
        }

        const isLocalSavedUser = getItem('usernames')?.find((v) => v.id === user._id);
        if (data.existed && !isLocalSavedUser) {
          return setError('This username already exists and/or is not yours. Please try another name!');
        }

        // Save to localStorage
        if (!getItem('usernames')) {
          setItem('usernames', []);
        }
        updateItem('usernames', (draft) => {
          draft!.push({
            name: user.username,
            id: user._id,
            active: true,
          });

          return draft;
        });

        // Add user to waiting room
        io?.emit('queue', user._id);
        setWaitState('waiting');

        console.info('Waiting for game...');

        // Listen to game creation updates
        io?.on('game-ready', (data) => {
          console.info('game ready!', data);
          setWaitState('ready');
        });

        // Game ready, navigate to game
        io?.on('game-created', (gameId) => {
          setWaitState('created');

          setTimeout(() => {
            router.push(`/game/${gameId}`);
          }, 1000);
        });
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
        {error && <p className="text-red-500">{error}</p>}

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

type UserCreateResponse = {
  user: GetUserByUsernameQuery['findUserByUsername'];
  existed: boolean;
};

type WaitStates = null | 'waiting' | 'ready' | 'created';
