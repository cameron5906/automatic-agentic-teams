import type { ToolResult } from '../../types';
import * as github from '../../services/github';
import * as projectStore from '../../context/project-store';
import { config } from '../../config';

export async function listRepos(org?: string): Promise<ToolResult> {
  try {
    const repos = await github.listRepositories(org);

    return {
      success: true,
      data: {
        count: repos.length,
        repos: repos.map((r) => ({
          name: r.name,
          fullName: r.fullName,
          description: r.description,
          url: r.url,
          isPrivate: r.isPrivate,
          updatedAt: r.updatedAt,
        })),
        summary: `Found ${repos.length} repository(ies)`,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to list repositories',
    };
  }
}

export async function getRepo(owner: string, repo: string): Promise<ToolResult> {
  try {
    const repository = await github.getRepository(owner, repo);

    return {
      success: true,
      data: {
        name: repository.name,
        fullName: repository.fullName,
        description: repository.description,
        url: repository.url,
        isPrivate: repository.isPrivate,
        defaultBranch: repository.defaultBranch,
        topics: repository.topics,
        language: repository.language,
        stars: repository.stargazersCount,
        forks: repository.forksCount,
        issues: repository.openIssuesCount,
        createdAt: repository.createdAt,
        updatedAt: repository.updatedAt,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get repository',
    };
  }
}

export async function createRepo(
  name: string,
  projectId: string,
  options: {
    description?: string;
    isPrivate?: boolean;
  } = {},
  hasApproval = false
): Promise<ToolResult> {
  const project = projectStore.getProject(projectId);
  if (!project) {
    return {
      success: false,
      error: `Project ${projectId} not found`,
    };
  }

  if (!hasApproval && !projectStore.hasApproval(projectId, 'repo')) {
    return {
      success: false,
      requiresApproval: true,
      approvalPrompt: `I'd like to create a new ${options.isPrivate !== false ? 'private' : 'public'} repository called **${name}** in **${config.github.org}**. Do you approve?`,
      error: 'Repository creation requires human approval',
    };
  }

  try {
    const repo = await github.createRepository(name, {
      description: options.description ?? project.description,
      isPrivate: options.isPrivate ?? true,
      autoInit: true,
    });

    projectStore.setGitHubResource(projectId, {
      owner: config.github.org,
      repo: repo.name,
      url: repo.url,
      isPrivate: options.isPrivate ?? true,
    });

    return {
      success: true,
      data: {
        name: repo.name,
        fullName: repo.fullName,
        url: repo.url,
        cloneUrl: repo.cloneUrl,
        message: `Created repository: ${repo.fullName}`,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create repository',
    };
  }
}

export async function createRepoFromTemplate(
  name: string,
  projectId: string,
  options: {
    description?: string;
    isPrivate?: boolean;
  } = {},
  hasApproval = false
): Promise<ToolResult> {
  const project = projectStore.getProject(projectId);
  if (!project) {
    return {
      success: false,
      error: `Project ${projectId} not found`,
    };
  }

  const templateRepo = config.github.templateRepo;

  if (!hasApproval && !projectStore.hasApproval(projectId, 'repo')) {
    return {
      success: false,
      requiresApproval: true,
      approvalPrompt: `I'd like to create a new ${options.isPrivate !== false ? 'private' : 'public'} repository called **${name}** in **${config.github.org}** from the template **${templateRepo}**. This will set up the automated agent pipeline. Do you approve?`,
      error: 'Repository creation requires human approval',
    };
  }

  try {
    const repo = await github.createRepositoryFromTemplate(name, {
      description: options.description ?? project.description,
      isPrivate: options.isPrivate ?? true,
    });

    projectStore.setGitHubResource(projectId, {
      owner: config.github.org,
      repo: repo.name,
      url: repo.url,
      isPrivate: options.isPrivate ?? true,
    });

    return {
      success: true,
      data: {
        name: repo.name,
        fullName: repo.fullName,
        url: repo.url,
        cloneUrl: repo.cloneUrl,
        createdFromTemplate: repo.createdFromTemplate,
        message: `Created repository ${repo.fullName} from template ${repo.createdFromTemplate}`,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create repository from template',
    };
  }
}

export async function forkRepo(
  owner: string,
  repo: string,
  projectId: string,
  newName?: string,
  hasApproval = false
): Promise<ToolResult> {
  const project = projectStore.getProject(projectId);
  if (!project) {
    return {
      success: false,
      error: `Project ${projectId} not found`,
    };
  }

  if (!hasApproval && !projectStore.hasApproval(projectId, 'repo')) {
    return {
      success: false,
      requiresApproval: true,
      approvalPrompt: `I'd like to fork **${owner}/${repo}**${newName ? ` as **${newName}**` : ''} into **${config.github.org}**. Do you approve?`,
      error: 'Repository forking requires human approval',
    };
  }

  try {
    const fork = await github.forkRepository(owner, repo, { newName });

    projectStore.setGitHubResource(projectId, {
      owner: config.github.org,
      repo: fork.name,
      url: fork.url,
      forkedFrom: fork.forkedFrom,
      isPrivate: true,
    });

    return {
      success: true,
      data: {
        name: fork.name,
        fullName: fork.fullName,
        url: fork.url,
        forkedFrom: fork.forkedFrom,
        message: `Forked ${fork.forkedFrom} to ${fork.fullName}`,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fork repository',
    };
  }
}

export async function deleteRepo(
  owner: string,
  repo: string,
  hasApproval = false
): Promise<ToolResult> {
  if (!hasApproval) {
    return {
      success: false,
      requiresApproval: true,
      approvalPrompt: `⚠️ **DANGER**: I'm about to permanently delete **${owner}/${repo}**. This cannot be undone! Do you approve?`,
      error: 'Repository deletion requires human approval',
    };
  }

  try {
    const success = await github.deleteRepository(owner, repo);

    if (success) {
      return {
        success: true,
        data: {
          owner,
          repo,
          message: `Deleted repository: ${owner}/${repo}`,
        },
      };
    } else {
      return {
        success: false,
        error: 'Failed to delete repository',
      };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete repository',
    };
  }
}

export async function updateRepo(
  owner: string,
  repo: string,
  options: {
    name?: string;
    description?: string;
    homepage?: string;
    isPrivate?: boolean;
  }
): Promise<ToolResult> {
  try {
    const success = await github.updateRepository(owner, repo, options);

    if (success) {
      return {
        success: true,
        data: {
          owner,
          repo,
          updates: options,
          message: `Updated repository: ${owner}/${repo}`,
        },
      };
    } else {
      return {
        success: false,
        error: 'Failed to update repository',
      };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update repository',
    };
  }
}

export async function createFile(
  owner: string,
  repo: string,
  path: string,
  content: string,
  message: string,
  branch?: string
): Promise<ToolResult> {
  try {
    const result = await github.createOrUpdateFile(owner, repo, path, content, message, branch);

    if (result.success) {
      return {
        success: true,
        data: {
          path,
          sha: result.sha,
          url: result.url,
          message: `Created/updated file: ${path}`,
        },
      };
    } else {
      return {
        success: false,
        error: 'Failed to create/update file',
      };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create/update file',
    };
  }
}

export async function getFile(
  owner: string,
  repo: string,
  path: string,
  ref?: string
): Promise<ToolResult> {
  try {
    const content = await github.getFileContent(owner, repo, path, ref);

    if (content !== null) {
      return {
        success: true,
        data: {
          path,
          content,
          length: content.length,
        },
      };
    } else {
      return {
        success: false,
        error: `File not found: ${path}`,
      };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get file',
    };
  }
}

export async function addCollaborator(
  owner: string,
  repo: string,
  username: string,
  permission: 'pull' | 'push' | 'admin' = 'push'
): Promise<ToolResult> {
  try {
    const success = await github.addCollaborator(owner, repo, username, permission);

    if (success) {
      return {
        success: true,
        data: {
          owner,
          repo,
          username,
          permission,
          message: `Added ${username} as collaborator with ${permission} access`,
        },
      };
    } else {
      return {
        success: false,
        error: 'Failed to add collaborator',
      };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to add collaborator',
    };
  }
}
