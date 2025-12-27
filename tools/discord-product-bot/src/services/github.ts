import { Octokit } from '@octokit/rest';
import { config } from '../config.js';
import type { GitHubIssue, SearchResult, PullRequest, WorkflowRun, WorkflowJob } from '../types.js';

const octokit = new Octokit({
  auth: config.github.token,
});

export async function getFileContent(path: string): Promise<string> {
  try {
    const { data } = await octokit.repos.getContent({
      owner: config.github.owner,
      repo: config.github.repo,
      path,
    });

    if ('content' in data && data.type === 'file') {
      return Buffer.from(data.content, 'base64').toString('utf-8');
    }
    throw new Error(`${path} is not a file`);
  } catch (error: unknown) {
    if (error instanceof Error && 'status' in error && (error as { status: number }).status === 404) {
      throw new Error(`File not found: ${path}`);
    }
    throw error;
  }
}

export async function searchCode(
  query: string,
  fileExtension?: string
): Promise<SearchResult[]> {
  const q = `${query} repo:${config.github.owner}/${config.github.repo}` +
    (fileExtension ? ` extension:${fileExtension}` : '');

  const results = await octokit.search.code({ q, per_page: 10 });

  return results.data.items.map((item) => ({
    path: item.path,
    repository: item.repository.full_name,
    url: item.html_url,
    textMatches: item.text_matches?.map((m) => m.fragment).filter((f): f is string => f !== undefined) || [],
  }));
}

export async function listFiles(
  path: string,
  pattern?: string
): Promise<string[]> {
  try {
    const { data } = await octokit.repos.getContent({
      owner: config.github.owner,
      repo: config.github.repo,
      path,
    });

    if (!Array.isArray(data)) {
      throw new Error(`${path} is not a directory`);
    }

    let files = data.map((item) => item.path);

    if (pattern) {
      const regex = new RegExp(pattern.replace(/\*/g, '.*'));
      files = files.filter((f) => regex.test(f));
    }

    return files;
  } catch (error: unknown) {
    if (error instanceof Error && 'status' in error && (error as { status: number }).status === 404) {
      throw new Error(`Directory not found: ${path}`);
    }
    throw error;
  }
}

export async function getIssue(
  issueNumber: number
): Promise<GitHubIssue & { body: string; state: string; labels: string[] }> {
  const { data } = await octokit.issues.get({
    owner: config.github.owner,
    repo: config.github.repo,
    issue_number: issueNumber,
  });

  return {
    number: data.number,
    html_url: data.html_url,
    title: data.title,
    body: data.body || '',
    state: data.state,
    labels: data.labels.map((l) => (typeof l === 'string' ? l : l.name || '')),
  };
}

export async function listIssues(
  state?: 'open' | 'closed' | 'all',
  labels?: string[],
  limit?: number
): Promise<Array<GitHubIssue & { state: string }>> {
  const { data } = await octokit.issues.listForRepo({
    owner: config.github.owner,
    repo: config.github.repo,
    state: state || 'open',
    labels: labels?.join(','),
    per_page: limit || 10,
  });

  return data
    .filter((issue) => !issue.pull_request)
    .map((issue) => ({
      number: issue.number,
      html_url: issue.html_url,
      title: issue.title,
      state: issue.state,
    }));
}

/**
 * Returns the count of open issues in the repository (excluding PRs).
 * Used to determine if @Team should be added to trigger the pipeline.
 */
export async function getOpenIssueCount(): Promise<number> {
  const { data } = await octokit.issues.listForRepo({
    owner: config.github.owner,
    repo: config.github.repo,
    state: 'open',
    per_page: 100,
  });

  // Filter out pull requests (GitHub API includes PRs in issues endpoint)
  return data.filter((issue) => !issue.pull_request).length;
}

/**
 * Creates a new GitHub issue with conditional @Team mention.
 * - If there are zero open issues, appends @Team to trigger the pipeline immediately
 * - If there are other open issues, creates the issue without @Team (queued for later)
 * 
 * Returns both the issue and whether @Team was added.
 */
export async function createIssue(
  title: string,
  body: string,
  labels?: string[]
): Promise<GitHubIssue & { teamTagged: boolean }> {
  const validLabels = (labels || []).filter((label) =>
    ['bug', 'enhancement', 'question', 'documentation', 'review'].includes(label)
  );

  // Check if there are any open issues to determine if we should trigger immediately
  const openIssueCount = await getOpenIssueCount();
  const shouldTriggerPipeline = openIssueCount === 0;

  // Only append @Team if no other open issues exist (triggers pipeline immediately)
  const finalBody = shouldTriggerPipeline
    ? `${body}\n\n@Team`
    : body;

  console.log(
    `[GitHub] Creating issue "${title}" - open issues: ${openIssueCount}, @Team: ${shouldTriggerPipeline}`
  );

  const response = await octokit.issues.create({
    owner: config.github.owner,
    repo: config.github.repo,
    title,
    body: finalBody,
    labels: validLabels.length > 0 ? validLabels : undefined,
  });

  return {
    number: response.data.number,
    html_url: response.data.html_url,
    title: response.data.title,
    teamTagged: shouldTriggerPipeline,
  };
}

