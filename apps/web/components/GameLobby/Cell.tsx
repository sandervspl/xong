import * as React from 'react';
import * as c from '@xong/constants';
import classNames from 'classnames';
import { useRouter } from 'next/router';

import socket from 'lib/websocket';
import useLocalStorage from 'hooks/userLocalStorage';

import type { GameStateClientGame } from '../../pages/game/[gameId]';


const Cell: React.VFC<Props> = (props) => {
  const { query } = useRouter();
  const { getItem } = useLocalStorage();
  const user = getItem('usernames')?.find((val) => val.active);
  const cellData = props.gameState?.xoState.get(props.cellId);
  const isUserTurn = props.userIsPlayer && props.gameState?.turn === user?.id;
  const isPickPhase = props.gameState?.playState === 'playing'
    && props.gameState?.phase === 'xo'
    && isUserTurn;

  function handleClick() {
    if (isPickPhase) {
      socket.emit(c.PLAYER_SELECT_CELL, {
        gameId: query.gameId,
        userId: user?.id,
        cellId: props.cellId,
      });
    }
  }

  return (
    <button
      id={props.cellId}
      className={classNames(
        'absolute border-2 border-solid border-secondary text-[10em] text-secondary',
        {
          'opacity-0': !cellData?.state || cellData?.state !== 'selected',
          'hover:opacity-50': !cellData?.state || cellData?.state !== 'selected',
          'opacity-75': cellData?.state === 'captured',
        },
        {
          'bg-player-1': cellData?.state === 'captured'
            ? cellData?.user === props.gameState?.players[1]
            : props.gameState?.turn === props.gameState?.players[1],
        },
        {
          'bg-player-2': cellData?.state === 'captured'
            ? cellData?.user === props.gameState?.players[2]
            : props.gameState?.turn === props.gameState?.players[2],
        },
        { 'pointer-events-none': !isPickPhase || cellData?.state === 'captured' },
      )}
      style={{
        top: props.y + 4 + 'px',
        left: props.x + 4 + 'px',
        width: Number(process.env.NEXT_PUBLIC_GAME_XO_SQUARE_SIZE) - 4 + 'px',
        height: Number(process.env.NEXT_PUBLIC_GAME_XO_SQUARE_SIZE) - 4 + 'px',
        lineHeight: Number(process.env.NEXT_PUBLIC_GAME_XO_SQUARE_SIZE) + 'px', // Center text
      }}
      onClick={handleClick}
    >
      {cellData?.state === 'captured' ? cellData.mark : null}
    </button>
  );
};

export type Props = {
  x: number;
  y: number;
  cellId: string;
  gameState?: GameStateClientGame;
  userIsPlayer: boolean;
};

export default Cell;
