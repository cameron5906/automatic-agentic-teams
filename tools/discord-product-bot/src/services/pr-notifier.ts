import {
  Client,
  TextChannel,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ButtonInteraction,
  APIActionRowComponent,
  APIButtonComponent,
} from 'discord.js';
import { Octokit } from '@octokit/rest';
import { config } from '../config.js';
import type { TrackedIssue } from './issue-tracker.js';
import {
  generatePrReadyAnnouncement,
  generateMergeAnnouncement,
  generateClosureAnnouncement,
} from './announcement-generator.js';
import { markPrAnnounced, markMergeAnnounced, markClosureAnnounced } from './issue-tracker.js';

const octokit = new Octokit({ auth: config.github.token });

export async function notifyPrReady(
  client: Client,
  trackedIssue: TrackedIssue,
  prNumber: number
): Promise<void> {
  // Disabled: PR notifications now handled by GitHub workflow
  console.log(`[PRNotifier] Skipping PR ready notification for #${prNumber} (handled by workflow)`);
  markPrAnnounced(trackedIssue.issueNumber);
  return;

  try {
    const channel = await client.channels.fetch(config.discord.pullRequestsChannelId);
    if (!channel?.isTextBased()) {
      console.error('[PRNotifier] Pull requests channel not found or not text-based');
      return;
    }

    const announcement = await generatePrReadyAnnouncement(trackedIssue, prNumber);

    const embed = new EmbedBuilder()
      .setTitle(`PR #${prNumber}: ${announcement.prTitle}`)
      .setURL(announcement.prUrl)
      .setDescription(announcement.message)
      .setColor(0x238636)
      .addFields(
        { name: 'Related Issue', value: `#${trackedIssue.issueNumber}`, inline: true },
        { name: 'Status', value: 'Awaiting Review', inline: true }
      )
      .setTimestamp();

    const approveButton = new ButtonBuilder()
      .setCustomId(`approve_pr_${prNumber}`)
      .setLabel('Approve PR')
      .setStyle(ButtonStyle.Success)
      .setEmoji('✅');

    const requestChangesButton = new ButtonBuilder()
      .setCustomId(`request_changes_${prNumber}`)
      .setLabel('Request Changes')
      .setStyle(ButtonStyle.Danger)
      .setEmoji('🔄');

    const viewButton = new ButtonBuilder()
      .setLabel('View on GitHub')
      .setStyle(ButtonStyle.Link)
      .setURL(announcement.prUrl)
      .setEmoji('🔗');

    const row = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(approveButton, requestChangesButton, viewButton);

    const teamLeadMention = `<@${config.discord.teamLeadUserId}>`;

    await (channel as TextChannel).send({
      content: `${teamLeadMention} - PR ready for review!`,
      embeds: [embed],
      components: [row],
    });

    markPrAnnounced(trackedIssue.issueNumber);
    console.log(`[PRNotifier] Announced PR #${prNumber} in #pull-requests`);
  } catch (error) {
    console.error('[PRNotifier] Failed to notify PR ready:', error);
  }
}

export async function notifyMerge(
  client: Client,
  trackedIssue: TrackedIssue,
  prNumber: number
): Promise<void> {
  try {
    const announcement = await generateMergeAnnouncement(trackedIssue, prNumber);

    if (!announcement.shouldAnnounce) {
      console.log(
        `[PRNotifier] Skipping merge announcement for PR #${prNumber}: ${announcement.reason}`
      );
      markMergeAnnounced(trackedIssue.issueNumber);
      return;
    }

    const channel = await client.channels.fetch(config.discord.productChannelId);
    if (!channel || !channel.isTextBased()) {
      console.error('[PRNotifier] Product channel not found or not text-based');
      return;
    }

    const prUrl = `https://github.com/${config.github.owner}/${config.github.repo}/pull/${prNumber}`;

    const embed = new EmbedBuilder()
      .setTitle('🚀 New Update Shipped!')
      .setDescription(announcement.message)
      .setColor(0x8957e5)
      .addFields({ name: 'Details', value: `[View PR #${prNumber}](${prUrl})`, inline: true })
      .setFooter({ text: `Issue #${trackedIssue.issueNumber}` })
      .setTimestamp();

    await (channel as TextChannel).send({
      embeds: [embed],
    });

    markMergeAnnounced(trackedIssue.issueNumber);
    console.log(`[PRNotifier] Announced merge for PR #${prNumber} in #product`);
  } catch (error) {
    console.error('[PRNotifier] Failed to notify merge:', error);
  }
}

