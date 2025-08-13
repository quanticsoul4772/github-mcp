# Type Safety Migration Guide

## Overview

This guide provides step-by-step instructions for fixing the critical type safety regression in tool handlers. The issue affects **20+ tool files** that use unsafe `args: any` patterns instead of proper type validation.

## 🚨 Critical Issues Fixed

### Before (Unsafe)
```typescript
handler: async (args: any) => {
  // ❌ No compile-time type checking
  // ❌ No runtime validation
  // ❌ Risk of runtime errors
  const result = await octokit.issues.get({
    owner: args.owner,        // Could be undefined/wrong type
    repo: args.repo,          // Could be undefined/wrong type
    issue_number: args.issue_number  // Could be negative/string
  });
}
```

### After (Type-Safe)
```typescript
// Define proper interface
interface GetIssueParams {
  owner: string;
  repo: string;
  issue_number: number;
}

// Define Zod schema for runtime validation
const GetIssueSchema = z.object({
  owner: z.string().min(1, 'Owner is required'),
  repo: z.string().min(1, 'Repository name is required'),
  issue_number: z.number().int().min(1, 'Issue number must be positive'),
});

// Use type-safe handler
handler: createTypeSafeHandler(
  GetIssueSchema,
  async (params: GetIssueParams) => {
    // ✅ Compile-time type checking
    // ✅ Runtime validation
    // ✅ No risk of runtime errors
    const result = await octokit.issues.get({
      owner: params.owner,        // Guaranteed to be string
      repo: params.repo,          // Guaranteed to be string
      issue_number: params.issue_number  // Guaranteed to be positive number
    });
  },
  'get_issue'
),
```

## 📁 Files Requiring Fixes

### High Priority (Complex GraphQL Tools)
1. `src/tools/advanced-search.ts` - ✅ **FIXED** (example available)
2. `src/tools/batch-operations.ts` - 3 handlers with `args: any`
3. `src/tools/project-management.ts` - 3 handlers with `args: any`
4. `src/tools/repository-insights.ts` - 3 handlers with `args: any`
5. `src/tools/optimized-repositories.ts` - 5 handlers with `args: any`

### Medium Priority (Standard API Tools)
6. `src/tools/pull-requests.ts` - 1 handler with `args: any`
7. `src/tools/issues/get-issue-tool.ts` - 1 handler with `args: any`
8. `src/tools/issues/list-issues-tool.ts` - 1 handler with `args: any`

## 🔧 Step-by-Step Migration Process

### Step 1: Add Required Imports
```typescript
import { z } from 'zod';
import { createTypeSafeHandler } from '../utils/type-safety.js';
```

### Step 2: Define TypeScript Interfaces
```typescript
interface ToolNameParams {
  // Define all parameters with proper types
  owner: string;
  repo: string;
  query?: string;
  page?: number;
  // ... other parameters
}
```

### Step 3: Create Zod Validation Schema
```typescript
const ToolNameSchema = z.object({
  owner: z.string().min(1, 'Owner is required'),
  repo: z.string().min(1, 'Repository name is required'),
  query: z.string().optional(),
  page: z.number().int().min(1).optional(),
  // ... other validations
});
```

### Step 4: Replace Unsafe Handler
```typescript
// BEFORE (unsafe)
handler: async (args: any) => {
  // handler implementation
}

// AFTER (type-safe)
handler: createTypeSafeHandler(
  ToolNameSchema,
  async (params: ToolNameParams) => {
    // Same handler implementation, but with typed params
  },
  'tool_name'
),
```

### Step 5: Update Parameter References
```typescript
// Change all instances of:
args.propertyName

// To:
params.propertyName
```

## 🛠️ Automated Migration

### Using the Migration Script
```bash
# Run the automated migration script
npx tsx scripts/fix-type-safety.ts

# This will:
# 1. Scan all tool files for type safety issues
# 2. Generate *-fixed.ts versions with proper type safety
# 3. Provide a summary of changes needed
```

### Manual Review Required
The automated script provides a starting point, but manual review is needed for:
- Complex parameter structures
- Custom validation logic
- GraphQL query parameters
- Optional parameter handling

## 📋 Validation Patterns

