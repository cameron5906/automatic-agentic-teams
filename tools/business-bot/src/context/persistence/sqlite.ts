import Database from 'better-sqlite3';
import type { ConversationMessage, Project, BotState } from '../../types';
import { config } from '../../config';
import * as fs from 'fs';
import * as path from 'path';

let db: Database.Database | null = null;

export function initDatabase(): Database.Database {
  if (db) return db;

  const dbPath = config.persistence.sqlitePath;
  const dbDir = path.dirname(dbPath);

  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS conversation_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      context_key TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      author_id TEXT,
      author_name TEXT,
      timestamp INTEGER NOT NULL,
      tool_call_id TEXT,
      tool_name TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_conversation_context_key
      ON conversation_messages(context_key);
    CREATE INDEX IF NOT EXISTS idx_conversation_timestamp
      ON conversation_messages(timestamp);

    CREATE TABLE IF NOT EXISTS conversation_state (
      context_key TEXT PRIMARY KEY,
      state TEXT NOT NULL DEFAULT 'idle',
      project_id TEXT,
      last_activity INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'planning',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      created_by TEXT NOT NULL,
      resources_json TEXT NOT NULL DEFAULT '{}',
      planning_json TEXT NOT NULL DEFAULT '{}'
    );

    CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
    CREATE INDEX IF NOT EXISTS idx_projects_created_by ON projects(created_by);

    CREATE TABLE IF NOT EXISTS project_resources (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id TEXT NOT NULL,
      resource_type TEXT NOT NULL,
      resource_id TEXT NOT NULL,
      name TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      metadata_json TEXT NOT NULL DEFAULT '{}',
      FOREIGN KEY (project_id) REFERENCES projects(id)
    );

    CREATE INDEX IF NOT EXISTS idx_project_resources_project
      ON project_resources(project_id);
    CREATE INDEX IF NOT EXISTS idx_project_resources_type
      ON project_resources(resource_type);

    CREATE TABLE IF NOT EXISTS owned_threads (
      thread_id TEXT PRIMARY KEY,
      channel_id TEXT NOT NULL,
      guild_id TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      topic TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_owned_threads_guild
      ON owned_threads(guild_id);

    CREATE TABLE IF NOT EXISTS stripe_accounts (
      account_id TEXT PRIMARY KEY,
      project_id TEXT,
      secret_key_encrypted TEXT NOT NULL,
      business_name TEXT NOT NULL,
      label TEXT,
      is_live INTEGER NOT NULL DEFAULT 0,
      connected_at INTEGER NOT NULL,
      connected_by TEXT NOT NULL,
      webhook_secrets_json TEXT NOT NULL DEFAULT '{}'
    );

    CREATE INDEX IF NOT EXISTS idx_stripe_accounts_project
      ON stripe_accounts(project_id);
  `);

  return db;
}

export function getDatabase(): Database.Database {
  if (!db) {
    return initDatabase();
  }
  return db;
}

export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
  }
}

export function saveConversationMessage(
  contextKey: string,
  message: ConversationMessage
): void {
  const db = getDatabase();
  const stmt = db.prepare(`
    INSERT INTO conversation_messages
    (context_key, role, content, author_id, author_name, timestamp, tool_call_id, tool_name)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    contextKey,
    message.role,
    message.content,
    message.authorId ?? null,
    message.authorName ?? null,
    message.timestamp,
    message.toolCallId ?? null,
    message.toolName ?? null
  );
}

export function loadConversationMessages(
  contextKey: string,
  limit = 50
): ConversationMessage[] {
  const db = getDatabase();
  const stmt = db.prepare(`
    SELECT role, content, author_id, author_name, timestamp, tool_call_id, tool_name
    FROM conversation_messages
    WHERE context_key = ?
    ORDER BY timestamp DESC
    LIMIT ?
  `);

  const rows = stmt.all(contextKey, limit) as Array<{
    role: string;
    content: string;
    author_id: string | null;
    author_name: string | null;
    timestamp: number;
    tool_call_id: string | null;
    tool_name: string | null;
  }>;

  return rows.reverse().map((row) => ({
    role: row.role as ConversationMessage['role'],
    content: row.content,
    authorId: row.author_id ?? undefined,
    authorName: row.author_name ?? undefined,
    timestamp: row.timestamp,
    toolCallId: row.tool_call_id ?? undefined,
    toolName: row.tool_name ?? undefined,
  }));
}