export async function notifyClosure(
  client: Client,
  trackedIssue: TrackedIssue
): Promise<void> {
  if (!trackedIssue.threadId) {
    console.log(`[PRNotifier] No thread to notify for issue #${trackedIssue.issueNumber}`);
    markClosureAnnounced(trackedIssue.issueNumber);
    return;
  }

  try {
    const thread = await client.channels.fetch(trackedIssue.threadId);
    if (!thread || !thread.isTextBased()) {
      console.error(`[PRNotifier] Thread ${trackedIssue.threadId} not found`);
      markClosureAnnounced(trackedIssue.issueNumber);
      return;
    }

    const announcement = await generateClosureAnnouncement(trackedIssue);

    await (thread as TextChannel).send({
      content: `✅ **Issue Closed**\n\n${announcement.message}`,
    });

    markClosureAnnounced(trackedIssue.issueNumber);
    console.log(`[PRNotifier] Announced closure for issue #${trackedIssue.issueNumber}`);
  } catch (error) {
    console.error('[PRNotifier] Failed to notify closure:', error);
  }
}

export async function handlePrButtonInteraction(
  interaction: ButtonInteraction
): Promise<void> {
  const customId = interaction.customId;

  if (customId.startsWith('approve_pr_')) {
    const prNumber = parseInt(customId.replace('approve_pr_', ''), 10);
    await handleApprove(interaction, prNumber);
  } else if (customId.startsWith('request_changes_')) {
    const prNumber = parseInt(customId.replace('request_changes_', ''), 10);
    await handleRequestChanges(interaction, prNumber);
  }
}

async function handleApprove(
  interaction: ButtonInteraction,
  prNumber: number
): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  try {
    await octokit.pulls.createReview({
      owner: config.github.owner,
      repo: config.github.repo,
      pull_number: prNumber,
      event: 'APPROVE',
      body: 'Approved via Discord bot.',
    });

    await interaction.editReply({
      content: `✅ PR #${prNumber} has been approved!`,
    });

    const message = interaction.message;
    const embed = EmbedBuilder.from(message.embeds[0])
      .setColor(0x238636)
      .setFields(
        { name: 'Related Issue', value: message.embeds[0].fields?.[0]?.value || 'N/A', inline: true },
        { name: 'Status', value: '✅ Approved', inline: true }
      );

    const actionRow = message.components[0] as unknown as APIActionRowComponent<APIButtonComponent>;
    const buttons = actionRow.components;

    const disabledRow = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        ButtonBuilder.from(buttons[0] as APIButtonComponent)
          .setDisabled(true)
          .setLabel('Approved'),
        ButtonBuilder.from(buttons[1] as APIButtonComponent).setDisabled(true),
        ButtonBuilder.from(buttons[2] as APIButtonComponent)
      );

    await message.edit({
      embeds: [embed],
      components: [disabledRow],
    });
  } catch (error) {
    console.error('[PRNotifier] Failed to approve PR:', error);
    await interaction.editReply({
      content: `❌ Failed to approve PR #${prNumber}. Check GitHub permissions.`,
    });
  }
}

async function handleRequestChanges(
  interaction: ButtonInteraction,
  prNumber: number
): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  try {
    await octokit.pulls.createReview({
      owner: config.github.owner,
      repo: config.github.repo,
      pull_number: prNumber,
      event: 'REQUEST_CHANGES',
      body: 'Changes requested via Discord bot. Please check GitHub for details.',
    });

    await interaction.editReply({
      content: `🔄 Changes requested on PR #${prNumber}. The team will be notified.`,
    });

    const message = interaction.message;
    const embed = EmbedBuilder.from(message.embeds[0])
      .setColor(0xda3633)
      .setFields(
        { name: 'Related Issue', value: message.embeds[0].fields?.[0]?.value || 'N/A', inline: true },
        { name: 'Status', value: '🔄 Changes Requested', inline: true }
      );

    const actionRow = message.components[0] as unknown as APIActionRowComponent<APIButtonComponent>;
    const buttons = actionRow.components;

    const disabledRow = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        ButtonBuilder.from(buttons[0] as APIButtonComponent).setDisabled(true),
        ButtonBuilder.from(buttons[1] as APIButtonComponent)
          .setDisabled(true)
          .setLabel('Changes Requested'),
        ButtonBuilder.from(buttons[2] as APIButtonComponent)
      );

    await message.edit({
      embeds: [embed],
      components: [disabledRow],
    });
  } catch (error) {
    console.error('[PRNotifier] Failed to request changes:', error);
    await interaction.editReply({
      content: `❌ Failed to request changes on PR #${prNumber}. Check GitHub permissions.`,
    });
  }
}
