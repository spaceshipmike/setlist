/// <reference types="vite/client" />

import type { SetlistAPI } from '../preload/index.js';

declare global {
  interface Window {
    setlist: SetlistAPI;
  }
}
