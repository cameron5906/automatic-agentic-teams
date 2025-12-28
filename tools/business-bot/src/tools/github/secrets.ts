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
    // E2E Testing
    discordE2eWebhookUrl?: string;
  },
  variables: {
    discordProductChannelId?: string;
    discordDevChannelId?: string;
    discordPrChannelId?: string;
    discordTeamLeadUserId?: string;
    // E2E Testing
    appPublicDomain?: string;
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
        // E2E Testing
        DISCORD_E2E_WEBHOOK_URL: secrets.discordE2eWebhookUrl,
      },
      {
        DISCORD_PRODUCT_CHANNEL_ID: variables.discordProductChannelId,
        DISCORD_DEV_CHANNEL_ID: variables.discordDevChannelId,
        DISCORD_PR_CHANNEL_ID: variables.discordPrChannelId,
        DISCORD_TEAM_LEAD_USER_ID: variables.discordTeamLeadUserId,
        // E2E Testing
        APP_PUBLIC_DOMAIN: variables.appPublicDomain,
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

export async function scaffoldRepoFromTemplate(
  projectId: string,
  secretValues: Record<string, string>
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

  const enrichedSecretValues = { ...secretValues };
  const autoVariables: Record<string, string> = {};

  if (project.resources.discord) {
    const { webhooks, channelIds } = project.resources.discord;

    if (webhooks) {
      if (webhooks['dev'] && !enrichedSecretValues['DISCORD_DEV_WEBHOOK_URL']) {
        enrichedSecretValues['DISCORD_DEV_WEBHOOK_URL'] = webhooks['dev'];
      }
      if (webhooks['product'] && !enrichedSecretValues['DISCORD_PRODUCT_WEBHOOK_URL']) {
        enrichedSecretValues['DISCORD_PRODUCT_WEBHOOK_URL'] = webhooks['product'];
      }
      if (webhooks['pull-requests'] && !enrichedSecretValues['DISCORD_PR_WEBHOOK_URL']) {
        enrichedSecretValues['DISCORD_PR_WEBHOOK_URL'] = webhooks['pull-requests'];
      }
    }

    if (channelIds) {
      if (channelIds['dev']) {
        autoVariables['DISCORD_DEV_CHANNEL_ID'] = channelIds['dev'];
      }
      if (channelIds['product']) {
        autoVariables['DISCORD_PRODUCT_CHANNEL_ID'] = channelIds['product'];
      }
      if (channelIds['pull-requests']) {
        autoVariables['DISCORD_PR_CHANNEL_ID'] = channelIds['pull-requests'];
      }
    }
  }

  const templateFull = config.github.templateRepo;
  const [templateOwner, templateRepo] = templateFull.split('/');

  try {
    const result = await github.scaffoldRepoSecretsAndVariables(
      owner,
      repo,
      templateOwner,
      templateRepo,
      enrichedSecretValues
    );

    for (const [name, value] of Object.entries(autoVariables)) {
      const success = await github.setRepositoryVariable(owner, repo, name, value);
      if (success) {
        result.variablesSet.push(name);
      } else {
        result.errors.push(`Failed to set variable: ${name}`);
      }
    }

    const discordSecretsProvided = [
      'DISCORD_DEV_WEBHOOK_URL',
      'DISCORD_PRODUCT_WEBHOOK_URL',
      'DISCORD_PR_WEBHOOK_URL',
    ].filter((s) => enrichedSecretValues[s]);

    if (result.missingSecrets.length > 0) {
      return {
        success: true,
        data: {
          owner,
          repo,
          secretsSet: result.secretsSet,
          variablesSet: result.variablesSet,
          missingSecrets: result.missingSecrets,
          errors: result.errors,
          discordAutoConfigured: discordSecretsProvided.length > 0,
          discordSecretsProvided,
          needsSecrets: true,
          message:
            `Scaffolded ${result.secretsSet.length} secrets and ${result.variablesSet.length} variables. ` +
            (discordSecretsProvided.length > 0
              ? `Discord webhooks auto-configured from project. `
              : '') +
            `Missing secrets that need values: ${result.missingSecrets.join(', ')}`,
        },
      };
    }

    return {
      success: result.errors.length === 0,
      data: {
        owner,
        repo,
        secretsSet: result.secretsSet,
        variablesSet: result.variablesSet,
        errors: result.errors,
        discordAutoConfigured: discordSecretsProvided.length > 0,
        discordSecretsProvided,
        message:
          `Scaffolded ${result.secretsSet.length} secrets and ${result.variablesSet.length} variables for ${owner}/${repo}` +
          (discordSecretsProvided.length > 0
            ? `. Discord webhooks and channel IDs auto-configured from project.`
            : ''),
      },
      error: result.errors.length > 0 ? `Some configurations failed: ${result.errors.join(', ')}` : undefined,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to scaffold repository configuration',
    };
  }
}

export async function getTemplateConfig(): Promise<ToolResult> {
  const templateFull = config.github.templateRepo;
  const [templateOwner, templateRepo] = templateFull.split('/');

  try {
    const templateConfig = await github.getTemplateRepoConfig(templateOwner, templateRepo);

    return {
      success: true,
      data: {
        templateRepo: templateFull,
        secrets: templateConfig.secrets,
        variables: templateConfig.variables,
        summary: `Template has ${templateConfig.secrets.length} secrets and ${templateConfig.variables.length} variables`,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get template configuration',
    };
  }
}
