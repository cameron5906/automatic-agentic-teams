<#
.SYNOPSIS
    Deploy and manage the Discord bot on AWS ECS Fargate.

.DESCRIPTION
    This script handles the complete lifecycle of the Discord bot deployment:
    - Infrastructure setup (ECR, ECS, EFS, IAM, Secrets Manager)
    - Building and pushing Docker images
    - Starting, stopping, and updating the service

.PARAMETER Action
    The action to perform: setup, deploy, start, stop, status, logs, teardown

.PARAMETER Profile
    Required. The AWS CLI profile to use for all commands.

.PARAMETER Region
    AWS region for deployment. Default: us-east-1

.PARAMETER ClusterName
    ECS cluster name. Default: soyl-cluster

.PARAMETER ServiceName
    ECS service name. Default: soyl-discord-bot

.PARAMETER RepoName
    ECR repository name. Default: soyl-discord-bot

.EXAMPLE
    .\deploy-bot.ps1 -Action setup -Profile myprofile

.EXAMPLE
    .\deploy-bot.ps1 -Action deploy -Profile myprofile

.EXAMPLE
    .\deploy-bot.ps1 -Action status -Profile myprofile
#>

param(
    [Parameter(Mandatory=$true)]
    [ValidateSet("setup", "deploy", "start", "stop", "status", "logs", "teardown")]
    [string]$Action,

    [Parameter(Mandatory=$true)]
    [string]$Profile,

    [string]$Region = "us-east-1",
    [string]$ClusterName = "soyl-cluster",
    [string]$ServiceName = "soyl-discord-bot",
    [string]$RepoName = "soyl-discord-bot"
)

$ErrorActionPreference = "Stop"

# Colors for output
function Write-Step { param($msg) Write-Host "`n>> $msg" -ForegroundColor Cyan }
function Write-Success { param($msg) Write-Host "   $msg" -ForegroundColor Green }
function Write-Warning { param($msg) Write-Host "   $msg" -ForegroundColor Yellow }
function Write-Error { param($msg) Write-Host "   $msg" -ForegroundColor Red }

# Common AWS CLI args
$awsArgs = @("--profile", $Profile, "--region", $Region)

# Get AWS account ID
function Get-AccountId {
    $result = aws sts get-caller-identity --profile $Profile --query "Account" --output text
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to get AWS account ID. Check your profile."
    }
    return $result.Trim()
}

# Check if resource exists
function Test-EcrRepo {
    $result = aws ecr describe-repositories --profile $Profile --region $Region --repository-names $RepoName 2>$null
    return $LASTEXITCODE -eq 0
}

function Test-EcsCluster {
    $result = aws ecs describe-clusters --profile $Profile --region $Region --clusters $ClusterName --query "clusters[?status=='ACTIVE'].clusterName" --output text 2>$null
    return ($result -and $result.Trim() -eq $ClusterName)
}

function Test-EcsService {
    $result = aws ecs describe-services --profile $Profile --region $Region --cluster $ClusterName --services $ServiceName --query "services[?status=='ACTIVE'].serviceName" --output text 2>$null
    return ($result -and $result.Trim() -eq $ServiceName)
}

function Test-Secret {
    param($SecretName)
    $result = aws secretsmanager describe-secret --profile $Profile --region $Region --secret-id $SecretName 2>$null
    return $LASTEXITCODE -eq 0
}

