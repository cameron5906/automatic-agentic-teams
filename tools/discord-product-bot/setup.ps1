<#
.SYNOPSIS
    Setup script for Discord Product Bot deployment to AWS

.DESCRIPTION
    This script creates the necessary AWS resources and deploys the Discord Product Bot.
    Prerequisites:
    - AWS CLI configured with appropriate credentials
    - CDK bootstrapped in your AWS account
    - Docker installed and running
    - Discord bot token from Discord Developer Portal
    - GitHub PAT with repo scope

.PARAMETER Environment
    Target environment (dev or prod). Default: dev

.PARAMETER DiscordBotToken
    Discord bot token. If not provided, you'll need to manually update the secret in AWS console.

.PARAMETER GitHubToken
    GitHub PAT with repo scope. If not provided, you'll need to manually update the secret in AWS console.

.EXAMPLE
    ./setup.ps1 -Environment dev -DiscordBotToken "your-token" -GitHubToken "ghp_xxx"
#>

param(
    [ValidateSet("dev", "prod")]
    [string]$Environment = "dev",

    [string]$DiscordBotToken,

    [string]$GitHubToken
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = (Get-Item "$ScriptDir/../..").FullName

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Discord Product Bot - AWS Setup" -ForegroundColor Cyan
Write-Host "Environment: $Environment" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Deploy CDK infrastructure (creates ECR repo, secrets, ECS service)
Write-Host "[1/4] Deploying CDK infrastructure..." -ForegroundColor Yellow
Set-Location "$RepoRoot/infrastructure/cdk"

npm ci
if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to install CDK dependencies"
    exit 1
}

# Note: This assumes the bot-stack is wired into the main CDK app
# You may need to add it to the CDK app file
npx cdk deploy "soyl-$Environment-bot" --require-approval never
if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to deploy CDK stack"
    exit 1
}

Write-Host "CDK deployment complete!" -ForegroundColor Green
Write-Host ""

# Step 2: Update secrets if provided
Write-Host "[2/4] Configuring secrets..." -ForegroundColor Yellow

if ($DiscordBotToken) {
    Write-Host "  Updating Discord bot token..."
    aws secretsmanager put-secret-value `
        --secret-id "soyl-$Environment-discord-bot-token" `
        --secret-string $DiscordBotToken `
        --no-cli-pager

    if ($LASTEXITCODE -ne 0) {
        Write-Warning "Failed to update Discord token. Update manually in AWS console."
    } else {
        Write-Host "  Discord token updated!" -ForegroundColor Green
    }
} else {
    Write-Host "  Discord token not provided. Update in AWS Secrets Manager:" -ForegroundColor Yellow
    Write-Host "    Secret: soyl-$Environment-discord-bot-token" -ForegroundColor Gray
}

if ($GitHubToken) {
    Write-Host "  Updating GitHub token..."
    aws secretsmanager put-secret-value `
        --secret-id "soyl-$Environment-github-token" `
        --secret-string $GitHubToken `
        --no-cli-pager

    if ($LASTEXITCODE -ne 0) {
        Write-Warning "Failed to update GitHub token. Update manually in AWS console."
    } else {
        Write-Host "  GitHub token updated!" -ForegroundColor Green
    }
} else {
    Write-Host "  GitHub token not provided. Update in AWS Secrets Manager:" -ForegroundColor Yellow
    Write-Host "    Secret: soyl-$Environment-github-token" -ForegroundColor Gray
}

Write-Host ""

# Step 3: Build and push Docker image
Write-Host "[3/4] Building and pushing Docker image..." -ForegroundColor Yellow
Set-Location "$ScriptDir"

npm ci
if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to install bot dependencies"
    exit 1
}

npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to build bot"
    exit 1
}

$ECR_URI = aws ecr describe-repositories `
    --repository-names "soyl-$Environment-bot" `
    --query 'repositories[0].repositoryUri' `
    --output text `
    --no-cli-pager

if (-not $ECR_URI -or $ECR_URI -eq "None") {
    Write-Error "ECR repository not found. CDK deployment may have failed."
    exit 1
}

Write-Host "  ECR URI: $ECR_URI" -ForegroundColor Gray

# Login to ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin $ECR_URI.Split('/')[0]

# Build for ARM64
docker build --platform linux/arm64 -t "${ECR_URI}:latest" .
if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to build Docker image"
    exit 1
}

docker push "${ECR_URI}:latest"
if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to push Docker image"
    exit 1
}

Write-Host "Docker image pushed!" -ForegroundColor Green
Write-Host ""

# Step 4: Force new deployment
Write-Host "[4/4] Starting ECS service..." -ForegroundColor Yellow

aws ecs update-service `
    --cluster "soyl-$Environment-cluster" `
    --service "soyl-$Environment-bot" `
    --force-new-deployment `
    --no-cli-pager | Out-Null

if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to update ECS service"
    exit 1
}

Write-Host "ECS service updated!" -ForegroundColor Green
Write-Host ""

# Done
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Setup Complete!" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "The bot should be running in ~2 minutes." -ForegroundColor White
Write-Host ""
Write-Host "To check status:" -ForegroundColor Yellow
Write-Host "  aws ecs describe-services --cluster soyl-$Environment-cluster --services soyl-$Environment-bot --query 'services[0].{Status:status,Running:runningCount,Desired:desiredCount}'" -ForegroundColor Gray
Write-Host ""
Write-Host "To view logs:" -ForegroundColor Yellow
Write-Host "  aws logs tail /ecs/soyl-$Environment-bot --follow" -ForegroundColor Gray
Write-Host ""

if (-not $DiscordBotToken -or -not $GitHubToken) {
    Write-Host "IMPORTANT: Remember to update the secrets in AWS Secrets Manager!" -ForegroundColor Red
}

Set-Location $RepoRoot
