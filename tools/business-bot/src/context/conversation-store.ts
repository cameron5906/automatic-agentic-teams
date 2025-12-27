import { LRUCache } from 'lru-cache';
import type { ConversationMessage, ConversationContext, BotState } from '../types';
import * as sqlite from './persistence/sqlite';

const MAX_MESSAGES_PER_CONTEXT = 50;
const CONTEXT_TTL_MS = 60 * 60 * 1000; // 1 hour

const contextCache = new LRUCache<string, ConversationContext>({
  max: 200,
  ttl: CONTEXT_TTL_MS,
});

export function getContextKey(channelId: string, threadId?: string): string {
  return threadId ?? channelId;
}

export function getConversationContext(contextKey: string): ConversationContext {
  let context = contextCache.get(contextKey);

  if (!context) {
    const messages = sqlite.loadConversationMessages(contextKey, MAX_MESSAGES_PER_CONTEXT);
    const stateData = sqlite.loadConversationState(contextKey);

    context = {
      contextKey,
      messages,
      state: stateData?.state ?? 'idle',
      projectId: stateData?.projectId,
      lastActivity: stateData?.lastActivity ?? Date.now(),
    };

    contextCache.set(contextKey, context);
  }

  return context;
}

export function addMessage(
  contextKey: string,
  role: ConversationMessage['role'],
  content: string,
  authorId?: string,
  authorName?: string,
  toolCallId?: string,
  toolName?: string
): void {
  const context = getConversationContext(contextKey);

  const message: ConversationMessage = {
    role,
    content,
    authorId,
    authorName,
    timestamp: Date.now(),
    toolCallId,
    toolName,
  };

  context.messages.push(message);
  context.lastActivity = message.timestamp;

  if (context.messages.length > MAX_MESSAGES_PER_CONTEXT) {
    context.messages = context.messages.slice(-MAX_MESSAGES_PER_CONTEXT);
  }

  contextCache.set(contextKey, context);

  sqlite.saveConversationMessage(contextKey, message);
}

export function setState(
  contextKey: string,
  state: BotState,
  projectId?: string
): void {
  const context = getConversationContext(contextKey);
  context.state = state;
  if (projectId !== undefined) {
    context.projectId = projectId;
  }
  context.lastActivity = Date.now();
  contextCache.set(contextKey, context);

  sqlite.saveConversationState(contextKey, state, context.projectId);
}

export function getState(contextKey: string): BotState {
  const context = getConversationContext(contextKey);
  return context.state;
}

export function getProjectId(contextKey: string): string | undefined {
  const context = getConversationContext(contextKey);
  return context.projectId;
}

export function setProjectId(contextKey: string, projectId: string): void {
  const context = getConversationContext(contextKey);
  context.projectId = projectId;
  context.lastActivity = Date.now();
  contextCache.set(contextKey, context);

  sqlite.saveConversationState(contextKey, context.state, projectId);
}

export function clearContext(contextKey: string): void {
  contextCache.delete(contextKey);
}

export function getMessagesForOpenAI(
  contextKey: string
): Array<{ role: 'user' | 'assistant' | 'system' | 'tool'; content: string; tool_call_id?: string; name?: string }> {
  const context = getConversationContext(contextKey);

  return context.messages.map((msg) => {
    if (msg.role === 'tool') {
      return {
        role: 'tool' as const,
        content: msg.content,
        tool_call_id: msg.toolCallId,
        name: msg.toolName,
      };
    }

    return {
      role: msg.role,
      content: msg.role === 'user' && msg.authorName
        ? `[${msg.authorName}]: ${msg.content}`
        : msg.content,
    };
  });
}

export function hydrateFromDatabase(): void {
  const recentCutoff = Date.now() - CONTEXT_TTL_MS;

  const db = sqlite.getDatabase();
  const stmt = db.prepare(`
    SELECT DISTINCT context_key
    FROM conversation_state
    WHERE last_activity > ?
  `);

  const rows = stmt.all(recentCutoff) as Array<{ context_key: string }>;

  for (const row of rows) {
    getConversationContext(row.context_key);
  }

  console.log(`[ConversationStore] Hydrated ${rows.length} conversation contexts`);
}
