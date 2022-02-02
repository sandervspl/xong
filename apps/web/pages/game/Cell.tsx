import * as React from 'react';
import classNames from 'classnames';
import { useRouter } from 'next/router';

import type { GameState } from 'pages/game/[gameId]';
import socket from 'lib/websocket';
import useLocalStorage from 'hooks/userLocalStorage';


const Cell: React.VFC<Props> = (props) => {
  const { query } = useRouter();
  const { getItem } = useLocalStorage();
  const user = getItem('usernames')?.find((val) => val.active);
  const isSelected = props.gameState?.selected === props.cellId;

  function handleClick() {
    socket.emit('player-select-cell', {
      gameId: query.gameId,
      userId: user?.id,
      selected: props.cellId,
    });
  }

  return (
    <button
      className={classNames(
        'absolute border-2 border-solid border-secondary',
        {
          'opacity-0': !isSelected,
          'hover:opacity-50': !isSelected,
          'bg-player-1': props.gameState?.turn === props.gameState?.players[1],
          'bg-player-2': props.gameState?.turn === props.gameState?.players[2],
        },
      )}
      style={{
        top: props.y + 4 + 'px',
        left: props.x + 4 + 'px',
        width: Number(process.env.NEXT_PUBLIC_GAME_XO_SQUARE_SIZE) - 4 + 'px',
        height: Number(process.env.NEXT_PUBLIC_GAME_XO_SQUARE_SIZE) - 4 + 'px',
      }}
      onClick={handleClick}
    />
  );
};

export type Props = {
  x: number;
  y: number;
  cellId: string;
  gameState?: GameState;
};

export default Cell;
