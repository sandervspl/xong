import { proxy } from 'valtio';

import type { ClientGameState } from './types';

// Keep this in a different file so it does not reset due to HMR
const gameState = proxy({} as ClientGameState);

export default gameState;
