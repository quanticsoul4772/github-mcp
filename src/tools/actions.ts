import { Octokit } from '@octokit/rest';
import { ToolConfig } from '../types.js';
import {
  ListWorkflowsParams,
  GetWorkflowParams,
  ListWorkflowRunsParams,
  TriggerWorkflowParams,
  CancelWorkflowRunParams,
  RerunWorkflowParams,
  GetWorkflowRunLogsParams
} from '../tool-types.js';

interface GetWorkflowRunParams {
  owner: string;
  repo: string;
  run_id: number;
}

interface ListWorkflowRunJobsParams {
  owner: string;
  repo: string;
  run_id: number;
  page?: number;
  perPage?: number;
}

interface GetJobLogsParams {
  owner: string;
  repo: string;
  job_id: number;
}

interface ListRepositorySecretsParams {
  owner: string;
  repo: string;
  page?: number;
  perPage?: number;
}

interface CreateRepositorySecretParams {
  owner: string;
  repo: string;
  secret_name: string;
  encrypted_value: string;
  key_id: string;
}

interface DeleteRepositorySecretParams {
  owner: string;
  repo: string;
  secret_name: string;
}

interface ListWorkflowRunsWithFilterParams {
  owner: string;
  repo: string;
  workflow_id: string;
  actor?: string;
  branch?: string;
  event?: string;
  status?: string;
  page?: number;
  perPage?: number;
}

interface ListWorkflowRunArtifactsParams {
  owner: string;
  repo: string;
  run_id: number;
  page?: number;
  perPage?: number;
}

interface GetWorkflowRunUsageParams {
  owner: string;
  repo: string;
  run_id: number;
}

interface RunWorkflowParams {
  owner: string;
  repo: string;
  workflow_id: string;
  ref: string;
  inputs?: object;
}

interface CancelWorkflowRunParams {
  owner: string;
  repo: string;
  run_id: number;
}

interface RerunWorkflowRunParams {
  owner: string;
  repo: string;
  run_id: number;
}

interface RerunFailedJobsParams {
  owner: string;
  repo: string;
  run_id: number;
}

interface DeleteWorkflowRunLogsParams {
  owner: string;
  repo: string;
  run_id: number;
}

