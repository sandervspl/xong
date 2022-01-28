import * as React from 'react';
import { useMutation } from 'react-query';
import axios from 'axios';


export default function Page() {
  const gamesMutation = useMutation((playerIds: string[]) => {
    return axios.post('/api/games', playerIds);
  });
  const userMutation = useMutation((username: string) => {
    return axios.post('/api/users', { username });
  });
  const [username, setUsername] = React.useState('');

  async function onPlayClick() {
    if (gamesMutation.isLoading || gamesMutation.isSuccess) {
      return;
    }

    // - Create user als dat nodig is
    userMutation.mutate(username, {
      onSuccess(data) {
        console.log(data);
      },
    });
    // - Get waiting rooms
    // - Voeg user toe aan waiting room
    // - Als er 2 mensen wachten, start game
    // - Clear waiting room

    // const userIds = props.initialUsers.map((user) => user?._id).filter(Boolean) as string[];

    // if (userIds.length >= 2) {
    //   gamesMutation.mutate([userIds[0], userIds[1]], {
    //     onSuccess(data) {
    //       router.push(`/game/${data.data._id}`);
    //     },
    //   });
    // }
  }

  return (
    <main className="bg-secondary h-full grid grid-rows-3 place-items-center text-base">
      <div>
        <h1 className="text-primary-500 text-9xl font-light">XONG</h1>
      </div>
      <div className="flex flex-col text-base">
        <input
          className="h-8 rounded-lg p-5 text-1xl text-secondary bg-gray-300 placeholder-gray-400 focus:outline-primary-300"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.currentTarget.value)}
        />

        <div className="h-5" aria-hidden="true" />

        <button className="fancy" onClick={onPlayClick}>
          <span className="text-secondary text-3xl">play</span>
        </button>
      </div>

      <div className="text-primary-500">
        {gamesMutation.isLoading && <div>Creating game...</div>}
        {gamesMutation.isError && <div>An error occurred: {(gamesMutation.error as any).message}</div>}
        {gamesMutation.isSuccess && <div>Game created!</div>}
      </div>
    </main>
  );
}
