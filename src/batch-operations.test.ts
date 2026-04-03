/**
 * Tests for batch-operations.ts
 */
import { describe, it, expect, vi } from 'vitest';
import {
  batchExecute,
  batchGetIssuesWithComments,
  batchCheckPermissions,
  batchGetFiles,
  batchUpdateFiles,
} from './batch-operations.js';

// ============================================================================
// batchExecute
// ============================================================================

describe('batchExecute', () => {
  it('should execute all items and return results', async () => {
    const items = [1, 2, 3];
    const results = await batchExecute(items, async (n) => n * 2);
    expect(results).toHaveLength(3);
    expect(results.every(r => r.success)).toBe(true);
    expect(results.map(r => r.data)).toEqual([2, 4, 6]);
  });

  it('should call onProgress callback (line 67)', async () => {
    const onProgress = vi.fn();
    await batchExecute([1, 2], async (n) => n, { onProgress });
    expect(onProgress).toHaveBeenCalled();
    // onProgress(completed, total) - final call should have completed=2, total=2
    expect(onProgress).toHaveBeenCalledWith(expect.any(Number), 2);
  });

  it('should stop on error when stopOnError=true (line 73-74)', async () => {
    const items = [1, 2, 3, 4, 5];
    let callCount = 0;
    const results = await batchExecute(
      items,
      async (n) => {
        callCount++;
        if (n === 1) throw new Error('fail');
        return n;
      },
      { concurrency: 1, stopOnError: true, retryFailures: false }
    );
    // Should have stopped before processing all items
    expect(results.some(r => !r.success)).toBe(true);
    expect(callCount).toBeLessThan(items.length);
  });

  it('should not retry when retryFailures=false (line 45)', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('fail'));
    const results = await batchExecute([1], fn as any, { retryFailures: false });
    expect(results[0].success).toBe(false);
    expect(fn).toHaveBeenCalledTimes(1); // No retries
  });

  it('should handle empty input', async () => {
    const results = await batchExecute([], async (x) => x);
    expect(results).toHaveLength(0);
  });

  it('should handle errors and continue when stopOnError=false', async () => {
    const items = [1, 2, 3];
    const results = await batchExecute(
      items,
      async (n) => {
        if (n === 2) throw new Error('fail on 2');
        return n;
      },
      { retryFailures: false }
    );
    expect(results[0].success).toBe(true);
    expect(results[1].success).toBe(false);
    expect(results[2].success).toBe(true);
  });
});

// ============================================================================
// batchGetIssuesWithComments
// ============================================================================

describe('batchGetIssuesWithComments', () => {
  it('should return issues map from GraphQL response (lines 305-315)', async () => {
    const mockOctokit = {
      graphql: vi.fn().mockResolvedValue({
        repository: {
          issues: {
            nodes: [
              { number: 1, title: 'Issue 1', body: 'Body 1', state: 'open', author: { login: 'user1' }, createdAt: '2024-01-01', updatedAt: '2024-01-02', comments: { nodes: [] } },
              { number: 2, title: 'Issue 2', body: 'Body 2', state: 'closed', author: { login: 'user2' }, createdAt: '2024-01-03', updatedAt: '2024-01-04', comments: { nodes: [] } },
            ],
          },
        },
      }),
    } as any;

    const result = await batchGetIssuesWithComments(mockOctokit, 'owner', 'repo', [1, 2]);
    expect(result.size).toBe(2);
    expect(result.get(1)?.title).toBe('Issue 1');
    expect(result.get(2)?.title).toBe('Issue 2');
  });

  it('should fall back to REST when GraphQL fails (lines 317-340)', async () => {
    const mockOctokit = {
      graphql: vi.fn().mockRejectedValue(new Error('GraphQL failed')),
      issues: {
        get: vi.fn().mockImplementation(({ issue_number }: { issue_number: number }) =>
          Promise.resolve({ data: { number: issue_number, title: `Issue ${issue_number}` } })
        ),
        listComments: vi.fn().mockResolvedValue({ data: [] }),
      },
    } as any;

    const result = await batchGetIssuesWithComments(mockOctokit, 'owner', 'repo', [1, 2]);
    expect(result.size).toBe(2);
    expect(result.get(1)?.title).toBe('Issue 1');
    expect(result.get(2)?.title).toBe('Issue 2');
  });
});

// ============================================================================
// batchCheckPermissions
// ============================================================================

describe('batchCheckPermissions', () => {
  it('should return permissions map for repos (lines 350-373)', async () => {
    const mockOctokit = {
      repos: {
        get: vi.fn().mockResolvedValue({
          data: {
            permissions: { admin: true, push: true, pull: true },
            private: false,
          },
        }),
      },
    } as any;

    const repos = [
      { owner: 'owner1', repo: 'repo1' },
      { owner: 'owner2', repo: 'repo2' },
    ];

    const result = await batchCheckPermissions(mockOctokit, repos);
    expect(result.size).toBe(2);
    expect(result.get('owner1/repo1')?.permissions.admin).toBe(true);
    expect(result.get('owner2/repo2')?.private).toBe(false);
  });

  it('should handle empty repos list', async () => {
    const mockOctokit = { repos: { get: vi.fn() } } as any;
    const result = await batchCheckPermissions(mockOctokit, []);
    expect(result.size).toBe(0);
  });
});

