import type { Socket } from 'socket.io-client';

import type { StoredUser } from 'hooks/userLocalStorage.js';

import { theme } from '../tailwind.config.js';


const PLR_WIDTH = Number(process.env.NEXT_PUBLIC_GAME_PLR_WIDTH);
const PLR_HEIGHT = Number(process.env.NEXT_PUBLIC_GAME_PLR_HEIGHT);
const FIELD_MARGIN = Number(process.env.NEXT_PUBLIC_GAME_FIELD_MARGIN);
const FIELD_WIDTH = Number(process.env.NEXT_PUBLIC_GAME_FIELD_WIDTH);
const FIELD_HEIGHT = Number(process.env.NEXT_PUBLIC_GAME_FIELD_HEIGHT);
const VELOCITY = Number(process.env.NEXT_PUBLIC_GAME_VELOCITY);

class Game {
  #canvas: HTMLCanvasElement;
  #ctx: CanvasRenderingContext2D;
  #players: Record<string, PlayerState>;
  #user?: StoredUser;
  #keysPressed: Record<string, boolean> = {};
  #gameState: GameState;
  #socket: Socket;

  constructor(
    canvas: HTMLCanvasElement,
    socket: Socket,
    gameState: GameState,
    user: StoredUser | undefined,
    userIsPlayer: boolean,
  ) {
    this.#canvas = canvas;
    this.#ctx = this.#canvas.getContext('2d')!;
    this.#gameState = gameState;
    this.#socket = socket;
    this.#user = user;

    this.#players = Object.entries(gameState.players).reduce((acc, [plrId, plrState], i) => {
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
        width: PLR_WIDTH,
        height: PLR_HEIGHT,
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

    this.#tick();
  }

  unload = () => {
    document.removeEventListener('keydown', this.#onKeyDown);
    document.removeEventListener('keyup', this.#onKeyUp);
  };

  start = () => {
    // this.#tick();
  };

  #onKeyDown = (e: KeyboardEvent) => {
    const key = e.key.toLowerCase();

    if (this.#keysPressed[key]) {
      return;
    }

    this.#keysPressed[key] = true;

    if (this.#user) {
      this.#socket.emit('player-key-down', {
        gameId: this.#gameState.id,
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
        gameId: this.#gameState.id,
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

      if (
        next >= 0 &&
        next <= FIELD_HEIGHT - PLR_HEIGHT
      ) {
        this.#players[playerId].y = next;
      }
    }
  };

  #draw = () => {
    this.#ctx.clearRect(0, 0, this.#canvas.width, this.#canvas.height);

    for (const playerId of Object.keys(this.#players)) {
      this.#ctx.rect(
        this.#players[playerId].x,
        this.#players[playerId].y,
        this.#players[playerId].width,
        this.#players[playerId].height,
      );
      this.#ctx.fillStyle = theme.extend.colors.primary[600];
      this.#ctx.fill();
    }
  };

  #tick = () => {
    this.#updatePositions();
    this.#draw();
    requestAnimationFrame(this.#tick);
  };
}

type GameState = {
  id: string;
  players: Record<string, {
    y: number;
    direction: null | 'up' | 'down';
  }>;
};

type PlayerState = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  direction: null | 'up' | 'down';
};

type PlayerKeypressData = {
  userId: string;
  direction: null | 'up' | 'down';
};

type PlayerKeypressUpData = PlayerKeypressData & {
  y: number;
};

export default Game;
