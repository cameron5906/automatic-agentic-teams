import { Octokit } from '@octokit/rest';
import { seal } from 'tweetsodium';
import { config } from '../config';

let octokit: Octokit | null = null;

export function getOctokit(): Octokit {
  if (!octokit) {
    octokit = new Octokit({
      auth: config.github.token,
    });
  }
  return octokit;
}

export async function listRepositories(org?: string): Promise<Array<{
  name: string;
  fullName: string;
  description: string | null;
  url: string;
  isPrivate: boolean;
  defaultBranch: string;
  createdAt: string;
  updatedAt: string;
}>> {
  const client = getOctokit();
  const targetOrg = org ?? config.github.org;

  try {
    const { data: repos } = await client.repos.listForOrg({
      org: targetOrg,
      per_page: 100,
      sort: 'updated',
    });

    return repos.map((repo) => ({
      name: repo.name,
      fullName: repo.full_name,
      description: repo.description,
      url: repo.html_url,
      isPrivate: repo.private,
      defaultBranch: repo.default_branch ?? 'main',
      createdAt: repo.created_at ?? '',
      updatedAt: repo.updated_at ?? '',
    }));
  } catch {
    const { data: repos } = await client.repos.listForAuthenticatedUser({
      per_page: 100,
      sort: 'updated',
    });

    return repos.map((repo) => ({
      name: repo.name,
      fullName: repo.full_name,
      description: repo.description,
      url: repo.html_url,
      isPrivate: repo.private,
      defaultBranch: repo.default_branch ?? 'main',
      createdAt: repo.created_at ?? '',
      updatedAt: repo.updated_at ?? '',
    }));
  }
}

export async function getRepository(owner: string, repo: string): Promise<{
  name: string;
  fullName: string;
  description: string | null;
  url: string;
  isPrivate: boolean;
  defaultBranch: string;
  topics: string[];
  language: string | null;
  stargazersCount: number;
  forksCount: number;
  openIssuesCount: number;
  createdAt: string;
  updatedAt: string;
}> {
  const client = getOctokit();

  const { data: repository } = await client.repos.get({
    owner,
    repo,
  });

  return {
    name: repository.name,
    fullName: repository.full_name,
    description: repository.description,
    url: repository.html_url,
    isPrivate: repository.private,
    defaultBranch: repository.default_branch,
    topics: repository.topics ?? [],
    language: repository.language,
    stargazersCount: repository.stargazers_count,
    forksCount: repository.forks_count,
    openIssuesCount: repository.open_issues_count,
    createdAt: repository.created_at ?? '',
    updatedAt: repository.updated_at ?? '',
  };
}

export async function createRepository(
  name: string,
  options: {
    description?: string;
    isPrivate?: boolean;
    autoInit?: boolean;
    org?: string;
  } = {}
): Promise<{
  name: string;
  fullName: string;
  url: string;
  cloneUrl: string;
  sshUrl: string;
}> {
  const client = getOctokit();
  const targetOrg = options.org ?? config.github.org;

  try {
    const { data: repo } = await client.repos.createInOrg({
      org: targetOrg,
      name,
      description: options.description,
      private: options.isPrivate ?? true,
      auto_init: options.autoInit ?? true,
    });

    return {
      name: repo.name,
      fullName: repo.full_name,
      url: repo.html_url,
      cloneUrl: repo.clone_url,
      sshUrl: repo.ssh_url,
    };
  } catch {
    const { data: repo } = await client.repos.createForAuthenticatedUser({
      name,
      description: options.description,
      private: options.isPrivate ?? true,
      auto_init: options.autoInit ?? true,
    });

    return {
      name: repo.name,
      fullName: repo.full_name,
      url: repo.html_url,
      cloneUrl: repo.clone_url,
      sshUrl: repo.ssh_url,
    };
  }
}

export async function createRepositoryFromTemplate(
  name: string,
  options: {
    description?: string;
    isPrivate?: boolean;
    org?: string;
    templateOwner?: string;
    templateRepo?: string;
  } = {}
): Promise<{
  name: string;
  fullName: string;
  url: string;
  cloneUrl: string;
  sshUrl: string;
  createdFromTemplate: string;
}> {
  const client = getOctokit();
  const targetOrg = options.org ?? config.github.org;

  const templateFull = config.github.templateRepo;
  const [defaultTemplateOwner, defaultTemplateRepo] = templateFull.split('/');

  const templateOwner = options.templateOwner ?? defaultTemplateOwner;
  const templateRepo = options.templateRepo ?? defaultTemplateRepo;

  const { data: repo } = await client.repos.createUsingTemplate({
    template_owner: templateOwner,
    template_repo: templateRepo,
    owner: targetOrg,
    name,
    description: options.description,
    private: options.isPrivate ?? true,
    include_all_branches: false,
  });

  return {
    name: repo.name,
    fullName: repo.full_name,
    url: repo.html_url,
    cloneUrl: repo.clone_url,
    sshUrl: repo.ssh_url,
    createdFromTemplate: `${templateOwner}/${templateRepo}`,
  };
}

