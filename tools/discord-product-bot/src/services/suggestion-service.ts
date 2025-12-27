/**
 * Suggestion Service
 * 
 * Handles the flow of suggesting next issues to work on after an issue closes:
 * 1. Ranks open issues using GPT based on context and priority
 * 2. Posts suggestions to Discord tagging the team lead
 * 3. Tracks suggestions in SQLite for response correlation
 * 4. Processes selections and triggers the pipeline via @Team comment
 */

import { Client, TextChannel, EmbedBuilder } from 'discord.js';
import OpenAI from 'openai';
import { config } from '../config.js';
import { listIssues, getIssue, triggerIssuePipeline } from './github.js';
import {
  createIssueSuggestion,
  getPendingSuggestion,
  resolveSuggestion,
  cancelPendingSuggestions,
  type SuggestedIssue,
  type IssueSuggestion,
} from './issue-tracker.js';

const openai = new OpenAI({
  apiKey: config.openai.apiKey,
});

// Time window for considering ambient responses (10 minutes)
const SUGGESTION_TIMEOUT_MS = 10 * 60 * 1000;

// Maximum number of messages between suggestion and response to consider
const MAX_MESSAGE_DISTANCE = 10;

/**
 * Prompt for ranking issues by priority/context.
 */
const RANK_ISSUES_PROMPT = `You are helping a team decide which GitHub issue to work on next.

The following issue was just completed:
- Issue #{{closedNumber}}: {{closedTitle}}

Here are the open issues to choose from:
{{issueList}}

Analyze these issues and select the TOP 3 most important to work on next.
Consider:
1. Dependencies - does one need to be done before others?
2. User impact - which affects users most?
3. Complexity - is there low-hanging fruit that unblocks other work?
4. Context from the just-completed issue - is there natural follow-up work?

Respond with JSON only (no markdown):
{
  "rankings": [
    { "number": <issue_number>, "reason": "<brief reason why this is a top priority>" },
    { "number": <issue_number>, "reason": "<brief reason>" },
    { "number": <issue_number>, "reason": "<brief reason>" }
  ]
}

If there are fewer than 3 issues, include all of them.`;

/**
 * Prompt for detecting if a message is responding to a suggestion.
 */
const DETECT_RESPONSE_PROMPT = `You are analyzing a Discord message to determine if it's responding to a bot's suggestion for which issue to work on next.

The bot posted this suggestion:
{{suggestionContent}}

The suggested issues were:
{{issueList}}

The user's message is:
"{{userMessage}}"

Additional context:
- Messages since suggestion: {{messageDistance}}
- Time since suggestion: {{timeSince}} minutes

Determine if this message is selecting one of the suggested issues.

Respond with JSON only (no markdown):
{
  "isResponse": boolean,
  "selectedIssue": <issue_number or null>,
  "confidence": "high" | "medium" | "low",
  "reasoning": "<brief explanation>"
}

Examples of responses that ARE selecting:
- "Let's do the first one"
- "Yeah go with 42"
- "#45 sounds good"
- "the auth one"
- "1" or "2" or "3"
- "sounds good, let's tackle that"

Examples of responses that are NOT selecting:
- General conversation
- Questions about the issues
- Responses clearly to someone else
- Requests for more info`;

export interface RankedIssue {
  number: number;
  title: string;
  reason: string;
}

/**
 * Ranks open issues and returns the top 3 candidates.
 */
export async function rankOpenIssues(
  closedIssueNumber: number,
  closedIssueTitle: string
): Promise<RankedIssue[]> {
  // Get all open issues
  const openIssues = await listIssues('open', undefined, 20);
  
  if (openIssues.length === 0) {
    console.log('[SuggestionService] No open issues to rank');
    return [];
  }

  // Build issue list for prompt
  const issueList = await Promise.all(
    openIssues.map(async (issue) => {
      try {
        const details = await getIssue(issue.number);
        const bodyPreview = details.body.slice(0, 200).replace(/\n/g, ' ');
        return `- #${issue.number}: ${issue.title}\n  Labels: ${details.labels.join(', ') || 'none'}\n  Preview: ${bodyPreview}...`;
      } catch {
        return `- #${issue.number}: ${issue.title}`;
      }
    })
  );

  const prompt = RANK_ISSUES_PROMPT
    .replace('{{closedNumber}}', String(closedIssueNumber))
    .replace('{{closedTitle}}', closedIssueTitle)
    .replace('{{issueList}}', issueList.join('\n\n'));

  try {
    const response = await openai.chat.completions.create({
      model: config.openai.model,
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.3,
    });

    const text = response.choices[0]?.message?.content;
    if (!text) {
      throw new Error('No response from OpenAI');
    }

    const result = JSON.parse(text) as { rankings: Array<{ number: number; reason: string }> };
    
    // Enrich with titles
    return result.rankings.map((r) => {
      const issue = openIssues.find((i) => i.number === r.number);
      return {
        number: r.number,
        title: issue?.title || `Issue #${r.number}`,
        reason: r.reason,
      };
    });
  } catch (error) {
    console.error('[SuggestionService] Failed to rank issues:', error);
    // Fallback: return first 3 issues without ranking
    return openIssues.slice(0, 3).map((issue) => ({
      number: issue.number,
      title: issue.title,
      reason: 'Unable to rank - showing by recency',
    }));
  }
}

/**
 * Posts a suggestion message to Discord and stores it for tracking.
 */