export function saveConversationState(
  contextKey: string,
  state: BotState,
  projectId?: string
): void {
  const db = getDatabase();
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO conversation_state
    (context_key, state, project_id, last_activity)
    VALUES (?, ?, ?, ?)
  `);

  stmt.run(contextKey, state, projectId ?? null, Date.now());
}

export function loadConversationState(
  contextKey: string
): { state: BotState; projectId?: string; lastActivity: number } | null {
  const db = getDatabase();
  const stmt = db.prepare(`
    SELECT state, project_id, last_activity
    FROM conversation_state
    WHERE context_key = ?
  `);

  const row = stmt.get(contextKey) as {
    state: string;
    project_id: string | null;
    last_activity: number;
  } | undefined;

  if (!row) return null;

  return {
    state: row.state as BotState,
    projectId: row.project_id ?? undefined,
    lastActivity: row.last_activity,
  };
}

export function pruneOldMessages(maxAgeMs = 7 * 24 * 60 * 60 * 1000): number {
  const db = getDatabase();
  const cutoff = Date.now() - maxAgeMs;
  const stmt = db.prepare(`
    DELETE FROM conversation_messages WHERE timestamp < ?
  `);
  const result = stmt.run(cutoff);
  return result.changes;
}

export function saveProject(project: Project): void {
  const db = getDatabase();
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO projects
    (id, name, description, status, created_at, updated_at, created_by, resources_json, planning_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    project.id,
    project.name,
    project.description ?? null,
    project.status,
    project.createdAt,
    project.updatedAt,
    project.createdBy,
    JSON.stringify(project.resources),
    JSON.stringify(project.planning)
  );
}

export function loadProject(id: string): Project | null {
  const db = getDatabase();
  const stmt = db.prepare(`
    SELECT id, name, description, status, created_at, updated_at, created_by, resources_json, planning_json
    FROM projects
    WHERE id = ?
  `);

  const row = stmt.get(id) as {
    id: string;
    name: string;
    description: string | null;
    status: string;
    created_at: number;
    updated_at: number;
    created_by: string;
    resources_json: string;
    planning_json: string;
  } | undefined;

  if (!row) return null;

  return {
    id: row.id,
    name: row.name,
    description: row.description ?? undefined,
    status: row.status as Project['status'],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    createdBy: row.created_by,
    resources: JSON.parse(row.resources_json),
    planning: JSON.parse(row.planning_json),
  };
}

export function loadAllProjects(
  status?: Project['status']
): Project[] {
  const db = getDatabase();
  let stmt;

  if (status) {
    stmt = db.prepare(`
      SELECT id, name, description, status, created_at, updated_at, created_by, resources_json, planning_json
      FROM projects
      WHERE status = ?
      ORDER BY updated_at DESC
    `);
  } else {
    stmt = db.prepare(`
      SELECT id, name, description, status, created_at, updated_at, created_by, resources_json, planning_json
      FROM projects
      ORDER BY updated_at DESC
    `);
  }

  const rows = (status ? stmt.all(status) : stmt.all()) as Array<{
    id: string;
    name: string;
    description: string | null;
    status: string;
    created_at: number;
    updated_at: number;
    created_by: string;
    resources_json: string;
    planning_json: string;
  }>;

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description ?? undefined,
    status: row.status as Project['status'],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    createdBy: row.created_by,
    resources: JSON.parse(row.resources_json),
    planning: JSON.parse(row.planning_json),
  }));
}

export function deleteProject(id: string): boolean {
  const db = getDatabase();
  const stmt = db.prepare(`DELETE FROM projects WHERE id = ?`);
  const result = stmt.run(id);
  return result.changes > 0;
}

export function findProjectByThreadId(threadId: string): Project | null {
  const db = getDatabase();
  const stmt = db.prepare(`
    SELECT id, name, description, status, created_at, updated_at, created_by, resources_json, planning_json
    FROM projects
    WHERE json_extract(planning_json, '$.threadId') = ?
  `);

  const row = stmt.get(threadId) as {
    id: string;
    name: string;
    description: string | null;
    status: string;
    created_at: number;
    updated_at: number;
    created_by: string;
    resources_json: string;
    planning_json: string;
  } | undefined;

  if (!row) return null;

  return {
    id: row.id,
    name: row.name,
    description: row.description ?? undefined,
    status: row.status as Project['status'],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    createdBy: row.created_by,
    resources: JSON.parse(row.resources_json),
    planning: JSON.parse(row.planning_json),
  };
}

export function saveOwnedThread(
  threadId: string,
  channelId: string,
  guildId: string,
  topic?: string
): void {
  const db = getDatabase();
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO owned_threads (thread_id, channel_id, guild_id, created_at, topic)
    VALUES (?, ?, ?, ?, ?)
  `);
  stmt.run(threadId, channelId, guildId, Date.now(), topic ?? null);
}