export async function getPullRequest(
  prNumber: number
): Promise<PullRequest & { body: string }> {
  const { data } = await octokit.pulls.get({
    owner: config.github.owner,
    repo: config.github.repo,
    pull_number: prNumber,
  });

  return {
    number: data.number,
    title: data.title,
    state: data.state,
    html_url: data.html_url,
    user: data.user?.login || 'unknown',
    created_at: data.created_at,
    body: data.body || '',
  };
}

export async function listPullRequests(
  state?: 'open' | 'closed' | 'all',
  limit?: number
): Promise<PullRequest[]> {
  const { data } = await octokit.pulls.list({
    owner: config.github.owner,
    repo: config.github.repo,
    state: state || 'open',
    per_page: limit || 10,
  });

  return data.map((pr) => ({
    number: pr.number,
    title: pr.title,
    state: pr.state,
    html_url: pr.html_url,
    user: pr.user?.login || 'unknown',
    created_at: pr.created_at,
  }));
}

export async function getWorkflowRuns(
  workflowName?: string,
  status?: string,
  limit?: number
): Promise<WorkflowRun[]> {
  const params: Parameters<typeof octokit.actions.listWorkflowRunsForRepo>[0] = {
    owner: config.github.owner,
    repo: config.github.repo,
    per_page: limit || 10,
  };

  if (status) {
    params.status = status as 'completed' | 'in_progress' | 'queued';
  }

  const { data } = await octokit.actions.listWorkflowRunsForRepo(params);

  let runs = data.workflow_runs;

  if (workflowName) {
    runs = runs.filter(
      (run) =>
        run.name?.toLowerCase().includes(workflowName.toLowerCase()) ||
        run.path?.toLowerCase().includes(workflowName.toLowerCase())
    );
  }

  return runs.slice(0, limit || 10).map((run) => ({
    id: run.id,
    name: run.name || 'Unknown',
    status: run.status || 'unknown',
    conclusion: run.conclusion,
    html_url: run.html_url,
    created_at: run.created_at,
  }));
}

/**
 * Fetches jobs for a specific workflow run.
 * This provides job-level detail including which agents are actively running.
 */
export async function getWorkflowRunJobs(runId: number): Promise<WorkflowJob[]> {
  try {
    const { data } = await octokit.actions.listJobsForWorkflowRun({
      owner: config.github.owner,
      repo: config.github.repo,
      run_id: runId,
    });

    return data.jobs.map((job) => ({
      id: job.id,
      name: job.name,
      status: job.status,
      conclusion: job.conclusion,
      started_at: job.started_at,
      html_url: job.html_url || '',
    }));
  } catch (error) {
    console.error(`[GitHub] Failed to fetch jobs for run ${runId}:`, error);
    return [];
  }
}

/**
 * Fetches workflow runs with their associated jobs for detailed status tracking.
 * Returns in-progress runs with job-level information.
 */
export async function getActiveWorkflowsWithJobs(limit?: number): Promise<
  Array<WorkflowRun & { jobs: WorkflowJob[]; issueNumber: number | null }>
> {
  // Get in-progress and queued runs
  const [inProgressRuns, queuedRuns] = await Promise.all([
    getWorkflowRuns(undefined, 'in_progress', limit || 5),
    getWorkflowRuns(undefined, 'queued', limit || 5),
  ]);

  const allActiveRuns = [...inProgressRuns, ...queuedRuns].slice(0, limit || 5);

  // Fetch jobs for each active run in parallel
  const runsWithJobs = await Promise.all(
    allActiveRuns.map(async (run) => {
      const jobs = await getWorkflowRunJobs(run.id);

      // Try to extract issue number from run name (e.g., "Issue Pipeline" processing #42)
      // or from the workflow run's head_branch which often contains issue number
      const issueNumber = extractIssueNumberFromRun(run.name);

      return {
        ...run,
        jobs,
        issueNumber,
      };
    })
  );

  return runsWithJobs;
}

/**
 * Extracts issue number from workflow run name or context.
 * Looks for patterns like "#42", "issue-42", "issue 42", etc.
 */
function extractIssueNumberFromRun(runName: string): number | null {
  // Match patterns like #42, issue-42, issue 42
  const patterns = [
    /#(\d+)/,
    /issue[- ]?(\d+)/i,
    /\[(\d+)\]/,
  ];

  for (const pattern of patterns) {
    const match = runName.match(pattern);
    if (match) {
      return parseInt(match[1], 10);
    }
  }

  return null;
}

