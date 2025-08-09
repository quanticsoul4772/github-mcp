/**
 * Batch operations for improved performance
 * Handles multiple GitHub API operations efficiently
 */

import { Octokit } from '@octokit/rest';
import { withErrorHandling, withRetry } from './errors.js';

interface BatchResult<T> {
  success: boolean;
  data?: T;
  error?: Error;
  index: number;
  input: any;
}

interface BatchOptions {
  concurrency?: number;
  stopOnError?: boolean;
  retryFailures?: boolean;
  onProgress?: (completed: number, total: number) => void;
}

/**
 * Execute multiple operations in parallel with concurrency control
 */
export async function batchExecute<TInput, TResult>(
  items: TInput[],
  operation: (item: TInput, index: number) => Promise<TResult>,
  options: BatchOptions = {}
): Promise<BatchResult<TResult>[]> {
  const {
    concurrency = 5,
    stopOnError = false,
    retryFailures = true,
    onProgress,
  } = options;

  const results: BatchResult<TResult>[] = [];
  const queue = [...items.map((item, index) => ({ item, index }))];
  const inProgress = new Set<Promise<void>>();
  let completed = 0;
  let shouldStop = false;

  const executeItem = async (item: TInput, index: number) => {
    try {
      const fn = () => operation(item, index);
      const data = retryFailures 
        ? await withRetry(fn, { maxAttempts: 3, backoffMs: 1000 })
        : await fn();
      
      results[index] = {
        success: true,
        data,
        index,
        input: item,
      };
    } catch (error) {
      results[index] = {
        success: false,
        error: error as Error,
        index,
        input: item,
      };
      
      if (stopOnError) {
        shouldStop = true;
      }
    } finally {
      completed++;
      if (onProgress) {
        onProgress(completed, items.length);
      }
    }
  };

  while (queue.length > 0 || inProgress.size > 0) {
    if (shouldStop) {
      break;
    }

    // Start new operations up to concurrency limit
    while (queue.length > 0 && inProgress.size < concurrency && !shouldStop) {
      const { item, index } = queue.shift()!;
      const promise = executeItem(item, index).then(() => {
        inProgress.delete(promise);
      });
      inProgress.add(promise);
    }

    // Wait for at least one operation to complete
    if (inProgress.size > 0) {
      await Promise.race(inProgress);
    }
  }

  // Wait for remaining operations
  await Promise.all(inProgress);

  return results;
}

/**
 * Batch fetch multiple files from a repository using Git Trees API
 * More efficient than individual file fetches
 */
export async function batchGetFiles(
  octokit: Octokit,
  owner: string,
  repo: string,
  paths: string[],
  ref: string = 'HEAD'
): Promise<Map<string, string>> {
  // Get the tree SHA for the ref
  const { data: refData } = await octokit.git.getRef({
    owner,
    repo,
    ref: ref.startsWith('refs/') ? ref.replace('refs/', '') : `heads/${ref}`,
  });

  // Get the tree recursively
  const { data: tree } = await octokit.git.getTree({
    owner,
    repo,
    tree_sha: refData.object.sha,
    recursive: 'true',
  });

  // Create a map of paths to SHAs
  const pathToSha = new Map<string, string>();
  const pathToSize = new Map<string, number>();
  
  for (const item of tree.tree) {
    if (item.type === 'blob' && paths.includes(item.path!)) {
      pathToSha.set(item.path!, item.sha!);
      pathToSize.set(item.path!, item.size!);
    }
  }

  // Batch fetch file contents
  const fileContents = new Map<string, string>();
  const fetchOperations = Array.from(pathToSha.entries()).map(([path, sha]) => ({
    path,
    sha,
    size: pathToSize.get(path) || 0,
  }));

  // Filter out large files (>1MB) to avoid memory issues
  const MAX_FILE_SIZE = 1024 * 1024; // 1MB
  const smallFiles = fetchOperations.filter(op => op.size < MAX_FILE_SIZE);
  const largeFiles = fetchOperations.filter(op => op.size >= MAX_FILE_SIZE);

  // Fetch small files in parallel
  const results = await batchExecute(
    smallFiles,
    async ({ path, sha }) => {
      const { data } = await octokit.git.getBlob({
        owner,
        repo,
        file_sha: sha,
      });
      
      const content = Buffer.from(data.content, 'base64').toString('utf-8');
      return { path, content };
    },
    { concurrency: 10 } // Higher concurrency for small files
  );

  // Process results
  for (const result of results) {
    if (result.success && result.data) {
      fileContents.set(result.data.path, result.data.content);
    }
  }

  // Add placeholders for large files
  for (const { path, size } of largeFiles) {
    fileContents.set(path, `[File too large: ${(size / 1024).toFixed(2)}KB]`);
  }

  return fileContents;
}

