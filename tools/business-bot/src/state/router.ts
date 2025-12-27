import type { BotState } from '../types';
import { routeIntent } from '../services/openai';
import { transition, type TransitionTrigger } from './machine';
import { getStateConfig } from './types';

const INTENT_TO_TRIGGER: Record<string, TransitionTrigger> = {
  chat: 'topic_change',
  planning: 'business_idea_detected',
  creating: 'create_request',
  managing: 'manage_request',
  researching: 'research_request',
  cleanup: 'cleanup_request',
};

export async function routeMessage(
  currentState: BotState,
  message: string,
  conversationSummary: string
): Promise<{
  newState: BotState;
  confidence: number;
  reasoning: string;
  stateChanged: boolean;
}> {
  const routerResult = await routeIntent(message, conversationSummary);

  const detectedIntent = routerResult.intent as BotState;
  const trigger = INTENT_TO_TRIGGER[detectedIntent];

  if (!trigger) {
    return {
      newState: currentState,
      confidence: routerResult.confidence,
      reasoning: routerResult.reasoning,
      stateChanged: false,
    };
  }

  const newState = transition(currentState, trigger);

  return {
    newState,
    confidence: routerResult.confidence,
    reasoning: routerResult.reasoning,
    stateChanged: newState !== currentState,
  };
}

export function buildStateAwarePrompt(
  basePrompt: string,
  state: BotState,
  projectContext?: string
): string {
  const stateConfig = getStateConfig(state);

  let prompt = basePrompt;

  if (stateConfig.systemPromptAddition) {
    prompt += `\n\n## Current Mode: ${state.toUpperCase()}\n${stateConfig.systemPromptAddition}`;
  }

  if (stateConfig.allowedTools.length > 0) {
    prompt += `\n\nTools available in this mode: ${stateConfig.allowedTools.join(', ')}`;
  }

  if (projectContext) {
    prompt += `\n\n## Active Project Context\n${projectContext}`;
  }

  return prompt;
}

export function shouldAutoTransition(
  currentState: BotState,
  toolsUsed: string[],
  lastResponse: string
): TransitionTrigger | null {
  if (currentState === 'creating') {
    const creationTools = [
      'namecheap_register_domain',
      'github_create_repo',
      'github_fork_repo',
      'discord_create_server',
    ];

    const createdResources = toolsUsed.filter((t) => creationTools.includes(t));
    if (createdResources.length >= 2) {
      return 'task_complete';
    }
  }

  if (currentState === 'researching') {
    const researchTools = ['tavily_search', 'tavily_research', 'tavily_market_research'];
    const researchCompleted = toolsUsed.filter((t) => researchTools.includes(t));

    if (researchCompleted.length >= 3) {
      return 'task_complete';
    }
  }

  if (currentState === 'cleanup') {
    const deleteTools = ['github_delete_repo', 'discord_delete_server', 'project_cleanup'];
    if (toolsUsed.some((t) => deleteTools.includes(t))) {
      return 'task_complete';
    }
  }

  return null;
}

export function getStateTransitionHints(state: BotState): string[] {
  const hints: Record<BotState, string[]> = {
    idle: ['Say something to start chatting'],
    chat: [
      'Tell me about a business idea to start planning',
      'Ask to check on your projects',
      'Say "let\'s create" to set up new resources',
    ],
    planning: [
      'Ask me to research the market',
      'Say "let\'s build this" when ready to create resources',
      'Keep refining your business plan',
    ],
    creating: [
      'Approve resource creation when prompted',
      'Say "cancel" to go back to planning',
    ],
    managing: [
      'Ask about project status',
      'Say "clean up" to remove a project',
      'Share a new business idea',
    ],
    researching: [
      'Ask follow-up research questions',
      'Say "that\'s enough research" to return to planning',
    ],
    cleanup: [
      'Confirm deletion of each resource',
      'Say "stop" to cancel cleanup',
    ],
  };

  return hints[state] ?? [];
}
