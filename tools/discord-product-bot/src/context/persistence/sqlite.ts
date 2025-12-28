import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import type { ConversationMessage } from '../../types.js';
import type { DraftIssue } from '../../ticket-flows/types.js';

/**
 * SQLite persistence for bot state.
 *
 * This file is intentionally *not* coupled to `config.ts` so tests can import
 * `conversation-store.ts` without requiring env vars.
 *
 * Call `initSqliteStateStore(sqlitePath)` once at startup, then pass the
 * returned store into the in-memory caches (conversation store + thread registry).
 */

export interface SqliteStateStore {
    // Conversations
    saveConversationMessage(contextKey: string, msg: ConversationMessage): void;
    loadConversationContexts(params: {
        sinceTimestamp: number;
        maxContexts: number;
        maxMessagesPerContext: number;
    }): Map<string, ConversationMessage[]>;
    pruneConversationMessages(beforeTimestamp: number): number;

    // Bot-owned threads
    upsertBotThread(threadId: string, lastActivity: number): void;
    loadBotThreads(params: { sinceTimestamp: number; limit: number }): string[];
    pruneBotThreads(beforeTimestamp: number): number;

    // Draft issues
    upsertDraft(draft: DraftIssue): void;
    loadDrafts(params: { sinceTimestamp: number; limit: number }): DraftIssue[];
    deleteDraft(threadId: string): void;
    pruneDrafts(beforeTimestamp: number): number;
}

function ensureParentDir(filePath: string): void {
    const dir = path.dirname(filePath);
    fs.mkdirSync(dir, { recursive: true });
}

function migrate(db: Database.Database): void {
    db.exec(`
    CREATE TABLE IF NOT EXISTS conversation_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      context_key TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      author_id TEXT NOT NULL,
      author_name TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      images_json TEXT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_conversation_messages_context_key_timestamp
      ON conversation_messages(context_key, timestamp);

    CREATE INDEX IF NOT EXISTS idx_conversation_messages_timestamp
      ON conversation_messages(timestamp);

    CREATE TABLE IF NOT EXISTS bot_threads (
      thread_id TEXT PRIMARY KEY,
      created_at INTEGER NOT NULL,
      last_activity INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_bot_threads_last_activity
      ON bot_threads(last_activity);

    CREATE TABLE IF NOT EXISTS draft_issues (
      id TEXT PRIMARY KEY,
      thread_id TEXT NOT NULL UNIQUE,
      channel_id TEXT NOT NULL,
      type TEXT NOT NULL,
      fields_json TEXT NOT NULL,
      collected_fields_json TEXT NOT NULL,
      draft_message_id TEXT NULL,
      status TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      created_by TEXT NOT NULL,
      filed_issue_number INTEGER NULL,
      filed_issue_url TEXT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_draft_issues_thread_id
      ON draft_issues(thread_id);

    CREATE INDEX IF NOT EXISTS idx_draft_issues_updated_at
      ON draft_issues(updated_at);

    CREATE INDEX IF NOT EXISTS idx_draft_issues_status
      ON draft_issues(status);
  `);
}

function imagesToJson(images: ConversationMessage['images']): string | null {
    if (!images?.length) return null;
    return JSON.stringify(images);
}

function imagesFromJson(imagesJson: string | null): ConversationMessage['images'] {
    if (!imagesJson) return undefined;
    try {
        return JSON.parse(imagesJson) as ConversationMessage['images'];
    } catch {
        return undefined;
    }
}

