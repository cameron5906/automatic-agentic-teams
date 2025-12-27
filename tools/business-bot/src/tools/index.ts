import type { ChatCompletionTool } from 'openai/resources/chat/completions';
import { namecheapTools } from './namecheap';
import { githubTools } from './github';
import { discordTools } from './discord';
import { tavilyTools } from './tavily';
import { projectTools } from './project';
import { stripeTools } from './stripe';

export const allTools: ChatCompletionTool[] = [
  ...namecheapTools,
  ...githubTools,
  ...discordTools,
  ...tavilyTools,
  ...projectTools,
  ...stripeTools,
];

export function getToolsByNames(names: string[]): ChatCompletionTool[] {
  if (names.length === 0) return allTools;
  return allTools.filter((t) => names.includes(t.function.name));
}

export function getToolNames(): string[] {
  return allTools.map((t) => t.function.name);
}

export { namecheapTools, githubTools, discordTools, tavilyTools, projectTools, stripeTools };
