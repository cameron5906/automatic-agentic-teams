import OpenAI from 'openai';
import { ActivityType } from 'discord.js';
import { config } from '../config.js';
import type { TeamStatus, ActiveAgent, WorkflowJob, WorkflowRun } from '../types.js';
import { listIssues, listPullRequests, getWorkflowRuns, getActiveWorkflowsWithJobs } from './github.js';

let openaiClient: OpenAI | null = null;

/**
 * Tracks workflow run start times for elapsed time calculation.
 * Key: workflow run ID, Value: start timestamp (ms)
 */
const workflowStartTimes = new Map<number, number>();

/**
 * Discord activity types mapped to pipeline phases.
 * - Playing: Active coding/building work
 * - Watching: Review/monitoring activities
 * - Competing: Testing/QA activities
 * - Listening: Waiting/queued states
 * - Custom: Idle/ready state
 */
export type DiscordActivityType = 'Playing' | 'Watching' | 'Competing' | 'Listening' | 'Custom';

/**
 * Maps pipeline phases to Discord activity types.
 */
const PHASE_TO_ACTIVITY_TYPE: Record<string, DiscordActivityType> = {
  pre: 'Watching',      // Planning/analyzing
  main: 'Playing',      // Active coding
  post: 'Playing',      // Polishing/finalizing
  review: 'Watching',   // Code review
  fix: 'Playing',       // Fixing issues
  test: 'Competing',    // Running tests (competing for quality!)
};

/**
 * Result of status generation including blurb text and activity metadata.
 */
export interface StatusResult {
  blurb: string;
  activityType: ActivityType;
  activityName: string;  // The "name" field for the activity (e.g., "Alex building #42")
  elapsedMinutes: number | null;
}

function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey: config.openai.apiKey,
    });
  }
  return openaiClient;
}

const MAX_BLURB_LENGTH = 100;

/**
 * Maps agent names to their friendly persona names.
 * These match the persona names used in agent-step.yml workflow.
 */
const AGENT_PERSONAS: Record<string, string> = {
  'documentation-sheriff': 'Riley - Docs',
  'infrastructure-engineer': 'Sam - Infra',
  'security-engineer': 'Casey - Security',
  'product-owner': 'Morgan - Product',
  'ux-designer': 'Drew - UX',
  'tech-lead': 'Taylor - Lead',
  'software-engineer': 'Alex - Dev',
  'test-engineer': 'Jamie - QA',
  'project-manager': 'Jordan - PM',
  'code-reviewer': 'Avery - Review',
};

/**
 * Short version of agent personas for compact status display.
 */
const AGENT_SHORT_NAMES: Record<string, string> = {
  'documentation-sheriff': 'Riley',
  'infrastructure-engineer': 'Sam',
  'security-engineer': 'Casey',
  'product-owner': 'Morgan',
  'ux-designer': 'Drew',
  'tech-lead': 'Taylor',
  'software-engineer': 'Alex',
  'test-engineer': 'Jamie',
  'project-manager': 'Jordan',
  'code-reviewer': 'Avery',
};

export interface ProjectContext {
  teamStatus: TeamStatus;
  openIssues: number;
  openPRs: number;
  inProgressWorkflows: number;
  latestWorkflowStatus?: string;
  mostRecentIssue?: { number: number; title: string };
  mostRecentPR?: { number: number; title: string };
  // Detailed agent activity from workflow jobs
  activeAgents: ActiveAgent[];
  queuedAgents: ActiveAgent[];
  // Elapsed time tracking
  oldestActiveWorkflowStartTime: Date | null;
  elapsedMinutes: number | null;
}

/**
 * Formats elapsed minutes into a compact string.
 * Examples: "2m", "15m", "1h", "2h15m"
 */
