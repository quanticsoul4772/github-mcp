/**
 * Octokit mocking utilities for tests
 */
import { vi } from 'vitest';

// Mock Octokit constructor
export const createMockOctokit = () => {
  return {
    rest: {
      repos: {
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
      },
      issues: {
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
      },
      pulls: {
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
      },
      actions: {
        listWorkflowRuns: vi.fn(),
        getWorkflowRun: vi.fn(),
        cancelWorkflowRun: vi.fn(),
        listWorkflows: vi.fn(),
        getWorkflow: vi.fn(),
        listJobsForWorkflowRun: vi.fn(),
        downloadWorkflowRunLogs: vi.fn(),
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
        issues: vi.fn(),
        users: vi.fn(),
      },
    },
    graphql: vi.fn(),
  };
};

// Default mock responses
export const mockResponses = {
  repo: {
    id: 1,
    name: 'test-repo',
    full_name: 'test-owner/test-repo',
    owner: { login: 'test-owner' },
    private: false,
    description: 'Test repository',
    default_branch: 'main',
  },
  user: {
    id: 1,
    login: 'test-user',
    name: 'Test User',
    email: 'test@example.com',
  },
  issue: {
    id: 1,
    number: 1,
    title: 'Test Issue',
    body: 'Test issue body',
    state: 'open',
    user: { login: 'test-user' },
    labels: [],
    assignees: [],
  },
  pullRequest: {
    id: 1,
    number: 1,
    title: 'Test PR',
    body: 'Test PR body',
    state: 'open',
    user: { login: 'test-user' },
    head: { ref: 'feature-branch', sha: 'abc123' },
    base: { ref: 'main', sha: 'def456' },
    mergeable: true,
  },
  workflow: {
    id: 1,
    name: 'Test Workflow',
    path: '.github/workflows/test.yml',
    state: 'active',
    created_at: '2024-01-01T00:00:00Z',
  },
  workflowRun: {
    id: 1,
    name: 'Test Run',
    status: 'completed',
    conclusion: 'success',
    workflow_id: 1,
    created_at: '2024-01-01T00:00:00Z',
  },
  commit: {
    sha: 'abc123',
    commit: {
      message: 'Test commit',
      author: {
        name: 'Test User',
        email: 'test@example.com',
        date: '2024-01-01T00:00:00Z',
      },
    },
  },
  fileContent: {
    content: btoa('Test file content'),
    encoding: 'base64',
    sha: 'file123',
    path: 'test.txt',
  },
};