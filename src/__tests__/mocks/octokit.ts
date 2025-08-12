/**
 * Octokit mocking utilities for tests
 */
import { vi } from 'vitest';

// Import dynamic test data generators
import { 
  createRepository, 
  createUser, 
  createIssue, 
  createPullRequest, 
  createWorkflow, 
  createCommit, 
  createFile 
} from '../fixtures/test-data.js';

// Dynamic mock responses - regenerated for each test
export const mockResponses = {
  get repo() { return createRepository(); },
  get user() { return createUser(); },
  get issue() { return createIssue(); },
  get pullRequest() { return createPullRequest(); },
  get workflow() { return createWorkflow(); },
  get workflowRun() { 
    return {
      id: Math.floor(Math.random() * 1000000) + 1000,
      name: `Test Run ${Math.random().toString(36).substring(7)}`,
      status: 'completed',
      conclusion: 'success',
      workflow_id: Math.floor(Math.random() * 1000) + 1,
      created_at: new Date().toISOString(),
    };
  },
  get commit() { return createCommit(); },
  get fileContent() { return createFile(); },
};

// Static mock responses for tests that need consistent data
export const staticMockResponses = {
  repo: {
    id: 12345,
    name: 'test-repo',
    full_name: 'test-owner/test-repo',
    owner: { login: 'test-owner', id: 67890 },
    private: false,
    description: 'Test repository',
    default_branch: 'main',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T12:00:00Z',
  },
  user: {
    id: 67890,
    login: 'test-user',
    name: 'Test User',
    email: 'test@example.com',
    created_at: '2024-01-01T00:00:00Z',
  },
  fileContent: {
    content: Buffer.from('Test file content').toString('base64'),
    encoding: 'base64',
    sha: 'file123456',
    path: 'test.txt',
    name: 'test.txt',
    size: 17,
    type: 'file',
  },
};