function formatElapsedTime(minutes: number): string {
  if (minutes < 60) {
    return `${Math.floor(minutes)}m`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMins = Math.floor(minutes % 60);
  if (remainingMins === 0) {
    return `${hours}h`;
  }
  return `${hours}h${remainingMins}m`;
}

/**
 * Gets the Discord ActivityType enum value from our internal type.
 */
function getDiscordActivityType(phase: string, hasActiveAgents: boolean): ActivityType {
  if (!hasActiveAgents) {
    return ActivityType.Custom;
  }

  const mappedType = PHASE_TO_ACTIVITY_TYPE[phase] || 'Playing';

  switch (mappedType) {
    case 'Playing':
      return ActivityType.Playing;
    case 'Watching':
      return ActivityType.Watching;
    case 'Competing':
      return ActivityType.Competing;
    case 'Listening':
      return ActivityType.Listening;
    default:
      return ActivityType.Custom;
  }
}

/**
 * Updates workflow start time tracking.
 * Called when gathering context to track when workflows began.
 */
function trackWorkflowStartTimes(
  activeWorkflows: Array<WorkflowRun & { jobs: WorkflowJob[]; issueNumber: number | null }>
): void {
  const activeRunIds = new Set(activeWorkflows.map((w) => w.id));

  // Clean up old entries for workflows that are no longer active
  for (const runId of workflowStartTimes.keys()) {
    if (!activeRunIds.has(runId)) {
      workflowStartTimes.delete(runId);
    }
  }

  // Add new entries for workflows we haven't seen before
  const now = Date.now();
  for (const workflow of activeWorkflows) {
    if (!workflowStartTimes.has(workflow.id)) {
      // Try to use the workflow's created_at time if available
      const startTime = workflow.created_at
        ? new Date(workflow.created_at).getTime()
        : now;
      workflowStartTimes.set(workflow.id, startTime);
      console.log(
        `[BlurbGenerator] Tracking workflow ${workflow.id} started at ${new Date(startTime).toISOString()}`
      );
    }
  }
}

/**
 * Gets the oldest workflow start time from tracked workflows.
 */
function getOldestWorkflowStartTime(): Date | null {
  if (workflowStartTimes.size === 0) {
    return null;
  }

  let oldest = Infinity;
  for (const startTime of workflowStartTimes.values()) {
    if (startTime < oldest) {
      oldest = startTime;
    }
  }

  return oldest === Infinity ? null : new Date(oldest);
}

/**
 * Maps spaced agent names to their hyphenated identifiers.
 * E.g., "Software Engineer" -> "software-engineer"
 */
const AGENT_NAME_VARIANTS: Record<string, string> = {
  'documentation sheriff': 'documentation-sheriff',
  'infrastructure engineer': 'infrastructure-engineer',
  'security engineer': 'security-engineer',
  'product owner': 'product-owner',
  'ux designer': 'ux-designer',
  'tech lead': 'tech-lead',
  'software engineer': 'software-engineer',
  'test engineer': 'test-engineer',
  'project manager': 'project-manager',
  'code reviewer': 'code-reviewer',
};

/**
 * Parses a workflow job name to extract agent name and phase.
 * Handles patterns like:
 * - "Run software-engineer (pre)" - direct hyphenated format
 * - "Software Engineer (Main)" - spaced format from calling workflow
 * - "Documentation Sheriff (Pre) / Run documentation-sheriff (pre)" - nested workflow format
 * - "Notify - Documentation Sheriff (Pre)" - notification jobs
 */
export function parseAgentFromJobName(
  jobName: string
): { agentName: string; phase: string } | null {
  const lowerName = jobName.toLowerCase();

  // Pattern 1: "Run {agent-name} ({phase})" - can be anywhere in the string (for nested workflows)
  // Matches: "Run software-engineer (pre)" or "... / Run software-engineer (pre)"
  const runPattern = /Run\s+([\w-]+)\s+\((\w+)\)/i;
  const runMatch = jobName.match(runPattern);
  if (runMatch) {
    return {
      agentName: runMatch[1].toLowerCase(),
      phase: runMatch[2].toLowerCase(),
    };
  }

  // Pattern 2: "{Agent Name} ({Phase})" - spaced agent names from workflow job names
  // Matches: "Software Engineer (Main)", "Documentation Sheriff (Pre)"
  for (const [spacedName, hyphenatedName] of Object.entries(AGENT_NAME_VARIANTS)) {
    if (lowerName.includes(spacedName)) {
      const phaseMatch = jobName.match(/\((\w+)\)/);
      if (phaseMatch) {
        return {
          agentName: hyphenatedName,
          phase: phaseMatch[1].toLowerCase(),
        };
      }
    }
  }

  // Pattern 3: "Notify - {Agent Name} ({Phase})"
  const notifyPattern = /Notify\s*-\s*([\w\s-]+)\s+\((\w+)\)/i;
  const notifyMatch = jobName.match(notifyPattern);
  if (notifyMatch) {
    // Convert "Documentation Sheriff" to "documentation-sheriff"
    const agentName = notifyMatch[1]
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-');
    return {
      agentName,
      phase: notifyMatch[2].toLowerCase(),
    };
  }

  // Pattern 4: Fallback - Job names that contain hyphenated agent identifiers
  const agentPatterns = Object.keys(AGENT_PERSONAS);
  for (const agent of agentPatterns) {
    if (lowerName.includes(agent)) {
      // Try to extract phase
      const phaseMatch = jobName.match(/\((\w+)\)/);
      return {
        agentName: agent,
        phase: phaseMatch ? phaseMatch[1].toLowerCase() : 'main',
      };
    }
  }

  return null;
}

/**
 * Converts workflow jobs into ActiveAgent objects for status display.
 */
function extractActiveAgentsFromJobs(
  jobs: WorkflowJob[],
  issueNumber: number | null,
  runUrl: string
): { active: ActiveAgent[]; queued: ActiveAgent[] } {
  const active: ActiveAgent[] = [];
  const queued: ActiveAgent[] = [];

  for (const job of jobs) {
    const parsed = parseAgentFromJobName(job.name);
    if (!parsed) continue;

    const agent: ActiveAgent = {
      name: parsed.agentName,
      persona: AGENT_PERSONAS[parsed.agentName] || parsed.agentName,
      phase: parsed.phase,
      issueNumber,
      runUrl,
      status:
        job.status === 'in_progress'
          ? 'running'
          : job.status === 'queued'
            ? 'queued'
            : 'completed',
    };

    // Only include running or queued agents (not completed)
    if (job.status === 'in_progress') {
      active.push(agent);
    } else if (job.status === 'queued') {
      queued.push(agent);
    }
  }

  return { active, queued };
}

async function gatherProjectContext(teamStatus: TeamStatus): Promise<ProjectContext> {
  try {
    // Fetch basic stats and detailed workflow info in parallel
    const [issues, prs, activeWorkflows, completedWorkflows] = await Promise.all([
      listIssues('open', undefined, 5).catch(() => []),
      listPullRequests('open', 5).catch(() => []),
      getActiveWorkflowsWithJobs(5).catch(() => []),
      getWorkflowRuns(undefined, 'completed', 1).catch(() => []),
    ]);

    // Track workflow start times for elapsed calculation
    trackWorkflowStartTimes(activeWorkflows);

    // Extract active agents from all workflow jobs
    const allActiveAgents: ActiveAgent[] = [];
    const allQueuedAgents: ActiveAgent[] = [];

    for (const workflow of activeWorkflows) {
      const { active, queued } = extractActiveAgentsFromJobs(
        workflow.jobs,
        workflow.issueNumber,
        workflow.html_url
      );
      allActiveAgents.push(...active);
      allQueuedAgents.push(...queued);
    }

    // Calculate elapsed time from oldest active workflow
    const oldestStartTime = getOldestWorkflowStartTime();
    const elapsedMinutes = oldestStartTime
      ? (Date.now() - oldestStartTime.getTime()) / (1000 * 60)
      : null;

    console.log(
      `[BlurbGenerator] Found ${allActiveAgents.length} active agents, ${allQueuedAgents.length} queued` +
      (elapsedMinutes !== null ? `, elapsed: ${formatElapsedTime(elapsedMinutes)}` : '')
    );

    return {
      teamStatus,
      openIssues: issues.length,
      openPRs: prs.length,
      inProgressWorkflows: activeWorkflows.length,
      latestWorkflowStatus: completedWorkflows[0]?.conclusion || undefined,
      mostRecentIssue: issues[0] ? { number: issues[0].number, title: issues[0].title } : undefined,
      mostRecentPR: prs[0] ? { number: prs[0].number, title: prs[0].title } : undefined,
      activeAgents: allActiveAgents,
      queuedAgents: allQueuedAgents,
      oldestActiveWorkflowStartTime: oldestStartTime,
      elapsedMinutes,
    };
  } catch (error) {
    console.error('[BlurbGenerator] Failed to gather project context:', error);
    return {
      teamStatus,
      openIssues: 0,
      openPRs: 0,
      inProgressWorkflows: 0,
      activeAgents: [],
      queuedAgents: [],
      oldestActiveWorkflowStartTime: null,
      elapsedMinutes: null,
    };
  }
}

const BLURB_SYSTEM_PROMPT = `You are the mood coordinator for an AI development team. Generate a SHORT status blurb (max 90 chars) for Discord.

Priority order for what to highlight:
1. **Active agents with time** - Include elapsed time when available ("Alex building #42 (8m)")
2. **Pipeline phase** - Include what phase they're in ("Alex planning #42", "Jamie testing")
3. **Open PRs awaiting review** - If there are PRs but no active agents ("PR #5 ready")
4. **Queued work** - If agents are queued ("2 agents queued")
5. **Idle state** - If nothing is happening ("Ready for work")

Agent name mapping (use these FIRST NAMES only):
Alex=software-engineer, Taylor=tech-lead, Jamie=test-engineer, Riley=documentation-sheriff
Sam=infrastructure-engineer, Casey=security-engineer, Morgan=product-owner
Drew=ux-designer, Jordan=project-manager, Avery=code-reviewer

Guidelines:
- ALWAYS include elapsed time in parentheses when provided: "(5m)", "(1h)", "(2h15m)"
- Use agent FIRST NAMES only (Alex, Taylor, Jamie, etc.)
- Include issue numbers when available ("#42")
- Keep it under 90 characters (need room for elapsed time)
- Phase verbs: pre="planning", main="building", post="polishing", review="reviewing", fix="fixing", test="testing"

Respond with ONLY the blurb text, no quotes, no explanation.`;

/**
 * Generates a status blurb string (legacy API - use generateStatus for full result).
 */
export async function generateStatusBlurb(teamStatus: TeamStatus): Promise<string> {
  const result = await generateStatus();
  return result.blurb;
}

/**
 * Generates the full status result including blurb, activity type, and timing.
 * This is the primary function for rich status updates.
 */
export async function generateStatus(): Promise<StatusResult> {
  const context = await gatherProjectContext({ content: '' });

  const userPrompt = buildContextPrompt(context);

  // Determine activity type based on current phase
  const primaryPhase = context.activeAgents[0]?.phase || 'idle';
  const activityType = getDiscordActivityType(primaryPhase, context.activeAgents.length > 0);

  let blurb: string;

  try {
    const openai = getOpenAIClient();
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: BLURB_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: 60,
      temperature: 0.7,
    });

    blurb = response.choices[0]?.message?.content?.trim() || '';

    if (!blurb) {
      console.warn('Empty blurb from OpenAI, falling back to context-based');
      blurb = generateFallbackBlurb(context);
    }
  } catch (error) {
    console.error('OpenAI blurb generation failed, falling back:', error);
    blurb = generateFallbackBlurb(context);
  }

  // Truncate blurb
  blurb = truncateBlurb(blurb);

  // For Playing/Watching/Competing, we use the blurb as the activity name
  // For Custom, we use it as the state
  const activityName = blurb;

  return {
    blurb,
    activityType,
    activityName,
    elapsedMinutes: context.elapsedMinutes,
  };
}

