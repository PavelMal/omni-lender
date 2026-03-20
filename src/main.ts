/**
 * OmniAgent — Main entry point.
 *
 * Standalone mode: single wallet, autonomous loop.
 * For web UI mode, use `npm run web` (src/web/server.ts).
 */

import { config } from './config.js';
import { createLogger, setLogLevel } from './utils/logger.js';

const log = createLogger('Main');

async function main(): Promise<void> {
  setLogLevel(config.logLevel as 'debug' | 'info' | 'warn' | 'error');

  log.info('Starting OmniAgent in standalone mode...');

  const { initWallet, getWalletState, shutdown } = await import('./wallet-os/core.js');
  const { reason } = await import('./agent/brain.js');
  const { initTreasury, checkAndRebalance } = await import('./modules/treasury.js');
  const { scanAndAllocate, checkPositions } = await import('./modules/defi.js');
  const { checkOverdueLoans } = await import('./modules/lending.js');

  await initWallet(undefined, 1000);
  initTreasury(getWalletState().totalBalance);

  log.info('Starting autonomous cycle (30s interval)...');

  const cleanup = async () => { shutdown(); process.exit(0); };
  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);

  let cycle = 1;
  while (true) {
    try {
      log.info(`─── Cycle ${cycle} ───`);
      await checkAndRebalance(reason);
      await scanAndAllocate(reason);
      await checkPositions(reason);
      await checkOverdueLoans();
      log.info('Cycle complete', { balance: getWalletState().totalBalance });
    } catch (err) {
      log.error('Cycle failed', { error: err instanceof Error ? err.message : String(err) });
    }
    cycle++;
    await new Promise(resolve => setTimeout(resolve, 30_000));
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
