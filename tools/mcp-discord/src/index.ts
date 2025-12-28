#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;
const DEFAULT_CHANNEL_ID = process.env.DISCORD_DEFAULT_CHANNEL_ID || "1453129264118370434";
const AGENT_NAME = process.env.AGENT_NAME || "Claude Agent";

// Generate avatar URL from agent name using DiceBear bottts style (PNG for Discord compatibility)
const generateAvatarUrl = (agentName: string): string => {
  // Convert agent name to a seed by removing spaces and special characters
  const seed = agentName.replace(/[^a-zA-Z0-9]/g, '');
  return `https://api.dicebear.com/9.x/personas/png?seed=${seed}1`;
};

const AVATAR_URL = generateAvatarUrl(AGENT_NAME);

if (!WEBHOOK_URL) {
  console.error("DISCORD_WEBHOOK_URL environment variable is required");
  process.exit(1);
}

const server = new Server(
  {
    name: "discord-notifier",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "discord_post_dev_update",
      description:
        "Post a development update to the #dev Discord channel. Use sparingly (1-3 times per session) for: tech debt observations, progress updates, delay/blocker explanations, or significant thinking steps. Keep messages concise and valuable to the team.",
      inputSchema: {
        type: "object" as const,
        properties: {
          category: {
            type: "string",
            enum: ["tech_debt", "progress", "delay", "thinking"],
            description:
              "Category of update: tech_debt (technical debt observations), progress (milestone/task completion), delay (blockers/delays), thinking (significant decision reasoning)",
          },
          message: {
            type: "string",
            description: "The update message. Keep concise but informative (1-2 sentences).",
          },
        },
        required: ["category", "message"],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === "discord_post_dev_update") {
    const args = request.params.arguments as {
      category: "tech_debt" | "progress" | "delay" | "thinking";
      message: string;
    };

    const { category, message } = args;

    // Simple emoji prefixes for each category - keeps it casual like Slack
    const categoryEmoji: Record<string, string> = {
      tech_debt: "🔧",
      progress: "✅",
      delay: "⏳",
      thinking: "💭",
    };

    const emoji = categoryEmoji[category] || "";

    // Plain text message, no embeds - looks like a normal Slack message
    const payload = {
      content: `${emoji} ${message}`,
      username: AGENT_NAME,
      avatar_url: AVATAR_URL,
    };

    try {
      const response = await fetch(WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return {
          content: [
            {
              type: "text" as const,
              text: `Failed to post to Discord: ${response.status} ${errorText}`,
            },
          ],
          isError: true,
        };
      }

      return {
        content: [
          {
            type: "text" as const,
            text: `Posted ${category} update to Discord #dev channel`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error posting to Discord: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  }

  return {
    content: [
      {
        type: "text" as const,
        text: `Unknown tool: ${request.params.name}`,
      },
    ],
    isError: true,
  };
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