export interface FileUpdateResult {
  path: string;
  sha: string;
  commitUrl: string;
}

export async function getFileSha(path: string): Promise<string> {
  const { data } = await octokit.repos.getContent({
    owner: config.github.owner,
    repo: config.github.repo,
    path,
  });

  if (!('sha' in data)) {
    throw new Error(`Cannot get SHA for ${path}: not a file`);
  }

  return data.sha;
}

export async function updateFile(
  path: string,
  content: string,
  message: string,
  branch?: string
): Promise<FileUpdateResult> {
  const sha = await getFileSha(path);

  const { data } = await octokit.repos.createOrUpdateFileContents({
    owner: config.github.owner,
    repo: config.github.repo,
    path,
    message,
    content: Buffer.from(content).toString('base64'),
    sha,
    branch: branch || 'main',
  });

  return {
    path,
    sha: data.content?.sha || '',
    commitUrl: data.commit.html_url || '',
  };
}

/**
 * Creates a new file in the repository.
 * Use this for files that don't exist yet (no SHA required).
 * 
 * @param path - Path where the file should be created
 * @param content - File content (base64 encoded if isBase64 is true)
 * @param message - Commit message
 * @param isBase64 - If true, content is already base64 encoded (for binary files)
 * @param branch - Target branch (defaults to 'main')
 */
export async function createFile(
  path: string,
  content: string,
  message: string,
  isBase64?: boolean,
  branch?: string
): Promise<FileUpdateResult> {
  // If content is not already base64, encode it
  const base64Content = isBase64 ? content : Buffer.from(content).toString('base64');

  const { data } = await octokit.repos.createOrUpdateFileContents({
    owner: config.github.owner,
    repo: config.github.repo,
    path,
    message,
    content: base64Content,
    branch: branch || 'main',
  });

  console.log(`[GitHub] Created file: ${path}`);

  return {
    path,
    sha: data.content?.sha || '',
    commitUrl: data.commit.html_url || '',
  };
}

/**
 * Downloads content from a URL (e.g., Discord CDN attachment).
 * Returns the content as a Buffer for binary handling.
 * 
 * @param url - The URL to download from
 * @returns Buffer containing the file content
 */
export async function downloadAttachment(url: string): Promise<Buffer> {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to download attachment: ${response.status} ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Result type for committing an attachment to the repository.
 */
export interface AttachmentCommitResult {
  path: string;
  sha: string;
  commitUrl: string;
  /** Permanent raw URL for referencing in markdown */
  permanentUrl: string;
}

/**
 * Downloads an attachment from a URL and commits it to the repository.
 * Useful for persisting Discord attachments whose URLs expire.
 * 
 * @param attachmentUrl - URL of the attachment to download
 * @param targetPath - Path in the repo where the file should be stored
 * @param commitMessage - Commit message for the file
 * @param branch - Target branch (defaults to 'main')
 */
export async function commitAttachment(
  attachmentUrl: string,
  targetPath: string,
  commitMessage: string,
  branch?: string
): Promise<AttachmentCommitResult> {
  // Download the attachment
  const content = await downloadAttachment(attachmentUrl);
  const base64Content = content.toString('base64');

  // Create the file in the repository
  const result = await createFile(targetPath, base64Content, commitMessage, true, branch);

  // Build the permanent raw URL for the file
  const permanentUrl = `https://raw.githubusercontent.com/${config.github.owner}/${config.github.repo}/${branch || 'main'}/${targetPath}`;

  console.log(`[GitHub] Committed attachment to: ${targetPath}`);

  return {
    ...result,
    permanentUrl,
  };
}

export interface IssueComment {
  id: number;
  body: string;
  html_url: string;
}

/**
 * Adds a comment to an existing GitHub issue.
 * Used to add @Team to trigger the pipeline on queued issues.
 */
export async function addIssueComment(
  issueNumber: number,
  body: string
): Promise<IssueComment> {
  const { data } = await octokit.issues.createComment({
    owner: config.github.owner,
    repo: config.github.repo,
    issue_number: issueNumber,
    body,
  });

  console.log(`[GitHub] Added comment to issue #${issueNumber}`);

  return {
    id: data.id,
    body: data.body || '',
    html_url: data.html_url,
  };
}

/**
 * Triggers the pipeline on an existing issue by adding a @Team comment.
 * Used when a queued issue is selected to be worked next.
 */
export async function triggerIssuePipeline(issueNumber: number): Promise<IssueComment> {
  return addIssueComment(
    issueNumber,
    '@Team\n\nThis issue has been selected to work next.'
  );
}
