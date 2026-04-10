# Coverage Reporting Setup

This document explains how to set up comprehensive coverage reporting with PR comments and badges.

## 1. Codecov Integration

### Setup Steps
1. Go to [codecov.io](https://codecov.io)
2. Sign in with GitHub
3. Add your repository
4. Copy the upload token (if private repo)
5. Add token as `CODECOV_TOKEN` in repository secrets

### Badge Integration
Add to your README.md:
```markdown
[![codecov](https://codecov.io/gh/USERNAME/REPO/branch/main/graph/badge.svg)](https://codecov.io/gh/USERNAME/REPO)
```

## 2. PR Coverage Comments

The updated CI workflow includes automatic coverage comments on PRs using the `5monkeys/cobertura-action`.

### What's Included
- **Coverage percentage** for the PR
- **Coverage change** vs target branch
- **Uncovered lines** highlighted
- **Files with low coverage** listed
- **Coverage trend** over time

### Example PR Comment
```
## Coverage Report
📊 **Coverage**: 82.5% (+2.1%)
✅ **Threshold**: 80% (PASSED)

### Coverage by File
| File | Coverage | Lines | Missing |
|------|----------|-------|---------|
| src/tools/issues.ts | 95.2% | 105 | 23-24, 67 |
| src/validation.ts | 76.3% | 127 | 45-52, 89-91 |

### Coverage Trend
- Previous: 80.4%
- Current: 82.5%
- Change: +2.1% ✅
```

## 3. Local Coverage Reports

### Generate Reports Locally
```bash
# Run tests with coverage
npm run test:coverage

# Check coverage thresholds
npm run coverage:check

# View HTML report
open coverage/html/index.html
```

### Coverage Output Formats
- **Text**: Console output during CI
- **HTML**: Interactive web report (`coverage/html/`)
- **LCOV**: For external tools (`coverage/lcov.info`)
- **Cobertura**: For PR comments (`coverage/cobertura-coverage.xml`)
- **JSON**: Programmatic access (`coverage/coverage-summary.json`)

## 4. Coverage Badges

### GitHub Actions Badge
Add to README.md:
```markdown
[![CI](https://github.com/USERNAME/REPO/workflows/CI/badge.svg)](https://github.com/USERNAME/REPO/actions)
```

### Coverage Badge (Alternative)
If not using Codecov, you can create a simple coverage badge:
```markdown
![Coverage](https://img.shields.io/badge/coverage-82%25-brightgreen)
```

## 5. Coverage Configuration

### Vitest Configuration
Located in `vitest.config.ts`:
- **Thresholds**: 80% for all metrics
- **Excludes**: Test files, config files, example files
- **Reporters**: Multiple formats for different uses

### NYC Configuration  
Located in `.nycrc.json`:
- **Backup coverage checking** with nyc
- **Same thresholds** as Vitest (80%)
- **Consistent exclusions**

## 6. Quality Gates Integration

Coverage is integrated into the complete quality gate system:

```bash
# Full quality check (includes coverage)
npm run quality:check

# CI-specific quality checks  
npm run ci:quality
```

## 7. Troubleshooting Coverage

### Low Coverage Issues
1. **Identify uncovered code**:
   ```bash
   npm run test:coverage
   open coverage/html/index.html
   ```

2. **Add missing tests** for uncovered functions/branches

3. **Exclude non-testable code** (if justified):
   ```typescript
   /* istanbul ignore next */
   if (process.env.NODE_ENV === 'test') {
     return mockValue;
   }
   ```

### Coverage Check Failing in CI
1. **Verify local coverage** matches CI
2. **Check for environment differences** (test vs CI)  
3. **Ensure all test files** are being discovered
4. **Review coverage exclusions** in config

### PR Comments Not Showing
1. **Check repository permissions** for GitHub Actions
2. **Verify GITHUB_TOKEN** has write permissions
3. **Ensure cobertura report** is generated
4. **Check workflow file** syntax and job dependencies

## 8. Coverage Monitoring

### Set Up Notifications
1. Configure Codecov to **post status checks**
2. Enable **email notifications** for coverage drops
3. Set up **Slack integration** for coverage reports

### Coverage Trends
- Monitor coverage over time
- Set up alerts for significant drops
- Review coverage in code reviews
- Include coverage goals in project planning

## 9. Advanced Configuration

### Per-File Thresholds
```javascript
// vitest.config.ts
coverage: {
  thresholds: {
    'src/critical/*.ts': {
      branches: 95,
      functions: 95,
      lines: 95,
      statements: 95
    }
  }
}
```

### Custom Reporters
Create custom coverage reporters for specific needs:
- Team dashboards
- Historical tracking  
- Integration with other tools
- Custom notification systems