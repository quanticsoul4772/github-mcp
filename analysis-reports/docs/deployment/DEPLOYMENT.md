# Deployment Guide

This document provides comprehensive deployment instructions for the GitHub MCP Server across different environments and platforms.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Configuration](#environment-configuration)
3. [Local Development](#local-development)
4. [Docker Deployment](#docker-deployment)
5. [Kubernetes Deployment](#kubernetes-deployment)
6. [Cloud Deployments](#cloud-deployments)
7. [CI/CD Pipeline](#cicd-pipeline)
8. [Monitoring and Logging](#monitoring-and-logging)
9. [Troubleshooting](#troubleshooting)

## Prerequisites

### Required Dependencies
- Node.js 20.x or later
- Docker 20.10+ (for containerized deployments)
- Kubernetes 1.24+ (for K8s deployments)
- kubectl CLI tool
- GitHub Personal Access Token

### GitHub Token Setup
1. Go to [GitHub Settings > Developer settings > Personal access tokens](https://github.com/settings/tokens)
2. Click "Generate new token (classic)"
3. Select the following scopes:
   - `repo` (Full control of private repositories)
   - `workflow` (Update GitHub Action workflows)
   - `user` (Access user information)
   - `notifications` (Access notifications)
   - `admin:org` (if deploying for organizations)

## Environment Configuration

### Environment Variables

#### Required
```bash
# GitHub Authentication (choose one)
GITHUB_PERSONAL_ACCESS_TOKEN=ghp_your_token_here
# OR
GITHUB_TOKEN=ghp_your_token_here
```

#### Optional
```bash
# Server Configuration
NODE_ENV=production                    # development|production|test
PORT=3000                             # Server port
LOG_LEVEL=info                        # debug|info|warn|error

# GitHub Configuration
GITHUB_READ_ONLY=false                # Enable read-only mode
GITHUB_TOOLSETS=all                   # Comma-separated toolsets or "all"
GITHUB_HOST=https://api.github.com    # GitHub Enterprise URL (optional)

# Performance
NODE_OPTIONS=--max-old-space-size=4096 # Memory settings
```

### Environment Validation

The application uses Zod for environment validation. Invalid configurations will display helpful error messages on startup:

```typescript
// Example validation error output
❌ Environment validation failed:
  - GITHUB_PERSONAL_ACCESS_TOKEN: Either GITHUB_PERSONAL_ACCESS_TOKEN or GITHUB_TOKEN must be provided

📋 Required environment variables:
  - GITHUB_PERSONAL_ACCESS_TOKEN or GITHUB_TOKEN: GitHub API authentication token
  - Create a token at: https://github.com/settings/tokens
  - Required scopes: repo, workflow, user, notifications
```

## Local Development

### Quick Start
```bash
# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Edit .env with your GitHub token

# Run in development mode
npm run dev

# Or run built version
npm run build
npm start
```

### Using Docker for Development
```bash
# Create .env file
echo "GITHUB_PERSONAL_ACCESS_TOKEN=your_token_here" > .env

# Run development server with hot reload
docker-compose --profile dev up github-mcp-dev

# Access at http://localhost:3001
```

## Docker Deployment

### Building the Image

```bash
# Build production image
docker build -t github-mcp:latest .

# Build with specific tag
docker build -t github-mcp:v1.0.0 .

# Multi-platform build
docker buildx build --platform linux/amd64,linux/arm64 -t github-mcp:latest .
```

### Running with Docker

```bash
# Run with environment variables
docker run -d \
  --name github-mcp \
  -p 3000:3000 \
  -e GITHUB_PERSONAL_ACCESS_TOKEN=your_token_here \
  -e NODE_ENV=production \
  github-mcp:latest

# Run with .env file
docker run -d \
  --name github-mcp \
  -p 3000:3000 \
  --env-file .env \
  github-mcp:latest
```

### Using Docker Compose

```bash
# Production deployment
docker-compose up -d

# Development with hot reload
docker-compose --profile dev up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

### Docker Compose Configuration

The `docker-compose.yml` includes:
- Production service with resource limits
- Development service with hot reload
- Health checks and logging configuration
- Network isolation

## Kubernetes Deployment

### Quick Deploy

```bash
# Deploy all resources
kubectl apply -f k8s/

# Or use Kustomize
kubectl apply -k k8s/
```

### Step-by-Step Deployment

1. **Create Namespace**
   ```bash
   kubectl apply -f k8s/namespace.yaml
   ```

2. **Configure Secrets**
   ```bash
   # Edit the secret with your GitHub token
   kubectl edit secret github-mcp-secrets -n github-mcp
   
   # Or create from command line
   kubectl create secret generic github-mcp-secrets \
     --from-literal=GITHUB_PERSONAL_ACCESS_TOKEN=your_token_here \
     -n github-mcp
   ```

3. **Deploy Application**
   ```bash
   kubectl apply -f k8s/configmap.yaml
   kubectl apply -f k8s/deployment.yaml
   kubectl apply -f k8s/service.yaml
   kubectl apply -f k8s/hpa.yaml
   ```

4. **Configure Ingress (Optional)**
   ```bash
   # Update k8s/ingress.yaml with your domain
   kubectl apply -f k8s/ingress.yaml
   ```

### Kubernetes Resources

The deployment includes:

- **Namespace**: Isolated environment
- **ConfigMap**: Non-sensitive configuration
- **Secret**: GitHub token and sensitive data
- **Deployment**: Application pods with 3 replicas
- **Service**: Load balancing and service discovery
- **HPA**: Horizontal Pod Autoscaler (3-10 replicas)
- **Ingress**: External access with TLS termination
- **Kustomization**: Centralized configuration management

### Monitoring Deployment

```bash
# Check pod status
kubectl get pods -n github-mcp

# View logs
kubectl logs -f deployment/github-mcp -n github-mcp

# Check HPA status
kubectl get hpa -n github-mcp

# Port forward for testing
kubectl port-forward service/github-mcp-service 3000:80 -n github-mcp
```

## Cloud Deployments

### AWS EKS

```bash
# Configure AWS CLI
aws configure

# Update kubeconfig
aws eks update-kubeconfig --region us-west-2 --name your-cluster-name

# Deploy
kubectl apply -f k8s/
```

### Google GKE

```bash
# Authenticate
gcloud auth login
gcloud container clusters get-credentials your-cluster-name --zone us-central1-a

# Deploy
kubectl apply -f k8s/
```

### Azure AKS

```bash
# Login and get credentials
az login
az aks get-credentials --resource-group your-rg --name your-cluster-name

# Deploy
kubectl apply -f k8s/
```

### AWS Lambda (Serverless)

```dockerfile
# Lambda-specific Dockerfile
FROM public.ecr.aws/lambda/nodejs:20

COPY package*.json ${LAMBDA_TASK_ROOT}/
RUN npm ci --only=production

COPY build/ ${LAMBDA_TASK_ROOT}/
COPY CLAUDE.md README.md ${LAMBDA_TASK_ROOT}/

CMD ["index.handler"]
```

## CI/CD Pipeline

### GitHub Actions

The repository includes two workflows:

1. **CI/CD Pipeline** (`.github/workflows/ci.yml`)
   - Runs tests and builds on push/PR
   - Builds and pushes Docker images
   - Deploys to staging/production

2. **Docker Security** (`.github/workflows/docker.yml`)
   - Lints Dockerfiles
   - Runs security scans
   - Tests Docker builds

### Required Secrets

Configure these in your GitHub repository settings:

```bash
# Required
GITHUB_TOKEN                    # Automatically provided
CODECOV_TOKEN                  # Optional: for code coverage
SNYK_TOKEN                     # Optional: for security scanning

# For K8s deployments
KUBECONFIG_STAGING             # Base64 encoded kubeconfig for staging
KUBECONFIG_PRODUCTION          # Base64 encoded kubeconfig for production
```

### Pipeline Stages

1. **Test and Build**
   - TypeScript compilation
   - Unit tests with coverage
   - Security audits

2. **Docker Build**
   - Multi-platform image builds
   - Security scanning with Trivy
   - SBOM generation

3. **Deploy Staging**
   - Automatic deployment on main branch
   - Smoke tests

4. **Deploy Production**
   - Manual approval required
   - Triggered on releases
   - Rollback capabilities

## Monitoring and Logging

### Application Metrics

The application exposes metrics for monitoring:

```yaml
# Prometheus annotations in deployment
annotations:
  prometheus.io/scrape: "true"
  prometheus.io/port: "3000"
  prometheus.io/path: "/metrics"
```

### Logging Configuration

```bash
# Set log level
LOG_LEVEL=debug  # debug|info|warn|error

# Docker Compose logging
logging:
  driver: "json-file"
  options:
    max-size: "10m"
    max-file: "3"
```

### Health Checks

```bash
# Docker health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "process.exit(0)" || exit 1

# Kubernetes probes
livenessProbe:
  exec:
    command: [node, -e, "process.exit(0)"]
  initialDelaySeconds: 30
  periodSeconds: 30
```

## Troubleshooting

### Common Issues

#### 1. Authentication Errors
```bash
# Check token validity
curl -H "Authorization: token your_token_here" https://api.github.com/user

# Verify token scopes
curl -I -H "Authorization: token your_token_here" https://api.github.com/user
```

#### 2. Environment Validation Failures
```bash
# Check environment variables
node -e "console.log(process.env.GITHUB_PERSONAL_ACCESS_TOKEN?.substring(0,10))"

# Validate with the env module
npm run dev  # Will show detailed validation errors
```

#### 3. Docker Build Issues
```bash
# Check Docker build context
docker build --no-cache -t github-mcp:debug .

# Verify multi-stage build
docker build --target builder -t github-mcp:builder .
```

#### 4. Kubernetes Deployment Issues
```bash
# Check pod logs
kubectl logs -f deployment/github-mcp -n github-mcp

# Describe pod for events
kubectl describe pod -l app=github-mcp -n github-mcp

# Check resource usage
kubectl top pods -n github-mcp
```

### Performance Tuning

#### Memory Settings
```bash
# Increase Node.js heap size
NODE_OPTIONS=--max-old-space-size=4096

# Kubernetes resource limits
resources:
  limits:
    memory: "512Mi"
    cpu: "500m"
  requests:
    memory: "256Mi"
    cpu: "250m"
```

#### Scaling Configuration
```bash
# Horizontal Pod Autoscaler
spec:
  minReplicas: 3
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
```

### Security Best Practices

1. **Use non-root containers**
2. **Enable read-only root filesystem**
3. **Drop all Linux capabilities**
4. **Use secrets management**
5. **Regular security scanning**
6. **Network policies for K8s**

For additional support, check the [TROUBLESHOOTING.md](TROUBLESHOOTING.md) file or open an issue on GitHub.