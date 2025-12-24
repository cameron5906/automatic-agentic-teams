import { Client, Events, GatewayIntentBits, Interaction } from 'discord.js';
import { config } from './config.js';
import { handleProductMessage } from './handlers/product-channel.js';
import { handleDevMessage } from './handlers/dev-channel.js';
import { startStatusUpdater, stopStatusUpdater } from './services/status-updater.js';
import { startIssuePoller, stopIssuePoller } from './services/issue-poller.js';
import { handlePrButtonInteraction } from './services/pr-notifier.js';
import { initSqliteStateStore } from './context/persistence/sqlite.js';
import {
  setConversationStorePersistence,
  hydrateConversationStoreFromPersistence,
} from './context/conversation-store.js';
import {
  setThreadRegistryPersistence,
  hydrateThreadRegistryFromPersistence,
} from './context/thread-registry.js';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.once(Events.ClientReady, (c) => {
  console.log(`Logged in as ${c.user.tag}`);
  console.log(`Watching product channel: ${config.discord.productChannelId}`);
  console.log(`Watching dev channel: ${config.discord.devChannelId}`);
  console.log(`Watching PR channel: ${config.discord.pullRequestsChannelId}`);

  try {
    const sqliteStore = initSqliteStateStore(config.persistence.sqlitePath);
    setConversationStorePersistence(sqliteStore);
    setThreadRegistryPersistence(sqliteStore);
    hydrateConversationStoreFromPersistence();
    hydrateThreadRegistryFromPersistence();
    console.log(`Loaded persisted bot state from: ${config.persistence.sqlitePath}`);
  } catch (error) {
    console.error('Failed to initialize persistence; continuing without it:', error);
  }

  startStatusUpdater(client);
  startIssuePoller(client);
});

client.on(Events.MessageCreate, async (message) => {
  try {
    const channel = message.channel;

    const resolvedChannelId = channel.isThread()
      ? (channel.parentId ?? message.channelId)
      : message.channelId;

    if (resolvedChannelId === config.discord.productChannelId) {
      await handleProductMessage(message, client);
    } else if (resolvedChannelId === config.discord.devChannelId) {
      await handleDevMessage(message, client);
    }
  } catch (error) {
    console.error('Unhandled error in message handler:', error);
  }
});

client.on(Events.InteractionCreate, async (interaction: Interaction) => {
  if (!interaction.isButton()) return;

  try {
    const customId = interaction.customId;

    if (customId.startsWith('approve_pr_') || customId.startsWith('request_changes_')) {
      await handlePrButtonInteraction(interaction);
    }
  } catch (error) {
    console.error('Unhandled error in interaction handler:', error);
    if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: 'An error occurred while processing your request.',
        ephemeral: true,
      });
    }
  }
});

client.on(Events.Error, (error) => {
  console.error('Discord client error:', error);
});

process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  stopStatusUpdater();
  stopIssuePoller();
  client.destroy();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  stopStatusUpdater();
  stopIssuePoller();
  client.destroy();
  process.exit(0);
});

client.login(config.discord.token).catch((error) => {
  console.error('Failed to login:', error);
  process.exit(1);
});