export function initSqliteStateStore(sqlitePath: string): SqliteStateStore {
    ensureParentDir(sqlitePath);
    const db = new Database(sqlitePath);
    migrate(db);

    const insertMessageStmt = db.prepare(`
    INSERT INTO conversation_messages (
      context_key, role, content, author_id, author_name, timestamp, images_json
    ) VALUES (
      @context_key, @role, @content, @author_id, @author_name, @timestamp, @images_json
    )
  `);

    const selectContextsStmt = db.prepare(`
    SELECT DISTINCT context_key
    FROM conversation_messages
    WHERE timestamp >= @since
    ORDER BY context_key
    LIMIT @maxContexts
  `);

    const selectMessagesForContextStmt = db.prepare(`
    SELECT role, content, author_id, author_name, timestamp, images_json
    FROM conversation_messages
    WHERE context_key = @context_key AND timestamp >= @since
    ORDER BY timestamp ASC
    LIMIT @maxMessages
  `);

    const pruneMessagesStmt = db.prepare(`
    DELETE FROM conversation_messages
    WHERE timestamp < @before
  `);

    const upsertBotThreadStmt = db.prepare(`
    INSERT INTO bot_threads (thread_id, created_at, last_activity)
    VALUES (@thread_id, @created_at, @last_activity)
    ON CONFLICT(thread_id) DO UPDATE SET
      last_activity = excluded.last_activity
  `);

    const selectBotThreadsStmt = db.prepare(`
    SELECT thread_id
    FROM bot_threads
    WHERE last_activity >= @since
    ORDER BY last_activity DESC
    LIMIT @limit
  `);

    const pruneBotThreadsStmt = db.prepare(`
    DELETE FROM bot_threads
    WHERE last_activity < @before
  `);

    const upsertDraftStmt = db.prepare(`
    INSERT INTO draft_issues (
      id, thread_id, channel_id, type, fields_json, collected_fields_json,
      draft_message_id, status, created_at, updated_at, created_by,
      filed_issue_number, filed_issue_url
    ) VALUES (
      @id, @thread_id, @channel_id, @type, @fields_json, @collected_fields_json,
      @draft_message_id, @status, @created_at, @updated_at, @created_by,
      @filed_issue_number, @filed_issue_url
    )
    ON CONFLICT(thread_id) DO UPDATE SET
      fields_json = excluded.fields_json,
      collected_fields_json = excluded.collected_fields_json,
      draft_message_id = excluded.draft_message_id,
      status = excluded.status,
      updated_at = excluded.updated_at,
      filed_issue_number = excluded.filed_issue_number,
      filed_issue_url = excluded.filed_issue_url
  `);

    const selectDraftsStmt = db.prepare(`
    SELECT id, thread_id, channel_id, type, fields_json, collected_fields_json,
           draft_message_id, status, created_at, updated_at, created_by,
           filed_issue_number, filed_issue_url
    FROM draft_issues
    WHERE updated_at >= @since
    ORDER BY updated_at DESC
    LIMIT @limit
  `);

    const deleteDraftStmt = db.prepare(`
    DELETE FROM draft_issues
    WHERE thread_id = @thread_id
  `);

    const pruneDraftsStmt = db.prepare(`
    DELETE FROM draft_issues
    WHERE updated_at < @before AND status IN ('filed', 'cancelled')
  `);

    return {
        saveConversationMessage(contextKey, msg) {
            insertMessageStmt.run({
                context_key: contextKey,
                role: msg.role,
                content: msg.content,
                author_id: msg.authorId,
                author_name: msg.authorName,
                timestamp: msg.timestamp,
                images_json: imagesToJson(msg.images),
            });
        },

        loadConversationContexts({ sinceTimestamp, maxContexts, maxMessagesPerContext }) {
            const contextKeys = selectContextsStmt.all({
                since: sinceTimestamp,
                maxContexts,
            }) as Array<{ context_key: string }>;

            const result = new Map<string, ConversationMessage[]>();

            for (const row of contextKeys) {
                const messages = selectMessagesForContextStmt.all({
                    context_key: row.context_key,
                    since: sinceTimestamp,
                    maxMessages: maxMessagesPerContext,
                }) as Array<{
                    role: ConversationMessage['role'];
                    content: string;
                    author_id: string;
                    author_name: string;
                    timestamp: number;
                    images_json: string | null;
                }>;

                result.set(
                    row.context_key,
                    messages.map((m) => ({
                        role: m.role,
                        content: m.content,
                        authorId: m.author_id,
                        authorName: m.author_name,
                        timestamp: m.timestamp,
                        images: imagesFromJson(m.images_json),
                    }))
                );
            }

            return result;
        },

        pruneConversationMessages(beforeTimestamp) {
            const info = pruneMessagesStmt.run({ before: beforeTimestamp });
            return Number(info.changes ?? 0);
        },

        upsertBotThread(threadId, lastActivity) {
            upsertBotThreadStmt.run({
                thread_id: threadId,
                created_at: Date.now(),
                last_activity: lastActivity,
            });
        },

        loadBotThreads({ sinceTimestamp, limit }) {
            const rows = selectBotThreadsStmt.all({
                since: sinceTimestamp,
                limit,
            }) as Array<{ thread_id: string }>;
            return rows.map((r) => r.thread_id);
        },

        pruneBotThreads(beforeTimestamp) {
            const info = pruneBotThreadsStmt.run({ before: beforeTimestamp });
            return Number(info.changes ?? 0);
        },

        upsertDraft(draft) {
            upsertDraftStmt.run({
                id: draft.id,
                thread_id: draft.threadId,
                channel_id: draft.channelId,
                type: draft.type,
                fields_json: JSON.stringify(draft.fields),
                collected_fields_json: JSON.stringify(draft.collectedFields),
                draft_message_id: draft.draftMessageId,
                status: draft.status,
                created_at: draft.createdAt,
                updated_at: draft.updatedAt,
                created_by: draft.createdBy,
                filed_issue_number: draft.filedIssueNumber ?? null,
                filed_issue_url: draft.filedIssueUrl ?? null,
            });
        },

        loadDrafts({ sinceTimestamp, limit }) {
            const rows = selectDraftsStmt.all({
                since: sinceTimestamp,
                limit,
            }) as Array<{
                id: string;
                thread_id: string;
                channel_id: string;
                type: string;
                fields_json: string;
                collected_fields_json: string;
                draft_message_id: string | null;
                status: string;
                created_at: number;
                updated_at: number;
                created_by: string;
                filed_issue_number: number | null;
                filed_issue_url: string | null;
            }>;

            return rows.map((row) => ({
                id: row.id,
                threadId: row.thread_id,
                channelId: row.channel_id,
                type: row.type as DraftIssue['type'],
                fields: JSON.parse(row.fields_json),
                collectedFields: JSON.parse(row.collected_fields_json),
                draftMessageId: row.draft_message_id,
                status: row.status as DraftIssue['status'],
                createdAt: row.created_at,
                updatedAt: row.updated_at,
                createdBy: row.created_by,
                filedIssueNumber: row.filed_issue_number ?? undefined,
                filedIssueUrl: row.filed_issue_url ?? undefined,
            }));
        },

        deleteDraft(threadId) {
            deleteDraftStmt.run({ thread_id: threadId });
        },

        pruneDrafts(beforeTimestamp) {
            const info = pruneDraftsStmt.run({ before: beforeTimestamp });
            return Number(info.changes ?? 0);
        },
    };
}





