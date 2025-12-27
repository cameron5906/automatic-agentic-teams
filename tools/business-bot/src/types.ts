import type { Message, TextChannel, ThreadChannel } from 'discord.js';

export type BotState =
  | 'idle'
  | 'chat'
  | 'planning'
  | 'creating'
  | 'managing'
  | 'researching'
  | 'cleanup';

export interface StateTransition {
  from: BotState;
  to: BotState;
  trigger: string;
}

export interface ConversationMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  authorId?: string;
  authorName?: string;
  timestamp: number;
  toolCallId?: string;
  toolName?: string;
}

export interface ConversationContext {
  contextKey: string;
  messages: ConversationMessage[];
  state: BotState;
  projectId?: string;
  lastActivity: number;
}

export interface ProjectResource {
  type: 'domain' | 'github' | 'discord';
  id: string;
  name: string;
  createdAt: number;
  metadata: Record<string, unknown>;
}

export interface ProjectDomainResource {
  name: string;
  registeredAt: number;
  expiresAt: number;
  autoRenew: boolean;
}

export interface ProjectGitHubResource {
  owner: string;
  repo: string;
  url: string;
  forkedFrom?: string;
  isPrivate: boolean;
}

export interface ProjectDiscordResource {
  serverId: string;
  serverName: string;
  inviteUrl?: string;
  channels: string[];
}

export interface ProjectApprovals {
  domain?: { approved: boolean; approvedBy?: string; approvedAt?: number };
  repo?: { approved: boolean; approvedBy?: string; approvedAt?: number };
  discord?: { approved: boolean; approvedBy?: string; approvedAt?: number };
}

export interface ProjectPlanning {
  threadId?: string;
  ideas: string[];
  research: string[];
  approvals: ProjectApprovals;
  businessPlan?: string;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  status: 'planning' | 'active' | 'archived' | 'deleted';
  createdAt: number;
  updatedAt: number;
  createdBy: string;

  resources: {
    domain?: ProjectDomainResource;
    github?: ProjectGitHubResource;
    discord?: ProjectDiscordResource;
  };

  planning: ProjectPlanning;
}

export interface MessageContext {
  message: Message;
  channel: TextChannel | ThreadChannel;
  threadId?: string;
  channelId: string;
  authorId: string;
  authorName: string;
  isAdmin: boolean;
  mentionedBot: boolean;
  isReplyToBot: boolean;
  isInOwnedThread: boolean;
  replyContext?: string;
}

export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
  requiresApproval?: boolean;
  approvalPrompt?: string;
}

export interface AgentResult {
  response: string;
  toolsUsed: string[];
  iterations: number;
  newState?: BotState;
}

export interface RouterResult {
  intent: BotState;
  confidence: number;
  reasoning: string;
}

export interface NamecheapDomainInfo {
  domain: string;
  available: boolean;
  price?: number;
  currency?: string;
  icannFee?: number;
}

export interface NamecheapOwnedDomain {
  domain: string;
  created: string;
  expires: string;
  isExpired: boolean;
  isLocked: boolean;
  autoRenew: boolean;
  whoisGuard: string;
}

export interface NamecheapDnsRecord {
  hostName: string;
  type: string;
  address: string;
  ttl: number;
  mxPref?: number;
}

export interface TavilySearchResult {
  title: string;
  url: string;
  content: string;
  score: number;
}

export interface TavilyResearchResult {
  query: string;
  results: TavilySearchResult[];
  summary?: string;
}
