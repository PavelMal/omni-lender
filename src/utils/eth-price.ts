/**
 * ETH/USD price oracle via CoinGecko (free, no API key).
 * Cached for 60 seconds to avoid rate limits.
 */

import { createLogger } from './logger.js';

const log = createLogger('ETH-Price');

let cachedPrice: { usd: number; fetchedAt: number } | null = null;
const CACHE_TTL_MS = 60_000;

export async function getEthUsdPrice(): Promise<number> {
  if (cachedPrice && Date.now() - cachedPrice.fetchedAt < CACHE_TTL_MS) {
    return cachedPrice.usd;
  }

  const res = await fetch(
    'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd',
  );
  if (!res.ok) throw new Error(`CoinGecko error: ${res.status}`);

  const data = (await res.json()) as { ethereum: { usd: number } };
  cachedPrice = { usd: data.ethereum.usd, fetchedAt: Date.now() };
  log.info(`ETH price: $${cachedPrice.usd}`);
  return cachedPrice.usd;
}
