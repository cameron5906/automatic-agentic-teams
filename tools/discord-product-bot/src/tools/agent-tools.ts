import { getFileContent, updateFile } from '../services/github.js';
import {
  getAvailableAgents,
  getAgentNames,
  getAgentDefinition,
  getAgentDefinitionContent,
  getAgentMemoryContent,
  isValidAgent,
} from '../services/agent-registry.js';
import type { AgentStatus, TeamStatus } from '../types.js';

const TEAM_STATUS_PATH = 'working/agents/memory/TEAM.md';

function extractSection(content: string, sectionName: string, useFirst: boolean = true): string {
  const regex = new RegExp(`## .*?${sectionName}.*?\\s*([\\s\\S]*?)(?=##|$)`, 'i');

  if (useFirst) {
    const match = content.match(regex);
    if (match) {
      return match[1].trim();
    }
  } else {
    const matches = Array.from(content.matchAll(new RegExp(regex.source, 'gi')));
    if (matches.length > 0) {
      return matches[matches.length - 1][1].trim();
    }
  }

  const lineRegex = new RegExp(`^[-*]?\\s*${sectionName}:\\s*(.*)$`, 'im');
  const lineMatch = content.match(lineRegex);
  if (lineMatch) {
    return lineMatch[1].trim();
  }

  return 'Not found';
}

function extractLastUpdated(content: string): string {
  const match = content.match(/Last updated:\s*(\d{4}-\d{2}-\d{2})/i);
  return match ? match[1] : 'Unknown';
}

export async function agent_list(): Promise<{ agents: string[]; count: number }> {
  const names = await getAgentNames();
  return { agents: names, count: names.length };
}

export async function agent_get_status(agentName: string): Promise<AgentStatus> {
  const valid = await isValidAgent(agentName);
  if (!valid) {
    const availableAgents = await getAgentNames();
    throw new Error(`Unknown agent: ${agentName}. Available: ${availableAgents.join(', ')}`);
  }

  const content = await getAgentMemoryContent(agentName);

  return {
    lastUpdated: extractLastUpdated(content),
    lastAction: extractSection(content, 'Last Action'),
    blockingIssues: extractSection(content, 'Blocking issues') || 'None',
    pendingWork: extractSection(content, 'Pending Work'),
  };
}

export async function agent_get_memory(agentName: string): Promise<string> {
  return await getAgentMemoryContent(agentName);
}

export async function agent_get_definition(agentName: string): Promise<string> {
  return await getAgentDefinitionContent(agentName);
}

export async function team_get_status(): Promise<TeamStatus> {
  try {
    const content = await getFileContent(TEAM_STATUS_PATH);
    return { content };
  } catch {
    return { content: 'No team status file found at working/agents/memory/TEAM.md' };
  }
}

export async function team_get_active_milestone(): Promise<string> {
  const { content } = await team_get_status();
  return extractSection(content, 'Active Milestone');
}

export async function team_get_composition(): Promise<{
  agents: Array<{ name: string; definitionPath: string; memoryPath: string }>;
  count: number;
}> {
  const agents = await getAvailableAgents();
  return {
    agents: agents.map(a => ({
      name: a.name,
      definitionPath: a.definitionPath,
      memoryPath: a.memoryPath,
    })),
    count: agents.length,
  };
}

export interface AgentNudgeResult {
  agentName: string;
  path: string;
  commitUrl: string;
  nudgeApplied: string;
}

export async function agent_nudge(
  agentName: string,
  nudge: string,
  reason: string
): Promise<AgentNudgeResult> {
  const agent = await getAgentDefinition(agentName);
  if (!agent) {
    const availableAgents = await getAgentNames();
    throw new Error(`Unknown agent: ${agentName}. Available: ${availableAgents.join(', ')}`);
  }

  const currentContent = await getAgentDefinitionContent(agentName);

  const timestamp = new Date().toISOString().split('T')[0];
  const nudgeSection = `\n\n<!-- NUDGE: ${timestamp} -->\n<!-- Reason: ${reason} -->\n${nudge}\n<!-- END NUDGE -->`;

  const existingNudgeMatch = currentContent.match(/<!-- NUDGE:.*?-->[\s\S]*?<!-- END NUDGE -->/g);
  let newContent: string;

  if (existingNudgeMatch && existingNudgeMatch.length > 0) {
    newContent = currentContent.replace(
      /<!-- NUDGE:.*?-->[\s\S]*?<!-- END NUDGE -->/g,
      ''
    ).trimEnd() + nudgeSection;
  } else {
    newContent = currentContent.trimEnd() + nudgeSection;
  }

  const commitMessage = `chore(agents): nudge ${agentName} - ${reason.slice(0, 50)}`;
  const result = await updateFile(agent.definitionPath, newContent, commitMessage);

  return {
    agentName,
    path: agent.definitionPath,
    commitUrl: result.commitUrl,
    nudgeApplied: nudge,
  };
}

export async function agent_clear_nudge(agentName: string): Promise<{
  agentName: string;
  path: string;
  commitUrl: string;
  cleared: boolean;
}> {
  const agent = await getAgentDefinition(agentName);
  if (!agent) {
    const availableAgents = await getAgentNames();
    throw new Error(`Unknown agent: ${agentName}. Available: ${availableAgents.join(', ')}`);
  }

  const currentContent = await getAgentDefinitionContent(agentName);

  if (!currentContent.includes('<!-- NUDGE:')) {
    return {
      agentName,
      path: agent.definitionPath,
      commitUrl: '',
      cleared: false,
    };
  }

  const newContent = currentContent.replace(
    /\n*<!-- NUDGE:.*?-->[\s\S]*?<!-- END NUDGE -->/g,
    ''
  ).trimEnd() + '\n';

  const commitMessage = `chore(agents): clear nudge for ${agentName}`;
  const result = await updateFile(agent.definitionPath, newContent, commitMessage);

  return {
    agentName,
    path: agent.definitionPath,
    commitUrl: result.commitUrl,
    cleared: true,
  };
}
