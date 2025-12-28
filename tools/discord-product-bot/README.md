# Discord Product Bot

Always-on Discord bot for the SOYL project that monitors product and dev channels.

## Deployment

The bot is deployed to AWS Fargate via GitHub Actions on push to `main` when changes are made to `tools/discord-product-bot/`.

### AWS Infrastructure Required

Before deployment, ensure the following AWS resources exist:

1. **ECR Repository**: Container registry for the bot image
2. **ECS Cluster**: Fargate cluster to run the service
3. **ECS Task Definition**: Defines the container configuration
4. **ECS Service**: Manages the running task with desired count = 1
5. **EFS Volume** (optional): For SQLite state persistence across restarts
6. **IAM Role**: For GitHub Actions OIDC authentication

### GitHub Configuration

#### Secrets (Settings > Secrets and variables > Actions)

| Secret | Description |
|--------|-------------|
| `AWS_ROLE_ARN` | IAM role ARN for GitHub Actions to assume (OIDC) |
| `DISCORD_BOT_TOKEN` | Discord bot token from Developer Portal |
| `GITHUB_TOKEN` | PAT with repo access for GitHub API operations |
| `OPENAI_API_KEY` | OpenAI API key for GPT-4 agent functionality |

#### Variables (Settings > Secrets and variables > Actions)

| Variable | Default | Description |
|----------|---------|-------------|
| `AWS_REGION` | `us-east-2` | AWS region for deployment |
| `ECR_REPOSITORY` | `soyl-discord-bot` | ECR repository name |
| `ECS_CLUSTER` | `soyl-cluster` | ECS cluster name |
| `ECS_SERVICE` | `soyl-discord-bot` | ECS service name |
| `ECS_TASK_DEFINITION` | `soyl-discord-bot` | Task definition family name |
| `CONTAINER_NAME` | `discord-bot` | Container name in task definition |

### ECS Task Definition Environment Variables

Configure these in the ECS task definition:

```json
{
  "containerDefinitions": [{
    "name": "discord-bot",
    "environment": [
      { "name": "NODE_ENV", "value": "production" },
      { "name": "BOT_SQLITE_PATH", "value": "/data/bot-state.sqlite" },
      { "name": "S3_ATTACHMENTS_BUCKET", "value": "soyl-issue-attachments" },
      { "name": "S3_ATTACHMENTS_REGION", "value": "us-east-1" }
    ],
    "secrets": [
      { "name": "DISCORD_BOT_TOKEN", "valueFrom": "arn:aws:secretsmanager:region:account:secret:discord-bot-token" },
      { "name": "GITHUB_TOKEN", "valueFrom": "arn:aws:secretsmanager:region:account:secret:github-token" },
      { "name": "OPENAI_API_KEY", "valueFrom": "arn:aws:secretsmanager:region:account:secret:openai-api-key" }
    ],
    "mountPoints": [{
      "sourceVolume": "bot-data",
      "containerPath": "/data"
    }]
  }],
  "volumes": [{
    "name": "bot-data",
    "efsVolumeConfiguration": {
      "fileSystemId": "fs-xxxxx"
    }
  }]
}
```

### S3 Bucket for Issue Attachments

The bot uses S3 to store image attachments from Discord messages. This provides:
- **Instant availability** - No GitHub CDN cache delays
- **Public URLs** - Work for both public and private repos
- **Permanent storage** - Discord attachment URLs expire after ~2 weeks

#### S3 Bucket Setup

1. Create a bucket (e.g., `soyl-issue-attachments`) with public read access:

```bash
aws s3api create-bucket \
  --bucket soyl-issue-attachments \
  --region us-east-1

aws s3api put-public-access-block \
  --bucket soyl-issue-attachments \
  --public-access-block-configuration \
    "BlockPublicAcls=false,IgnorePublicAcls=false,BlockPublicPolicy=false,RestrictPublicBuckets=false"

aws s3api put-bucket-policy \
  --bucket soyl-issue-attachments \
  --policy '{
    "Version": "2012-10-17",
    "Statement": [{
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::soyl-issue-attachments/*"
    }]
  }'
```

2. Grant the ECS task role permission to write to the bucket:

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": ["s3:PutObject"],
    "Resource": "arn:aws:s3:::soyl-issue-attachments/*"
  }]
}
```

3. Set the environment variables in the ECS task definition:
   - `S3_ATTACHMENTS_BUCKET`: Bucket name (e.g., `soyl-issue-attachments`)
   - `S3_ATTACHMENTS_REGION`: AWS region (defaults to `us-east-1`)

If `S3_ATTACHMENTS_BUCKET` is not set, the bot falls back to committing attachments to the GitHub repository (which may have CDN caching delays).

### Manual Deployment

```bash
cd tools/discord-product-bot
npm ci
npm run build
docker build -t discord-bot .
docker run -e DISCORD_BOT_TOKEN=xxx -e GITHUB_TOKEN=xxx -e OPENAI_API_KEY=xxx discord-bot
```

## Local Development

```bash
cd tools/discord-product-bot
npm install
cp .env.example .env  # Create and fill in environment variables
npm run dev
```

## Architecture

- **Node.js 20** runtime
- **discord.js** for Discord API interaction
- **OpenAI GPT-4o** for intelligent responses
- **better-sqlite3** for conversation state persistence
- **Fargate** for always-on container hosting
