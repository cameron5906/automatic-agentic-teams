import type { ToolResult, Project } from '../../types';
import * as projectStore from '../../context/project-store';
import * as github from '../../services/github';
import * as namecheap from '../../services/namecheap';

export async function createProject(
  name: string,
  createdBy: string,
  description?: string,
  threadId?: string
): Promise<ToolResult> {
  try {
    const project = projectStore.createProject(name, createdBy, description, threadId);

    return {
      success: true,
      data: {
        id: project.id,
        name: project.name,
        status: project.status,
        message: `Created project: ${project.name} (${project.id})`,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create project',
    };
  }
}

export async function getProject(projectId: string): Promise<ToolResult> {
  const project = projectStore.getProject(projectId);

  if (!project) {
    return {
      success: false,
      error: `Project ${projectId} not found`,
    };
  }

  return {
    success: true,
    data: {
      id: project.id,
      name: project.name,
      description: project.description,
      status: project.status,
      createdAt: new Date(project.createdAt).toISOString(),
      updatedAt: new Date(project.updatedAt).toISOString(),
      createdBy: project.createdBy,
      resources: {
        domain: project.resources.domain
          ? {
              name: project.resources.domain.name,
              expiresAt: new Date(project.resources.domain.expiresAt).toISOString(),
            }
          : null,
        github: project.resources.github
          ? {
              repo: `${project.resources.github.owner}/${project.resources.github.repo}`,
              url: project.resources.github.url,
            }
          : null,
        discord: project.resources.discord
          ? {
              serverName: project.resources.discord.serverName,
              serverId: project.resources.discord.serverId,
              channels: project.resources.discord.channels,
            }
          : null,
      },
      planning: {
        ideaCount: project.planning.ideas.length,
        researchCount: project.planning.research.length,
        hasBusinessPlan: Boolean(project.planning.businessPlan),
        approvals: project.planning.approvals,
      },
    },
  };
}

export async function listProjects(status?: Project['status']): Promise<ToolResult> {
  const projects = projectStore.listProjects(status);

  return {
    success: true,
    data: {
      count: projects.length,
      filter: status ?? 'all',
      projects: projects.map((p) => ({
        id: p.id,
        name: p.name,
        status: p.status,
        hasResources: Boolean(
          p.resources.domain || p.resources.github || p.resources.discord
        ),
        updatedAt: new Date(p.updatedAt).toISOString(),
      })),
    },
  };
}

export async function addIdea(projectId: string, idea: string): Promise<ToolResult> {
  const project = projectStore.addIdea(projectId, idea);

  if (!project) {
    return {
      success: false,
      error: `Project ${projectId} not found`,
    };
  }

  return {
    success: true,
    data: {
      projectId,
      ideaCount: project.planning.ideas.length,
      message: `Added idea to project (${project.planning.ideas.length} total)`,
    },
  };
}

export async function addResearch(projectId: string, research: string): Promise<ToolResult> {
  const project = projectStore.addResearch(projectId, research);

  if (!project) {
    return {
      success: false,
      error: `Project ${projectId} not found`,
    };
  }

  return {
    success: true,
    data: {
      projectId,
      researchCount: project.planning.research.length,
      message: `Added research to project (${project.planning.research.length} entries)`,
    },
  };
}

export async function setBusinessPlan(projectId: string, businessPlan: string): Promise<ToolResult> {
  const project = projectStore.setBusinessPlan(projectId, businessPlan);

  if (!project) {
    return {
      success: false,
      error: `Project ${projectId} not found`,
    };
  }

  return {
    success: true,
    data: {
      projectId,
      message: 'Business plan updated',
    },
  };
}

export async function setStatus(projectId: string, status: Project['status']): Promise<ToolResult> {
  const project = projectStore.setProjectStatus(projectId, status);

  if (!project) {
    return {
      success: false,
      error: `Project ${projectId} not found`,
    };
  }

  return {
    success: true,
    data: {
      projectId,
      oldStatus: project.status,
      newStatus: status,
      message: `Project status changed to ${status}`,
    },
  };
}

export async function getProjectStatus(projectId: string): Promise<ToolResult> {
  const project = projectStore.getProject(projectId);

  if (!project) {
    return {
      success: false,
      error: `Project ${projectId} not found`,
    };
  }

  const resourceStatus: Record<string, unknown> = {};

  if (project.resources.domain) {
    try {
      const domainInfo = await namecheap.getDomainInfo(project.resources.domain.name);
      resourceStatus.domain = {
        name: project.resources.domain.name,
        status: domainInfo.status,
        expires: domainInfo.expires,
        healthy: domainInfo.status === 'Ok',
      };
    } catch {
      resourceStatus.domain = {
        name: project.resources.domain.name,
        status: 'unknown',
        healthy: false,
        error: 'Could not fetch domain status',
      };
    }
  }

  if (project.resources.github) {
    try {
      const repo = await github.getRepository(
        project.resources.github.owner,
        project.resources.github.repo
      );
      resourceStatus.github = {
        repo: `${project.resources.github.owner}/${project.resources.github.repo}`,
        url: project.resources.github.url,
        healthy: true,
        openIssues: repo.openIssuesCount,
        stars: repo.stargazersCount,
      };
    } catch {
      resourceStatus.github = {
        repo: `${project.resources.github.owner}/${project.resources.github.repo}`,
        healthy: false,
        error: 'Could not fetch repository status',
      };
    }
  }

  if (project.resources.discord) {
    resourceStatus.discord = {
      serverName: project.resources.discord.serverName,
      serverId: project.resources.discord.serverId,
      channels: project.resources.discord.channels,
      healthy: true,
    };
  }

  return {
    success: true,
    data: {
      projectId,
      name: project.name,
      status: project.status,
      resources: resourceStatus,
      planning: {
        ideas: project.planning.ideas.length,
        research: project.planning.research.length,
        hasBusinessPlan: Boolean(project.planning.businessPlan),
      },
      health: Object.values(resourceStatus).every(
        (r) => (r as { healthy?: boolean }).healthy !== false
      )
        ? 'healthy'
        : 'issues',
    },
  };
}

export async function cleanupProject(projectId: string): Promise<ToolResult> {
  const project = projectStore.getProject(projectId);

  if (!project) {
    return {
      success: false,
      error: `Project ${projectId} not found`,
    };
  }

  const resources: string[] = [];

  if (project.resources.domain) {
    resources.push(`Domain: ${project.resources.domain.name}`);
  }
  if (project.resources.github) {
    resources.push(`Repository: ${project.resources.github.owner}/${project.resources.github.repo}`);
  }
  if (project.resources.discord) {
    resources.push(`Discord Server: ${project.resources.discord.serverName}`);
  }

  if (resources.length === 0) {
    projectStore.setProjectStatus(projectId, 'deleted');
    return {
      success: true,
      data: {
        projectId,
        message: 'Project has no external resources. Marked as deleted.',
      },
    };
  }

  return {
    success: false,
    requiresApproval: true,
    approvalPrompt: `
⚠️ **Project Cleanup: ${project.name}**

The following resources will be affected:
${resources.map((r) => `- ${r}`).join('\n')}

**Note:**
- Domains cannot be deleted but will be marked for non-renewal
- GitHub repositories will be permanently deleted
- Discord servers will be permanently deleted

Do you want to proceed with cleanup?`,
    error: 'Project cleanup requires explicit approval for each resource',
  };
}
