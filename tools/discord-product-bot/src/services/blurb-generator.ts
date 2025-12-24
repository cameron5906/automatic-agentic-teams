import OpenAI from 'openai';
import { config } from '../config.js';
import type { TeamStatus } from '../types.js';
import { listIssues, listPullRequests, getWorkflowRuns } from './github.js';

let openaiClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey: config.openai.apiKey,
    });
  }
  return openaiClient;
}

const MAX_BLURB_LENGTH = 100;

export interface ProjectContext {
  teamStatus: TeamStatus;
  openIssues: number;
  openPRs: number;
  inProgressWorkflows: number;
  latestWorkflowStatus?: string;
  mostRecentIssue?: { number: number; title: string };
  mostRecentPR?: { number: number; title: string };
}

async function gatherProjectContext(teamStatus: TeamStatus): Promise<ProjectContext> {
  try {
    const [issues, prs, workflows] = await Promise.all([
      listIssues('open', undefined, 5).catch(() => []),
      listPullRequests('open', 5).catch(() => []),
      getWorkflowRuns(undefined, 'in_progress', 5).catch(() => []),
    ]);

    const completedWorkflows = await getWorkflowRuns(undefined, 'completed', 1).catch(() => []);

    return {
      teamStatus,
      openIssues: issues.length,
      openPRs: prs.length,
      inProgressWorkflows: workflows.length,
      latestWorkflowStatus: completedWorkflows[0]?.conclusion || undefined,
      mostRecentIssue: issues[0] ? { number: issues[0].number, title: issues[0].title } : undefined,
      mostRecentPR: prs[0] ? { number: prs[0].number, title: prs[0].title } : undefined,
    };
  } catch (error) {
    console.error('[BlurbGenerator] Failed to gather project context:', error);
    return {
      teamStatus,
      openIssues: 0,
      openPRs: 0,
      inProgressWorkflows: 0,
    };
  }
}

const BLURB_SYSTEM_PROMPT = `You are the mood coordinator for an AI development team. Generate a SHORT status blurb (max 100 chars) for Discord.

Priority order for what to highlight:
1. **In-progress workflows** - If agents are actively working, mention it ("Agents processing #42...")
2. **Open PRs awaiting review** - If there are PRs, mention ("PR #5 ready for review")
3. **Latest issue being worked** - Mention the current focus
4. **Active milestone** - Fall back to milestone if nothing else is happening
5. **Idle state** - If nothing is happening, a calm "Ready for work" or similar

Guidelines:
- Be specific: Name issue numbers, PR numbers, or milestone names
- Be human: Use friendly, professional tone
- Reflect urgency: Use "Working on..." for active, "Awaiting..." for blocked
- Keep it concise: Must be under 100 characters
- Vary phrasing: "Processing...", "Reviewing...", "Building...", "Deploying...", etc.

Respond with ONLY the blurb text, no quotes, no explanation.`;

export async function generateStatusBlurb(teamStatus: TeamStatus): Promise<string> {
  const context = await gatherProjectContext(teamStatus);

  const userPrompt = buildContextPrompt(context);

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

    const blurb = response.choices[0]?.message?.content?.trim();

    if (!blurb) {
      console.warn('Empty blurb from OpenAI, falling back to context-based');
      return truncateBlurb(generateFallbackBlurb(context));
    }

    return truncateBlurb(blurb);
  } catch (error) {
    console.error('OpenAI blurb generation failed, falling back:', error);
    return truncateBlurb(generateFallbackBlurb(context));
  }
}

function buildContextPrompt(context: ProjectContext): string {
  const lines: string[] = ['Current project state:'];

  if (context.inProgressWorkflows > 0) {
    lines.push(`- ${context.inProgressWorkflows} workflow(s) actively running`);
  }

  if (context.mostRecentIssue) {
    lines.push(`- Latest issue: #${context.mostRecentIssue.number} "${context.mostRecentIssue.title}"`);
  }

  if (context.mostRecentPR) {
    lines.push(`- Open PR: #${context.mostRecentPR.number} "${context.mostRecentPR.title}"`);
  }

  lines.push(`- Total open issues: ${context.openIssues}`);
  lines.push(`- Total open PRs: ${context.openPRs}`);

  if (context.latestWorkflowStatus) {
    lines.push(`- Last workflow result: ${context.latestWorkflowStatus}`);
  }

  lines.push('');
  lines.push('TEAM.md content:');
  lines.push(context.teamStatus.content.slice(0, 1000));

  return lines.join('\n');
}

function generateFallbackBlurb(context: ProjectContext): string {
  if (context.inProgressWorkflows > 0 && context.mostRecentIssue) {
    return `Processing #${context.mostRecentIssue.number}...`;
  }

  if (context.openPRs > 0 && context.mostRecentPR) {
    return `PR #${context.mostRecentPR.number} awaiting review`;
  }

  if (context.mostRecentIssue) {
    return `Working on #${context.mostRecentIssue.number}`;
  }

  const milestone = extractMilestoneName(extractSection(context.teamStatus.content, 'Active Milestone'));
  if (milestone && milestone !== 'Working...') {
    return milestone;
  }

  return 'Ready for work';
}

function extractSection(content: string, sectionName: string): string {
  const regex = new RegExp(`## .*?${sectionName}.*?\\s*([\\s\\S]*?)(?=##|$)`, 'i');
  const match = content.match(regex);
  return match ? match[1].trim() : '';
}

export function truncateBlurb(blurb: string): string {
  if (blurb.length <= MAX_BLURB_LENGTH) {
    return blurb;
  }
  return blurb.slice(0, MAX_BLURB_LENGTH - 3) + '...';
}

export function extractMilestoneName(activeMilestone: string): string {
  const nameMatch = activeMilestone.match(/^[-*]?\s*Name:\s*(.+?)(?:\n|$)/im);
  if (nameMatch) {
    return nameMatch[1].trim();
  }

  const lines = activeMilestone.split('\n').filter((line) => line.trim());
  const firstLine = lines[0]?.trim() || 'Working...';

  return firstLine.replace(/^[-*]\s*/, '').trim() || 'Working...';
}

export { MAX_BLURB_LENGTH, BLURB_SYSTEM_PROMPT };
