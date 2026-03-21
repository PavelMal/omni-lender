/**
 * API base URL — always use relative paths so Vite proxy handles routing.
 */
export const API_BASE = '';

export const WS_BASE = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}`;
