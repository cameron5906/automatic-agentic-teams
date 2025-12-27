<#
.SYNOPSIS
    Deploy and manage the Business Bot on AWS ECS Fargate.

.DESCRIPTION
    This script handles the complete lifecycle of the Business Bot deployment:
    - Infrastructure setup (ECR, ECS, IAM, Secrets Manager)
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
    ECS service name. Default: soyl-business-bot

.PARAMETER RepoName
    ECR repository name. Default: soyl-business-bot

.EXAMPLE
    .\deploy-business-bot.ps1 -Action setup -Profile myprofile

.EXAMPLE
    .\deploy-business-bot.ps1 -Action deploy -Profile myprofile

.EXAMPLE
    .\deploy-business-bot.ps1 -Action status -Profile myprofile
#>

param(
    [Parameter(Mandatory=$true)]
    [ValidateSet("setup", "deploy", "start", "stop", "status", "logs", "teardown")]
    [string]$Action,

    [Parameter(Mandatory=$true)]
    [string]$Profile,

    [string]$Region = "us-east-1",
    [string]$ClusterName = "soyl-cluster",
    [string]$ServiceName = "soyl-business-bot",
    [string]$RepoName = "soyl-business-bot"
)

$ErrorActionPreference = "Stop"

function Write-Step { param($msg) Write-Host "`n>> $msg" -ForegroundColor Cyan }
function Write-Success { param($msg) Write-Host "   $msg" -ForegroundColor Green }
function Write-Warning { param($msg) Write-Host "   $msg" -ForegroundColor Yellow }
function Write-Error { param($msg) Write-Host "   $msg" -ForegroundColor Red }

$awsArgs = @("--profile", $Profile, "--region", $Region)

function Get-AccountId {
    $result = aws sts get-caller-identity --profile $Profile --query "Account" --output text
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to get AWS account ID. Check your profile."
    }
    return $result.Trim()
}

function Test-EcrRepo {
    $ErrorActionPreference = "SilentlyContinue"
    $result = aws ecr describe-repositories --profile $Profile --region $Region --repository-names $RepoName 2>&1
    $ErrorActionPreference = "Stop"
    return $LASTEXITCODE -eq 0
}

function Test-EcsCluster {
    $ErrorActionPreference = "SilentlyContinue"
    $result = aws ecs describe-clusters --profile $Profile --region $Region --clusters $ClusterName --query "clusters[?status=='ACTIVE'].clusterName" --output text 2>&1
    $ErrorActionPreference = "Stop"
    return ($result -and $result.Trim() -eq $ClusterName)
}

function Test-EcsService {
    $ErrorActionPreference = "SilentlyContinue"
    $result = aws ecs describe-services --profile $Profile --region $Region --cluster $ClusterName --services $ServiceName --query "services[?status=='ACTIVE'].serviceName" --output text 2>&1
    $ErrorActionPreference = "Stop"
    return ($result -and $result.Trim() -eq $ServiceName)
}

function Test-Secret {
    param($SecretName)
    $ErrorActionPreference = "SilentlyContinue"
    $result = aws secretsmanager describe-secret --profile $Profile --region $Region --secret-id $SecretName 2>&1
    $ErrorActionPreference = "Stop"
    return $LASTEXITCODE -eq 0
}

