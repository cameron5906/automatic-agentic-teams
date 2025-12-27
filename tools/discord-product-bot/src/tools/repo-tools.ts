import { LRUCache } from 'lru-cache';
import {
  getFileContent,
  searchCode,
  listFiles,
  getIssue,
  listIssues,
  createIssue,
  getPullRequest,
  listPullRequests,
  getWorkflowRuns,
  commitAttachment,
  type AttachmentCommitResult,
} from '../services/github.js';
import { trackIssue } from '../services/issue-tracker.js';
import type {
  SearchResult,
  DeploymentStatus,
  GitHubIssue,
  PullRequest,
  WorkflowRun,
} from '../types.js';

const fileCache = new LRUCache<string, string>({
  max: 100,
  ttl: 1000 * 60 * 5,
});

export async function repo_search_code(
  query: string,
  fileExtension?: string
): Promise<SearchResult[]> {
  return await searchCode(query, fileExtension);
}

export async function repo_read_file(path: string): Promise<string> {
  const cached = fileCache.get(path);
  if (cached) return cached;

  const content = await getFileContent(path);
  fileCache.set(path, content);
  return content;
}

export async function repo_list_files(
  path: string,
  pattern?: string
): Promise<string[]> {
  return await listFiles(path, pattern);
}

export async function repo_get_issue(issueNumber: number): Promise<GitHubIssue & { body: string; state: string; labels: string[] }> {
  return await getIssue(issueNumber);
}

export async function repo_list_issues(
  state?: 'open' | 'closed' | 'all',
  labels?: string[],
  limit?: number
): Promise<Array<GitHubIssue & { state: string }>> {
  return await listIssues(state, labels, limit);
}

export interface IssueCreationContext {
  channelId: string;
  threadId: string | null;
}

export async function repo_create_issue(
  title: string,
  body: string,
  labels?: string[],
  context?: IssueCreationContext
): Promise<GitHubIssue> {
  const issue = await createIssue(title, body, labels);

  if (context) {
    trackIssue(issue.number, issue.title, context.channelId, context.threadId);
  }

  return issue;
}

export async function repo_get_pr(prNumber: number): Promise<PullRequest & { body: string }> {
  return await getPullRequest(prNumber);
}

export async function repo_list_prs(
  state?: 'open' | 'closed' | 'all',
  limit?: number
): Promise<PullRequest[]> {
  return await listPullRequests(state, limit);
}

export async function repo_get_workflow_runs(
  workflowName?: string,
  status?: string,
  limit?: number
): Promise<WorkflowRun[]> {
  return await getWorkflowRuns(workflowName, status, limit);
}

export async function repo_get_deployment_status(
  environment?: string
): Promise<DeploymentStatus> {
  const runs = await getWorkflowRuns('deploy.yml', undefined, 5);
  const latestRun = runs[0];

  return {
    environment: environment || 'dev',
    status: latestRun?.conclusion || latestRun?.status || 'unknown',
    runUrl: latestRun?.html_url,
    timestamp: latestRun?.created_at,
  };
}

/**
 * Commits a file attachment (e.g., Discord image) to the repository.
 * Downloads the file from the provided URL and creates it in the repo.
 * Returns a permanent URL that can be used in GitHub issues/PRs.
 * 
 * @param attachmentUrl - The URL to download the attachment from (e.g., Discord CDN)
 * @param targetPath - Path in the repo where the file should be stored
 * @param commitMessage - Commit message describing the file
 */
export async function repo_commit_attachment(
  attachmentUrl: string,
  targetPath: string,
  commitMessage: string
): Promise<AttachmentCommitResult> {
  return await commitAttachment(attachmentUrl, targetPath, commitMessage);
}
