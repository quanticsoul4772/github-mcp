/**
 * Tests for tool-types type guard functions
 */
import { describe, it, expect } from 'vitest';
import {
  isGetFileContentsParams,
  isCreateIssueParams,
  isCreatePullRequestParams,
} from './tool-types.js';

describe('isGetFileContentsParams', () => {
  it('should return true for valid params', () => {
    expect(isGetFileContentsParams({ owner: 'alice', repo: 'myrepo' })).toBe(true);
  });

  it('should return true with optional fields', () => {
    expect(isGetFileContentsParams({ owner: 'alice', repo: 'myrepo', path: 'src/index.ts', ref: 'main' })).toBe(true);
  });

  it('should return false when owner is missing', () => {
    expect(isGetFileContentsParams({ repo: 'myrepo' })).toBe(false);
  });

  it('should return false when repo is missing', () => {
    expect(isGetFileContentsParams({ owner: 'alice' })).toBe(false);
  });

  it('should return false for non-object', () => {
    expect(isGetFileContentsParams(null)).toBe(false);
    expect(isGetFileContentsParams(42)).toBe(false);
    expect(isGetFileContentsParams('string')).toBe(false);
  });

  it('should return false when owner is not a string', () => {
    expect(isGetFileContentsParams({ owner: 123, repo: 'myrepo' })).toBe(false);
  });

  it('should return false when repo is not a string', () => {
    expect(isGetFileContentsParams({ owner: 'alice', repo: 123 })).toBe(false);
  });
});

describe('isCreateIssueParams', () => {
  it('should return true for valid params', () => {
    expect(isCreateIssueParams({ owner: 'alice', repo: 'myrepo', title: 'Bug' })).toBe(true);
  });

  it('should return false when title is missing', () => {
    expect(isCreateIssueParams({ owner: 'alice', repo: 'myrepo' })).toBe(false);
  });

  it('should return false when owner is missing', () => {
    expect(isCreateIssueParams({ repo: 'myrepo', title: 'Bug' })).toBe(false);
  });

  it('should return false when repo is missing', () => {
    expect(isCreateIssueParams({ owner: 'alice', title: 'Bug' })).toBe(false);
  });

  it('should return false for null', () => {
    expect(isCreateIssueParams(null)).toBe(false);
  });

  it('should return false when title is not a string', () => {
    expect(isCreateIssueParams({ owner: 'alice', repo: 'myrepo', title: 123 })).toBe(false);
  });
});

describe('isCreatePullRequestParams', () => {
  it('should return true for valid params', () => {
    expect(
      isCreatePullRequestParams({
        owner: 'alice',
        repo: 'myrepo',
        title: 'Feature',
        head: 'feature-branch',
        base: 'main',
      })
    ).toBe(true);
  });

  it('should return false when head is missing', () => {
    expect(
      isCreatePullRequestParams({ owner: 'alice', repo: 'myrepo', title: 'Feature', base: 'main' })
    ).toBe(false);
  });

  it('should return false when base is missing', () => {
    expect(
      isCreatePullRequestParams({ owner: 'alice', repo: 'myrepo', title: 'Feature', head: 'branch' })
    ).toBe(false);
  });

  it('should return false when head is not a string', () => {
    expect(
      isCreatePullRequestParams({ owner: 'alice', repo: 'myrepo', title: 'Feature', head: 123, base: 'main' })
    ).toBe(false);
  });

  it('should return false when base is not a string', () => {
    expect(
      isCreatePullRequestParams({ owner: 'alice', repo: 'myrepo', title: 'Feature', head: 'branch', base: 123 })
    ).toBe(false);
  });

  it('should return false for null', () => {
    expect(isCreatePullRequestParams(null)).toBe(false);
  });
});
