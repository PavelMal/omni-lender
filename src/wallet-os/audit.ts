import { appendFileSync, mkdirSync, existsSync, readFileSync, writeFileSync, readdirSync, unlinkSync } from 'fs';
import { dirname, join } from 'path';
import { createLogger } from '../utils/logger.js';
import type { AuditEntry } from './types.js';

const log = createLogger('Audit');

// Per-user in-memory entries (capped at MAX_MEMORY_ENTRIES)
const userEntries: Map<string, AuditEntry[]> = new Map();
const MAX_MEMORY_ENTRIES = 200;
const MAX_FILE_ENTRIES = 1000;
const LOG_DIR = 'logs';

function ensureLogDir(): void {
  if (!existsSync(LOG_DIR)) {
    mkdirSync(LOG_DIR, { recursive: true });
  }
}

function getUserLogPath(userAddress: string): string {
  const safe = userAddress.toLowerCase().replace(/[^a-z0-9]/g, '');
  return join(LOG_DIR, `audit_${safe}.jsonl`);
}

function rotateFileIfNeeded(filePath: string): void {
  if (!existsSync(filePath)) return;

  try {
    const content = readFileSync(filePath, 'utf-8');
    const lines = content.trim().split('\n').filter(Boolean);
    if (lines.length > MAX_FILE_ENTRIES) {
      // Keep only the last MAX_FILE_ENTRIES lines
      const trimmed = lines.slice(lines.length - MAX_FILE_ENTRIES);
      writeFileSync(filePath, trimmed.join('\n') + '\n', 'utf-8');
    }
  } catch {
    // If rotation fails, continue — not critical
  }
}

export function logAudit(entry: AuditEntry, userAddress?: string): void {
  const addr = userAddress ?? 'global';

  // In-memory: push and cap
  if (!userEntries.has(addr)) userEntries.set(addr, []);
  const entries = userEntries.get(addr)!;
  entries.push(entry);
  if (entries.length > MAX_MEMORY_ENTRIES) {
    entries.splice(0, entries.length - MAX_MEMORY_ENTRIES);
  }

  const statusIcon =
    entry.status === 'approved' ? '✓' :
    entry.status === 'rejected' ? '✗' :
    entry.status === 'executed' ? '→' :
    entry.status === 'failed' ? '!' : '·';

  const amountStr = entry.amount !== undefined ? ` ${entry.amount} ${entry.asset ?? 'USDT'}` : '';

  log.info(`[${statusIcon}] [${entry.module}] ${entry.action}${amountStr} — ${entry.reasoning}`);

  // Write to per-user file
  try {
    ensureLogDir();
    const filePath = getUserLogPath(addr);
    appendFileSync(filePath, JSON.stringify(entry) + '\n', 'utf-8');
    rotateFileIfNeeded(filePath);
  } catch (err) {
    log.error('Failed to write audit log to disk', { error: String(err) });
  }

}

export function getAuditLog(userAddress?: string): AuditEntry[] {
  if (userAddress) {
    return [...(userEntries.get(userAddress) ?? [])];
  }
  // Fallback: merge all user entries
  const all: AuditEntry[] = [];
  for (const entries of userEntries.values()) {
    all.push(...entries);
  }
  return all.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}

export function getModuleAuditLog(module: AuditEntry['module'], userAddress?: string): AuditEntry[] {
  return getAuditLog(userAddress).filter(e => e.module === module);
}

export function clearAuditLog(): void {
  userEntries.clear();

  // Delete log files from disk
  try {
    if (existsSync(LOG_DIR)) {
      for (const file of readdirSync(LOG_DIR)) {
        if (file.startsWith('audit_') && file.endsWith('.jsonl')) {
          unlinkSync(join(LOG_DIR, file));
        }
      }
    }
  } catch { /* ignore */ }

  log.info('Audit log cleared (memory + disk)');
}