/**
 * Gets a short action verb based on the pipeline phase.
 */
function getPhaseVerb(phase: string): string {
  const verbs: Record<string, string> = {
    pre: 'planning',
    main: 'building',
    post: 'polishing',
    review: 'reviewing',
    fix: 'fixing',
  };
  return verbs[phase] || 'working on';
}

/**
 * Builds the context prompt for GPT with detailed agent activity.
 */
function buildContextPrompt(context: ProjectContext): string {
  const lines: string[] = ['Current project state:'];

  // ELAPSED TIME - Important for status display
  if (context.elapsedMinutes !== null) {
    lines.push('');
    lines.push(`ELAPSED TIME: ${formatElapsedTime(context.elapsedMinutes)} (INCLUDE THIS IN RESPONSE)`);
  }

  // Detailed active agent information (highest priority)
  if (context.activeAgents.length > 0) {
    lines.push('');
    lines.push('ACTIVE AGENTS (currently running):');
    for (const agent of context.activeAgents) {
      const shortName = AGENT_SHORT_NAMES[agent.name] || agent.name;
      const issueRef = agent.issueNumber ? `#${agent.issueNumber}` : 'current work';
      const elapsedStr = context.elapsedMinutes !== null
        ? ` - running for ${formatElapsedTime(context.elapsedMinutes)}`
        : '';
      lines.push(`- ${shortName} is ${getPhaseVerb(agent.phase)} ${issueRef} (phase: ${agent.phase})${elapsedStr}`);
    }
  }

  // Queued agents
  if (context.queuedAgents.length > 0) {
    lines.push('');
    lines.push(`QUEUED AGENTS (${context.queuedAgents.length} waiting):`);
    for (const agent of context.queuedAgents.slice(0, 3)) {
      const shortName = AGENT_SHORT_NAMES[agent.name] || agent.name;
      lines.push(`- ${shortName} (${agent.phase} phase) - queued`);
    }
    if (context.queuedAgents.length > 3) {
      lines.push(`- ...and ${context.queuedAgents.length - 3} more queued`);
    }
  }

  // No active agents - show other context
  if (context.activeAgents.length === 0) {
    lines.push('');
    lines.push('NO AGENTS CURRENTLY ACTIVE');

    if (context.inProgressWorkflows > 0) {
      lines.push(`- ${context.inProgressWorkflows} workflow(s) running (no agent jobs detected)`);
    }
  }

  // PR and issue context
  if (context.mostRecentPR) {
    lines.push('');
    lines.push(`Open PR: #${context.mostRecentPR.number} "${context.mostRecentPR.title}"`);
  }

  if (context.mostRecentIssue) {
    lines.push(`Latest issue: #${context.mostRecentIssue.number} "${context.mostRecentIssue.title}"`);
  }

  // Summary stats
  lines.push('');
  lines.push(`Stats: ${context.openIssues} open issues, ${context.openPRs} open PRs`);

  if (context.latestWorkflowStatus) {
    lines.push(`Last workflow result: ${context.latestWorkflowStatus}`);
  }

  return lines.join('\n');
}

