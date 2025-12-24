import Database from 'better-sqlite3';
import { config } from '../config.js';
import { getIssue, listPullRequests as ghListPRs } from './github.js';
import type { PullRequest } from '../types.js';

export interface TrackedIssue {
  issueNumber: number;
  title: string;
  threadId: string | null;
  channelId: string;
  createdAt: number;
  closedAt: number | null;
  status: 'open' | 'closed';
  linkedPrNumber: number | null;
  linkedPrStatus: 'open' | 'merged' | 'closed' | null;
  prAnnouncedAt: number | null;
  mergeAnnouncedAt: number | null;
  closureAnnouncedAt: number | null;
}

export interface TrackedIssueUpdate {
  issueNumber: number;
  previousStatus: string;
  newStatus: string;
  linkedPrNumber?: number;
  linkedPrStatus?: string;
  issue: TrackedIssue;
}

let db: Database.Database | null = null;

function getDb(): Database.Database {
  if (!db) {
    db = new Database(config.persistence.sqlitePath);
    migrate(db);
  }
  return db;
}

function migrate(database: Database.Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS tracked_issues (
      issue_number INTEGER PRIMARY KEY,
      title TEXT NOT NULL,
      thread_id TEXT,
      channel_id TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      closed_at INTEGER,
      status TEXT NOT NULL DEFAULT 'open',
      linked_pr_number INTEGER,
      linked_pr_status TEXT,
      pr_announced_at INTEGER,
      merge_announced_at INTEGER,
      closure_announced_at INTEGER
    );

    CREATE INDEX IF NOT EXISTS idx_tracked_issues_status
      ON tracked_issues(status);

    CREATE INDEX IF NOT EXISTS idx_tracked_issues_linked_pr
      ON tracked_issues(linked_pr_number);
  `);
}

export function trackIssue(
  issueNumber: number,
  title: string,
  channelId: string,
  threadId: string | null
): void {
  const database = getDb();
  const stmt = database.prepare(`
    INSERT OR REPLACE INTO tracked_issues (
      issue_number, title, thread_id, channel_id, created_at, status
    ) VALUES (
      @issue_number, @title, @thread_id, @channel_id, @created_at, 'open'
    )
  `);

  stmt.run({
    issue_number: issueNumber,
    title,
    thread_id: threadId,
    channel_id: channelId,
    created_at: Date.now(),
  });

  console.log(`[IssueTracker] Now tracking issue #${issueNumber}: ${title}`);
}

export function getTrackedIssue(issueNumber: number): TrackedIssue | null {
  const database = getDb();
  const stmt = database.prepare(`
    SELECT * FROM tracked_issues WHERE issue_number = ?
  `);

  const row = stmt.get(issueNumber) as any;
  if (!row) return null;

  return mapRowToTrackedIssue(row);
}

export function getOpenTrackedIssues(): TrackedIssue[] {
  const database = getDb();
  const stmt = database.prepare(`
    SELECT * FROM tracked_issues WHERE status = 'open'
  `);

  const rows = stmt.all() as any[];
  return rows.map(mapRowToTrackedIssue);
}

export function getIssuesNeedingPrAnnouncement(): TrackedIssue[] {
  const database = getDb();
  const stmt = database.prepare(`
    SELECT * FROM tracked_issues
    WHERE linked_pr_number IS NOT NULL
      AND linked_pr_status = 'open'
      AND pr_announced_at IS NULL
  `);

  const rows = stmt.all() as any[];
  return rows.map(mapRowToTrackedIssue);
}

export function getIssuesNeedingMergeAnnouncement(): TrackedIssue[] {
  const database = getDb();
  const stmt = database.prepare(`
    SELECT * FROM tracked_issues
    WHERE linked_pr_number IS NOT NULL
      AND linked_pr_status = 'merged'
      AND merge_announced_at IS NULL
  `);

  const rows = stmt.all() as any[];
  return rows.map(mapRowToTrackedIssue);
}

export function getIssuesNeedingClosureAnnouncement(): TrackedIssue[] {
  const database = getDb();
  const stmt = database.prepare(`
    SELECT * FROM tracked_issues
    WHERE status = 'closed'
      AND closure_announced_at IS NULL
  `);

  const rows = stmt.all() as any[];
  return rows.map(mapRowToTrackedIssue);
}

