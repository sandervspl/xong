import { proxy } from 'valtio';
import { devtools } from 'valtio/utils';

import type { ClientGameState } from './types';

// Keep this in a different file so it does not reset due to HMR
const gameState = proxy({} as ClientGameState);
export default gameState;

devtools(gameState, 'game state');