function Invoke-Setup {
    Write-Step "Setting up AWS infrastructure for Business Bot..."

    $accountId = Get-AccountId
    Write-Success "Using AWS Account: $accountId"

    Write-Step "Creating ECR repository..."
    if (Test-EcrRepo) {
        Write-Warning "ECR repository '$RepoName' already exists, skipping."
    } else {
        aws ecr create-repository @awsArgs --repository-name $RepoName | Out-Null
        Write-Success "Created ECR repository: $RepoName"
    }

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

    Write-Step "Setting up Secrets Manager..."

    $secrets = @(
        @{ Name = "business-bot-discord-token"; Prompt = "Enter Discord Bot Token" },
        @{ Name = "business-bot-openai-key"; Prompt = "Enter OpenAI API Key" },
        @{ Name = "business-bot-namecheap-user"; Prompt = "Enter Namecheap API User" },
        @{ Name = "business-bot-namecheap-key"; Prompt = "Enter Namecheap API Key" },
        @{ Name = "business-bot-namecheap-username"; Prompt = "Enter Namecheap Username" },
        @{ Name = "business-bot-github-token"; Prompt = "Enter GitHub PAT" },
        @{ Name = "business-bot-tavily-key"; Prompt = "Enter Tavily API Key" }
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

    Write-Step "Creating IAM roles..."

    $executionRoleName = "ecs-task-execution-role"

    $ErrorActionPreference = "SilentlyContinue"
    $roleExists = aws iam get-role --profile $Profile --role-name $executionRoleName 2>&1
    $roleCheckExitCode = $LASTEXITCODE
    $ErrorActionPreference = "Stop"

    if ($roleCheckExitCode -ne 0) {
        $trustPolicyFile = Join-Path $env:TEMP "trust-policy.json"
        $trustPolicyJson = '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"ecs-tasks.amazonaws.com"},"Action":"sts:AssumeRole"}]}'
        [System.IO.File]::WriteAllText($trustPolicyFile, $trustPolicyJson)

        aws iam create-role --profile $Profile `
            --role-name $executionRoleName `
            --assume-role-policy-document "file://$trustPolicyFile" | Out-Null
        if ($LASTEXITCODE -ne 0) { throw "Failed to create IAM role" }

        aws iam attach-role-policy --profile $Profile `
            --role-name $executionRoleName `
            --policy-arn "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy" | Out-Null
        if ($LASTEXITCODE -ne 0) { throw "Failed to attach managed policy" }

        Write-Success "Created IAM role: $executionRoleName"
    } else {
        Write-Warning "IAM role '$executionRoleName' already exists, skipping."
    }

    $secretArns = @(
        "arn:aws:secretsmanager:${Region}:${accountId}:secret:business-bot-*"
    )
    $secretsPolicyFile = Join-Path $env:TEMP "business-bot-secrets-policy.json"
    $secretsPolicyJson = @"
{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Action":["secretsmanager:GetSecretValue"],"Resource":$($secretArns | ConvertTo-Json -Compress)}]}
"@
    [System.IO.File]::WriteAllText($secretsPolicyFile, $secretsPolicyJson)

    aws iam put-role-policy --profile $Profile `
        --role-name $executionRoleName `
        --policy-name "BusinessBotSecretsAccess" `
        --policy-document "file://$secretsPolicyFile" | Out-Null
    Write-Success "Added secrets access policy"

    Write-Step "Creating CloudWatch log group..."
    $logGroup = "/ecs/$ServiceName"
    $ErrorActionPreference = "SilentlyContinue"
    aws logs create-log-group @awsArgs --log-group-name $logGroup 2>&1 | Out-Null
    $ErrorActionPreference = "Stop"
    Write-Success "Log group ready: $logGroup"

    Write-Step "Configuring Business Bot..."

    Write-Host "   Enter admin Discord user IDs (comma-separated, or blank for none):"
    $adminUserIds = Read-Host "   Admin User IDs"

    Write-Host "   Enter team Discord user IDs to invite (comma-separated, or blank for none):"
    $teamUserIds = Read-Host "   Team User IDs"

    Write-Host "   Enter GitHub organization/user for repositories:"
    $githubOrg = Read-Host "   GitHub Org"

    Write-Host "   Enter template repository for new projects (owner/repo):"
    Write-Host "   Default: cameron5906/automatic-agentic-teams"
    $templateRepo = Read-Host "   Template Repo (or press Enter for default)"
    if (-not $templateRepo) {
        $templateRepo = "cameron5906/automatic-agentic-teams"
    }

    Write-Host "   Enter your public IP for Namecheap API (check whatismyip.com):"
    $namecheapClientIp = Read-Host "   Client IP"

    Write-Host "   Enter Product Bot Client ID (for auto-invite link, or blank to skip):"
    $productBotClientId = Read-Host "   Product Bot Client ID"

    Write-Host "   Use Namecheap sandbox mode? (y/N):"
    $namecheapSandbox = Read-Host
    $useSandbox = $namecheapSandbox -eq "y"

    $configPath = Join-Path $PSScriptRoot ".business-bot-config.json"
    @{
        AdminUserIds = $adminUserIds
        TeamUserIds = $teamUserIds
        GitHubOrg = $githubOrg
        GitHubTemplateRepo = $templateRepo
        NamecheapClientIp = $namecheapClientIp
        NamecheapSandbox = $useSandbox
        ProductBotClientId = $productBotClientId
    } | ConvertTo-Json | Set-Content $configPath
    Write-Success "Saved config to $configPath"

    Write-Step "Getting VPC configuration..."
    $vpcId = aws ec2 describe-vpcs @awsArgs --filters "Name=is-default,Values=true" --query "Vpcs[0].VpcId" --output text
    $subnetIds = aws ec2 describe-subnets @awsArgs --filters "Name=vpc-id,Values=$vpcId" --query "Subnets[*].SubnetId" --output text
    $subnet = ($subnetIds -split "`t")[0]

    $sgName = "$ServiceName-sg"
    $ErrorActionPreference = "SilentlyContinue"
    $sgId = aws ec2 describe-security-groups @awsArgs --filters "Name=group-name,Values=$sgName" --query "SecurityGroups[0].GroupId" --output text 2>&1
    $ErrorActionPreference = "Stop"

    if (-not $sgId -or $sgId -eq "None") {
        $sgId = aws ec2 create-security-group @awsArgs `
            --group-name $sgName `
            --description "Security group for Business Bot" `
            --vpc-id $vpcId `
            --query "GroupId" --output text

        $ErrorActionPreference = "SilentlyContinue"
        aws ec2 authorize-security-group-egress @awsArgs `
            --group-id $sgId `
            --protocol tcp --port 443 --cidr 0.0.0.0/0 2>&1 | Out-Null
        $ErrorActionPreference = "Stop"

        Write-Success "Created security group: $sgId"
    } else {
        Write-Warning "Security group '$sgName' already exists: $sgId"
    }

    @{
        SubnetId = $subnet
        SecurityGroupId = $sgId
    } | ConvertTo-Json | Set-Content (Join-Path $PSScriptRoot ".business-bot-network.json")

    Write-Step "Fetching secret ARNs..."

    function Get-SecretArn {
        param($SecretName)
        $arn = aws secretsmanager describe-secret @awsArgs --secret-id $SecretName --query "ARN" --output text 2>$null
        if ($LASTEXITCODE -ne 0 -or -not $arn) {
            throw "Secret '$SecretName' not found. Run setup first."
        }
        return $arn.Trim()
    }

    $secretArns = @{
        DiscordToken = Get-SecretArn "business-bot-discord-token"
        OpenAIKey = Get-SecretArn "business-bot-openai-key"
        NamecheapUser = Get-SecretArn "business-bot-namecheap-user"
        NamecheapKey = Get-SecretArn "business-bot-namecheap-key"
        NamecheapUsername = Get-SecretArn "business-bot-namecheap-username"
        GitHubToken = Get-SecretArn "business-bot-github-token"
        TavilyKey = Get-SecretArn "business-bot-tavily-key"
    }
    Write-Success "Retrieved all secret ARNs"

    Write-Step "Creating ECS task definition..."

    $taskDef = @{
        family = $ServiceName
        networkMode = "awsvpc"
        requiresCompatibilities = @("FARGATE")
        cpu = "512"
        memory = "1024"
        executionRoleArn = "arn:aws:iam::${accountId}:role/$executionRoleName"
        containerDefinitions = @(
            @{
                name = "business-bot"
                image = "${accountId}.dkr.ecr.${Region}.amazonaws.com/${RepoName}:latest"
                essential = $true
                environment = @(
                    @{ name = "NODE_ENV"; value = "production" }
                    @{ name = "BOT_SQLITE_PATH"; value = "/data/business-bot.sqlite" }
                    @{ name = "DISCORD_ADMIN_USER_IDS"; value = $adminUserIds }
                    @{ name = "DISCORD_TEAM_USER_IDS"; value = $teamUserIds }
                    @{ name = "GITHUB_ORG"; value = $githubOrg }
                    @{ name = "GITHUB_TEMPLATE_REPO"; value = $templateRepo }
                    @{ name = "NAMECHEAP_CLIENT_IP"; value = $namecheapClientIp }
                    @{ name = "PRODUCT_BOT_CLIENT_ID"; value = $productBotClientId }
                    @{ name = "NAMECHEAP_SANDBOX"; value = if ($useSandbox) { "true" } else { "false" } }
                )
                secrets = @(
                    @{ name = "DISCORD_BOT_TOKEN"; valueFrom = $secretArns.DiscordToken }
                    @{ name = "OPENAI_API_KEY"; valueFrom = $secretArns.OpenAIKey }
                    @{ name = "NAMECHEAP_API_USER"; valueFrom = $secretArns.NamecheapUser }
                    @{ name = "NAMECHEAP_API_KEY"; valueFrom = $secretArns.NamecheapKey }
                    @{ name = "NAMECHEAP_USERNAME"; valueFrom = $secretArns.NamecheapUsername }
                    @{ name = "GITHUB_TOKEN"; valueFrom = $secretArns.GitHubToken }
                    @{ name = "TAVILY_API_KEY"; valueFrom = $secretArns.TavilyKey }
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
    $taskDefFile = Join-Path $env:TEMP "business-bot-task-def.json"
    [System.IO.File]::WriteAllText($taskDefFile, $taskDefJson)

    aws ecs register-task-definition @awsArgs --cli-input-json "file://$taskDefFile" | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Failed to register task definition" }
    Write-Success "Registered task definition: $ServiceName"

    Write-Step "Setup complete!"
    Write-Host ""
    Write-Host "   Next steps:" -ForegroundColor White
    Write-Host "   1. Run: .\deploy-business-bot.ps1 -Action deploy -Profile $Profile" -ForegroundColor Yellow
    Write-Host "   2. Run: .\deploy-business-bot.ps1 -Action start -Profile $Profile" -ForegroundColor Yellow
    Write-Host ""
}

function Invoke-Deploy {
    Write-Step "Building and deploying Business Bot..."

    $accountId = Get-AccountId
    $ecrUri = "${accountId}.dkr.ecr.${Region}.amazonaws.com"
    $imageUri = "${ecrUri}/${RepoName}"

    Write-Step "Logging in to ECR..."
    $loginCmd = aws ecr get-login-password @awsArgs
    $loginCmd | docker login --username AWS --password-stdin $ecrUri
    if ($LASTEXITCODE -ne 0) { throw "ECR login failed" }
    Write-Success "Logged in to ECR"

    Write-Step "Building Docker image..."
    $botPath = Join-Path $PSScriptRoot "..\tools\business-bot"
    Push-Location $botPath
    try {
        docker build -t "${imageUri}:latest" .
        if ($LASTEXITCODE -ne 0) { throw "Docker build failed" }
        Write-Success "Built image: ${imageUri}:latest"

        Write-Step "Pushing to ECR..."
        docker push "${imageUri}:latest"
        if ($LASTEXITCODE -ne 0) { throw "Docker push failed" }
        Write-Success "Pushed image to ECR"
    } finally {
        Pop-Location
    }

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

function Invoke-Start {
    Write-Step "Starting Business Bot service..."

    $accountId = Get-AccountId

    $networkConfigPath = Join-Path $PSScriptRoot ".business-bot-network.json"
    if (-not (Test-Path $networkConfigPath)) {
        throw "Network config not found. Run 'setup' first."
    }
    $networkConfig = Get-Content $networkConfigPath | ConvertFrom-Json

    if (Test-EcsService) {
        aws ecs update-service @awsArgs `
            --cluster $ClusterName `
            --service $ServiceName `
            --desired-count 1 | Out-Null
        Write-Success "Service started (desired count: 1)"
    } else {
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

function Invoke-Stop {
    Write-Step "Stopping Business Bot service..."

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

function Invoke-Status {
    Write-Step "Business Bot Status"

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

    Write-Host ""
    Write-Host "   Recent Events:" -ForegroundColor White
    $service.events | Select-Object -First 5 | ForEach-Object {
        $time = [DateTime]::Parse($_.createdAt).ToString("HH:mm:ss")
        Write-Host "   [$time] $($_.message)" -ForegroundColor Gray
    }
}

function Invoke-Logs {
    Write-Step "Streaming logs (Ctrl+C to stop)..."

    $logGroup = "/ecs/$ServiceName"

    aws logs tail @awsArgs $logGroup --follow
}

function Invoke-Teardown {
    Write-Step "This will DELETE all Business Bot infrastructure!"
    Write-Host ""
    Write-Warning "This includes: ECS service, task definitions, ECR images, secrets, and log groups."
    Write-Host ""
    $confirm = Read-Host "Type 'DELETE' to confirm"

    if ($confirm -ne "DELETE") {
        Write-Host "Aborted."
        return
    }

    $accountId = Get-AccountId

    Write-Step "Deleting ECS service..."
    if (Test-EcsService) {
        aws ecs update-service @awsArgs --cluster $ClusterName --service $ServiceName --desired-count 0 | Out-Null
        aws ecs delete-service @awsArgs --cluster $ClusterName --service $ServiceName --force | Out-Null
        Write-Success "Deleted service"
    }

    Write-Step "Deregistering task definitions..."
    $taskDefs = aws ecs list-task-definitions @awsArgs --family-prefix $ServiceName --query "taskDefinitionArns" --output json | ConvertFrom-Json
    foreach ($td in $taskDefs) {
        aws ecs deregister-task-definition @awsArgs --task-definition $td | Out-Null
    }
    Write-Success "Deregistered task definitions"

    Write-Step "Deleting ECR repository..."
    if (Test-EcrRepo) {
        aws ecr delete-repository @awsArgs --repository-name $RepoName --force | Out-Null
        Write-Success "Deleted ECR repository"
    }

    Write-Step "Deleting secrets..."
    $secretNames = @(
        "business-bot-discord-token",
        "business-bot-openai-key",
        "business-bot-namecheap-user",
        "business-bot-namecheap-key",
        "business-bot-namecheap-username",
        "business-bot-github-token",
        "business-bot-tavily-key"
    )
    foreach ($secretName in $secretNames) {
        if (Test-Secret $secretName) {
            aws secretsmanager delete-secret @awsArgs --secret-id $secretName --force-delete-without-recovery | Out-Null
            Write-Success "Deleted secret: $secretName"
        }
    }

    Write-Step "Deleting log group..."
    $ErrorActionPreference = "SilentlyContinue"
    aws logs delete-log-group @awsArgs --log-group-name "/ecs/$ServiceName" 2>&1 | Out-Null
    $ErrorActionPreference = "Stop"
    Write-Success "Deleted log group"

    Write-Step "Deleting security group..."
    $ErrorActionPreference = "SilentlyContinue"
    $sgId = aws ec2 describe-security-groups @awsArgs --filters "Name=group-name,Values=$ServiceName-sg" --query "SecurityGroups[0].GroupId" --output text 2>&1
    $ErrorActionPreference = "Stop"
    if ($sgId -and $sgId -ne "None") {
        $ErrorActionPreference = "SilentlyContinue"
        aws ec2 delete-security-group @awsArgs --group-id $sgId 2>&1 | Out-Null
        $ErrorActionPreference = "Stop"
        Write-Success "Deleted security group"
    }

    Write-Warning "IAM roles and ECS cluster were NOT deleted (may be shared resources)."

    Remove-Item (Join-Path $PSScriptRoot ".business-bot-config.json") -ErrorAction SilentlyContinue
    Remove-Item (Join-Path $PSScriptRoot ".business-bot-network.json") -ErrorAction SilentlyContinue

    Write-Step "Teardown complete!"
}

Write-Host ""
Write-Host "Business Bot Deployment Script" -ForegroundColor Magenta
Write-Host "===============================" -ForegroundColor Magenta

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
