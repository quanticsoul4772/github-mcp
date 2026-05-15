# Project Structure

## Root Directory (Clean Structure)
```
github-mcp/
├── src/                    # Source code
├── docs/                   # All documentation
├── config/                 # All configuration files
├── scripts/                # Build, test, and utility scripts
├── examples/               # Usage examples
├── test/                   # Test infrastructure
├── README.md              # Main project documentation
├── CLAUDE.md              # Claude AI instructions
├── CONTRIBUTING.md        # Contribution guidelines
├── SECURITY.md            # Security policies
├── PROJECT_STRUCTURE.md   # This file
├── package.json           # Node.js dependencies
├── tsconfig.json          # TypeScript configuration
├── vitest.config.ts       # Test runner configuration
└── .env.example           # Environment variables template
```

## Documentation (`docs/`)
```
docs/
├── README.md              # Documentation index
├── api/                   # API documentation
│   └── API_REFERENCE.md
├── guides/                # How-to guides
│   ├── AGENT_SYSTEM_GUIDE.md
│   ├── AUTHENTICATION_SECURITY.md
│   ├── BRANCH_PROTECTION_SETUP.md
│   └── coverage-setup.md
├── deployment/            # Deployment documentation
│   └── DEPLOYMENT.md
├── architecture.md        # System architecture
├── developer-guide.md     # Developer setup
├── performance.md         # Performance guide
├── tools-reference.md     # Tool reference
├── EXAMPLES.md           # Usage examples
└── TROUBLESHOOTING.md    # Common issues
```

## Source Code (`src/`)
```
src/
├── index.ts              # Main server class
├── main.ts               # Entry point
├── types.ts              # Core type definitions
├── tool-types.ts         # Tool parameter types
├── validation.ts         # Input validation
├── errors.ts             # Error handling
├── tools/                # GitHub API tools
│   ├── repositories.ts
│   ├── issues.ts
│   ├── pull-requests.ts
│   └── ...
├── agents/               # Agent system
│   ├── base/            # Base classes
│   ├── analysis/        # Analysis agents
│   ├── security/        # Security agents
│   └── testing/         # Test agents
├── foundation/           # Core infrastructure
│   ├── bootstrap.ts
│   ├── container.ts
│   └── interfaces.ts
└── __tests__/           # Test files
    ├── unit/
    ├── integration/
    └── fixtures/
```

## Configuration (`config/`)
```
config/
├── docker/                    # Docker configurations
│   ├── Dockerfile
│   ├── Dockerfile.agents
│   ├── docker-compose.yml
│   ├── docker-compose.agents.yml
│   └── nginx.conf
├── k8s/                       # Kubernetes manifests
│   └── *.yaml files
├── commitlint.config.js       # Commit message linting
├── eslint.config.js           # ESLint configuration
└── ci-workflow-template.yml   # CI/CD template
```

## Scripts (`scripts/`)
```
scripts/
├── tests/                     # Test scripts
│   ├── demo-phase1.js
│   ├── test-phase1.sh
│   ├── test-dotenv.js
│   ├── test-help.mjs
│   ├── test-real-world.ts
│   ├── test-reliability.js
│   └── test-validation.js
├── setup-security.sh          # Security setup
├── requirements-security.*    # Security requirements
├── dashboard.html             # Test dashboard
└── index-update-patch.txt     # Update patches
```

## Key Files

### Essential Root Files
- **README.md**: Project overview and quick start
- **CLAUDE.md**: Instructions for Claude AI when working with code
- **package.json**: Dependencies and scripts
- **tsconfig.json**: TypeScript compiler configuration
- **.env.example**: Template for environment variables

### Entry Points
- **src/main.ts**: Application entry point for execution
- **src/index.ts**: Module exports for testing/integration

### Configuration
- **config/**: Docker and CI/CD configurations
- **.github/workflows/**: GitHub Actions workflows

### Documentation
- **docs/**: All project documentation
- **docs/README.md**: Documentation index
- **docs/api/**: API reference
- **docs/guides/**: How-to guides
- **docs/deployment/**: Deployment instructions