export function createActionTools(octokit: Octokit, readOnly: boolean): ToolConfig[] {
  const tools: ToolConfig[] = [];

  // List workflows tool
  tools.push({
    tool: {
      name: 'list_workflows',
      description: 'List GitHub Actions workflows in a repository',
      inputSchema: {
        type: 'object',
        properties: {
          owner: {
            type: 'string',
            description: 'Repository owner',
          },
          repo: {
            type: 'string',
            description: 'Repository name',
          },
          page: {
            type: 'number',
            description: 'Page number for pagination (min 1)',
            minimum: 1,
          },
          perPage: {
            type: 'number',
            description: 'Results per page for pagination (min 1, max 100)',
            minimum: 1,
            maximum: 100,
          },
        },
        required: ['owner', 'repo'],
      },
    },
    handler: async (args: ListWorkflowsParams) => {
      const { data } = await octokit.actions.listRepoWorkflows({
        owner: args.owner,
        repo: args.repo,
        page: args.page,
        per_page: args.perPage,
      });

      return {
        total_count: data.total_count,
        workflows: data.workflows.map((workflow) => ({
          id: workflow.id,
          name: workflow.name,
          path: workflow.path,
          state: workflow.state,
          created_at: workflow.created_at,
          updated_at: workflow.updated_at,
          html_url: workflow.html_url,
          badge_url: workflow.badge_url,
        })),
      };
    },
  });

  // List workflow runs tool
  tools.push({
    tool: {
      name: 'list_workflow_runs',
      description: 'List workflow runs for a specific workflow',
      inputSchema: {
        type: 'object',
        properties: {
          owner: {
            type: 'string',
            description: 'Repository owner',
          },
          repo: {
            type: 'string',
            description: 'Repository name',
          },
          workflow_id: {
            type: 'string',
            description: 'The workflow ID or workflow file name',
          },
          actor: {
            type: 'string',
            description: 'Returns someone\'s workflow runs',
          },
          branch: {
            type: 'string',
            description: 'Returns workflow runs associated with a branch',
          },
          event: {
            type: 'string',
            description: 'Returns workflow runs for a specific event type',
          },
          status: {
            type: 'string',
            description: 'Returns workflow runs with the check run status',
            enum: ['completed', 'action_required', 'cancelled', 'failure', 'neutral', 'skipped', 'stale', 'success', 'timed_out', 'in_progress', 'queued', 'requested', 'waiting'],
          },
          page: {
            type: 'number',
            description: 'Page number for pagination (min 1)',
            minimum: 1,
          },
          perPage: {
            type: 'number',
            description: 'Results per page for pagination (min 1, max 100)',
            minimum: 1,
            maximum: 100,
          },
        },
        required: ['owner', 'repo', 'workflow_id'],
      },
    },
    handler: async (args: ListWorkflowRunsWithFilterParams) => {
      const { data } = await octokit.actions.listWorkflowRuns({
        owner: args.owner,
        repo: args.repo,
        workflow_id: args.workflow_id,
        actor: args.actor,
        branch: args.branch,
        event: args.event,
        status: args.status,
        page: args.page,
        per_page: args.perPage,
      });

      return {
        total_count: data.total_count,
        workflow_runs: data.workflow_runs.map((run) => ({
          id: run.id,
          name: run.name,
          head_branch: run.head_branch,
          head_sha: run.head_sha,
          run_number: run.run_number,
          event: run.event,
          status: run.status,
          conclusion: run.conclusion,
          workflow_id: run.workflow_id,
          created_at: run.created_at,
          updated_at: run.updated_at,
          html_url: run.html_url,
        })),
      };
    },
  });

  // Get workflow run tool
  tools.push({
    tool: {
      name: 'get_workflow_run',
      description: 'Get details of a specific workflow run',
      inputSchema: {
        type: 'object',
        properties: {
          owner: {
            type: 'string',
            description: 'Repository owner',
          },
          repo: {
            type: 'string',
            description: 'Repository name',
          },
          run_id: {
            type: 'number',
            description: 'The unique identifier of the workflow run',
          },
        },
        required: ['owner', 'repo', 'run_id'],
      },
    },
    handler: async (args: GetWorkflowRunParams) => {
      const { data } = await octokit.actions.getWorkflowRun({
        owner: args.owner,
        repo: args.repo,
        run_id: args.run_id,
      });

      return {
        id: data.id,
        name: data.name,
        head_branch: data.head_branch,
        head_sha: data.head_sha,
        run_number: data.run_number,
        event: data.event,
        status: data.status,
        conclusion: data.conclusion,
        workflow_id: data.workflow_id,
        workflow_url: data.workflow_url,
        created_at: data.created_at,
        updated_at: data.updated_at,
        run_started_at: data.run_started_at,
        html_url: data.html_url,
        jobs_url: data.jobs_url,
        logs_url: data.logs_url,
        artifacts_url: data.artifacts_url,
        cancel_url: data.cancel_url,
        rerun_url: data.rerun_url,
      };
    },
  });

  // List workflow jobs tool
  tools.push({
    tool: {
      name: 'list_workflow_jobs',
      description: 'List jobs for a workflow run',
      inputSchema: {
        type: 'object',
        properties: {
          owner: {
            type: 'string',
            description: 'Repository owner',
          },
          repo: {
            type: 'string',
            description: 'Repository name',
          },
          run_id: {
            type: 'number',
            description: 'The unique identifier of the workflow run',
          },
          filter: {
            type: 'string',
            description: 'Filters jobs by their completed_at timestamp',
            enum: ['latest', 'all'],
          },
          page: {
            type: 'number',
            description: 'Page number for pagination (min 1)',
            minimum: 1,
          },
          perPage: {
            type: 'number',
            description: 'Results per page for pagination (min 1, max 100)',
            minimum: 1,
            maximum: 100,
          },
        },
        required: ['owner', 'repo', 'run_id'],
      },
    },
    handler: async (args: ListWorkflowRunJobsParams) => {
      const { data } = await octokit.actions.listJobsForWorkflowRun({
        owner: args.owner,
        repo: args.repo,
        run_id: args.run_id,
        filter: args.filter,
        page: args.page,
        per_page: args.perPage,
      });

      return {
        total_count: data.total_count,
        jobs: data.jobs.map((job) => ({
          id: job.id,
          run_id: job.run_id,
          run_url: job.run_url,
          node_id: job.node_id,
          head_sha: job.head_sha,
          status: job.status,
          conclusion: job.conclusion,
          started_at: job.started_at,
          completed_at: job.completed_at,
          name: job.name,
          steps: job.steps?.map((step) => ({
            name: step.name,
            status: step.status,
            conclusion: step.conclusion,
            number: step.number,
            started_at: step.started_at,
            completed_at: step.completed_at,
          })),
          html_url: job.html_url,
        })),
      };
    },
  });

  // Get job logs tool
  tools.push({
    tool: {
      name: 'get_job_logs',
      description: 'Get logs for a workflow job',
      inputSchema: {
        type: 'object',
        properties: {
          owner: {
            type: 'string',
            description: 'Repository owner',
          },
          repo: {
            type: 'string',
            description: 'Repository name',
          },
          job_id: {
            type: 'number',
            description: 'The unique identifier of the workflow job',
          },
          run_id: {
            type: 'number',
            description: 'Workflow run ID (required when using failed_only)',
          },
          failed_only: {
            type: 'boolean',
            description: 'When true, gets logs for all failed jobs in run_id',
          },
          return_content: {
            type: 'boolean',
            description: 'Returns actual log content instead of URLs',
          },
          tail_lines: {
            type: 'number',
            description: 'Number of lines to return from the end of the log',
          },
        },
        required: ['owner', 'repo'],
      },
    },
    handler: async (args: GetJobLogsParams) => {
      if (args.failed_only && args.run_id) {
        // Get all failed jobs in the run
        const { data: jobsData } = await octokit.actions.listJobsForWorkflowRun({
          owner: args.owner,
          repo: args.repo,
          run_id: args.run_id,
        });

        const failedJobs = jobsData.jobs.filter((job) => 
          job.conclusion === 'failure' || job.status === 'failure'
        );

        const results = [];
        for (const job of failedJobs) {
          try {
            const response = await octokit.actions.downloadJobLogsForWorkflowRun({
              owner: args.owner,
              repo: args.repo,
              job_id: job.id,
            });

            let logContent = response.data;
            if (args.tail_lines && typeof logContent === 'string') {
              const lines = logContent.split('\n');
              logContent = lines.slice(-args.tail_lines).join('\n');
            }

            results.push({
              job_id: job.id,
              job_name: job.name,
              logs: args.return_content ? logContent : response.url,
            });
          } catch (error) {
            results.push({
              job_id: job.id,
              job_name: job.name,
              error: error instanceof Error ? error.message : 'Failed to get logs',
            });
          }
        }
        return results;
      } else if (args.job_id) {
        // Get logs for specific job
        const response = await octokit.actions.downloadJobLogsForWorkflowRun({
          owner: args.owner,
          repo: args.repo,
          job_id: args.job_id,
        });

        let logContent = response.data;
        if (args.tail_lines && typeof logContent === 'string') {
          const lines = logContent.split('\n');
          logContent = lines.slice(-args.tail_lines).join('\n');
        }

        return {
          logs: args.return_content ? logContent : response.url,
        };
      } else {
        throw new Error('Either job_id or (run_id with failed_only) must be provided');
      }
    },
  });

  // Get workflow run logs tool
  tools.push({
    tool: {
      name: 'get_workflow_run_logs',
      description: 'Get logs for a workflow run',
      inputSchema: {
        type: 'object',
        properties: {
          owner: {
            type: 'string',
            description: 'Repository owner',
          },
          repo: {
            type: 'string',
            description: 'Repository name',
          },
          run_id: {
            type: 'number',
            description: 'The unique identifier of the workflow run',
          },
        },
        required: ['owner', 'repo', 'run_id'],
      },
    },
    handler: async (args: GetWorkflowRunLogsParams) => {
      const response = await octokit.actions.downloadWorkflowRunLogs({
        owner: args.owner,
        repo: args.repo,
        run_id: args.run_id,
      });

      return {
        logs_url: response.url,
      };
    },
  });

  // List workflow run artifacts tool
  tools.push({
    tool: {
      name: 'list_workflow_run_artifacts',
      description: 'List artifacts for a workflow run',
      inputSchema: {
        type: 'object',
        properties: {
          owner: {
            type: 'string',
            description: 'Repository owner',
          },
          repo: {
            type: 'string',
            description: 'Repository name',
          },
          run_id: {
            type: 'number',
            description: 'The unique identifier of the workflow run',
          },
          page: {
            type: 'number',
            description: 'Page number for pagination (min 1)',
            minimum: 1,
          },
          perPage: {
            type: 'number',
            description: 'Results per page for pagination (min 1, max 100)',
            minimum: 1,
            maximum: 100,
          },
        },
        required: ['owner', 'repo', 'run_id'],
      },
    },
    handler: async (args: ListWorkflowRunArtifactsParams) => {
      const { data } = await octokit.actions.listWorkflowRunArtifacts({
        owner: args.owner,
        repo: args.repo,
        run_id: args.run_id,
        page: args.page,
        per_page: args.perPage,
      });

      return {
        total_count: data.total_count,
        artifacts: data.artifacts.map((artifact) => ({
          id: artifact.id,
          node_id: artifact.node_id,
          name: artifact.name,
          size_in_bytes: artifact.size_in_bytes,
          url: artifact.url,
          archive_download_url: artifact.archive_download_url,
          expired: artifact.expired,
          created_at: artifact.created_at,
          updated_at: artifact.updated_at,
          expires_at: artifact.expires_at,
        })),
      };
    },
  });

  // Get workflow run usage tool
  tools.push({
    tool: {
      name: 'get_workflow_run_usage',
      description: 'Get usage statistics for a workflow run',
      inputSchema: {
        type: 'object',
        properties: {
          owner: {
            type: 'string',
            description: 'Repository owner',
          },
          repo: {
            type: 'string',
            description: 'Repository name',
          },
          run_id: {
            type: 'number',
            description: 'The unique identifier of the workflow run',
          },
        },
        required: ['owner', 'repo', 'run_id'],
      },
    },
    handler: async (args: GetWorkflowRunUsageParams) => {
      const { data } = await octokit.actions.getWorkflowRunUsage({
        owner: args.owner,
        repo: args.repo,
        run_id: args.run_id,
      });

      return {
        billable: data.billable,
        run_duration_ms: data.run_duration_ms,
      };
    },
  });

  // Add write operations if not in read-only mode
  if (!readOnly) {
    // Run workflow tool
    tools.push({
      tool: {
        name: 'run_workflow',
        description: 'Trigger a workflow run',
        inputSchema: {
          type: 'object',
          properties: {
            owner: {
              type: 'string',
              description: 'Repository owner',
            },
            repo: {
              type: 'string',
              description: 'Repository name',
            },
            workflow_id: {
              type: 'string',
              description: 'The workflow ID or workflow file name',
            },
            ref: {
              type: 'string',
              description: 'The git reference for the workflow',
            },
            inputs: {
              type: 'object',
              description: 'Inputs the workflow accepts',
            },
          },
          required: ['owner', 'repo', 'workflow_id', 'ref'],
        },
      },
      handler: async (args: RunWorkflowParams) => {
        await octokit.actions.createWorkflowDispatch({
          owner: args.owner,
          repo: args.repo,
          workflow_id: args.workflow_id,
          ref: args.ref,
          inputs: args.inputs,
        });

        return {
          success: true,
          message: `Workflow ${args.workflow_id} triggered successfully`,
        };
      },
    });

    // Cancel workflow run tool
    tools.push({
      tool: {
        name: 'cancel_workflow_run',
        description: 'Cancel a workflow run',
        inputSchema: {
          type: 'object',
          properties: {
            owner: {
              type: 'string',
              description: 'Repository owner',
            },
            repo: {
              type: 'string',
              description: 'Repository name',
            },
            run_id: {
              type: 'number',
              description: 'The unique identifier of the workflow run',
            },
          },
          required: ['owner', 'repo', 'run_id'],
        },
      },
      handler: async (args: CancelWorkflowRunParams) => {
        await octokit.actions.cancelWorkflowRun({
          owner: args.owner,
          repo: args.repo,
          run_id: args.run_id,
        });

        return {
          success: true,
          message: `Workflow run ${args.run_id} cancelled successfully`,
        };
      },
    });

    // Rerun workflow run tool
    tools.push({
      tool: {
        name: 'rerun_workflow_run',
        description: 'Rerun a workflow',
        inputSchema: {
          type: 'object',
          properties: {
            owner: {
              type: 'string',
              description: 'Repository owner',
            },
            repo: {
              type: 'string',
              description: 'Repository name',
            },
            run_id: {
              type: 'number',
              description: 'The unique identifier of the workflow run',
            },
          },
          required: ['owner', 'repo', 'run_id'],
        },
      },
      handler: async (args: RerunWorkflowRunParams) => {
        await octokit.actions.reRunWorkflow({
          owner: args.owner,
          repo: args.repo,
          run_id: args.run_id,
        });

        return {
          success: true,
          message: `Workflow run ${args.run_id} rerun initiated successfully`,
        };
      },
    });

    // Rerun failed jobs tool
    tools.push({
      tool: {
        name: 'rerun_failed_jobs',
        description: 'Rerun failed jobs in a workflow run',
        inputSchema: {
          type: 'object',
          properties: {
            owner: {
              type: 'string',
              description: 'Repository owner',
            },
            repo: {
              type: 'string',
              description: 'Repository name',
            },
            run_id: {
              type: 'number',
              description: 'The unique identifier of the workflow run',
            },
          },
          required: ['owner', 'repo', 'run_id'],
        },
      },
      handler: async (args: RerunFailedJobsParams) => {
        await octokit.actions.reRunWorkflowFailedJobs({
          owner: args.owner,
          repo: args.repo,
          run_id: args.run_id,
        });

        return {
          success: true,
          message: `Failed jobs in workflow run ${args.run_id} rerun initiated successfully`,
        };
      },
    });

    // Delete workflow run logs tool
    tools.push({
      tool: {
        name: 'delete_workflow_run_logs',
        description: 'Delete logs for a workflow run',
        inputSchema: {
          type: 'object',
          properties: {
            owner: {
              type: 'string',
              description: 'Repository owner',
            },
            repo: {
              type: 'string',
              description: 'Repository name',
            },
            run_id: {
              type: 'number',
              description: 'The unique identifier of the workflow run',
            },
          },
          required: ['owner', 'repo', 'run_id'],
        },
      },
      handler: async (args: DeleteWorkflowRunLogsParams) => {
        await octokit.actions.deleteWorkflowRunLogs({
          owner: args.owner,
          repo: args.repo,
          run_id: args.run_id,
        });

        return {
          success: true,
          message: `Logs for workflow run ${args.run_id} deleted successfully`,
        };
      },
    });
  }

  return tools;
}
