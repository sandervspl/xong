import type { Socket } from 'socket.io';

import type { CellId, GameState, PlayerState, XoState } from './state';


export const socketMock = {
  emit(a, b) {
    // console.log('emit', a, b);
  },
  join(a) {
    // console.log('join', a);
  },
  handshake: {
    headers: {
      origin: 'http://localhost:3000',
    },
  },
} as Socket;

export const xoStateInit = new Map<string, XoState>();
for (let x = 0; x < 3; x++) {
  for (let y = 0; y < 3; y++) {
    const cellId = '' + x + y;
    xoStateInit.set(cellId, {
      cellId,
      mark: null,
      state: null,
      user: null,
    });
  }
}

// xoStateInit.set('00', {
//   cellId: '00',
//   mark: 'o',
//   state: 'captured',
//   user: '322526166267200076',
// });
// xoStateInit.set('02', {
//   cellId: '02',
//   mark: 'o',
//   state: 'captured',
//   user: '322526166267200076',
// });
// xoStateInit.set('11', {
//   cellId: '02',
//   mark: 'o',
//   state: 'captured',
//   user: '322526166267200076',
// });
// xoStateInit.set('20', {
//   cellId: '02',
//   mark: 'o',
//   state: 'captured',
//   user: '322526166267200076',
// });

export const gameMock = new Map<string, GameState>().set('322573768640692812', {
  id: '322573768640692812',
  phase: 'xo',
  playState: 'waiting_for_players',
  players: {
    1: '322304205897335372',
    2: '322526166267200076',
  },
  turn: '322304205897335372',
  xoState: xoStateInit,
  ball: {
    position: { x: -100, y: -100 },
    speed: { x: 0, y: 0 },
  },
  winner: null,
});

export const mockPlayers = new Map<string, PlayerState>();
mockPlayers.set('322304205897335372', {
  id: '322304205897335372',
  connected: false,
  direction: null,
  gameId: '322573768640692812',
  mark: 'x',
  socketId: '',
  y: 0,
});
mockPlayers.set('322526166267200076', {
  id: '322526166267200076',
  connected: false,
  direction: null,
  gameId: '322573768640692812',
  mark: 'o',
  socketId: '',
  y: 0,
});