### Common Parameter Types
```typescript
// Repository identification
owner: z.string().min(1, 'Owner is required'),
repo: z.string().min(1, 'Repository name is required'),

// Pagination
page: z.number().int().min(1).optional(),
per_page: z.number().int().min(1).max(100).optional(),

// Search queries
query: z.string().min(1, 'Search query is required'),

// Enums
state: z.enum(['open', 'closed', 'all']).optional(),
sort: z.enum(['created', 'updated', 'popularity']).optional(),

// Arrays
labels: z.array(z.string()).optional(),
assignees: z.array(z.string()).optional(),

// Numbers with constraints
issue_number: z.number().int().min(1, 'Issue number must be positive'),
milestone: z.number().int().optional(),

// Booleans
draft: z.boolean().optional(),
include_metrics: z.boolean().optional(),
```

### Complex Nested Objects
```typescript
// For GraphQL tools with complex parameters
const ComplexSchema = z.object({
  repositories: z.array(z.object({
    owner: z.string(),
    repo: z.string(),
    alias: z.string().optional(),
  })).max(10),
  
  options: z.object({
    includeLanguages: z.boolean().optional(),
    includeContributors: z.boolean().optional(),
    repositoryLimit: z.number().int().min(1).max(25).optional(),
  }).optional(),
});
```

## ✅ Testing Your Changes

### 1. Run Type Safety Tests
```bash
npm test src/__tests__/type-safety/type-safety.test.ts
```

### 2. Test Individual Tools
```bash
# Test specific tool files
npm test src/tools/your-fixed-tool.test.ts
```

### 3. Integration Testing
```bash
# Run all tests to ensure no regressions
npm test
```

### 4. Manual Validation Testing
```typescript
// Test with valid parameters
const validParams = { owner: 'octocat', repo: 'Hello-World', issue_number: 1 };

// Test with invalid parameters (should throw ParameterValidationError)
const invalidParams = { owner: '', repo: 'test' }; // missing issue_number
```

## 🚀 Benefits After Migration

### Compile-Time Safety
- ✅ TypeScript catches type errors during development
- ✅ IDE provides autocomplete and type hints
- ✅ Refactoring is safer with type checking

### Runtime Safety
- ✅ Parameters are validated before handler execution
- ✅ Clear error messages for invalid input
- ✅ No risk of undefined/null property access

### Code Quality
- ✅ Consistent validation patterns across all tools
- ✅ Self-documenting parameter requirements
- ✅ Easier debugging and maintenance

### Security
- ✅ Input validation prevents injection attacks
- ✅ Type safety prevents data corruption
- ✅ Follows security best practices

## 📊 Progress Tracking

### Completion Checklist
- [ ] `src/tools/batch-operations.ts`
- [ ] `src/tools/project-management.ts`
- [ ] `src/tools/repository-insights.ts`
- [ ] `src/tools/optimized-repositories.ts`
- [ ] `src/tools/pull-requests.ts`
- [ ] `src/tools/issues/get-issue-tool.ts`
- [ ] `src/tools/issues/list-issues-tool.ts`
- [x] `src/tools/advanced-search.ts` ✅ **COMPLETED**

### Success Criteria
- [ ] All `args: any` patterns removed
- [ ] All handlers use `createTypeSafeHandler`
- [ ] All tests pass
- [ ] No TypeScript compilation errors
- [ ] Runtime validation working correctly

## 🆘 Common Issues and Solutions

### Issue: Zod Schema Too Strict
```typescript
// Problem: Required field that should be optional
owner: z.string().min(1),

// Solution: Make it optional
owner: z.string().min(1).optional(),
```

### Issue: Complex GraphQL Parameters
```typescript
// Problem: Nested object validation
// Solution: Use nested schemas
const NestedSchema = z.object({
  parent: z.object({
    child: z.string(),
    options: z.array(z.string()).optional(),
  }),
});
```

### Issue: Backward Compatibility
```typescript
// Problem: Existing code expects different parameter names
// Solution: Use transform to maintain compatibility
const CompatibilitySchema = z.object({
  repo_name: z.string(),
}).transform(data => ({
  repo: data.repo_name, // Transform to expected format
}));
```

## 📞 Support

If you encounter issues during migration:

1. **Check the example**: `src/tools/advanced-search-fixed.ts`
2. **Review test cases**: `src/__tests__/type-safety/type-safety.test.ts`
3. **Use the migration script**: `scripts/fix-type-safety.ts`
4. **Follow the patterns**: Use existing type-safe tools as templates

## 🎯 Next Steps

1. **Start with high-priority files** (complex GraphQL tools)
2. **Use the automated migration script** as a starting point
3. **Test each file thoroughly** after migration
4. **Update documentation** to reflect new type-safe patterns
5. **Establish code review guidelines** to prevent future regressions

---

**Remember**: Type safety is not just about preventing errors—it's about creating more maintainable, reliable, and secure code. Every file migrated makes the entire codebase more robust! 🛡️