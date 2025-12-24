import { LRUCache } from 'lru-cache';
import type { SqliteStateStore } from './persistence/sqlite.js';

/**
 * Registry of threads created by the bot.
 *
 * We use this to auto-handle messages in those threads without requiring @mentions.
 * This is persisted (optionally) so restarts don't break ongoing ticket conversations.
 */

const THREAD_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const MAX_THREADS = 500;

const threadCache = new LRUCache<string, { lastActivity: number }>({
  max: MAX_THREADS,
  ttl: THREAD_TTL_MS,
});

let sqliteStore: SqliteStateStore | null = null;

export function setThreadRegistryPersistence(store: SqliteStateStore | null): void {
  sqliteStore = store;
}

export function hydrateThreadRegistryFromPersistence(): void {
  if (!sqliteStore) return;

  const since = Date.now() - THREAD_TTL_MS;
  const threadIds = sqliteStore.loadBotThreads({ sinceTimestamp: since, limit: MAX_THREADS });

  for (const threadId of threadIds) {
    threadCache.set(threadId, { lastActivity: Date.now() });
  }

  sqliteStore.pruneBotThreads(since);
}

export function registerBotThread(threadId: string): void {
  threadCache.set(threadId, { lastActivity: Date.now() });
  if (sqliteStore) {
    try {
      sqliteStore.upsertBotThread(threadId, Date.now());
    } catch (error) {
      console.error('Failed to persist bot thread:', error);
    }
  }
}

export function touchBotThread(threadId: string): void {
  if (!threadCache.has(threadId)) return;
  threadCache.set(threadId, { lastActivity: Date.now() });
  if (sqliteStore) {
    try {
      sqliteStore.upsertBotThread(threadId, Date.now());
    } catch (error) {
      console.error('Failed to persist bot thread touch:', error);
    }
  }
}

export function isBotThread(threadId: string): boolean {
  return threadCache.has(threadId);
}

// Export for testing
export const _testExports = {
  threadCache,
  THREAD_TTL_MS,
  MAX_THREADS,
};