export async function forkRepository(
  owner: string,
  repo: string,
  options: {
    newName?: string;
    org?: string;
  } = {}
): Promise<{
  name: string;
  fullName: string;
  url: string;
  forkedFrom: string;
}> {
  const client = getOctokit();
  const targetOrg = options.org ?? config.github.org;

  const { data: fork } = await client.repos.createFork({
    owner,
    repo,
    organization: targetOrg,
    name: options.newName,
  });

  if (options.newName && fork.name !== options.newName) {
    await client.repos.update({
      owner: fork.owner?.login ?? targetOrg,
      repo: fork.name,
      name: options.newName,
    });
  }

  return {
    name: options.newName ?? fork.name,
    fullName: `${targetOrg}/${options.newName ?? fork.name}`,
    url: fork.html_url,
    forkedFrom: `${owner}/${repo}`,
  };
}

export async function deleteRepository(owner: string, repo: string): Promise<boolean> {
  const client = getOctokit();

  try {
    await client.repos.delete({
      owner,
      repo,
    });
    return true;
  } catch (error) {
    console.error(`Failed to delete repository ${owner}/${repo}:`, error);
    return false;
  }
}

export async function updateRepository(
  owner: string,
  repo: string,
  options: {
    name?: string;
    description?: string;
    homepage?: string;
    isPrivate?: boolean;
    defaultBranch?: string;
  }
): Promise<boolean> {
  const client = getOctokit();

  try {
    await client.repos.update({
      owner,
      repo,
      name: options.name,
      description: options.description,
      homepage: options.homepage,
      private: options.isPrivate,
      default_branch: options.defaultBranch,
    });
    return true;
  } catch (error) {
    console.error(`Failed to update repository ${owner}/${repo}:`, error);
    return false;
  }
}

export async function createOrUpdateFile(
  owner: string,
  repo: string,
  path: string,
  content: string,
  message: string,
  branch?: string
): Promise<{
  success: boolean;
  sha?: string;
  url?: string;
}> {
  const client = getOctokit();

  let existingSha: string | undefined;

  try {
    const { data: existing } = await client.repos.getContent({
      owner,
      repo,
      path,
      ref: branch,
    });

    if ('sha' in existing) {
      existingSha = existing.sha;
    }
  } catch {
    // File doesn't exist, which is fine
  }

  try {
    const { data: result } = await client.repos.createOrUpdateFileContents({
      owner,
      repo,
      path,
      message,
      content: Buffer.from(content).toString('base64'),
      sha: existingSha,
      branch,
    });

    return {
      success: true,
      sha: result.content?.sha,
      url: result.content?.html_url,
    };
  } catch (error) {
    console.error(`Failed to create/update file ${path}:`, error);
    return { success: false };
  }
}

export async function getFileContent(
  owner: string,
  repo: string,
  path: string,
  ref?: string
): Promise<string | null> {
  const client = getOctokit();

  try {
    const { data } = await client.repos.getContent({
      owner,
      repo,
      path,
      ref,
    });

    if ('content' in data && data.encoding === 'base64') {
      return Buffer.from(data.content, 'base64').toString('utf-8');
    }

    return null;
  } catch {
    return null;
  }
}

export async function listBranches(owner: string, repo: string): Promise<string[]> {
  const client = getOctokit();

  const { data: branches } = await client.repos.listBranches({
    owner,
    repo,
    per_page: 100,
  });

  return branches.map((b) => b.name);
}

export async function addCollaborator(
  owner: string,
  repo: string,
  username: string,
  permission: 'pull' | 'push' | 'admin' = 'push'
): Promise<boolean> {
  const client = getOctokit();

  try {
    await client.repos.addCollaborator({
      owner,
      repo,
      username,
      permission,
    });
    return true;
  } catch (error) {
    console.error(`Failed to add collaborator ${username}:`, error);
    return false;
  }
}

export async function createWebhook(
  owner: string,
  repo: string,
  url: string,
  events: string[] = ['push', 'pull_request']
): Promise<{
  success: boolean;
  id?: number;
}> {
  const client = getOctokit();

  try {
    const { data: hook } = await client.repos.createWebhook({
      owner,
      repo,
      config: {
        url,
        content_type: 'json',
      },
      events,
      active: true,
    });

    return {
      success: true,
      id: hook.id,
    };
  } catch (error) {
    console.error('Failed to create webhook:', error);
    return { success: false };
  }
}

