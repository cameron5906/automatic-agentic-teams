import { Octokit } from '@octokit/rest';
import { config } from '../config.js';
import type { GitHubIssue, SearchResult, PullRequest, WorkflowRun } from '../types.js';

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

export async function createIssue(
  title: string,
  body: string,
  labels?: string[]
): Promise<GitHubIssue> {
  const validLabels = (labels || []).filter((label) =>
    ['bug', 'enhancement', 'question', 'documentation', 'review'].includes(label)
  );

  // Append @claude mention to trigger Claude Code agent on the issue
  const bodyWithClaude = `${body}\n\n@claude`;

  const response = await octokit.issues.create({
    owner: config.github.owner,
    repo: config.github.repo,
    title,
    body: bodyWithClaude,
    labels: validLabels.length > 0 ? validLabels : undefined,
  });

  return {
    number: response.data.number,
    html_url: response.data.html_url,
    title: response.data.title,
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
