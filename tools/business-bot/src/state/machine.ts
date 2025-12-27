import type { BotState } from '../types';
import { STATE_CONFIGS, getStateConfig } from './types';

export type TransitionTrigger =
  | 'user_message'
  | 'business_idea_detected'
  | 'create_request'
  | 'manage_request'
  | 'research_request'
  | 'cleanup_request'
  | 'approval_received'
  | 'task_complete'
  | 'topic_change';

interface Transition {
  from: BotState | '*';
  trigger: TransitionTrigger;
  to: BotState;
  condition?: () => boolean;
}

const TRANSITIONS: Transition[] = [
  { from: 'idle', trigger: 'user_message', to: 'chat' },

  { from: 'chat', trigger: 'business_idea_detected', to: 'planning' },
  { from: 'chat', trigger: 'create_request', to: 'creating' },
  { from: 'chat', trigger: 'manage_request', to: 'managing' },
  { from: 'chat', trigger: 'cleanup_request', to: 'cleanup' },
  { from: 'chat', trigger: 'research_request', to: 'researching' },

  { from: 'planning', trigger: 'create_request', to: 'creating' },
  { from: 'planning', trigger: 'research_request', to: 'researching' },
  { from: 'planning', trigger: 'topic_change', to: 'chat' },

  { from: 'creating', trigger: 'task_complete', to: 'managing' },
  { from: 'creating', trigger: 'topic_change', to: 'planning' },

  { from: 'managing', trigger: 'cleanup_request', to: 'cleanup' },
  { from: 'managing', trigger: 'business_idea_detected', to: 'planning' },
  { from: 'managing', trigger: 'topic_change', to: 'chat' },

  { from: 'researching', trigger: 'task_complete', to: 'planning' },
  { from: 'researching', trigger: 'create_request', to: 'creating' },
  { from: 'researching', trigger: 'topic_change', to: 'chat' },

  { from: 'cleanup', trigger: 'task_complete', to: 'chat' },
  { from: 'cleanup', trigger: 'topic_change', to: 'managing' },

  { from: '*', trigger: 'topic_change', to: 'chat' },
];

export function canTransition(from: BotState, trigger: TransitionTrigger): BotState | null {
  const transition = TRANSITIONS.find(
    (t) => (t.from === from || t.from === '*') && t.trigger === trigger
  );

  if (!transition) return null;

  if (transition.condition && !transition.condition()) {
    return null;
  }

  return transition.to;
}

export function getValidTransitions(from: BotState): Array<{ trigger: TransitionTrigger; to: BotState }> {
  return TRANSITIONS
    .filter((t) => t.from === from || t.from === '*')
    .map((t) => ({ trigger: t.trigger, to: t.to }));
}

export function transition(from: BotState, trigger: TransitionTrigger): BotState {
  const newState = canTransition(from, trigger);
  return newState ?? from;
}

export function getStateDescription(state: BotState): string {
  return getStateConfig(state).description;
}

export function getAllStates(): BotState[] {
  return Object.keys(STATE_CONFIGS) as BotState[];
}

export function formatStateInfo(state: BotState): string {
  const config = getStateConfig(state);
  const transitions = getValidTransitions(state);

  return `
**State: ${state}**
${config.description}

Available tools: ${config.allowedTools.length > 0 ? config.allowedTools.join(', ') : 'All tools'}

Possible transitions:
${transitions.map((t) => `- ${t.trigger} → ${t.to}`).join('\n')}
`.trim();
}
