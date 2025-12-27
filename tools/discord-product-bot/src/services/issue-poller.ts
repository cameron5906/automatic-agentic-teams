import { Client } from 'discord.js';
import {
  getOpenTrackedIssues,
  getIssuesNeedingPrAnnouncement,
  getIssuesNeedingMergeAnnouncement,
  getIssuesNeedingClosureAnnouncement,
  pollIssueStatus,
  findLinkedPRForIssue,
  checkPRStatus,
  updateLinkedPr,
  type TrackedIssue,
} from './issue-tracker.js';
import { notifyPrReady, notifyMerge, notifyClosure } from './pr-notifier.js';
import { rankOpenIssues, postIssueSuggestion } from './suggestion-service.js';
import { listIssues } from './github.js';

const POLL_INTERVAL_MS = 2 * 60 * 1000; // 2 minutes

let intervalId: ReturnType<typeof setInterval> | null = null;
let isPolling = false;

export function startIssuePoller(client: Client): void {
  if (intervalId) {
    console.warn('[IssuePoller] Already running');
    return;
  }

  console.log(`[IssuePoller] Starting with ${POLL_INTERVAL_MS / 1000}s interval`);

  pollAllIssues(client);

  intervalId = setInterval(() => {
    pollAllIssues(client);
  }, POLL_INTERVAL_MS);
}

export function stopIssuePoller(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    console.log('[IssuePoller] Stopped');
  }
}

async function pollAllIssues(client: Client): Promise<void> {
  if (isPolling) {
    console.log('[IssuePoller] Poll already in progress, skipping');
    return;
  }

  isPolling = true;

  try {
    const openIssues = getOpenTrackedIssues();
    console.log(`[IssuePoller] Polling ${openIssues.length} open issues`);

    for (const issue of openIssues) {
      await pollSingleIssue(client, issue);
      await sleep(500);
    }

    await processAnnouncements(client);
  } catch (error) {
    console.error('[IssuePoller] Error during poll:', error);
  } finally {
    isPolling = false;
  }
}

async function pollSingleIssue(client: Client, issue: TrackedIssue): Promise<void> {
  try {
    const update = await pollIssueStatus(issue.issueNumber);

    if (update && update.newStatus === 'closed') {
      console.log(`[IssuePoller] Issue #${issue.issueNumber} is now closed`);
      
      // Trigger next issue suggestion flow when an issue closes
      await handleIssueClosed(client, issue.issueNumber, issue.title);
    }

    if (!issue.linkedPrNumber) {
      const linkedPr = await findLinkedPRForIssue(issue.issueNumber);
      if (linkedPr) {
        const prStatus = await checkPRStatus(linkedPr.number);
        updateLinkedPr(issue.issueNumber, linkedPr.number, prStatus);
        console.log(
          `[IssuePoller] Found linked PR #${linkedPr.number} for issue #${issue.issueNumber} (status: ${prStatus})`
        );
      }
    } else {
      const prStatus = await checkPRStatus(issue.linkedPrNumber);
      if (prStatus !== issue.linkedPrStatus) {
        updateLinkedPr(issue.issueNumber, issue.linkedPrNumber, prStatus);
        console.log(
          `[IssuePoller] PR #${issue.linkedPrNumber} status changed: ${issue.linkedPrStatus} -> ${prStatus}`
        );
      }
    }
  } catch (error) {
    console.error(`[IssuePoller] Error polling issue #${issue.issueNumber}:`, error);
  }
}

/**
 * Handles the flow when an issue is closed:
 * 1. Checks if there are more open issues
 * 2. If yes, ranks them and posts a suggestion to Discord
 */
async function handleIssueClosed(
  client: Client,
  closedIssueNumber: number,
  closedIssueTitle: string
): Promise<void> {
  try {
    // Check if there are more open issues
    const openIssues = await listIssues('open', undefined, 10);
    
    if (openIssues.length === 0) {
      console.log('[IssuePoller] No more open issues - nothing to suggest');
      return;
    }

    console.log(`[IssuePoller] Issue #${closedIssueNumber} closed, ${openIssues.length} open issues remain`);

    // Rank the open issues
    const rankedIssues = await rankOpenIssues(closedIssueNumber, closedIssueTitle);
    
    if (rankedIssues.length === 0) {
      console.log('[IssuePoller] No issues to suggest after ranking');
      return;
    }

    // Post suggestion to Discord
    await postIssueSuggestion(client, closedIssueNumber, closedIssueTitle, rankedIssues);
  } catch (error) {
    console.error('[IssuePoller] Error handling issue closure:', error);
  }
}

async function processAnnouncements(client: Client): Promise<void> {
  const needsPrAnnouncement = getIssuesNeedingPrAnnouncement();
  for (const issue of needsPrAnnouncement) {
    if (issue.linkedPrNumber) {
      await notifyPrReady(client, issue, issue.linkedPrNumber);
      await sleep(1000);
    }
  }

  const needsMergeAnnouncement = getIssuesNeedingMergeAnnouncement();
  for (const issue of needsMergeAnnouncement) {
    if (issue.linkedPrNumber) {
      await notifyMerge(client, issue, issue.linkedPrNumber);
      await sleep(1000);
    }
  }

  const needsClosureAnnouncement = getIssuesNeedingClosureAnnouncement();
  for (const issue of needsClosureAnnouncement) {
    await notifyClosure(client, issue);
    await sleep(1000);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export { POLL_INTERVAL_MS };