# ============================================================================
# SETUP - Create all AWS infrastructure
# ============================================================================
function Invoke-Setup {
    Write-Step "Setting up AWS infrastructure for Discord bot..."

    $accountId = Get-AccountId
    Write-Success "Using AWS Account: $accountId"

    # 1. Create ECR Repository
    Write-Step "Creating ECR repository..."
    if (Test-EcrRepo) {
        Write-Warning "ECR repository '$RepoName' already exists, skipping."
    } else {
        aws ecr create-repository @awsArgs --repository-name $RepoName | Out-Null
        Write-Success "Created ECR repository: $RepoName"
    }

    # 2. Create ECS Cluster
    Write-Step "Creating ECS cluster..."
    if (Test-EcsCluster) {
        Write-Warning "ECS cluster '$ClusterName' already exists, skipping."
    } else {
        aws ecs create-cluster @awsArgs `
            --cluster-name $ClusterName `
            --capacity-providers FARGATE FARGATE_SPOT `
            --default-capacity-provider-strategy capacityProvider=FARGATE,weight=1 | Out-Null
        Write-Success "Created ECS cluster: $ClusterName"
    }

    # 3. Create Secrets (prompt for values)
    Write-Step "Setting up Secrets Manager..."

    $secrets = @(
        @{ Name = "discord-bot-token"; Prompt = "Enter Discord Bot Token" },
        @{ Name = "github-token"; Prompt = "Enter GitHub PAT (for API access)" },
        @{ Name = "openai-api-key"; Prompt = "Enter OpenAI API Key" }
    )

    foreach ($secret in $secrets) {
        if (Test-Secret $secret.Name) {
            Write-Warning "Secret '$($secret.Name)' already exists. Update it? (y/N)"
            $update = Read-Host
            if ($update -eq "y") {
                $value = Read-Host $secret.Prompt -AsSecureString
                $plainValue = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($value))
                aws secretsmanager put-secret-value @awsArgs --secret-id $secret.Name --secret-string $plainValue | Out-Null
                Write-Success "Updated secret: $($secret.Name)"
            }
        } else {
            $value = Read-Host $secret.Prompt -AsSecureString
            $plainValue = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($value))
            aws secretsmanager create-secret @awsArgs --name $secret.Name --secret-string $plainValue | Out-Null
            Write-Success "Created secret: $($secret.Name)"
        }
    }

    # 4. Create IAM roles
    Write-Step "Creating IAM roles..."

    # Task Execution Role
    $executionRoleName = "ecs-task-execution-role"
    $taskRoleName = "ecs-task-role"

    # Check if execution role exists
    $roleExists = aws iam get-role --profile $Profile --role-name $executionRoleName 2>$null
    if ($LASTEXITCODE -ne 0) {
        # Create trust policy
        $trustPolicy = @{
            Version = "2012-10-17"
            Statement = @(
                @{
                    Effect = "Allow"
                    Principal = @{ Service = "ecs-tasks.amazonaws.com" }
                    Action = "sts:AssumeRole"
                }
            )
        } | ConvertTo-Json -Depth 10 -Compress

        aws iam create-role --profile $Profile `
            --role-name $executionRoleName `
            --assume-role-policy-document $trustPolicy | Out-Null

        # Attach managed policy
        aws iam attach-role-policy --profile $Profile `
            --role-name $executionRoleName `
            --policy-arn "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy" | Out-Null

        # Add Secrets Manager access
        $secretsPolicy = @{
            Version = "2012-10-17"
            Statement = @(
                @{
                    Effect = "Allow"
                    Action = @("secretsmanager:GetSecretValue")
                    Resource = @(
                        "arn:aws:secretsmanager:${Region}:${accountId}:secret:discord-bot-token-*",
                        "arn:aws:secretsmanager:${Region}:${accountId}:secret:github-token-*",
                        "arn:aws:secretsmanager:${Region}:${accountId}:secret:openai-api-key-*"
                    )
                }
            )
        } | ConvertTo-Json -Depth 10 -Compress

        aws iam put-role-policy --profile $Profile `
            --role-name $executionRoleName `
            --policy-name "SecretsManagerAccess" `
            --policy-document $secretsPolicy | Out-Null

        Write-Success "Created IAM role: $executionRoleName"
    } else {
        Write-Warning "IAM role '$executionRoleName' already exists, skipping."
    }

    # 5. Create CloudWatch Log Group
    Write-Step "Creating CloudWatch log group..."
    $logGroup = "/ecs/$ServiceName"
    aws logs create-log-group @awsArgs --log-group-name $logGroup 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Success "Created log group: $logGroup"
    } else {
        Write-Warning "Log group already exists or creation failed, continuing..."
    }

    # 6. Get Discord Channel IDs
    Write-Step "Configuring Discord channels..."
    Write-Host "   You'll need to enable Developer Mode in Discord to get channel IDs."
    Write-Host "   (Discord Settings -> App Settings -> Advanced -> Developer Mode)"
    Write-Host "   Then right-click channels/users and select 'Copy ID'"
    Write-Host ""

    $productChannelId = Read-Host "   Enter #product channel ID"
    $devChannelId = Read-Host "   Enter #dev channel ID"
    $prChannelId = Read-Host "   Enter #pull-requests channel ID"
    $teamLeadUserId = Read-Host "   Enter team lead user ID (for pings)"

    # Save config for later use
    $configPath = Join-Path $PSScriptRoot ".bot-config.json"
    @{
        ProductChannelId = $productChannelId
        DevChannelId = $devChannelId
        PrChannelId = $prChannelId
        TeamLeadUserId = $teamLeadUserId
    } | ConvertTo-Json | Set-Content $configPath
    Write-Success "Saved channel config to $configPath"

    # 7. Create Task Definition
    Write-Step "Creating ECS task definition..."

    $taskDef = @{
        family = $ServiceName
        networkMode = "awsvpc"
        requiresCompatibilities = @("FARGATE")
        cpu = "256"
        memory = "512"
        executionRoleArn = "arn:aws:iam::${accountId}:role/$executionRoleName"
        containerDefinitions = @(
            @{
                name = "discord-bot"
                image = "${accountId}.dkr.ecr.${Region}.amazonaws.com/${RepoName}:latest"
                essential = $true
                environment = @(
                    @{ name = "NODE_ENV"; value = "production" }
                    @{ name = "BOT_SQLITE_PATH"; value = "/data/bot-state.sqlite" }
                    @{ name = "DISCORD_PRODUCT_CHANNEL_ID"; value = $productChannelId }
                    @{ name = "DISCORD_DEV_CHANNEL_ID"; value = $devChannelId }
                    @{ name = "DISCORD_PR_CHANNEL_ID"; value = $prChannelId }
                    @{ name = "DISCORD_TEAM_LEAD_USER_ID"; value = $teamLeadUserId }
                )
                secrets = @(
                    @{ name = "DISCORD_BOT_TOKEN"; valueFrom = "arn:aws:secretsmanager:${Region}:${accountId}:secret:discord-bot-token" }
                    @{ name = "GITHUB_TOKEN"; valueFrom = "arn:aws:secretsmanager:${Region}:${accountId}:secret:github-token" }
                    @{ name = "OPENAI_API_KEY"; valueFrom = "arn:aws:secretsmanager:${Region}:${accountId}:secret:openai-api-key" }
                )
                logConfiguration = @{
                    logDriver = "awslogs"
                    options = @{
                        "awslogs-group" = $logGroup
                        "awslogs-region" = $Region
                        "awslogs-stream-prefix" = "ecs"
                    }
                }
            }
        )
    }

    $taskDefJson = $taskDef | ConvertTo-Json -Depth 10 -Compress
    $taskDefFile = Join-Path $env:TEMP "task-def.json"
    $taskDefJson | Set-Content $taskDefFile -Encoding UTF8

    aws ecs register-task-definition @awsArgs --cli-input-json "file://$taskDefFile" | Out-Null
    Write-Success "Registered task definition: $ServiceName"

    # 8. Get default VPC info
    Write-Step "Getting VPC configuration..."
    $vpcId = aws ec2 describe-vpcs @awsArgs --filters "Name=is-default,Values=true" --query "Vpcs[0].VpcId" --output text
    $subnetIds = aws ec2 describe-subnets @awsArgs --filters "Name=vpc-id,Values=$vpcId" --query "Subnets[*].SubnetId" --output text
    $subnet = ($subnetIds -split "`t")[0]

    # Get or create security group
    $sgName = "$ServiceName-sg"
    $sgId = aws ec2 describe-security-groups @awsArgs --filters "Name=group-name,Values=$sgName" --query "SecurityGroups[0].GroupId" --output text 2>$null

    if (-not $sgId -or $sgId -eq "None") {
        $sgId = aws ec2 create-security-group @awsArgs `
            --group-name $sgName `
            --description "Security group for Discord bot" `
            --vpc-id $vpcId `
            --query "GroupId" --output text

        # Allow outbound HTTPS (for Discord API)
        aws ec2 authorize-security-group-egress @awsArgs `
            --group-id $sgId `
            --protocol tcp --port 443 --cidr 0.0.0.0/0 2>$null

        Write-Success "Created security group: $sgId"
    } else {
        Write-Warning "Security group '$sgName' already exists: $sgId"
    }

    # Save network config
    @{
        SubnetId = $subnet
        SecurityGroupId = $sgId
    } | ConvertTo-Json | Set-Content (Join-Path $PSScriptRoot ".network-config.json")

    Write-Step "Setup complete!"
    Write-Host ""
    Write-Host "   Next steps:" -ForegroundColor White
    Write-Host "   1. Run: .\deploy-bot.ps1 -Action deploy -Profile $Profile" -ForegroundColor Yellow
    Write-Host "   2. Run: .\deploy-bot.ps1 -Action start -Profile $Profile" -ForegroundColor Yellow
    Write-Host ""
}

