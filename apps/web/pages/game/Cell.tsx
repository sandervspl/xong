import * as React from 'react';
import classNames from 'classnames';
import { useRouter } from 'next/router';

import useSocketIO from 'hooks/useSocketIO';
import useLocalStorage from 'hooks/userLocalStorage';


const Cell: React.VFC<Props> = (props) => {
  const { query } = useRouter();
  const socket = useSocketIO();
  const { getItem } = useLocalStorage();
  const user = getItem('usernames')?.find((val) => val.active);

  function handleClick() {
    socket?.emit('player-select-cell', {
      gameId: query.gameId,
      userId: user?.id,
      selected: props.cellId,
    });
  }

  return (
    <button
      className={classNames(
        'absolute bg-primary-200 border-2 border-solid border-secondary',
        {
          'opacity-0': !props.isSelected,
          'hover:opacity-50': !props.isSelected,
        },
        {
          'bg-primary-400': props.isSelected,
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
  isSelected: boolean;
};

export default Cell;
