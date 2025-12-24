import OpenAI from 'openai';
import { config } from '../config.js';
import type { TrackedIssue } from './issue-tracker.js';
import { getIssue, getPullRequest } from './github.js';

let openaiClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey: config.openai.apiKey,
    });
  }
  return openaiClient;
}

export interface ClosureAnnouncement {
  message: string;
}

export interface PrReadyAnnouncement {
  message: string;
  prUrl: string;
  prNumber: number;
  prTitle: string;
}

export interface MergeAnnouncement {
  shouldAnnounce: boolean;
  message: string;
  reason: string;
}

export async function generateClosureAnnouncement(
  trackedIssue: TrackedIssue
): Promise<ClosureAnnouncement> {
  let issueBody = '';
  try {
    const issue = await getIssue(trackedIssue.issueNumber);
    issueBody = issue.body;
  } catch {
    issueBody = 'Unable to fetch issue details.';
  }

  let prContext = '';
  if (trackedIssue.linkedPrNumber) {
    try {
      const pr = await getPullRequest(trackedIssue.linkedPrNumber);
      prContext = `
A pull request was created: PR #${pr.number} "${pr.title}"
PR Status: ${trackedIssue.linkedPrStatus}
`;
    } catch {
      prContext = `A pull request #${trackedIssue.linkedPrNumber} was linked.`;
    }
  }

  const systemPrompt = `You are a friendly project manager giving a casual update in Discord about a completed task.

Keep it brief, human, and conversational. Use Discord markdown for formatting.
Focus on what was accomplished rather than technical details.
Be positive but not over-the-top.
Max 2-3 sentences.`;

  const userPrompt = `The following issue has been completed:

Issue #${trackedIssue.issueNumber}: ${trackedIssue.title}

Issue Description:
${issueBody.slice(0, 500)}

${prContext}

Write a brief, friendly closure message for the Discord thread where this was originally discussed.`;

  try {
    const openai = getOpenAIClient();
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: 150,
      temperature: 0.7,
    });

    const message = response.choices[0]?.message?.content?.trim() ||
      `Issue #${trackedIssue.issueNumber} has been completed!`;

    return { message };
  } catch (error) {
    console.error('[AnnouncementGenerator] Failed to generate closure message:', error);
    return {
      message: `Issue #${trackedIssue.issueNumber} "${trackedIssue.title}" has been completed and closed.`,
    };
  }
}

export async function generatePrReadyAnnouncement(
  trackedIssue: TrackedIssue,
  prNumber: number
): Promise<PrReadyAnnouncement> {
  let prTitle = '';
  let prUrl = '';
  let prBody = '';

  try {
    const pr = await getPullRequest(prNumber);
    prTitle = pr.title;
    prUrl = pr.html_url;
    prBody = pr.body || '';
  } catch {
    prUrl = `https://github.com/${config.github.owner}/${config.github.repo}/pull/${prNumber}`;
    prTitle = `PR #${prNumber}`;
  }

  const systemPrompt = `You are a tech lead notifying the team lead that a pull request is ready for review.

Write a brief, professional message that:
- Gets straight to the point
- Mentions what the PR accomplishes
- Is casual but professional (like messaging a colleague)
- Uses Discord markdown

Keep it to 2-3 sentences max. Don't be overly formal or corporate.`;

  const userPrompt = `A pull request is ready for review:

Original Issue: #${trackedIssue.issueNumber} - ${trackedIssue.title}
PR: #${prNumber} - ${prTitle}

PR Description:
${prBody.slice(0, 500)}

Write a brief message to notify the team lead that this PR needs review.`;

  try {
    const openai = getOpenAIClient();
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: 150,
      temperature: 0.7,
    });

    const message = response.choices[0]?.message?.content?.trim() ||
      `PR #${prNumber} is ready for review!`;

    return {
      message,
      prUrl,
      prNumber,
      prTitle,
    };
  } catch (error) {
    console.error('[AnnouncementGenerator] Failed to generate PR announcement:', error);
    return {
      message: `PR #${prNumber} "${prTitle}" is ready for review. It addresses issue #${trackedIssue.issueNumber}.`,
      prUrl,
      prNumber,
      prTitle,
    };
  }
}

export async function generateMergeAnnouncement(
  trackedIssue: TrackedIssue,
  prNumber: number
): Promise<MergeAnnouncement> {
  let prTitle = '';
  let prBody = '';
  let issueBody = '';

  try {
    const pr = await getPullRequest(prNumber);
    prTitle = pr.title;
    prBody = pr.body || '';
  } catch {
    prTitle = `PR #${prNumber}`;
  }

  try {
    const issue = await getIssue(trackedIssue.issueNumber);
    issueBody = issue.body;
  } catch {
    issueBody = '';
  }

  const systemPrompt = `You are a product manager evaluating whether a code change is worth announcing to users.

Your job is to:
1. Determine if this change is user-facing and meaningful to end users
2. If yes, write a brief, exciting product announcement
3. If no, explain why it's not announcement-worthy

Consider:
- Bug fixes that users would notice = announce
- New features = announce
- Internal refactoring = don't announce
- CI/CD changes = don't announce
- Documentation updates = usually don't announce
- Performance improvements users would feel = announce

Be honest. Not everything needs to be announced.

Respond in JSON format:
{
  "shouldAnnounce": true/false,
  "reason": "brief explanation",
  "announcement": "the announcement message if shouldAnnounce is true, otherwise empty"
}`;

  const userPrompt = `Evaluate whether this merged PR is worth a product announcement:

Issue: #${trackedIssue.issueNumber} - ${trackedIssue.title}
${issueBody.slice(0, 300)}

PR: #${prNumber} - ${prTitle}
${prBody.slice(0, 500)}

Respond with JSON only.`;

  try {
    const openai = getOpenAIClient();
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: 300,
      temperature: 0.5,
    });

    const content = response.choices[0]?.message?.content?.trim() || '';

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        shouldAnnounce: parsed.shouldAnnounce === true,
        message: parsed.announcement || '',
        reason: parsed.reason || '',
      };
    }

    return {
      shouldAnnounce: false,
      message: '',
      reason: 'Failed to parse GPT response',
    };
  } catch (error) {
    console.error('[AnnouncementGenerator] Failed to generate merge announcement:', error);
    return {
      shouldAnnounce: false,
      message: '',
      reason: 'Error generating announcement',
    };
  }
}
