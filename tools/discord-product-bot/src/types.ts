import type { Client, Message, ThreadChannel } from 'discord.js';

export interface ClassificationResult {
  isDevRelated: boolean;
  reasoning: string;
  issue?: {
    title: string;
    body: string;
    labels: string[];
  };
}

export interface ProductUpdateResult {
  shouldPost: boolean;
  update: string;
}

export interface GitHubIssue {
  number: number;
  html_url: string;
  title: string;
}

export interface ImageAttachment {
  url: string;
  name: string;
  contentType: string;
  width?: number;
  height?: number;
}

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  authorId: string;
  authorName: string;
  timestamp: number;
  images?: ImageAttachment[];
}

export interface MessageContext {
  message: Message;
  client: Client;
  author: string;
  authorId: string;
  channelId: string;
  threadId: string | null;
  images: ImageAttachment[];
  shouldReply?: boolean;
  /**
   * When true, indicates this is the first message in a newly created thread.
   * The agent should consolidate all output into a single follow-up message.
   */
  isThreadCreation?: boolean;
}


export interface AgentStatus {
  lastUpdated: string;
  lastAction: string;
  blockingIssues: string;
  pendingWork: string;
}

export interface TeamStatus {
  content: string;
}

export interface SearchResult {
  path: string;
  repository: string;
  url: string;
  textMatches?: string[];
}

export interface DeploymentStatus {
  environment: string;
  status: string;
  runUrl?: string;
  timestamp?: string;
}

export interface PullRequest {
  number: number;
  title: string;
  state: string;
  html_url: string;
  user: string;
  created_at: string;
}

export interface WorkflowRun {
  id: number;
  name: string;
  status: string;
  conclusion: string | null;
  html_url: string;
  created_at: string;
}

/**
 * Represents a job within a workflow run.
 * Jobs correspond to individual agents or steps in the pipeline.
 */
export interface WorkflowJob {
  id: number;
  name: string; // e.g., "Run software-engineer (pre)" or "Notify - Alex (Dev)"
  status: string; // queued, in_progress, completed
  conclusion: string | null; // success, failure, cancelled, skipped
  started_at: string | null;
  html_url: string;
}

/**
 * Represents an active agent extracted from workflow job information.
 * Used for generating meaningful status blurbs.
 */
export interface ActiveAgent {
  name: string; // e.g., "software-engineer"
  persona: string; // e.g., "Alex - Dev"
  phase: string; // e.g., "pre", "main", "post", "review", "fix"
  issueNumber: number | null;
  runUrl: string;
  status: 'running' | 'queued' | 'completed';
}

export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

export interface ThreadInfo {
  id: string;
  name: string;
}