export async function postIssueSuggestion(
  client: Client,
  closedIssueNumber: number,
  closedIssueTitle: string,
  rankedIssues: RankedIssue[]
): Promise<string | null> {
  if (rankedIssues.length === 0) {
    console.log('[SuggestionService] No issues to suggest');
    return null;
  }

  try {
    const channel = await client.channels.fetch(config.discord.productChannelId);
    if (!channel || !channel.isTextBased()) {
      console.error('[SuggestionService] Product channel not found or not text-based');
      return null;
    }

    // Cancel any previous pending suggestions
    cancelPendingSuggestions(config.discord.productChannelId);

    // Build suggestion embed
    const embed = new EmbedBuilder()
      .setTitle('🎯 What should we work on next?')
      .setDescription(
        `Issue #${closedIssueNumber} (${closedIssueTitle}) is complete!\n\n` +
        `Here are the top candidates for the next issue:`
      )
      .setColor(0x5865F2)
      .addFields(
        rankedIssues.map((issue, idx) => ({
          name: `${idx + 1}. #${issue.number}: ${issue.title}`,
          value: issue.reason,
          inline: false,
        }))
      )
      .setFooter({ text: 'Reply with a number or issue reference to select' })
      .setTimestamp();

    const teamLeadMention = `<@${config.discord.teamLeadUserId}>`;
    
    const message = await (channel as TextChannel).send({
      content: `${teamLeadMention} - Which issue should we tackle next?`,
      embeds: [embed],
    });

    // Store suggestion for tracking
    const suggestedIssues: SuggestedIssue[] = rankedIssues.map((issue) => ({
      number: issue.number,
      title: issue.title,
      reason: issue.reason,
    }));

    createIssueSuggestion(
      message.id,
      config.discord.productChannelId,
      suggestedIssues
    );

    console.log(`[SuggestionService] Posted suggestion with ${rankedIssues.length} options`);
    return message.id;
  } catch (error) {
    console.error('[SuggestionService] Failed to post suggestion:', error);
    return null;
  }
}

export interface ResponseDetectionResult {
  isResponse: boolean;
  selectedIssue: number | null;
  confidence: 'high' | 'medium' | 'low';
  reasoning: string;
}

/**
 * Detects if a message is responding to a pending suggestion.
 */
export async function detectSuggestionResponse(
  message: string,
  suggestion: IssueSuggestion,
  messageDistance: number
): Promise<ResponseDetectionResult> {
  const timeSinceMs = Date.now() - suggestion.createdAt;
  const timeSinceMinutes = Math.round(timeSinceMs / 60000);

  // Quick rejection for old suggestions
  if (timeSinceMs > SUGGESTION_TIMEOUT_MS) {
    return {
      isResponse: false,
      selectedIssue: null,
      confidence: 'high',
      reasoning: 'Suggestion has timed out',
    };
  }

  // Quick rejection for distant messages
  if (messageDistance > MAX_MESSAGE_DISTANCE) {
    return {
      isResponse: false,
      selectedIssue: null,
      confidence: 'high',
      reasoning: 'Too many messages between suggestion and this message',
    };
  }

  // Build issue list for prompt
  const issueList = suggestion.suggestedIssues
    .map((issue, idx) => `${idx + 1}. #${issue.number}: ${issue.title}`)
    .join('\n');

  const suggestionContent = `Which issue should we tackle next?\n${issueList}`;

  const prompt = DETECT_RESPONSE_PROMPT
    .replace('{{suggestionContent}}', suggestionContent)
    .replace('{{issueList}}', issueList)
    .replace('{{userMessage}}', message)
    .replace('{{messageDistance}}', String(messageDistance))
    .replace('{{timeSince}}', String(timeSinceMinutes));

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini', // Use faster/cheaper model for detection
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.1,
    });

    const text = response.choices[0]?.message?.content;
    if (!text) {
      throw new Error('No response from OpenAI');
    }

    return JSON.parse(text) as ResponseDetectionResult;
  } catch (error) {
    console.error('[SuggestionService] Failed to detect response:', error);
    return {
      isResponse: false,
      selectedIssue: null,
      confidence: 'low',
      reasoning: 'Detection failed',
    };
  }
}

/**
 * Processes a selection and triggers the pipeline on the selected issue.
 */
export async function processIssueSelection(
  client: Client,
  suggestion: IssueSuggestion,
  selectedIssueNumber: number
): Promise<boolean> {
  try {
    // Verify the issue is in the suggestion
    const selectedIssue = suggestion.suggestedIssues.find(
      (i) => i.number === selectedIssueNumber
    );
    
    if (!selectedIssue) {
      console.warn(
        `[SuggestionService] Issue #${selectedIssueNumber} not in suggestion ${suggestion.id}`
      );
      return false;
    }

    // Mark suggestion as resolved
    resolveSuggestion(suggestion.id, selectedIssueNumber);

    // Trigger pipeline by adding @Team comment
    await triggerIssuePipeline(selectedIssueNumber);

    // Post confirmation to Discord
    const channel = await client.channels.fetch(config.discord.productChannelId);
    if (channel && channel.isTextBased()) {
      await (channel as TextChannel).send(
        `✅ Got it! Starting work on **#${selectedIssueNumber}: ${selectedIssue.title}**`
      );
    }

    console.log(`[SuggestionService] Triggered pipeline for issue #${selectedIssueNumber}`);
    return true;
  } catch (error) {
    console.error('[SuggestionService] Failed to process selection:', error);
    return false;
  }
}

/**
 * Gets the pending suggestion for the product channel if one exists.
 */
export function getActiveSuggestion(): IssueSuggestion | null {
  return getPendingSuggestion(config.discord.productChannelId);
}