# ============================================================================
# DEPLOY - Build and push Docker image
# ============================================================================
function Invoke-Deploy {
    Write-Step "Building and deploying Discord bot..."

    $accountId = Get-AccountId
    $ecrUri = "${accountId}.dkr.ecr.${Region}.amazonaws.com"
    $imageUri = "${ecrUri}/${RepoName}"

    # Login to ECR
    Write-Step "Logging in to ECR..."
    $loginCmd = aws ecr get-login-password @awsArgs
    $loginCmd | docker login --username AWS --password-stdin $ecrUri
    if ($LASTEXITCODE -ne 0) { throw "ECR login failed" }
    Write-Success "Logged in to ECR"

    # Build image
    Write-Step "Building Docker image..."
    $botPath = Join-Path $PSScriptRoot "..\tools\discord-product-bot"
    Push-Location $botPath
    try {
        docker build -t "${imageUri}:latest" .
        if ($LASTEXITCODE -ne 0) { throw "Docker build failed" }
        Write-Success "Built image: ${imageUri}:latest"

        # Push image
        Write-Step "Pushing to ECR..."
        docker push "${imageUri}:latest"
        if ($LASTEXITCODE -ne 0) { throw "Docker push failed" }
        Write-Success "Pushed image to ECR"
    } finally {
        Pop-Location
    }

    # Update service if running
    if (Test-EcsService) {
        Write-Step "Updating ECS service..."
        aws ecs update-service @awsArgs `
            --cluster $ClusterName `
            --service $ServiceName `
            --force-new-deployment | Out-Null
        Write-Success "Service update triggered. Use 'status' to monitor."
    } else {
        Write-Warning "Service not running. Use 'start' to create it."
    }
}

# ============================================================================
# START - Create/start the ECS service
# ============================================================================
function Invoke-Start {
    Write-Step "Starting Discord bot service..."

    $accountId = Get-AccountId

    # Load network config
    $networkConfigPath = Join-Path $PSScriptRoot ".network-config.json"
    if (-not (Test-Path $networkConfigPath)) {
        throw "Network config not found. Run 'setup' first."
    }
    $networkConfig = Get-Content $networkConfigPath | ConvertFrom-Json

    if (Test-EcsService) {
        # Update desired count
        aws ecs update-service @awsArgs `
            --cluster $ClusterName `
            --service $ServiceName `
            --desired-count 1 | Out-Null
        Write-Success "Service started (desired count: 1)"
    } else {
        # Create service
        aws ecs create-service @awsArgs `
            --cluster $ClusterName `
            --service-name $ServiceName `
            --task-definition $ServiceName `
            --desired-count 1 `
            --launch-type FARGATE `
            --network-configuration "awsvpcConfiguration={subnets=[$($networkConfig.SubnetId)],securityGroups=[$($networkConfig.SecurityGroupId)],assignPublicIp=ENABLED}" | Out-Null
        Write-Success "Created and started service: $ServiceName"
    }

    Write-Host ""
    Write-Host "   Use 'status' to check if the bot is running." -ForegroundColor Yellow
}