export function updateIssueStatus(
  issueNumber: number,
  status: 'open' | 'closed',
  closedAt?: number
): void {
  const database = getDb();
  const stmt = database.prepare(`
    UPDATE tracked_issues
    SET status = @status, closed_at = @closed_at
    WHERE issue_number = @issue_number
  `);

  stmt.run({
    issue_number: issueNumber,
    status,
    closed_at: closedAt || null,
  });
}

export function updateLinkedPr(
  issueNumber: number,
  prNumber: number,
  prStatus: 'open' | 'merged' | 'closed'
): void {
  const database = getDb();
  const stmt = database.prepare(`
    UPDATE tracked_issues
    SET linked_pr_number = @pr_number, linked_pr_status = @pr_status
    WHERE issue_number = @issue_number
  `);

  stmt.run({
    issue_number: issueNumber,
    pr_number: prNumber,
    pr_status: prStatus,
  });
}

export function markPrAnnounced(issueNumber: number): void {
  const database = getDb();
  const stmt = database.prepare(`
    UPDATE tracked_issues SET pr_announced_at = ? WHERE issue_number = ?
  `);
  stmt.run(Date.now(), issueNumber);
}

export function markMergeAnnounced(issueNumber: number): void {
  const database = getDb();
  const stmt = database.prepare(`
    UPDATE tracked_issues SET merge_announced_at = ? WHERE issue_number = ?
  `);
  stmt.run(Date.now(), issueNumber);
}

export function markClosureAnnounced(issueNumber: number): void {
  const database = getDb();
  const stmt = database.prepare(`
    UPDATE tracked_issues SET closure_announced_at = ? WHERE issue_number = ?
  `);
  stmt.run(Date.now(), issueNumber);
}

function mapRowToTrackedIssue(row: any): TrackedIssue {
  return {
    issueNumber: row.issue_number,
    title: row.title,
    threadId: row.thread_id,
    channelId: row.channel_id,
    createdAt: row.created_at,
    closedAt: row.closed_at,
    status: row.status,
    linkedPrNumber: row.linked_pr_number,
    linkedPrStatus: row.linked_pr_status,
    prAnnouncedAt: row.pr_announced_at,
    mergeAnnouncedAt: row.merge_announced_at,
    closureAnnouncedAt: row.closure_announced_at,
  };
}

export async function pollIssueStatus(issueNumber: number): Promise<TrackedIssueUpdate | null> {
  const tracked = getTrackedIssue(issueNumber);
  if (!tracked) return null;

  try {
    const issue = await getIssue(issueNumber);
    const previousStatus = tracked.status;
    const newStatus = issue.state as 'open' | 'closed';

    if (previousStatus !== newStatus) {
      updateIssueStatus(
        issueNumber,
        newStatus,
        newStatus === 'closed' ? Date.now() : undefined
      );

      return {
        issueNumber,
        previousStatus,
        newStatus,
        issue: { ...tracked, status: newStatus },
      };
    }

    return null;
  } catch (error) {
    console.error(`[IssueTracker] Failed to poll issue #${issueNumber}:`, error);
    return null;
  }
}

export async function findLinkedPRForIssue(issueNumber: number): Promise<PullRequest | null> {
  try {
    const prs = await ghListPRs('all', 20);

    for (const pr of prs) {
      if (
        pr.title.includes(`#${issueNumber}`) ||
        pr.title.toLowerCase().includes(`issue ${issueNumber}`)
      ) {
        return pr;
      }
    }

    return null;
  } catch (error) {
    console.error(`[IssueTracker] Failed to find linked PR for issue #${issueNumber}:`, error);
    return null;
  }
}

export async function checkPRStatus(prNumber: number): Promise<'open' | 'merged' | 'closed'> {
  const { getPullRequest } = await import('./github.js');

  try {
    const pr = await getPullRequest(prNumber);

    if (pr.state === 'closed') {
      const { Octokit } = await import('@octokit/rest');
      const octokit = new Octokit({ auth: config.github.token });

      const { data } = await octokit.pulls.get({
        owner: config.github.owner,
        repo: config.github.repo,
        pull_number: prNumber,
      });

      return data.merged ? 'merged' : 'closed';
    }

    return 'open';
  } catch (error) {
    console.error(`[IssueTracker] Failed to check PR #${prNumber} status:`, error);
    return 'open';
  }
}
