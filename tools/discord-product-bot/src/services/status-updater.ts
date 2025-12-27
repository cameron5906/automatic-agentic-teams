import { Client, ActivityType, PresenceStatusData } from 'discord.js';
import { generateStatus, formatElapsedTime } from './blurb-generator.js';

const UPDATE_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

// Prevent overlapping updates
let isUpdating = false;
let intervalId: ReturnType<typeof setInterval> | null = null;

/**
 * Maps ActivityType enum to a human-readable string for logging.
 */
function activityTypeToString(type: ActivityType): string {
  switch (type) {
    case ActivityType.Playing:
      return 'Playing';
    case ActivityType.Watching:
      return 'Watching';
    case ActivityType.Competing:
      return 'Competing';
    case ActivityType.Listening:
      return 'Listening';
    case ActivityType.Custom:
      return 'Custom';
    default:
      return 'Unknown';
  }
}

/**
 * Updates the Discord bot's activity status with dynamic activity type.
 * - Playing: Active coding/building work
 * - Watching: Review/planning activities
 * - Competing: Testing/QA activities
 * - Custom: Idle/ready state
 * Includes elapsed time tracking for active workflows.
 */
async function updateStatus(client: Client): Promise<void> {
  if (isUpdating) {
    console.log('Status update already in progress, skipping');
    return;
  }

  isUpdating = true;

  try {
    console.log('[StatusUpdater] Generating status from GitHub workflow data...');

    const status = await generateStatus();
    const elapsedStr = status.elapsedMinutes !== null
      ? ` (elapsed: ${formatElapsedTime(status.elapsedMinutes)})`
      : '';

    console.log(
      `[StatusUpdater] Generated status: "${status.blurb}" ` +
      `[${activityTypeToString(status.activityType)}]${elapsedStr}`
    );

    // Build presence based on activity type
    // For Custom type, use state field; for others, use name field
    if (status.activityType === ActivityType.Custom) {
      // Custom status: shows the state text directly
      client.user?.setPresence({
        activities: [
          {
            name: 'Team Focus',
            state: status.blurb,
            type: ActivityType.Custom,
          },
        ],
        status: 'online',
      });
    } else {
      // Playing/Watching/Competing/Listening: shows as "[Type] {name}"
      // e.g., "Playing Alex building #42 (8m)"
      client.user?.setPresence({
        activities: [
          {
            name: status.activityName,
            type: status.activityType,
          },
        ],
        status: 'online',
      });
    }

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
        status: 'online',
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
