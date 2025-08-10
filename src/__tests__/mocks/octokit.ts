/**
 * Octokit mocking utilities for tests
 */
import { vi } from 'vitest';

// Mock Octokit constructor
export const createMockOctokit = () => {
  const reposMock = {
    get: vi.fn(),
    listForAuthenticatedUser: vi.fn(),
    getContent: vi.fn(),
    createOrUpdateFileContents: vi.fn(),
    deleteFile: vi.fn(),
    listBranches: vi.fn(),
    createFork: vi.fn(),
    listCommits: vi.fn(),
    getCommit: vi.fn(),
    listReleases: vi.fn(),
    createRelease: vi.fn(),
  };

  const issuesMock = {
    list: vi.fn(),
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    lock: vi.fn(),
    unlock: vi.fn(),
    listComments: vi.fn(),
    createComment: vi.fn(),
    updateComment: vi.fn(),
    deleteComment: vi.fn(),
    addLabels: vi.fn(),
    removeLabel: vi.fn(),
    addAssignees: vi.fn(),
    removeAssignees: vi.fn(),
  };

  const pullsMock = {
    list: vi.fn(),
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    merge: vi.fn(),
    listFiles: vi.fn(),
    createReview: vi.fn(),
    listReviews: vi.fn(),
    dismissReview: vi.fn(),
    listComments: vi.fn(),
    createReviewComment: vi.fn(),
  };

  const actionsMock = {
    listWorkflowRuns: vi.fn(),
    getWorkflowRun: vi.fn(),
    cancelWorkflowRun: vi.fn(),
    listWorkflows: vi.fn(),
    getWorkflow: vi.fn(),
    listJobsForWorkflowRun: vi.fn(),
    downloadWorkflowRunLogs: vi.fn(),
  };

  const usersMock = {
    getAuthenticated: vi.fn(),
    getByUsername: vi.fn(),
    listFollowersForUser: vi.fn(),
    listFollowingForUser: vi.fn(),
  };

  return {
    // Direct access (used by tools)
    repos: reposMock,
    issues: issuesMock,
    pulls: pullsMock,
    actions: actionsMock,
    users: usersMock,
    
    // Rest API access (for compatibility)
    rest: {
      repos: reposMock,
      issues: issuesMock,
      pulls: pullsMock,
      actions: actionsMock,
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
      users: usersMock,
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
        issues: vi.fn(),
        users: vi.fn(),
      },
    },
    graphql: vi.fn(),
  };
};

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