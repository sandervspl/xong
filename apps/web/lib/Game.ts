import type { Socket } from 'socket.io-client';

import type { StoredUser } from 'hooks/userLocalStorage.js';

import { theme } from '../tailwind.config.js';


const PLR_HEIGHT = 20;
const PLR_WIDTH = 2;
const VELOCITY = 1;


class Game {
  #canvas: HTMLCanvasElement;
  #ctx: CanvasRenderingContext2D;
  #players: Record<string, PlayerState>;
  #user?: StoredUser;
  // #userIsPlayer: boolean;
  #keysPressed: Record<string, boolean> = {};
  #gameData: GameState;
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
    this.#gameData = gameState;
    this.#socket = socket;
    this.#user = user;
    // this.#userIsPlayer = userIsPlayer;

    this.#players = Object.entries(gameState.players).reduce((acc, [plrId, plrState], i) => {
      acc[plrId] = {
        id: plrId,
        x: 0 + (canvas.width - PLR_WIDTH) * i,
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

    this.#socket.emit('player-key-down', {
      gameId: this.#gameData.id,
      userId: this.#user!.id,
      key,
    });
  };

  #onKeyUp = (e: KeyboardEvent) => {
    const key = e.key.toLowerCase();

    this.#keysPressed[key] = false;

    this.#socket.emit('player-key-up', {
      gameId: this.#gameData.id,
      userId: this.#user!.id,
      y: this.#players[this.#user!.id].y,
      key,
    });
  };

  #updatePositions = () => {
    for (const playerId of Object.keys(this.#players)) {
      if (this.#players[playerId].direction === 'up') {
        this.#players[playerId].y -= VELOCITY;
      }

      if (this.#players[playerId].direction === 'down') {
        this.#players[playerId].y += VELOCITY;
      }
    }
  };

  #draw = () => {
    this.#ctx.clearRect(0, 0, this.#canvas.width, this.#canvas.height);

    for (const playerId of Object.keys(this.#players)) {
      this.#ctx.beginPath();
      this.#ctx.lineWidth = 2;
      this.#ctx.strokeStyle = theme.extend.colors.primary[600];
      this.#ctx.rect(
        this.#players[playerId].x,
        this.#players[playerId].y,
        PLR_WIDTH,
        PLR_HEIGHT,
      );
      this.#ctx.stroke();
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
