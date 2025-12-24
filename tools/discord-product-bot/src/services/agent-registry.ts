import { listFiles, getFileContent } from './github.js';
import { LRUCache } from 'lru-cache';

export interface AgentDefinition {
  name: string;
  definitionPath: string;
  memoryPath: string;
  description?: string;
}

const DEFINITIONS_PATH = 'working/agents/definitions';
const MEMORY_PATH = 'working/agents/memory';

const agentCache = new LRUCache<string, AgentDefinition[]>({
  max: 1,
  ttl: 1000 * 60 * 10, // 10 minutes
});

const definitionContentCache = new LRUCache<string, string>({
  max: 20,
  ttl: 1000 * 60 * 5, // 5 minutes
});

function extractAgentDescription(content: string): string | undefined {
  const lines = content.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('#')) continue;
    if (trimmed.length > 0) {
      return trimmed.slice(0, 200);
    }
  }
  return undefined;
}

export async function getAvailableAgents(): Promise<AgentDefinition[]> {
  const cached = agentCache.get('agents');
  if (cached) return cached;

  try {
    const files = await listFiles(DEFINITIONS_PATH);
    const agents: AgentDefinition[] = [];

    for (const filePath of files) {
      if (!filePath.endsWith('.md')) continue;

      const fileName = filePath.split('/').pop() || filePath;
      const agentName = fileName.replace('.md', '');

      agents.push({
        name: agentName,
        definitionPath: filePath,
        memoryPath: `${MEMORY_PATH}/${agentName}/MEMORY.md`,
      });
    }

    agentCache.set('agents', agents);
    return agents;
  } catch (error) {
    console.error('[AgentRegistry] Failed to list agents:', error);
    return [];
  }
}

export async function getAgentNames(): Promise<string[]> {
  const agents = await getAvailableAgents();
  return agents.map(a => a.name);
}

export async function isValidAgent(name: string): Promise<boolean> {
  const agents = await getAvailableAgents();
  return agents.some(a => a.name.toLowerCase() === name.toLowerCase());
}

export async function getAgentDefinition(name: string): Promise<AgentDefinition | null> {
  const agents = await getAvailableAgents();
  return agents.find(a => a.name.toLowerCase() === name.toLowerCase()) || null;
}

export async function getAgentDefinitionContent(name: string): Promise<string> {
  const agent = await getAgentDefinition(name);
  if (!agent) {
    throw new Error(`Unknown agent: ${name}. Use agent_list to see available agents.`);
  }

  const cacheKey = agent.definitionPath;
  const cached = definitionContentCache.get(cacheKey);
  if (cached) return cached;

  const content = await getFileContent(agent.definitionPath);
  definitionContentCache.set(cacheKey, content);
  return content;
}

export async function getAgentMemoryContent(name: string): Promise<string> {
  const agent = await getAgentDefinition(name);
  if (!agent) {
    throw new Error(`Unknown agent: ${name}. Use agent_list to see available agents.`);
  }

  try {
    return await getFileContent(agent.memoryPath);
  } catch (error) {
    return 'No memory file found for this agent.';
  }
}

export function clearAgentCache(): void {
  agentCache.clear();
  definitionContentCache.clear();
}
