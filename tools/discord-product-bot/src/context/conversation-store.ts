import { LRUCache } from 'lru-cache';
import type { ConversationMessage, ImageAttachment } from '../types.js';
import type { SqliteStateStore } from './persistence/sqlite.js';

export interface ConversationContext {
  messages: ConversationMessage[];
  lastActivity: number;
}

// Configuration
const MAX_CHANNELS = 100;
const MAX_MESSAGES_PER_CHANNEL = 50;
const TTL_MS = 30 * 60 * 1000; // 30 minutes

// LRU cache: key = channelId or threadId
const contextCache = new LRUCache<string, ConversationContext>({
  max: MAX_CHANNELS,
  ttl: TTL_MS,
});

// Optional persistence layer (initialized at runtime).
let sqliteStore: SqliteStateStore | null = null;

/**
 * Attach a SQLite persistence store. This is called from app startup code.
 * Keeping this as a setter avoids importing config/env in tests.
 */
export function setConversationStorePersistence(store: SqliteStateStore | null): void {
  sqliteStore = store;
}

/**
 * Hydrate the in-memory cache from SQLite. Intended to be called once at startup.
 */
export function hydrateConversationStoreFromPersistence(): void {
  if (!sqliteStore) return;

  const since = Date.now() - TTL_MS;
  const contexts = sqliteStore.loadConversationContexts({
    sinceTimestamp: since,
    maxContexts: MAX_CHANNELS,
    maxMessagesPerContext: MAX_MESSAGES_PER_CHANNEL,
  });

  for (const [contextKey, messages] of contexts.entries()) {
    if (!messages.length) continue;
    contextCache.set(contextKey, {
      messages,
      lastActivity: messages[messages.length - 1]!.timestamp,
    });
  }

  // Best-effort pruning so the DB doesn't grow unbounded.
  sqliteStore.pruneConversationMessages(since);
}

/**
 * Get the context key for a message.
 * Uses threadId if in a thread, otherwise channelId.
 */
export function getContextKey(channelId: string, threadId: string | null): string {
  return threadId ?? channelId;
}

/**
 * Retrieve conversation context for a channel/thread.
 */
export function getConversationContext(contextKey: string): ConversationMessage[] {
  const context = contextCache.get(contextKey);
  return context?.messages ?? [];
}

/**
 * Add a message to the conversation context.
 * Maintains FIFO order, pruning old messages when limit is reached.
 */
export function addMessage(
  contextKey: string,
  role: 'user' | 'assistant',
  content: string,
  authorId: string,
  authorName: string,
  images?: ImageAttachment[]
): void {
  const existing = contextCache.get(contextKey);
  const messages = existing?.messages ?? [];

  const newMessage: ConversationMessage = {
    role,
    content,
    authorId,
    authorName,
    timestamp: Date.now(),
    images,
  };

  messages.push(newMessage);

  // Persist write-through if enabled.
  if (sqliteStore) {
    try {
      sqliteStore.saveConversationMessage(contextKey, newMessage);
    } catch (error) {
      console.error('Failed to persist conversation message:', error);
    }
  }

  // Prune oldest messages if over limit
  while (messages.length > MAX_MESSAGES_PER_CHANNEL) {
    messages.shift();
  }

  contextCache.set(contextKey, {
    messages,
    lastActivity: Date.now(),
  });
}

/**
 * Clear conversation context for a channel/thread.
 */
export function clearContext(contextKey: string): void {
  contextCache.delete(contextKey);
}

/**
 * Get cache statistics for monitoring.
 */
export function getCacheStats(): { size: number; maxSize: number } {
  return {
    size: contextCache.size,
    maxSize: MAX_CHANNELS,
  };
}

// Export for testing
export const _testExports = {
  contextCache,
  MAX_CHANNELS,
  MAX_MESSAGES_PER_CHANNEL,
  TTL_MS,
};
