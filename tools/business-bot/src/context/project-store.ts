import { LRUCache } from 'lru-cache';
import { v4 as uuidv4 } from 'uuid';
import type { Project, ProjectPlanning } from '../types';
import * as sqlite from './persistence/sqlite';

const PROJECT_CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

const projectCache = new LRUCache<string, Project>({
  max: 100,
  ttl: PROJECT_CACHE_TTL_MS,
});

export function createProject(
  name: string,
  createdBy: string,
  description?: string,
  threadId?: string
): Project {
  const now = Date.now();

  const project: Project = {
    id: uuidv4(),
    name,
    description,
    status: 'planning',
    createdAt: now,
    updatedAt: now,
    createdBy,
    resources: {},
    planning: {
      threadId,
      ideas: [],
      research: [],
      approvals: {},
    },
  };

  sqlite.saveProject(project);
  projectCache.set(project.id, project);

  return project;
}

export function getProject(id: string): Project | null {
  let project = projectCache.get(id);

  if (!project) {
    project = sqlite.loadProject(id) ?? undefined;
    if (project) {
      projectCache.set(id, project);
    }
  }

  return project ?? null;
}

export function getProjectByThreadId(threadId: string): Project | null {
  for (const [, project] of projectCache.entries()) {
    if (project.planning.threadId === threadId) {
      return project;
    }
  }

  const project = sqlite.findProjectByThreadId(threadId);
  if (project) {
    projectCache.set(project.id, project);
  }

  return project;
}

export function updateProject(
  id: string,
  updates: Partial<Omit<Project, 'id' | 'createdAt' | 'createdBy'>>
): Project | null {
  const project = getProject(id);
  if (!project) return null;

  const updated: Project = {
    ...project,
    ...updates,
    updatedAt: Date.now(),
    resources: updates.resources
      ? { ...project.resources, ...updates.resources }
      : project.resources,
    planning: updates.planning
      ? { ...project.planning, ...updates.planning }
      : project.planning,
  };

  sqlite.saveProject(updated);
  projectCache.set(id, updated);

  return updated;
}

export function deleteProject(id: string): boolean {
  projectCache.delete(id);
  return sqlite.deleteProject(id);
}

export function listProjects(status?: Project['status']): Project[] {
  return sqlite.loadAllProjects(status);
}

export function addIdea(projectId: string, idea: string): Project | null {
  const project = getProject(projectId);
  if (!project) return null;

  const planning: ProjectPlanning = {
    ...project.planning,
    ideas: [...project.planning.ideas, idea],
  };

  return updateProject(projectId, { planning });
}

export function addResearch(projectId: string, research: string): Project | null {
  const project = getProject(projectId);
  if (!project) return null;

  const planning: ProjectPlanning = {
    ...project.planning,
    research: [...project.planning.research, research],
  };

  return updateProject(projectId, { planning });
}

export function setApproval(
  projectId: string,
  resourceType: 'domain' | 'repo' | 'discord',
  approved: boolean,
  approvedBy: string
): Project | null {
  const project = getProject(projectId);
  if (!project) return null;

  const planning: ProjectPlanning = {
    ...project.planning,
    approvals: {
      ...project.planning.approvals,
      [resourceType]: {
        approved,
        approvedBy,
        approvedAt: Date.now(),
      },
    },
  };

  return updateProject(projectId, { planning });
}

export function hasApproval(
  projectId: string,
  resourceType: 'domain' | 'repo' | 'discord'
): boolean {
  const project = getProject(projectId);
  if (!project) return false;

  const approval = project.planning.approvals[resourceType];
  return approval?.approved === true;
}

export function setDomainResource(
  projectId: string,
  domain: {
    name: string;
    registeredAt: number;
    expiresAt: number;
    autoRenew?: boolean;
  }
): Project | null {
  const project = getProject(projectId);
  if (!project) return null;

  return updateProject(projectId, {
    resources: {
      ...project.resources,
      domain: {
        name: domain.name,
        registeredAt: domain.registeredAt,
        expiresAt: domain.expiresAt,
        autoRenew: domain.autoRenew ?? false,
      },
    },
  });
}

export function setGitHubResource(
  projectId: string,
  github: {
    owner: string;
    repo: string;
    url: string;
    forkedFrom?: string;
    isPrivate?: boolean;
  }
): Project | null {
  const project = getProject(projectId);
  if (!project) return null;

  return updateProject(projectId, {
    resources: {
      ...project.resources,
      github: {
        owner: github.owner,
        repo: github.repo,
        url: github.url,
        forkedFrom: github.forkedFrom,
        isPrivate: github.isPrivate ?? false,
      },
    },
  });
}

export function setDiscordResource(
  projectId: string,
  discord: {
    serverId: string;
    serverName: string;
    inviteUrl?: string;
    channels?: string[];
    channelIds?: Record<string, string>;
    webhooks?: Record<string, string>;
  }
): Project | null {
  const project = getProject(projectId);
  if (!project) return null;

  return updateProject(projectId, {
    resources: {
      ...project.resources,
      discord: {
        serverId: discord.serverId,
        serverName: discord.serverName,
        inviteUrl: discord.inviteUrl,
        channels: discord.channels ?? [],
        channelIds: discord.channelIds,
        webhooks: discord.webhooks,
      },
    },
  });
}

export function setProjectStatus(
  projectId: string,
  status: Project['status']
): Project | null {
  return updateProject(projectId, { status });
}

export function setBusinessPlan(
  projectId: string,
  businessPlan: string
): Project | null {
  const project = getProject(projectId);
  if (!project) return null;

  const planning: ProjectPlanning = {
    ...project.planning,
    businessPlan,
  };

  return updateProject(projectId, { planning });
}

export function getActiveProjects(): Project[] {
  return listProjects('active');
}

export function getPlanningProjects(): Project[] {
  return listProjects('planning');
}

export function getProjectsWithResources(): Project[] {
  const allProjects = listProjects();
  return allProjects.filter((p) => {
    const { resources } = p;
    return resources.domain || resources.github || resources.discord;
  });
}
