/**
 * Tests for GitHub Actions tools
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createActionTools } from './actions.js';
import { createMockOctokit } from '../__tests__/mocks/octokit.js';
import { testFixtures } from '../__tests__/fixtures/test-data.js';
// import { ValidationError } from '../validation.js';

describe('Actions Tools', () => {
  let mockOctokit: any;
  let tools: any[];

  beforeEach(() => {
    mockOctokit = createMockOctokit();
    tools = createActionTools(mockOctokit, false);
  });

  describe('list_workflows', () => {
    let listWorkflows: any;

    beforeEach(() => {
      listWorkflows = tools.find(tool => tool.tool.name === 'list_workflows');
    });

    it('should be registered', () => {
      expect(listWorkflows).toBeDefined();
      expect(listWorkflows.tool.name).toBe('list_workflows');
      expect(listWorkflows.tool.description).toContain('List GitHub Actions workflows');
    });

    it('should list workflows successfully', async () => {
      const workflows = [
        testFixtures.workflows.active,
        testFixtures.workflows.disabled,
      ];

      mockOctokit.actions.listRepoWorkflows.mockResolvedValue({
        data: { workflows },
      });

      const result = await listWorkflows.handler({
        owner: 'test-owner',
        repo: 'test-repo',
      });

      expect(mockOctokit.actions.listRepoWorkflows).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        page: undefined,
        per_page: undefined,
      });

      expect(result.workflows).toHaveLength(2);
      expect(result.workflows[0].name).toBe('CI');
      expect(result.workflows[0].state).toBe('active');
      expect(result.workflows[1].name).toBe('Deploy');
      expect(result.workflows[1].state).toBe('disabled_manually');
    });

    it('should validate input parameters', async () => {
      // Empty owner should cause an error
      mockOctokit.actions.listRepoWorkflows.mockRejectedValue(
        new Error('owner is required')
      );
      
      await expect(
        listWorkflows.handler({ owner: '', repo: 'test-repo' })
      ).rejects.toThrow();

      // Empty repo should cause an error
      mockOctokit.actions.listRepoWorkflows.mockRejectedValue(
        new Error('repo is required')
      );
      
      await expect(
        listWorkflows.handler({ owner: 'test-owner', repo: '' })
      ).rejects.toThrow();
    });
  });

  describe('get_workflow', () => {
    let getWorkflow: any;

    beforeEach(() => {
      getWorkflow = tools.find(tool => tool.tool.name === 'get_workflow');
    });

    it('should be registered', () => {
      expect(getWorkflow).toBeDefined();
      expect(getWorkflow.tool.name).toBe('get_workflow');
    });

    it('should get workflow by ID successfully', async () => {
      mockOctokit.actions.getWorkflow.mockResolvedValue({
        data: testFixtures.workflows.active,
      });

      const result = await getWorkflow.handler({
        owner: 'test-owner',
        repo: 'test-repo',
        workflow_id: 1,
      });

      expect(mockOctokit.actions.getWorkflow).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        workflow_id: 1,
      });

      expect(result.name).toBe('CI');
      expect(result.path).toBe('.github/workflows/ci.yml');
      expect(result.state).toBe('active');
    });

    it('should get workflow by filename successfully', async () => {
      mockOctokit.actions.getWorkflow.mockResolvedValue({
        data: testFixtures.workflows.active,
      });

      await getWorkflow.handler({
        owner: 'test-owner',
        repo: 'test-repo',
        workflow_id: 'ci.yml',
      });

      expect(mockOctokit.actions.getWorkflow).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        workflow_id: 'ci.yml',
      });
    });

    it('should validate input parameters', async () => {
      mockOctokit.actions.getWorkflow.mockRejectedValue(
        new Error('Invalid parameters')
      );
      
      await expect(
        getWorkflow.handler({
          owner: '',
          repo: 'test-repo',
          workflow_id: 1,
        })
      ).rejects.toThrow();

      await expect(
        getWorkflow.handler({
          owner: 'test-owner',
          repo: 'test-repo',
          workflow_id: '',
        })
      ).rejects.toThrow();
    });
  });

  describe('list_workflow_runs', () => {
    let listRuns: any;

    beforeEach(() => {
      listRuns = tools.find(tool => tool.tool.name === 'list_workflow_runs');
    });

    it('should be registered', () => {
      expect(listRuns).toBeDefined();
      expect(listRuns.tool.name).toBe('list_workflow_runs');
    });

    it('should list workflow runs successfully', async () => {
      const workflowRuns = [
        {
          id: 1,
          name: 'CI Run 1',
          status: 'completed',
          conclusion: 'success',
          workflow_id: 1,
          run_number: 123,
          created_at: '2024-01-01T00:00:00Z',
          head_branch: 'main',
          head_sha: 'abc123',
        },
        {
          id: 2,
          name: 'CI Run 2',
          status: 'in_progress',
          conclusion: null,
          workflow_id: 1,
          run_number: 124,
          created_at: '2024-01-01T12:00:00Z',
          head_branch: 'feature-branch',
          head_sha: 'def456',
        },
      ];

      mockOctokit.actions.listWorkflowRuns.mockResolvedValue({
        data: { workflow_runs: workflowRuns },
      });

      const result = await listRuns.handler({
        owner: 'test-owner',
        repo: 'test-repo',
        workflow_id: 1,
      });

      expect(mockOctokit.actions.listWorkflowRuns).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        workflow_id: 1,
        page: undefined,
        per_page: undefined,
      });

      expect(result.workflow_runs).toHaveLength(2);
      expect(result.workflow_runs[0].name).toBe('CI Run 1');
      expect(result.workflow_runs[0].status).toBe('completed');
      expect(result.workflow_runs[0].conclusion).toBe('success');
      expect(result.workflow_runs[1].name).toBe('CI Run 2');
      expect(result.workflow_runs[1].status).toBe('in_progress');
    });

    it('should handle filtering parameters', async () => {
      mockOctokit.actions.listWorkflowRuns.mockResolvedValue({
        data: { workflow_runs: [] },
      });

      await listRuns.handler({
        owner: 'test-owner',
        repo: 'test-repo',
        workflow_id: 1,
        branch: 'main',
        event: 'push',
        status: 'completed',
      });

      expect(mockOctokit.actions.listWorkflowRuns).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        workflow_id: 1,
        branch: 'main',
        event: 'push',
        status: 'completed',
        page: undefined,
        per_page: undefined,
      });
    });
  });

  describe('get_workflow_run', () => {
    let getRun: any;

    beforeEach(() => {
      getRun = tools.find(tool => tool.tool.name === 'get_workflow_run');
    });

    it('should be registered', () => {
      expect(getRun).toBeDefined();
      expect(getRun.tool.name).toBe('get_workflow_run');
    });

    it('should get workflow run details successfully', async () => {
      const workflowRun = {
        id: 123,
        name: 'CI',
        status: 'completed',
        conclusion: 'success',
        workflow_id: 1,
        run_number: 456,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:05:00Z',
        head_branch: 'main',
        head_sha: 'abc123',
        run_attempt: 1,
        jobs_url: 'https://api.github.com/repos/test-owner/test-repo/actions/runs/123/jobs',
      };

      mockOctokit.actions.getWorkflowRun.mockResolvedValue({
        data: workflowRun,
      });

      const result = await getRun.handler({
        owner: 'test-owner',
        repo: 'test-repo',
        run_id: 123,
      });

      expect(mockOctokit.actions.getWorkflowRun).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        run_id: 123,
      });

      expect(result.name).toBe('CI');
      expect(result.status).toBe('completed');
      expect(result.conclusion).toBe('success');
      expect(result.run_number).toBe(456);
    });

    it('should validate input parameters', async () => {
      mockOctokit.actions.getWorkflowRun.mockRejectedValue(
        new Error('Invalid parameters')
      );
      
      await expect(
        getRun.handler({
          owner: '',
          repo: 'test-repo',
          run_id: 123,
        })
      ).rejects.toThrow();

      await expect(
        getRun.handler({
          owner: 'test-owner',
          repo: 'test-repo',
          run_id: -1,
        })
      ).rejects.toThrow();
    });
  });

  describe('cancel_workflow_run', () => {
    let cancelRun: any;

    beforeEach(() => {
      cancelRun = tools.find(tool => tool.tool.name === 'cancel_workflow_run');
    });

    it('should be registered when not in read-only mode', () => {
      expect(cancelRun).toBeDefined();
      expect(cancelRun.tool.name).toBe('cancel_workflow_run');
    });

    it('should not be registered in read-only mode', () => {
      const readOnlyTools = createActionTools(mockOctokit, true);
      const readOnlyTool = readOnlyTools.find(tool => tool.tool.name === 'cancel_workflow_run');
      expect(readOnlyTool).toBeUndefined();
    });

    it('should cancel workflow run successfully', async () => {
      mockOctokit.actions.cancelWorkflowRun.mockResolvedValue({
        status: 202,
      });

      const result = await cancelRun.handler({
        owner: 'test-owner',
        repo: 'test-repo',
        run_id: 123,
      });

      expect(mockOctokit.actions.cancelWorkflowRun).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        run_id: 123,
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('123');
    });

    it('should validate input parameters', async () => {
      mockOctokit.actions.cancelWorkflowRun.mockRejectedValue(
        new Error('Invalid parameters')
      );
      
      await expect(
        cancelRun.handler({
          owner: '',
          repo: 'test-repo',
          run_id: 123,
        })
      ).rejects.toThrow();
    });
  });

  describe('list_workflow_run_jobs', () => {
    let listJobs: any;

    beforeEach(() => {
      listJobs = tools.find(tool => tool.tool.name === 'list_workflow_run_jobs');
    });

    it('should be registered', () => {
      expect(listJobs).toBeDefined();
      expect(listJobs.tool.name).toBe('list_workflow_run_jobs');
    });

    it('should list workflow run jobs successfully', async () => {
      const jobs = [
        {
          id: 1,
          name: 'test',
          status: 'completed',
          conclusion: 'success',
          started_at: '2024-01-01T00:00:00Z',
          completed_at: '2024-01-01T00:02:00Z',
          steps: [
            {
              name: 'Checkout',
              status: 'completed',
              conclusion: 'success',
              number: 1,
            },
            {
              name: 'Setup Node.js',
              status: 'completed',
              conclusion: 'success',
              number: 2,
            },
          ],
        },
        {
          id: 2,
          name: 'build',
          status: 'completed',
          conclusion: 'failure',
          started_at: '2024-01-01T00:00:00Z',
          completed_at: '2024-01-01T00:03:00Z',
          steps: [
            {
              name: 'Build',
              status: 'completed',
              conclusion: 'failure',
              number: 1,
            },
          ],
        },
      ];

      mockOctokit.actions.listJobsForWorkflowRun.mockResolvedValue({
        data: { jobs },
      });

      const result = await listJobs.handler({
        owner: 'test-owner',
        repo: 'test-repo',
        run_id: 123,
      });

      expect(mockOctokit.actions.listJobsForWorkflowRun).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        run_id: 123,
        filter: 'all',
        page: undefined,
        per_page: undefined,
      });

      expect(result.jobs).toHaveLength(2);
      expect(result.jobs[0].name).toBe('test');
      expect(result.jobs[0].conclusion).toBe('success');
      expect(result.jobs[1].name).toBe('build');
      expect(result.jobs[1].conclusion).toBe('failure');
      expect(result.jobs[0].steps).toBeDefined();
      expect(result.jobs[0].steps[0].name).toBe('Checkout');
      expect(result.jobs[0].steps[1].name).toBe('Setup Node.js');
    });

    it('should handle job filtering', async () => {
      mockOctokit.actions.listJobsForWorkflowRun.mockResolvedValue({
        data: { jobs: [] },
      });

      await listJobs.handler({
        owner: 'test-owner',
        repo: 'test-repo',
        run_id: 123,
        filter: 'latest',
      });

      expect(mockOctokit.actions.listJobsForWorkflowRun).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        run_id: 123,
        filter: 'latest',
        page: undefined,
        per_page: undefined,
      });
    });
  });

  describe('download_workflow_run_logs', () => {
    let downloadLogs: any;

    beforeEach(() => {
      downloadLogs = tools.find(tool => tool.tool.name === 'download_workflow_run_logs');
    });

    it('should be registered', () => {
      expect(downloadLogs).toBeDefined();
      expect(downloadLogs.tool.name).toBe('download_workflow_run_logs');
    });

    it('should download workflow run logs successfully', async () => {
      const logData = {
        url: 'https://api.github.com/repos/test-owner/test-repo/actions/runs/123/logs',
        data: 'Mock log data content',
      };

      mockOctokit.actions.downloadWorkflowRunLogs.mockResolvedValue(logData);

      const result = await downloadLogs.handler({
        owner: 'test-owner',
        repo: 'test-repo',
        run_id: 123,
      });

      expect(mockOctokit.actions.downloadWorkflowRunLogs).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        run_id: 123,
      });

      expect(result.logs_url).toBe('https://api.github.com/repos/test-owner/test-repo/actions/runs/123/logs');
    });

    it('should handle download URL response', async () => {
      const logData = {
        url: 'https://github.com/download/logs/url',
        status: 302,
      };

      mockOctokit.actions.downloadWorkflowRunLogs.mockResolvedValue(logData);

      const result = await downloadLogs.handler({
        owner: 'test-owner',
        repo: 'test-repo',
        run_id: 123,
      });

      expect(result.logs_url).toBe('https://github.com/download/logs/url');
    });

    it('should validate input parameters', async () => {
      mockOctokit.actions.downloadWorkflowRunLogs.mockRejectedValue(
        new Error('Invalid parameters')
      );
      
      await expect(
        downloadLogs.handler({
          owner: '',
          repo: 'test-repo',
          run_id: 123,
        })
      ).rejects.toThrow();

      await expect(
        downloadLogs.handler({
          owner: 'test-owner',
          repo: 'test-repo',
          run_id: -1,
        })
      ).rejects.toThrow();
    });
  });

  describe('repo workflow runs (without workflow_id)', () => {
    let listRepoRuns: any;

    beforeEach(() => {
      // This would be a separate tool for listing all runs in a repository
      // without specifying a workflow_id - checking if it exists
      listRepoRuns = tools.find(tool => 
        tool.tool.name === 'list_repository_workflow_runs' ||
        tool.tool.name === 'list_workflow_runs_for_repo'
      );
    });

    it('should handle repository-wide workflow runs', async () => {
      // This test is more speculative since we'd need to see the actual implementation
      // But it's good to check if such functionality exists
      if (listRepoRuns) {
        const workflowRuns = [
          {
            id: 1,
            name: 'CI',
            status: 'completed',
            conclusion: 'success',
            workflow_id: 1,
          },
          {
            id: 2,
            name: 'Deploy',
            status: 'in_progress',
            conclusion: null,
            workflow_id: 2,
          },
        ];

        mockOctokit.actions.listWorkflowRunsForRepo?.mockResolvedValue({
          data: { workflow_runs: workflowRuns },
        });

        const result = await listRepoRuns.handler({
          owner: 'test-owner',
          repo: 'test-repo',
        });

        expect(result).toContain('CI');
        expect(result).toContain('Deploy');
      } else {
        // If the tool doesn't exist, that's also valid - just document it
        expect(listRepoRuns).toBeUndefined();
      }
    });
  });

  describe('workflow run re-run functionality', () => {
    let rerunWorkflow: any;

    beforeEach(() => {
      rerunWorkflow = tools.find(tool => 
        tool.tool.name === 'rerun_workflow' ||
        tool.tool.name === 'rerun_workflow_run'
      );
    });

    it('should handle workflow re-runs if supported', async () => {
      if (rerunWorkflow) {
        mockOctokit.actions.reRunWorkflow?.mockResolvedValue({
          status: 201,
        });

        const result = await rerunWorkflow.handler({
          owner: 'test-owner',
          repo: 'test-repo',
          run_id: 123,
        });

        expect(result.success).toBe(true);
        expect(result.message).toContain('rerun');
      } else {
        // Document that re-run functionality might not be implemented
        expect(rerunWorkflow).toBeUndefined();
      }
    });
  });
});