// Mock Octokit constructor
export const createMockOctokit = () => {
  const mockFn = (returnValue: any) => {
    const fn = vi.fn();
    fn.mockResolvedValue({ data: returnValue });
    return fn;
  };
  
  return {
    repos: {
      get: mockFn(mockResponses.repo),
      listForAuthenticatedUser: mockFn([mockResponses.repo]),
      getContent: mockFn(mockResponses.fileContent),
      createOrUpdateFileContents: mockFn({ content: mockResponses.fileContent, commit: mockResponses.commit }),
      deleteFile: mockFn({ commit: mockResponses.commit }),
      listBranches: mockFn([{ name: 'main', commit: { sha: 'abc123', url: 'test' }, protected: false }]),
      createFork: mockFn(mockResponses.repo),
      listCommits: mockFn([mockResponses.commit]),
      getCommit: mockFn(mockResponses.commit),
      listReleases: vi.fn(),
      createRelease: vi.fn(),
    },
    issues: {
      listForRepo: mockFn([mockResponses.issue]),
      get: mockFn(mockResponses.issue),
      create: mockFn(mockResponses.issue),
      update: mockFn(mockResponses.issue),
      lock: vi.fn().mockResolvedValue({}),
      unlock: vi.fn().mockResolvedValue({}),
      listComments: mockFn([{ id: 1, body: 'Test comment', user: { login: 'test-user' }, created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z', html_url: 'test' }]),
      createComment: mockFn({ id: 1, body: 'Test comment', user: { login: 'test-user' }, created_at: '2024-01-01T00:00:00Z', html_url: 'test' }),
      updateComment: mockFn({ id: 1, body: 'Updated comment', user: { login: 'test-user' }, updated_at: '2024-01-01T00:00:00Z', html_url: 'test' }),
      deleteComment: vi.fn().mockResolvedValue({}),
      addLabels: mockFn([{ name: 'bug', color: 'ff0000', description: 'Bug label' }]),
      removeLabel: vi.fn().mockResolvedValue({}),
      addAssignees: vi.fn(),
      removeAssignees: vi.fn(),
    },
    pulls: {
      list: mockFn([mockResponses.pullRequest]),
      get: mockFn(mockResponses.pullRequest),
      create: mockFn(mockResponses.pullRequest),
      update: mockFn(mockResponses.pullRequest),
      merge: mockFn({ merged: true, message: 'Pull request merged', sha: 'abc123' }),
      listFiles: mockFn([{ filename: 'test.js', status: 'modified', additions: 10, deletions: 5, changes: 15, patch: '@@ test patch @@', sha: 'file123', blob_url: 'test', raw_url: 'test', contents_url: 'test' }]),
      createReview: mockFn({ id: 1, body: 'Test review', state: 'APPROVED', user: { login: 'test-user' }, submitted_at: '2024-01-01T00:00:00Z', html_url: 'test' }),
      listReviews: mockFn([{ id: 1, user: { login: 'test-user' }, body: 'Test review', state: 'APPROVED', submitted_at: '2024-01-01T00:00:00Z', html_url: 'test' }]),
      dismissReview: mockFn({ id: 1, state: 'DISMISSED', user: { login: 'test-user' }, body: 'Test review', submitted_at: '2024-01-01T00:00:00Z', html_url: 'test' }),
      listReviewComments: mockFn([{ id: 1, body: 'Test comment', path: 'test.js', line: 10, side: 'RIGHT', user: { login: 'test-user' }, created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z', html_url: 'test' }]),
      createReviewComment: mockFn({ id: 1, body: 'Test comment', path: 'test.js', line: 10, side: 'RIGHT', user: { login: 'test-user' }, created_at: '2024-01-01T00:00:00Z', html_url: 'test' }),
    },
    actions: {
      listRepoWorkflows: mockFn({ total_count: 1, workflows: [mockResponses.workflow] }),
      getWorkflow: mockFn(mockResponses.workflow),
      listWorkflowRuns: mockFn({ total_count: 1, workflow_runs: [mockResponses.workflowRun] }),
      getWorkflowRun: mockFn(mockResponses.workflowRun),
      cancelWorkflowRun: vi.fn().mockResolvedValue({ status: 202 }),
      listJobsForWorkflowRun: mockFn({ total_count: 1, jobs: [{ id: 1, name: 'test', status: 'completed', conclusion: 'success', started_at: '2024-01-01T00:00:00Z', completed_at: '2024-01-01T00:02:00Z', steps: [{ name: 'Checkout', status: 'completed', conclusion: 'success', number: 1 }] }] }),
      downloadWorkflowRunLogs: vi.fn().mockResolvedValue({ url: 'https://example.com/logs', data: 'Mock log data' }),
      reRunWorkflow: vi.fn().mockResolvedValue({}),
      reRunWorkflowFailedJobs: vi.fn().mockResolvedValue({}),
      deleteWorkflowRunLogs: vi.fn().mockResolvedValue({}),
    },
    codeScanning: {
      listAlertsForRepo: vi.fn(),
      getAlert: vi.fn(),
      updateAlert: vi.fn(),
    },
    secretScanning: {
      listAlertsForRepo: vi.fn(),
      getAlert: vi.fn(),
      updateAlert: vi.fn(),
    },
    dependabot: {
      listAlertsForRepo: vi.fn(),
      getAlert: vi.fn(),
      updateAlert: vi.fn(),
    },
    users: {
      getAuthenticated: vi.fn(),
      getByUsername: vi.fn(),
      listFollowersForUser: vi.fn(),
      listFollowingForUser: vi.fn(),
    },
    orgs: {
      get: vi.fn(),
      list: vi.fn(),
      listMembers: vi.fn(),
      getMembershipForUser: vi.fn(),
    },
    activity: {
      listNotificationsForAuthenticatedUser: vi.fn(),
      markNotificationsAsRead: vi.fn(),
      getThread: vi.fn(),
      markThreadAsRead: vi.fn(),
    },
    search: {
      repos: vi.fn(),
      code: vi.fn(),
      issuesAndPullRequests: vi.fn(),
      users: vi.fn(),
    },
    rest: {
      repos: {
        get: mockFn(mockResponses.repo),
        listForAuthenticatedUser: mockFn([mockResponses.repo]),
        getContent: mockFn(mockResponses.fileContent),
        createOrUpdateFileContents: mockFn({ content: mockResponses.fileContent, commit: mockResponses.commit }),
        deleteFile: mockFn({ commit: mockResponses.commit }),
        listBranches: mockFn([{ name: 'main', commit: { sha: 'abc123', url: 'test' }, protected: false }]),
        createFork: mockFn(mockResponses.repo),
        listCommits: mockFn([mockResponses.commit]),
        getCommit: mockFn(mockResponses.commit),
        listReleases: vi.fn(),
        createRelease: vi.fn(),
      },
      issues: {
        listForRepo: mockFn([mockResponses.issue]),
        get: mockFn(mockResponses.issue),
        create: mockFn(mockResponses.issue),
        update: mockFn(mockResponses.issue),
        lock: vi.fn().mockResolvedValue({}),
        unlock: vi.fn().mockResolvedValue({}),
        listComments: mockFn([{ id: 1, body: 'Test comment', user: { login: 'test-user' }, created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z', html_url: 'test' }]),
        createComment: mockFn({ id: 1, body: 'Test comment', user: { login: 'test-user' }, created_at: '2024-01-01T00:00:00Z', html_url: 'test' }),
        updateComment: mockFn({ id: 1, body: 'Updated comment', user: { login: 'test-user' }, updated_at: '2024-01-01T00:00:00Z', html_url: 'test' }),
        deleteComment: vi.fn().mockResolvedValue({}),
        addLabels: mockFn([{ name: 'bug', color: 'ff0000', description: 'Bug label' }]),
        removeLabel: vi.fn().mockResolvedValue({}),
        addAssignees: vi.fn(),
        removeAssignees: vi.fn(),
      },
      pulls: {
        list: mockFn([mockResponses.pullRequest]),
        get: mockFn(mockResponses.pullRequest),
        create: mockFn(mockResponses.pullRequest),
        update: mockFn(mockResponses.pullRequest),
        merge: mockFn({ merged: true, message: 'Pull request merged', sha: 'abc123' }),
        listFiles: mockFn([{ filename: 'test.js', status: 'modified', additions: 10, deletions: 5, changes: 15, patch: '@@ test patch @@', sha: 'file123', blob_url: 'test', raw_url: 'test', contents_url: 'test' }]),
        createReview: mockFn({ id: 1, body: 'Test review', state: 'APPROVED', user: { login: 'test-user' }, submitted_at: '2024-01-01T00:00:00Z', html_url: 'test' }),
        listReviews: mockFn([{ id: 1, user: { login: 'test-user' }, body: 'Test review', state: 'APPROVED', submitted_at: '2024-01-01T00:00:00Z', html_url: 'test' }]),
        dismissReview: mockFn({ id: 1, state: 'DISMISSED', user: { login: 'test-user' }, body: 'Test review', submitted_at: '2024-01-01T00:00:00Z', html_url: 'test' }),
        listReviewComments: mockFn([{ id: 1, body: 'Test comment', path: 'test.js', line: 10, side: 'RIGHT', user: { login: 'test-user' }, created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z', html_url: 'test' }]),
        createReviewComment: mockFn({ id: 1, body: 'Test comment', path: 'test.js', line: 10, side: 'RIGHT', user: { login: 'test-user' }, created_at: '2024-01-01T00:00:00Z', html_url: 'test' }),
      },
      actions: {
        listRepoWorkflows: mockFn({ total_count: 1, workflows: [mockResponses.workflow] }),
        getWorkflow: mockFn(mockResponses.workflow),
        listWorkflowRuns: mockFn({ total_count: 1, workflow_runs: [mockResponses.workflowRun] }),
        getWorkflowRun: mockFn(mockResponses.workflowRun),
        cancelWorkflowRun: vi.fn().mockResolvedValue({ status: 202 }),
        listJobsForWorkflowRun: mockFn({ total_count: 1, jobs: [{ id: 1, name: 'test', status: 'completed', conclusion: 'success', started_at: '2024-01-01T00:00:00Z', completed_at: '2024-01-01T00:02:00Z', steps: [{ name: 'Checkout', status: 'completed', conclusion: 'success', number: 1 }] }] }),
        downloadWorkflowRunLogs: vi.fn().mockResolvedValue({ url: 'https://example.com/logs', data: 'Mock log data' }),
        reRunWorkflow: vi.fn().mockResolvedValue({}),
        reRunWorkflowFailedJobs: vi.fn().mockResolvedValue({}),
        deleteWorkflowRunLogs: vi.fn().mockResolvedValue({}),
      },
      codeScanning: {
        listAlertsForRepo: vi.fn(),
        getAlert: vi.fn(),
        updateAlert: vi.fn(),
      },
      secretScanning: {
        listAlertsForRepo: vi.fn(),
        getAlert: vi.fn(),
        updateAlert: vi.fn(),
      },
      dependabot: {
        listAlertsForRepo: vi.fn(),
        getAlert: vi.fn(),
        updateAlert: vi.fn(),
      },
      users: {
        getAuthenticated: vi.fn(),
        getByUsername: vi.fn(),
        listFollowersForUser: vi.fn(),
        listFollowingForUser: vi.fn(),
      },
      orgs: {
        get: vi.fn(),
        list: vi.fn(),
        listMembers: vi.fn(),
        getMembershipForUser: vi.fn(),
      },
      activity: {
        listNotificationsForAuthenticatedUser: vi.fn(),
        markNotificationsAsRead: vi.fn(),
        getThread: vi.fn(),
        markThreadAsRead: vi.fn(),
      },
      search: {
        repos: vi.fn(),
        code: vi.fn(),
        issuesAndPullRequests: vi.fn(),
        users: vi.fn(),
      },
    },
    graphql: vi.fn(),
    hook: {
      before: vi.fn(),
      after: vi.fn(),
      error: vi.fn(),
    }
  };
};