// ============================================================================
// batchGetFiles
// ============================================================================

describe('batchGetFiles', () => {
  it('should fetch files and return content map (lines 110-177)', async () => {
    const mockOctokit = {
      git: {
        getRef: vi.fn().mockResolvedValue({
          data: { object: { sha: 'abc123' } },
        }),
        getTree: vi.fn().mockResolvedValue({
          data: {
            tree: [
              { type: 'blob', path: 'src/index.ts', sha: 'sha1', size: 100 },
              { type: 'blob', path: 'src/utils.ts', sha: 'sha2', size: 200 },
              { type: 'tree', path: 'src', sha: 'treeSha', size: 0 }, // non-blob entry
            ],
          },
        }),
        getBlob: vi.fn().mockImplementation(({ file_sha }: { file_sha: string }) =>
          Promise.resolve({
            data: {
              content: Buffer.from(`content of ${file_sha}`).toString('base64'),
            },
          })
        ),
      },
    } as any;

    const result = await batchGetFiles(
      mockOctokit,
      'owner',
      'repo',
      ['src/index.ts', 'src/utils.ts']
    );

    expect(result.size).toBe(2);
    expect(result.get('src/index.ts')).toContain('content of sha1');
    expect(result.get('src/utils.ts')).toContain('content of sha2');
  });

  it('should use refs/ prefix for getRef when ref starts with refs/', async () => {
    const mockOctokit = {
      git: {
        getRef: vi.fn().mockResolvedValue({
          data: { object: { sha: 'deadbeef' } },
        }),
        getTree: vi.fn().mockResolvedValue({ data: { tree: [] } }),
      },
    } as any;

    await batchGetFiles(mockOctokit, 'owner', 'repo', [], 'refs/heads/main');
    // Should call getRef with 'heads/main' (strips 'refs/')
    expect(mockOctokit.git.getRef).toHaveBeenCalledWith(
      expect.objectContaining({ ref: 'heads/main' })
    );
  });

  it('should add placeholder for large files (lines 172-174)', async () => {
    const LARGE_SIZE = 2 * 1024 * 1024; // 2MB
    const mockOctokit = {
      git: {
        getRef: vi.fn().mockResolvedValue({
          data: { object: { sha: 'abc123' } },
        }),
        getTree: vi.fn().mockResolvedValue({
          data: {
            tree: [
              { type: 'blob', path: 'bigfile.ts', sha: 'bigsha', size: LARGE_SIZE },
            ],
          },
        }),
        getBlob: vi.fn(),
      },
    } as any;

    const result = await batchGetFiles(mockOctokit, 'owner', 'repo', ['bigfile.ts']);
    expect(result.get('bigfile.ts')).toContain('File too large');
    expect(mockOctokit.git.getBlob).not.toHaveBeenCalled();
  });
});

// ============================================================================
// batchUpdateFiles
// ============================================================================

describe('batchUpdateFiles', () => {
  it('should create blobs, tree, commit, and update ref (lines 183-263)', async () => {
    const mockOctokit = {
      git: {
        getRef: vi.fn().mockResolvedValue({
          data: { object: { sha: 'branchSha' } },
        }),
        getCommit: vi.fn().mockResolvedValue({
          data: { tree: { sha: 'treeSha' } },
        }),
        createBlob: vi.fn().mockImplementation(() =>
          Promise.resolve({ data: { sha: 'blobSha' } })
        ),
        createTree: vi.fn().mockResolvedValue({
          data: { sha: 'newTreeSha' },
        }),
        createCommit: vi.fn().mockResolvedValue({
          data: { sha: 'newCommitSha' },
        }),
        updateRef: vi.fn().mockResolvedValue({}),
      },
    } as any;

    const files = [
      { path: 'src/index.ts', content: 'export {}' },
      { path: 'src/utils.ts', content: 'export {}', mode: '100755' },
    ];

    const result = await batchUpdateFiles(
      mockOctokit,
      'owner',
      'repo',
      'main',
      files,
      'feat: batch update'
    );

    expect(result.commit).toBe('newCommitSha');
    expect(result.tree).toBe('newTreeSha');
    expect(mockOctokit.git.createBlob).toHaveBeenCalledTimes(2);
    expect(mockOctokit.git.updateRef).toHaveBeenCalledWith(
      expect.objectContaining({ ref: 'heads/main', sha: 'newCommitSha' })
    );
  });
});
