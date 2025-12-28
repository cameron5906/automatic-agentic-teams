function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optionalEnv(name: string): string | undefined {
  const value = process.env[name];
  return value && value.trim().length > 0 ? value : undefined;
}

export const config = {
  discord: {
    get token(): string {
      return requireEnv('DISCORD_BOT_TOKEN');
    },
    get productChannelId(): string {
      return requireEnv('DISCORD_PRODUCT_CHANNEL_ID');
    },
    get devChannelId(): string {
      return requireEnv('DISCORD_DEV_CHANNEL_ID');
    },
    get pullRequestsChannelId(): string {
      return requireEnv('DISCORD_PR_CHANNEL_ID');
    },
    get teamLeadUserId(): string {
      return requireEnv('DISCORD_TEAM_LEAD_USER_ID');
    },
  },
  github: {
    get token(): string {
      return requireEnv('GITHUB_TOKEN');
    },
    owner: 'cameron5906',
    repo: 'story-of-your-life',
  },
  openai: {
    get apiKey(): string {
      return requireEnv('OPENAI_API_KEY');
    },
    model: 'gpt-4o',
  },
  s3: {
    get enabled(): boolean {
      return !!optionalEnv('S3_ATTACHMENTS_BUCKET');
    },
    get bucket(): string {
      return requireEnv('S3_ATTACHMENTS_BUCKET');
    },
    get region(): string {
      return optionalEnv('S3_ATTACHMENTS_REGION') ?? 'us-east-1';
    },
  },
  persistence: {
    sqlitePath:
      optionalEnv('BOT_SQLITE_PATH') ??
      './working/discord-product-bot/bot-state.sqlite',
  },
} as const;
