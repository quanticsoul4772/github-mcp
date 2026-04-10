# Branch Protection Rules Setup

This document provides step-by-step instructions for configuring branch protection rules to enforce the CI/CD quality gates.

## Required Branch Protection Settings

### 1. Navigate to Repository Settings
1. Go to your repository on GitHub
2. Click on **Settings** tab
3. Select **Branches** from the left sidebar

### 2. Add Branch Protection Rule for `main`

Click **Add rule** and configure the following:

#### Basic Settings
- **Branch name pattern**: `main`
- ✅ **Restrict pushes that create files that are sensitive**: Enabled

#### Status Checks
- ✅ **Require status checks to pass before merging**: Enabled
- ✅ **Require branches to be up to date before merging**: Enabled

**Required Status Checks** (must all pass):
- `test (18.x)` - Tests on Node.js 18
- `test (20.x)` - Tests on Node.js 20  
- `quality-check` - Code quality gates
- `security-check` - Security scanning
- `build` - Build verification

#### Pull Request Requirements  
- ✅ **Require a pull request before merging**: Enabled
- **Required number of reviews**: 1 (minimum)
- ✅ **Dismiss stale PR reviews when new commits are pushed**: Enabled
- ✅ **Require review from code owners**: Enabled (if CODEOWNERS file exists)

#### Additional Restrictions
- ✅ **Restrict pushes that create files that are sensitive**: Enabled  
- ✅ **Include administrators**: Enabled (enforce rules for all users)
- ✅ **Allow force pushes**: Disabled
- ✅ **Allow deletions**: Disabled

### 3. Configure Required Status Checks

After setting up the branch protection rule, ensure these status checks are required:

#### Test Jobs
- `test (18.x)` - Node.js 18 test matrix
- `test (20.x)` - Node.js 20 test matrix

#### Quality Gates  
- `quality-check` - Code complexity, dependencies, licenses
- `security-check` - Security audit and vulnerability scanning
- `build` - Final build verification

#### Coverage Requirements
The PR coverage comment action will automatically fail PRs with < 80% coverage.

## Verification

### Test the Protection Rules
1. Create a test branch
2. Make a change that fails linting or tests
3. Open a PR - it should be blocked from merging
4. Fix the issues - PR should become mergeable

### Expected Behavior
- ❌ PRs with failing tests cannot be merged
- ❌ PRs with < 80% coverage cannot be merged  
- ❌ PRs with linting errors cannot be merged
- ❌ PRs with security vulnerabilities cannot be merged
- ❌ PRs with unused dependencies cannot be merged
- ✅ Only PRs passing all quality gates can be merged

## Quality Gate Enforcement

### Coverage Threshold: 80%
- Line coverage: ≥ 80%
- Function coverage: ≥ 80%  
- Branch coverage: ≥ 80%
- Statement coverage: ≥ 80%

### Code Quality Checks
- TypeScript compilation must pass
- ESLint linting must pass without warnings
- Code complexity within acceptable limits
- No unused dependencies
- License compliance verified

### Security Requirements  
- No high/critical security vulnerabilities
- Secret scanning passes (if configured)
- Dependency audit clean

## Troubleshooting

### Status Check Not Found
If a required status check is missing:
1. Ensure the CI workflow is running on the target branch
2. Check that job names in workflow match required status checks
3. Verify workflow syntax is correct

### Coverage Check Failing
If coverage checks fail:
1. Run `npm run coverage:check` locally to verify
2. Add tests for uncovered code paths
3. Check coverage report in `coverage/html/index.html`

### Quality Gate Failures
For quality gate issues:
- **Linting**: Run `npm run lint:fix` to auto-fix issues
- **TypeScript**: Fix type errors shown by `npm run typecheck`  
- **Complexity**: Refactor complex functions (> 10 complexity)
- **Dependencies**: Remove unused deps identified by `npm run quality:dependencies`

## Manual Override (Emergency Only)

In rare cases where protection rules need to be bypassed:
1. Administrators can use "Merge without waiting for requirements"
2. Document the reason in PR comments
3. Create follow-up issue to address quality gate failures
4. Re-enable full protection after emergency merge

**⚠️ Note**: Manual overrides should be extremely rare and well-documented.