# ============================================================================
# STOP - Stop the ECS service
# ============================================================================
function Invoke-Stop {
    Write-Step "Stopping Discord bot service..."

    if (-not (Test-EcsService)) {
        Write-Warning "Service is not running."
        return
    }

    aws ecs update-service @awsArgs `
        --cluster $ClusterName `
        --service $ServiceName `
        --desired-count 0 | Out-Null

    Write-Success "Service stopped (desired count: 0)"
}

# ============================================================================
# STATUS - Check service status
# ============================================================================
function Invoke-Status {
    Write-Step "Discord Bot Status"

    if (-not (Test-EcsCluster)) {
        Write-Error "Cluster '$ClusterName' not found. Run 'setup' first."
        return
    }

    if (-not (Test-EcsService)) {
        Write-Warning "Service '$ServiceName' not found or inactive."
        return
    }

    $service = aws ecs describe-services @awsArgs `
        --cluster $ClusterName `
        --services $ServiceName `
        --query "services[0]" | ConvertFrom-Json

    Write-Host ""
    Write-Host "   Service: $($service.serviceName)" -ForegroundColor White
    Write-Host "   Status:  $($service.status)" -ForegroundColor $(if ($service.status -eq "ACTIVE") { "Green" } else { "Yellow" })
    Write-Host "   Running: $($service.runningCount) / $($service.desiredCount)" -ForegroundColor $(if ($service.runningCount -eq $service.desiredCount) { "Green" } else { "Yellow" })

    if ($service.deployments.Count -gt 0) {
        $deploy = $service.deployments[0]
        Write-Host "   Deploy:  $($deploy.status) ($($deploy.runningCount) running, $($deploy.pendingCount) pending)" -ForegroundColor Cyan
    }

    # Get recent events
    Write-Host ""
    Write-Host "   Recent Events:" -ForegroundColor White
    $service.events | Select-Object -First 5 | ForEach-Object {
        $time = [DateTime]::Parse($_.createdAt).ToString("HH:mm:ss")
        Write-Host "   [$time] $($_.message)" -ForegroundColor Gray
    }
}