/**
 * Generates a fallback blurb when GPT fails or returns empty.
 * Uses the agent-aware context with elapsed time for better status messages.
 */
function generateFallbackBlurb(context: ProjectContext): string {
  const elapsedStr = context.elapsedMinutes !== null
    ? ` (${formatElapsedTime(context.elapsedMinutes)})`
    : '';

  // Priority 1: Active agents with their current work
  if (context.activeAgents.length > 0) {
    const agent = context.activeAgents[0];
    const shortName = AGENT_SHORT_NAMES[agent.name] || agent.name;
    const issueRef = agent.issueNumber ? `#${agent.issueNumber}` : '';
    const verb = getPhaseVerb(agent.phase);

    if (context.activeAgents.length === 1) {
      const base = issueRef ? `${shortName} ${verb} ${issueRef}` : `${shortName} ${verb}`;
      return `${base}${elapsedStr}`;
    } else {
      // Multiple active agents
      const otherCount = context.activeAgents.length - 1;
      return `${shortName} + ${otherCount} more working${elapsedStr}`;
    }
  }

  // Priority 2: Queued agents
  if (context.queuedAgents.length > 0) {
    const agent = context.queuedAgents[0];
    const shortName = AGENT_SHORT_NAMES[agent.name] || agent.name;
    return `${shortName} queued to start...`;
  }

  // Priority 3: Generic workflow activity
  if (context.inProgressWorkflows > 0 && context.mostRecentIssue) {
    return `Processing #${context.mostRecentIssue.number}${elapsedStr}`;
  }

  // Priority 4: Open PRs
  if (context.openPRs > 0 && context.mostRecentPR) {
    return `PR #${context.mostRecentPR.number} awaiting review`;
  }

  // Priority 5: Recent issue
  if (context.mostRecentIssue) {
    return `Tracking #${context.mostRecentIssue.number}`;
  }

  // Default idle state
  return 'Ready for work';
}

export function truncateBlurb(blurb: string): string {
  if (blurb.length <= MAX_BLURB_LENGTH) {
    return blurb;
  }
  return blurb.slice(0, MAX_BLURB_LENGTH - 3) + '...';
}

export {
  MAX_BLURB_LENGTH,
  BLURB_SYSTEM_PROMPT,
  AGENT_PERSONAS,
  AGENT_SHORT_NAMES,
  PHASE_TO_ACTIVITY_TYPE,
  formatElapsedTime,
};
