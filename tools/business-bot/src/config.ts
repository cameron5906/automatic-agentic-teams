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

function optionalEnvList(name: string): string[] {
  const value = optionalEnv(name);
  if (!value) return [];
  return value.split(',').map((s) => s.trim()).filter(Boolean);
}

export function validateConfig(): void {
  const required = [
    'DISCORD_BOT_TOKEN',
    'OPENAI_API_KEY',
    'NAMECHEAP_API_USER',
    'NAMECHEAP_API_KEY',
    'NAMECHEAP_USERNAME',
    'NAMECHEAP_CLIENT_IP',
    'GITHUB_TOKEN',
    'GITHUB_ORG',
    'TAVILY_API_KEY',
  ];

  const missing = required.filter((name) => !process.env[name]?.trim());

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables:\n  - ${missing.join('\n  - ')}`
    );
  }
}

export const config = {
  discord: {
    get token(): string {
      return requireEnv('DISCORD_BOT_TOKEN');
    },
    get adminUserIds(): string[] {
      return optionalEnvList('DISCORD_ADMIN_USER_IDS');
    },
    get teamUserIds(): string[] {
      return optionalEnvList('DISCORD_TEAM_USER_IDS');
    },
    get productBotClientId(): string | undefined {
      return optionalEnv('PRODUCT_BOT_CLIENT_ID');
    },
  },

  openai: {
    get apiKey(): string {
      return requireEnv('OPENAI_API_KEY');
    },
    model: 'gpt-4o',
    routerModel: 'gpt-4o-mini',
  },

  namecheap: {
    get apiUser(): string {
      return requireEnv('NAMECHEAP_API_USER');
    },
    get apiKey(): string {
      return requireEnv('NAMECHEAP_API_KEY');
    },
    get username(): string {
      return requireEnv('NAMECHEAP_USERNAME');
    },
    get clientIp(): string {
      return requireEnv('NAMECHEAP_CLIENT_IP');
    },
    sandbox: optionalEnv('NAMECHEAP_SANDBOX') === 'true',
  },

  github: {
    get token(): string {
      return requireEnv('GITHUB_TOKEN');
    },
    get org(): string {
      return requireEnv('GITHUB_ORG');
    },
    get templateRepo(): string {
      return optionalEnv('GITHUB_TEMPLATE_REPO') ?? 'cameron5906/automatic-agentic-teams';
    },
  },

  tavily: {
    get apiKey(): string {
      return requireEnv('TAVILY_API_KEY');
    },
  },

  persistence: {
    sqlitePath:
      optionalEnv('BOT_SQLITE_PATH') ??
      './data/business-bot.sqlite',
  },
} as const;