export async function getAuthenticatedUser(): Promise<{
  login: string;
  name: string | null;
  email: string | null;
}> {
  const client = getOctokit();

  const { data: user } = await client.users.getAuthenticated();

  return {
    login: user.login,
    name: user.name,
    email: user.email,
  };
}

export async function getRepositoryPublicKey(
  owner: string,
  repo: string
): Promise<{ keyId: string; key: string }> {
  const client = getOctokit();

  const { data } = await client.actions.getRepoPublicKey({
    owner,
    repo,
  });

  return {
    keyId: data.key_id,
    key: data.key,
  };
}

function encryptSecret(publicKey: string, secretValue: string): string {
  const messageBytes = Buffer.from(secretValue);
  const keyBytes = Buffer.from(publicKey, 'base64');

  const encryptedBytes = seal(messageBytes, keyBytes);
  return Buffer.from(encryptedBytes).toString('base64');
}

export async function setRepositorySecret(
  owner: string,
  repo: string,
  secretName: string,
  secretValue: string
): Promise<boolean> {
  const client = getOctokit();

  try {
    const { keyId, key } = await getRepositoryPublicKey(owner, repo);
    const encryptedValue = encryptSecret(key, secretValue);

    await client.actions.createOrUpdateRepoSecret({
      owner,
      repo,
      secret_name: secretName,
      encrypted_value: encryptedValue,
      key_id: keyId,
    });

    return true;
  } catch (error) {
    console.error(`Failed to set secret ${secretName}:`, error);
    return false;
  }
}

export async function deleteRepositorySecret(
  owner: string,
  repo: string,
  secretName: string
): Promise<boolean> {
  const client = getOctokit();

  try {
    await client.actions.deleteRepoSecret({
      owner,
      repo,
      secret_name: secretName,
    });
    return true;
  } catch (error) {
    console.error(`Failed to delete secret ${secretName}:`, error);
    return false;
  }
}

export async function listRepositorySecrets(
  owner: string,
  repo: string
): Promise<string[]> {
  const client = getOctokit();

  try {
    const { data } = await client.actions.listRepoSecrets({
      owner,
      repo,
    });

    return data.secrets.map((s) => s.name);
  } catch (error) {
    console.error('Failed to list secrets:', error);
    return [];
  }
}

export async function setRepositoryVariable(
  owner: string,
  repo: string,
  name: string,
  value: string
): Promise<boolean> {
  const client = getOctokit();

  try {
    try {
      await client.actions.updateRepoVariable({
        owner,
        repo,
        name,
        value,
      });
    } catch {
      await client.actions.createRepoVariable({
        owner,
        repo,
        name,
        value,
      });
    }
    return true;
  } catch (error) {
    console.error(`Failed to set variable ${name}:`, error);
    return false;
  }
}

export async function listRepositoryVariables(
  owner: string,
  repo: string
): Promise<Array<{ name: string; value: string }>> {
  const client = getOctokit();

  try {
    const { data } = await client.actions.listRepoVariables({
      owner,
      repo,
    });

    return data.variables.map((v) => ({ name: v.name, value: v.value }));
  } catch (error) {
    console.error('Failed to list variables:', error);
    return [];
  }
}

export interface PipelineSecrets {
  ANTHROPIC_API_KEY?: string;
  CLAUDE_WORKFLOW_TOKEN?: string;
  DISCORD_DEV_WEBHOOK_URL?: string;
  DISCORD_PRODUCT_WEBHOOK_URL?: string;
  OPENAI_API_KEY?: string;
}

export interface PipelineVariables {
  DISCORD_PRODUCT_CHANNEL_ID?: string;
  DISCORD_DEV_CHANNEL_ID?: string;
  DISCORD_PR_CHANNEL_ID?: string;
  DISCORD_TEAM_LEAD_USER_ID?: string;
}

export async function configureRepositoryForPipelines(
  owner: string,
  repo: string,
  secrets: PipelineSecrets,
  variables: PipelineVariables
): Promise<{
  success: boolean;
  secretsSet: string[];
  variablesSet: string[];
  errors: string[];
}> {
  const secretsSet: string[] = [];
  const variablesSet: string[] = [];
  const errors: string[] = [];

  for (const [name, value] of Object.entries(secrets)) {
    if (value) {
      const success = await setRepositorySecret(owner, repo, name, value);
      if (success) {
        secretsSet.push(name);
      } else {
        errors.push(`Failed to set secret: ${name}`);
      }
    }
  }

  for (const [name, value] of Object.entries(variables)) {
    if (value) {
      const success = await setRepositoryVariable(owner, repo, name, value);
      if (success) {
        variablesSet.push(name);
      } else {
        errors.push(`Failed to set variable: ${name}`);
      }
    }
  }

  return {
    success: errors.length === 0,
    secretsSet,
    variablesSet,
    errors,
  };
}