export function isOwnedThread(threadId: string): boolean {
  const db = getDatabase();
  const stmt = db.prepare(`SELECT 1 FROM owned_threads WHERE thread_id = ?`);
  return stmt.get(threadId) !== undefined;
}

export function deleteOwnedThread(threadId: string): boolean {
  const db = getDatabase();
  const stmt = db.prepare(`DELETE FROM owned_threads WHERE thread_id = ?`);
  const result = stmt.run(threadId);
  return result.changes > 0;
}

export interface ConversationSearchResult {
  contextKey: string;
  role: string;
  content: string;
  authorName?: string;
  timestamp: number;
  matchedSnippet: string;
}

export function searchConversationHistory(
  query: string,
  projectId?: string,
  limit = 20
): ConversationSearchResult[] {
  const db = getDatabase();

  const searchPattern = `%${query.toLowerCase()}%`;

  let stmt;
  let rows: Array<{
    context_key: string;
    role: string;
    content: string;
    author_name: string | null;
    timestamp: number;
  }>;

  if (projectId) {
    stmt = db.prepare(`
      SELECT cm.context_key, cm.role, cm.content, cm.author_name, cm.timestamp
      FROM conversation_messages cm
      INNER JOIN conversation_state cs ON cm.context_key = cs.context_key
      WHERE LOWER(cm.content) LIKE ?
        AND cs.project_id = ?
      ORDER BY cm.timestamp DESC
      LIMIT ?
    `);
    rows = stmt.all(searchPattern, projectId, limit) as typeof rows;
  } else {
    stmt = db.prepare(`
      SELECT context_key, role, content, author_name, timestamp
      FROM conversation_messages
      WHERE LOWER(content) LIKE ?
      ORDER BY timestamp DESC
      LIMIT ?
    `);
    rows = stmt.all(searchPattern, limit) as typeof rows;
  }

  return rows.map((row) => {
    const lowerContent = row.content.toLowerCase();
    const lowerQuery = query.toLowerCase();
    const matchIndex = lowerContent.indexOf(lowerQuery);

    const start = Math.max(0, matchIndex - 50);
    const end = Math.min(row.content.length, matchIndex + query.length + 50);
    let snippet = row.content.substring(start, end);
    if (start > 0) snippet = '...' + snippet;
    if (end < row.content.length) snippet = snippet + '...';

    return {
      contextKey: row.context_key,
      role: row.role,
      content: row.content,
      authorName: row.author_name ?? undefined,
      timestamp: row.timestamp,
      matchedSnippet: snippet,
    };
  });
}

export function getRecentActivity(
  limit = 10
): Array<{
  contextKey: string;
  state: string;
  projectId?: string;
  lastActivity: number;
  messageCount: number;
}> {
  const db = getDatabase();
  const stmt = db.prepare(`
    SELECT
      cs.context_key,
      cs.state,
      cs.project_id,
      cs.last_activity,
      COUNT(cm.id) as message_count
    FROM conversation_state cs
    LEFT JOIN conversation_messages cm ON cs.context_key = cm.context_key
    GROUP BY cs.context_key
    ORDER BY cs.last_activity DESC
    LIMIT ?
  `);

  const rows = stmt.all(limit) as Array<{
    context_key: string;
    state: string;
    project_id: string | null;
    last_activity: number;
    message_count: number;
  }>;

  return rows.map((row) => ({
    contextKey: row.context_key,
    state: row.state,
    projectId: row.project_id ?? undefined,
    lastActivity: row.last_activity,
    messageCount: row.message_count,
  }));
}

export function getOwnedThreadsByGuild(
  guildId: string
): Array<{ threadId: string; channelId: string; topic?: string; createdAt: number }> {
  const db = getDatabase();
  const stmt = db.prepare(`
    SELECT thread_id, channel_id, topic, created_at
    FROM owned_threads
    WHERE guild_id = ?
    ORDER BY created_at DESC
  `);

  const rows = stmt.all(guildId) as Array<{
    thread_id: string;
    channel_id: string;
    topic: string | null;
    created_at: number;
  }>;

  return rows.map((row) => ({
    threadId: row.thread_id,
    channelId: row.channel_id,
    topic: row.topic ?? undefined,
    createdAt: row.created_at,
  }));
}

export function findProjectByServerId(serverId: string): Project | null {
  const db = getDatabase();
  const stmt = db.prepare(`
    SELECT id, name, description, status, created_at, updated_at, created_by, resources_json, planning_json
    FROM projects
    WHERE json_extract(resources_json, '$.discord.serverId') = ?
  `);

  const row = stmt.get(serverId) as {
    id: string;
    name: string;
    description: string | null;
    status: string;
    created_at: number;
    updated_at: number;
    created_by: string;
    resources_json: string;
    planning_json: string;
  } | undefined;

  if (!row) return null;

  return {
    id: row.id,
    name: row.name,
    description: row.description ?? undefined,
    status: row.status as Project['status'],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    createdBy: row.created_by,
    resources: JSON.parse(row.resources_json),
    planning: JSON.parse(row.planning_json),
  };
}

