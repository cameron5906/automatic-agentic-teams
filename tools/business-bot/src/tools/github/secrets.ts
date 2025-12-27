import type { ToolResult } from '../../types';
import * as github from '../../services/github';
import * as projectStore from '../../context/project-store';
import { config } from '../../config';

export async function listSecrets(owner: string, repo: string): Promise<ToolResult> {
  try {
    const secrets = await github.listRepositorySecrets(owner, repo);

    return {
      success: true,
      data: {
        count: secrets.length,
        secrets,
        summary: `Found ${secrets.length} secret(s) configured`,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to list secrets',
    };
  }
}

export async function listVariables(owner: string, repo: string): Promise<ToolResult> {
  try {
    const variables = await github.listRepositoryVariables(owner, repo);

    return {
      success: true,
      data: {
        count: variables.length,
        variables,
        summary: `Found ${variables.length} variable(s) configured`,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to list variables',
    };
  }
}

export async function setSecret(
  owner: string,
  repo: string,
  name: string,
  value: string
): Promise<ToolResult> {
  try {
    const success = await github.setRepositorySecret(owner, repo, name, value);

    if (success) {
      return {
        success: true,
        data: {
          name,
          message: `Secret ${name} has been set`,
        },
      };
    } else {
      return {
        success: false,
        error: `Failed to set secret ${name}`,
      };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to set secret',
    };
  }
}

export async function setVariable(
  owner: string,
  repo: string,
  name: string,
  value: string
): Promise<ToolResult> {
  try {
    const success = await github.setRepositoryVariable(owner, repo, name, value);

    if (success) {
      return {
        success: true,
        data: {
          name,
          value,
          message: `Variable ${name} has been set`,
        },
      };
    } else {
      return {
        success: false,
        error: `Failed to set variable ${name}`,
      };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to set variable',
    };
  }
}

export async function configurePipelineSecrets(
  projectId: string,
  secrets: {
    anthropicApiKey?: string;
    claudeWorkflowToken?: string;
    discordDevWebhookUrl?: string;
    discordProductWebhookUrl?: string;
    openaiApiKey?: string;
  },
  variables: {
    discordProductChannelId?: string;
    discordDevChannelId?: string;
    discordPrChannelId?: string;
    discordTeamLeadUserId?: string;
  },
  hasApproval = false
): Promise<ToolResult> {
  const project = projectStore.getProject(projectId);
  if (!project) {
    return {
      success: false,
      error: `Project ${projectId} not found`,
    };
  }

  if (!project.resources.github) {
    return {
      success: false,
      error: 'Project does not have a GitHub repository configured',
    };
  }

  const { owner, repo } = project.resources.github;

  const secretCount = Object.values(secrets).filter(Boolean).length;
  const variableCount = Object.values(variables).filter(Boolean).length;

  if (!hasApproval) {
    return {
      success: false,
      requiresApproval: true,
      approvalPrompt:
        `I'd like to configure **${secretCount} secret(s)** and **${variableCount} variable(s)** ` +
        `for the repository **${owner}/${repo}** to enable the CI/CD pipelines. Do you approve?`,
      error: 'Pipeline configuration requires human approval',
    };
  }

  try {
    const result = await github.configureRepositoryForPipelines(
      owner,
      repo,
      {
        ANTHROPIC_API_KEY: secrets.anthropicApiKey,
        CLAUDE_WORKFLOW_TOKEN: secrets.claudeWorkflowToken,
        DISCORD_DEV_WEBHOOK_URL: secrets.discordDevWebhookUrl,
        DISCORD_PRODUCT_WEBHOOK_URL: secrets.discordProductWebhookUrl,
        OPENAI_API_KEY: secrets.openaiApiKey,
      },
      {
        DISCORD_PRODUCT_CHANNEL_ID: variables.discordProductChannelId,
        DISCORD_DEV_CHANNEL_ID: variables.discordDevChannelId,
        DISCORD_PR_CHANNEL_ID: variables.discordPrChannelId,
        DISCORD_TEAM_LEAD_USER_ID: variables.discordTeamLeadUserId,
      }
    );

    if (result.success) {
      return {
        success: true,
        data: {
          owner,
          repo,
          secretsSet: result.secretsSet,
          variablesSet: result.variablesSet,
          message: `Configured ${result.secretsSet.length} secrets and ${result.variablesSet.length} variables for ${owner}/${repo}`,
        },
      };
    } else {
      return {
        success: false,
        data: {
          secretsSet: result.secretsSet,
          variablesSet: result.variablesSet,
          errors: result.errors,
        },
        error: `Some configurations failed: ${result.errors.join(', ')}`,
      };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to configure pipeline secrets',
    };
  }
}

export async function configureFromDiscordServer(
  projectId: string,
  discordServerId: string,
  secrets: {
    anthropicApiKey: string;
    claudeWorkflowToken: string;
    openaiApiKey?: string;
  },
  hasApproval = false
): Promise<ToolResult> {
  const project = projectStore.getProject(projectId);
  if (!project) {
    return {
      success: false,
      error: `Project ${projectId} not found`,
    };
  }

  if (!project.resources.github) {
    return {
      success: false,
      error: 'Project does not have a GitHub repository configured',
    };
  }

  if (!project.resources.discord || project.resources.discord.serverId !== discordServerId) {
    return {
      success: false,
      error: 'Discord server does not match project configuration',
    };
  }

  return configurePipelineSecrets(
    projectId,
    {
      anthropicApiKey: secrets.anthropicApiKey,
      claudeWorkflowToken: secrets.claudeWorkflowToken,
      openaiApiKey: secrets.openaiApiKey,
    },
    {},
    hasApproval
  );
}
