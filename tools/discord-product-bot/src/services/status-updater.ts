import { Client, ActivityType } from 'discord.js';
import { team_get_status } from '../tools/agent-tools.js';
import { generateStatusBlurb } from './blurb-generator.js';

const UPDATE_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

// Prevent overlapping updates
let isUpdating = false;
let intervalId: ReturnType<typeof setInterval> | null = null;

/**
 * Updates the Discord bot's activity status with a generated blurb from team status.
 */
async function updateStatus(client: Client): Promise<void> {
  if (isUpdating) {
    console.log('Status update already in progress, skipping');
    return;
  }

  isUpdating = true;

  try {
    const teamStatus = await team_get_status();
    console.log(`[StatusUpdater] Fetched team status from GitHub (length: ${teamStatus.content.length})`);
    
    const blurb = await generateStatusBlurb(teamStatus);
    console.log(`[StatusUpdater] Generated blurb: "${blurb}"`);

    // In Discord.js v14, for ActivityType.Custom, the actual text must be in the 'state' property.
    // The 'name' property is what appears as the activity category (e.g., "Playing <name>").
    client.user?.setPresence({
      activities: [
        {
          name: 'Team Focus',
          state: blurb,
          type: ActivityType.Custom,
        },
      ],
      status: 'online',
    });
    console.log('[StatusUpdater] Discord presence updated successfully');
  } catch (error) {
    console.error('[StatusUpdater] Failed to update status:', error);
    // On failure, set a generic status rather than leaving it stale
    try {
      client.user?.setPresence({
        activities: [
          {
            name: 'Team Focus',
            state: 'Working on StoryOfYourLife',
            type: ActivityType.Custom,
          },
        ],
      });
    } catch (fallbackError) {
      console.error('[StatusUpdater] Fallback status also failed:', fallbackError);
    }
  } finally {
    isUpdating = false;
  }
}

/**
 * Starts the status updater service that runs on a fixed interval.
 * Should be called once after the Discord client is ready.
 */
export function startStatusUpdater(client: Client): void {
  if (intervalId) {
    console.warn('[StatusUpdater] Status updater already running');
    return;
  }

  console.log(`[StatusUpdater] Starting with ${UPDATE_INTERVAL_MS / 1000}s interval`);

  // Run initial update immediately
  updateStatus(client);

  // Schedule recurring updates
  intervalId = setInterval(() => {
    updateStatus(client);
  }, UPDATE_INTERVAL_MS);
}

/**
 * Stops the status updater service.
 * Should be called during graceful shutdown.
 */
export function stopStatusUpdater(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    console.log('[StatusUpdater] Stopped');
  }
}

// Export for testing
export { UPDATE_INTERVAL_MS, updateStatus, isUpdating };
