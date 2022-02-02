import type { Socket } from 'socket.io-client';

import type { StoredUser } from 'hooks/userLocalStorage.js';

import { theme } from '../tailwind.config.js';


const PLR_WIDTH = Number(process.env.NEXT_PUBLIC_GAME_PLR_WIDTH);
const PLR_HEIGHT = Number(process.env.NEXT_PUBLIC_GAME_PLR_HEIGHT);
const FIELD_MARGIN = Number(process.env.NEXT_PUBLIC_GAME_FIELD_MARGIN);
const FIELD_WIDTH = Number(process.env.NEXT_PUBLIC_GAME_FIELD_WIDTH);
const FIELD_HEIGHT = Number(process.env.NEXT_PUBLIC_GAME_FIELD_HEIGHT);
const XO_SQUARE_SIZE = Number(process.env.NEXT_PUBLIC_GAME_XO_SQUARE_SIZE);
const VELOCITY = Number(process.env.NEXT_PUBLIC_GAME_VELOCITY);

class Game {
  #canvas: HTMLCanvasElement;
  #ctx: CanvasRenderingContext2D;
  #players: Record<string, ClientPlayerState>;
  #user?: StoredUser;
  #keysPressed: Record<string, boolean> = {};
  #socket: Socket;
  #userIsPlayer: boolean;
  gameState: GameState;
  cells: { x: number; y: number; cellId: string }[] = [];

  constructor(
    socket: Socket,
    gameState: GameState,
    playersState: Record<UserId, ServerPlayerState>,
    user: StoredUser | undefined,
    userIsPlayer: boolean,
  ) {
    this.gameState = gameState;
    this.#canvas = document.getElementById('game') as HTMLCanvasElement;
    this.#ctx = this.#canvas.getContext('2d')!;
    this.#socket = socket;
    this.#user = user;
    this.#userIsPlayer = userIsPlayer;

    this.#players = Object.entries(playersState).reduce((acc, [plrId, plrState], i) => {
      let x: number;
      if (i === 0) {
        x = FIELD_MARGIN;
      } else {
        x = FIELD_WIDTH - PLR_WIDTH - FIELD_MARGIN;
      }

      acc[plrId] = {
        id: plrId,
        x,
        y: plrState.y,
        direction: plrState.direction,
        width: PLR_WIDTH,
        height: PLR_HEIGHT,
        mark: plrState.mark,
      };

      return acc;
    }, {});

    // Only give players of this game keyboard controls
    if (userIsPlayer) {
      document.addEventListener('keydown', this.#onKeyDown);
      document.addEventListener('keyup', this.#onKeyUp);
    }

    socket.on('player-key-down', (data: PlayerKeypressData) => {
      this.#players[data.userId].direction = data.direction;
    });

    socket.on('player-key-up', (data: PlayerKeypressUpData) => {
      this.#players[data.userId].direction = data.direction;
      this.#players[data.userId].y = data.y;
    });

    this.#drawXOField();
    this.#tick();
  }

  unload = () => {
    document.removeEventListener('keydown', this.#onKeyDown);
    document.removeEventListener('keyup', this.#onKeyUp);
  };

  start = () => {
    // this.#tick();
  };

  getPlayer = (userId?: string) => {
    if (userId == null) {
      return;
    }

    return this.#players[userId];
  };

  #onKeyDown = (e: KeyboardEvent) => {
    const key = e.key.toLowerCase();

    if (this.#keysPressed[key]) {
      return;
    }

    this.#keysPressed[key] = true;

    if (this.#user) {
      // console.log('emit down');
      this.#socket.emit('player-key-down', {
        gameId: this.gameState.id,
        userId: this.#user.id,
        key,
      });
    }
  };

  #onKeyUp = (e: KeyboardEvent) => {
    const key = e.key.toLowerCase();
    this.#keysPressed[key] = false;

    if (this.#user) {
      this.#socket.emit('player-key-up', {
        gameId: this.gameState.id,
        userId: this.#user.id,
        y: this.#players[this.#user.id].y,
        key,
      });
    }
  };

  #updatePositions = () => {
    for (const playerId of Object.keys(this.#players)) {
      let next = this.#players[playerId].y;

      if (this.#players[playerId].direction === 'up') {
        next = this.#players[playerId].y - VELOCITY;
      }

      if (this.#players[playerId].direction === 'down') {
        next = this.#players[playerId].y + VELOCITY;
      }

      if (next >= 0 && next <= FIELD_HEIGHT - PLR_HEIGHT) {
        this.#players[playerId].y = next;
      }
    }
  };

  #drawXOField = () => {
    const CELL_SIZE = XO_SQUARE_SIZE;
    const Mx = this.#canvas.width / 2;
    const My = this.#canvas.height / 2;
    const L1x = Mx - (CELL_SIZE / 2);
    const L1y = My - ((CELL_SIZE / 2) * 3);
    const L2x = Mx + (CELL_SIZE / 2);
    const L2y = L1y;
    const L3x = Mx - ((CELL_SIZE / 2) * 3);
    const L3y = My - (CELL_SIZE / 2);
    const L4x = L3x;
    const L4y = My + (CELL_SIZE / 2);

    if (this.cells.length === 0) {
      for (let x = 0; x < 3; x++) {
        for (let y = 0; y < 3; y++) {
          const CellX = L3x + (CELL_SIZE * x);
          const CellY = L1y + (CELL_SIZE * y);

          this.cells.push({
            x: CellX,
            y: CellY,
            cellId: '' + x + y,
          });
        }
      }
    }

    for (const [d, x, y] of [
      [0, L1x, L1y],
      [0, L2x, L2y],
      [1, L3x, L3y],
      [1, L4x, L4y],
    ]) {
      this.#ctx.beginPath();
      this.#ctx.lineWidth = 2;
      this.#ctx.strokeStyle = theme.extend.colors.primary[900];
      this.#ctx.moveTo(x, y);
      if (d) {
        this.#ctx.lineTo(x + (CELL_SIZE * 3), y);
      } else {
        this.#ctx.lineTo(x, y + (CELL_SIZE * 3));
      }
      this.#ctx.stroke();
    }
  };

  #drawPlayers = () => {
    let i = 1;
    for (const playerId of Object.keys(this.#players)) {
      this.#ctx.fillStyle = theme.extend.colors.player[i++];
      this.#ctx.fillRect(
        this.#players[playerId].x,
        this.#players[playerId].y,
        this.#players[playerId].width,
        this.#players[playerId].height,
      );
    }
  };

  #draw = () => {
    this.#ctx.clearRect(0, 0, this.#canvas.width, this.#canvas.height);
    this.#drawXOField();
    this.#drawPlayers();
  };

  #tick = () => {
    this.#updatePositions();
    this.#draw();
    requestAnimationFrame(this.#tick);
  };
}

export type GameId = string;
export type UserId = string;
type Direction = 'up' | 'down' | null;
type Mark = 'x' | 'o';

export type GameState = {
  id: GameId;
  selected: string;
  turn: string;
  playState: 'waiting_for_players' | 'playing' | 'paused' | 'finished';
  phase: 'picking' | 'cell_attempt';
  players: { 1: UserId; 2: UserId };
};

export type ServerPlayerState = {
  id: UserId;
  y: number;
  direction: Direction;
  mark: Mark;
  connected: boolean;
  socketId: string;
};

type ClientPlayerState = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  direction: Direction;
  mark: Mark;
};

type PlayerKeypressData = {
  userId: string;
  direction: Direction;
};

type PlayerKeypressUpData = PlayerKeypressData & {
  y: number;
};

export default Game;