# ============================================================================
# LOGS - Stream CloudWatch logs
# ============================================================================
function Invoke-Logs {
    Write-Step "Streaming logs (Ctrl+C to stop)..."

    $logGroup = "/ecs/$ServiceName"

    aws logs tail @awsArgs $logGroup --follow
}

# ============================================================================
# TEARDOWN - Remove all infrastructure
# ============================================================================
function Invoke-Teardown {
    Write-Step "This will DELETE all Discord bot infrastructure!"
    Write-Host ""
    Write-Warning "This includes: ECS service, task definitions, ECR images, secrets, IAM roles, and log groups."
    Write-Host ""
    $confirm = Read-Host "Type 'DELETE' to confirm"

    if ($confirm -ne "DELETE") {
        Write-Host "Aborted."
        return
    }

    $accountId = Get-AccountId

    # Stop and delete service
    Write-Step "Deleting ECS service..."
    if (Test-EcsService) {
        aws ecs update-service @awsArgs --cluster $ClusterName --service $ServiceName --desired-count 0 | Out-Null
        aws ecs delete-service @awsArgs --cluster $ClusterName --service $ServiceName --force | Out-Null
        Write-Success "Deleted service"
    }

    # Delete task definitions
    Write-Step "Deregistering task definitions..."
    $taskDefs = aws ecs list-task-definitions @awsArgs --family-prefix $ServiceName --query "taskDefinitionArns" --output json | ConvertFrom-Json
    foreach ($td in $taskDefs) {
        aws ecs deregister-task-definition @awsArgs --task-definition $td | Out-Null
    }
    Write-Success "Deregistered task definitions"

    # Delete ECR repository
    Write-Step "Deleting ECR repository..."
    if (Test-EcrRepo) {
        aws ecr delete-repository @awsArgs --repository-name $RepoName --force | Out-Null
        Write-Success "Deleted ECR repository"
    }

    # Delete secrets
    Write-Step "Deleting secrets..."
    foreach ($secretName in @("discord-bot-token", "github-token", "openai-api-key")) {
        if (Test-Secret $secretName) {
            aws secretsmanager delete-secret @awsArgs --secret-id $secretName --force-delete-without-recovery | Out-Null
            Write-Success "Deleted secret: $secretName"
        }
    }

    # Delete log group
    Write-Step "Deleting log group..."
    aws logs delete-log-group @awsArgs --log-group-name "/ecs/$ServiceName" 2>$null
    Write-Success "Deleted log group"

    # Delete security group
    Write-Step "Deleting security group..."
    $sgId = aws ec2 describe-security-groups @awsArgs --filters "Name=group-name,Values=$ServiceName-sg" --query "SecurityGroups[0].GroupId" --output text 2>$null
    if ($sgId -and $sgId -ne "None") {
        aws ec2 delete-security-group @awsArgs --group-id $sgId 2>$null
        Write-Success "Deleted security group"
    }

    # Note: Leaving IAM role and ECS cluster as they might be shared
    Write-Warning "IAM roles and ECS cluster were NOT deleted (may be shared resources)."
    Write-Warning "Delete manually if needed: ecs-task-execution-role, $ClusterName"

    # Clean up local config
    Remove-Item (Join-Path $PSScriptRoot ".bot-config.json") -ErrorAction SilentlyContinue
    Remove-Item (Join-Path $PSScriptRoot ".network-config.json") -ErrorAction SilentlyContinue

    Write-Step "Teardown complete!"
}

# ============================================================================
# MAIN
# ============================================================================
Write-Host ""
Write-Host "Discord Bot Deployment Script" -ForegroundColor Magenta
Write-Host "==============================" -ForegroundColor Magenta

switch ($Action) {
    "setup"    { Invoke-Setup }
    "deploy"   { Invoke-Deploy }
    "start"    { Invoke-Start }
    "stop"     { Invoke-Stop }
    "status"   { Invoke-Status }
    "logs"     { Invoke-Logs }
    "teardown" { Invoke-Teardown }
}

Write-Host ""
