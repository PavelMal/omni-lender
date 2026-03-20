/// <reference types="vite/client" />
/**
 * API base URL — uses same origin in production (served from Express),
 * falls back to localhost:3001 in dev (Vite proxy or direct).
 */
const isDev = import.meta.env.DEV;
const host = window.location.hostname;
const port = isDev ? 3001 : window.location.port || (window.location.protocol === 'https:' ? 443 : 80);
const protocol = window.location.protocol;

export const API_BASE = isDev ? `http://${host}:${port}` : `${protocol}//${host}${port === 80 || port === 443 ? '' : ':' + port}`;

export const WS_BASE = isDev
  ? `ws://${host}:${port}`
  : `${protocol === 'https:' ? 'wss:' : 'ws:'}//${host}${port === 80 || port === 443 ? '' : ':' + port}`;
