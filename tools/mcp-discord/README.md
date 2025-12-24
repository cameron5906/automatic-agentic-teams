# MCP Discord

Model Context Protocol (MCP) server for posting development updates to Discord via webhook.

## Purpose

Provides Claude Code agents with the ability to post status updates to a Discord channel during pipeline execution. Used by the agent-step workflow to enable agents to communicate progress, blockers, and insights.

## Installation

```bash
cd tools/mcp-discord
npm install
npm run build
```

## Configuration

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DISCORD_WEBHOOK_URL` | Yes | - | Discord webhook URL for posting messages |
| `DISCORD_DEFAULT_CHANNEL_ID` | No | `1453129264118370434` | Default channel ID (for display purposes) |
| `AGENT_NAME` | No | `Claude Agent` | Name shown in message footer |

### Creating a Discord Webhook

1. Open Discord Server Settings
2. Go to Integrations > Webhooks
3. Create New Webhook
4. Select the #dev channel
5. Copy the Webhook URL

## MCP Tool

### `discord_post_dev_update`

Posts a development update to the configured Discord channel.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `category` | enum | Yes | Type of update: `tech_debt`, `progress`, `delay`, `thinking` |
| `message` | string | Yes | The update message (1-2 sentences recommended) |

**Categories:**

| Category | Emoji | Color | Use For |
|----------|-------|-------|---------|
| `tech_debt` | :wrench: | Orange | Technical debt observations |
| `progress` | :white_check_mark: | Green | Milestones, task completions |
| `delay` | :hourglass: | Yellow | Blockers, delays |
| `thinking` | :thought_balloon: | Blue | Decisions, reasoning |

## Usage in GitHub Actions

The MCP server is automatically built and configured in `agent-step.yml`:

```yaml
- name: Build MCP Discord
  working-directory: tools/mcp-discord
  run: |
    npm ci
    npm run build

- name: Create MCP config
  run: |
    cat > /tmp/mcp-config.json << EOF
    {
      "mcpServers": {
        "discord": {
          "command": "node",
          "args": ["${{ github.workspace }}/tools/mcp-discord/dist/index.js"],
          "env": {
            "DISCORD_WEBHOOK_URL": "${{ secrets.DISCORD_DEV_WEBHOOK_URL }}",
            "AGENT_NAME": "${{ inputs.agent_name }}"
          }
        }
      }
    }
    EOF

- name: Run agent
  uses: anthropics/claude-code-action@beta
  with:
    claude_args: --mcp-config /tmp/mcp-config.json
```

## GitHub Configuration

### Secrets Required

| Secret | Description |
|--------|-------------|
| `DISCORD_DEV_WEBHOOK_URL` | Discord webhook URL for the #dev channel |

### Variables (Optional)

| Variable | Default | Description |
|----------|---------|-------------|
| `DISCORD_DEV_CHANNEL_ID` | `1453129264118370434` | Channel ID for display purposes |

## Agent Instructions

Agents are instructed to post 1-3 updates per session for:
- Technical debt they encounter
- Significant progress milestones
- Blockers or delay reasons
- Important thinking/decision steps

Example messages:
- `tech_debt`: "Found duplicated validation logic across 3 controllers - would benefit from extraction"
- `progress`: "Completed user authentication module with JWT refresh"
- `delay`: "Blocked on missing API documentation for payment service"
- `thinking`: "Choosing repository pattern over direct DB for testability"