/**
 * Batch create or update multiple files in a single commit
 * Uses Git Trees API for efficiency
 */
export async function batchUpdateFiles(
  octokit: Octokit,
  owner: string,
  repo: string,
  branch: string,
  files: Array<{ path: string; content: string; mode?: string }>,
  message: string
): Promise<{ commit: string; tree: string }> {
  // Get the current branch reference
  const { data: ref } = await octokit.git.getRef({
    owner,
    repo,
    ref: `heads/${branch}`,
  });

  // Get the current commit
  const { data: commit } = await octokit.git.getCommit({
    owner,
    repo,
    commit_sha: ref.object.sha,
  });

  // Create blobs for all files
  const blobs = await batchExecute(
    files,
    async (file) => {
      const { data } = await octokit.git.createBlob({
        owner,
        repo,
        content: Buffer.from(file.content).toString('base64'),
        encoding: 'base64',
      });
      return {
        path: file.path,
        sha: data.sha,
        mode: file.mode || '100644', // Default to regular file
      };
    },
    { concurrency: 10 }
  );

  // Filter successful blob creations
  const treeItems = blobs
    .filter(r => r.success && r.data)
    .map(r => ({
      path: r.data!.path,
      mode: r.data!.mode as '100644' | '100755' | '040000' | '160000' | '120000',
      type: 'blob' as const,
      sha: r.data!.sha,
    }));

  // Create a new tree
  const { data: newTree } = await octokit.git.createTree({
    owner,
    repo,
    tree: treeItems,
    base_tree: commit.tree.sha,
  });

  // Create a new commit
  const { data: newCommit } = await octokit.git.createCommit({
    owner,
    repo,
    message,
    tree: newTree.sha,
    parents: [ref.object.sha],
  });

  // Update the branch reference
  await octokit.git.updateRef({
    owner,
    repo,
    ref: `heads/${branch}`,
    sha: newCommit.sha,
  });

  return {
    commit: newCommit.sha,
    tree: newTree.sha,
  };
}

/**
 * Batch fetch issues with comments
 * Reduces API calls by using GraphQL
 */
export async function batchGetIssuesWithComments(
  octokit: Octokit,
  owner: string,
  repo: string,
  issueNumbers: number[]
): Promise<Map<number, any>> {
  const query = `
    query($owner: String!, $repo: String!, $numbers: [Int!]!) {
      repository(owner: $owner, name: $repo) {
        issues(first: 100, filterBy: { numbers: $numbers }) {
          nodes {
            number
            title
            body
            state
            author {
              login
            }
            createdAt
            updatedAt
            comments(first: 100) {
              nodes {
                author {
                  login
                }
                body
                createdAt
              }
            }
          }
        }
      }
    }
  `;

  try {
    const result = await octokit.graphql(query, {
      owner,
      repo,
      numbers: issueNumbers,
    });

    const issues = new Map<number, any>();
    for (const issue of (result as any).repository.issues.nodes) {
      issues.set(issue.number, issue);
    }
    return issues;
  } catch (error) {
    // Fallback to REST API if GraphQL fails
    const issues = new Map<number, any>();
    const results = await batchExecute(
      issueNumbers,
      async (number) => {
        const [issue, comments] = await Promise.all([
          octokit.issues.get({ owner, repo, issue_number: number }),
          octokit.issues.listComments({ owner, repo, issue_number: number }),
        ]);
        return { number, issue: issue.data, comments: comments.data };
      },
      { concurrency: 5 }
    );

    for (const result of results) {
      if (result.success && result.data) {
        issues.set(result.data.number, {
          ...result.data.issue,
          comments: result.data.comments,
        });
      }
    }
    return issues;
  }
}

/**
 * Batch check repository permissions
 */
export async function batchCheckPermissions(
  octokit: Octokit,
  repos: Array<{ owner: string; repo: string }>
): Promise<Map<string, any>> {
  const results = await batchExecute(
    repos,
    async ({ owner, repo }) => {
      const { data } = await octokit.repos.get({ owner, repo });
      return {
        key: `${owner}/${repo}`,
        permissions: data.permissions,
        private: data.private,
      };
    },
    { concurrency: 10 }
  );

  const permissions = new Map<string, any>();
  for (const result of results) {
    if (result.success && result.data) {
      permissions.set(result.data.key, {
        permissions: result.data.permissions,
        private: result.data.private,
      });
    }
  }
  return permissions;
}