export interface StripeAccountRecord {
  accountId: string;
  projectId?: string;
  secretKey: string;
  businessName: string;
  label?: string;
  isLive: boolean;
  connectedAt: number;
  connectedBy: string;
  webhookSecrets: Record<string, string>;
}

function encryptKey(key: string): string {
  return Buffer.from(key).toString('base64');
}

function decryptKey(encrypted: string): string {
  return Buffer.from(encrypted, 'base64').toString('utf-8');
}

export function saveStripeAccount(account: StripeAccountRecord): void {
  const db = getDatabase();
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO stripe_accounts
    (account_id, project_id, secret_key_encrypted, business_name, label, is_live, connected_at, connected_by, webhook_secrets_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    account.accountId,
    account.projectId ?? null,
    encryptKey(account.secretKey),
    account.businessName,
    account.label ?? null,
    account.isLive ? 1 : 0,
    account.connectedAt,
    account.connectedBy,
    JSON.stringify(account.webhookSecrets)
  );
}

export function getStripeAccount(accountId: string): StripeAccountRecord | null {
  const db = getDatabase();
  const stmt = db.prepare(`
    SELECT account_id, project_id, secret_key_encrypted, business_name, label, is_live, connected_at, connected_by, webhook_secrets_json
    FROM stripe_accounts
    WHERE account_id = ?
  `);

  const row = stmt.get(accountId) as {
    account_id: string;
    project_id: string | null;
    secret_key_encrypted: string;
    business_name: string;
    label: string | null;
    is_live: number;
    connected_at: number;
    connected_by: string;
    webhook_secrets_json: string;
  } | undefined;

  if (!row) return null;

  return {
    accountId: row.account_id,
    projectId: row.project_id ?? undefined,
    secretKey: decryptKey(row.secret_key_encrypted),
    businessName: row.business_name,
    label: row.label ?? undefined,
    isLive: row.is_live === 1,
    connectedAt: row.connected_at,
    connectedBy: row.connected_by,
    webhookSecrets: JSON.parse(row.webhook_secrets_json),
  };
}

export function listStripeAccounts(projectId?: string): StripeAccountRecord[] {
  const db = getDatabase();

  let stmt;
  let rows: Array<{
    account_id: string;
    project_id: string | null;
    secret_key_encrypted: string;
    business_name: string;
    label: string | null;
    is_live: number;
    connected_at: number;
    connected_by: string;
    webhook_secrets_json: string;
  }>;

  if (projectId) {
    stmt = db.prepare(`
      SELECT account_id, project_id, secret_key_encrypted, business_name, label, is_live, connected_at, connected_by, webhook_secrets_json
      FROM stripe_accounts
      WHERE project_id = ?
      ORDER BY connected_at DESC
    `);
    rows = stmt.all(projectId) as typeof rows;
  } else {
    stmt = db.prepare(`
      SELECT account_id, project_id, secret_key_encrypted, business_name, label, is_live, connected_at, connected_by, webhook_secrets_json
      FROM stripe_accounts
      ORDER BY connected_at DESC
    `);
    rows = stmt.all() as typeof rows;
  }

  return rows.map((row) => ({
    accountId: row.account_id,
    projectId: row.project_id ?? undefined,
    secretKey: decryptKey(row.secret_key_encrypted),
    businessName: row.business_name,
    label: row.label ?? undefined,
    isLive: row.is_live === 1,
    connectedAt: row.connected_at,
    connectedBy: row.connected_by,
    webhookSecrets: JSON.parse(row.webhook_secrets_json),
  }));
}

export function updateStripeWebhookSecret(
  accountId: string,
  webhookId: string,
  secret: string
): boolean {
  const account = getStripeAccount(accountId);
  if (!account) return false;

  account.webhookSecrets[webhookId] = secret;

  const db = getDatabase();
  const stmt = db.prepare(`
    UPDATE stripe_accounts
    SET webhook_secrets_json = ?
    WHERE account_id = ?
  `);

  const result = stmt.run(JSON.stringify(account.webhookSecrets), accountId);
  return result.changes > 0;
}

export function deleteStripeAccount(accountId: string): boolean {
  const db = getDatabase();
  const stmt = db.prepare(`DELETE FROM stripe_accounts WHERE account_id = ?`);
  const result = stmt.run(accountId);
  return result.changes > 0;
}
