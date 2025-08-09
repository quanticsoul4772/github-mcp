import { Octokit } from '@octokit/rest';
import { ToolConfig } from '../types.js';

interface ListSecretScanningAlertsParams {
  owner: string;
  repo: string;
  state?: string;
  secret_type?: string;
  resolution?: string;
}

interface GetSecretScanningAlertParams {
  owner: string;
  repo: string;
  alertNumber: number;
}

interface ListSecretScanningAlertLocationsParams {
  owner: string;
  repo: string;
  alertNumber: number;
  page?: number;
  perPage?: number;
}

interface ListOrgSecretScanningAlertsParams {
  org: string;
  state?: string;
  secret_type?: string;
  resolution?: string;
  page?: number;
  perPage?: number;
}

interface UpdateSecretScanningAlertParams {
  owner: string;
  repo: string;
  alertNumber: number;
  state: string;
  resolution?: string;
  resolution_comment?: string;
}

export function createSecretScanningTools(octokit: Octokit, readOnly: boolean): ToolConfig[] {
  const tools: ToolConfig[] = [];

  // List secret scanning alerts tool
  tools.push({
    tool: {
      name: 'list_secret_scanning_alerts',
      description: 'List secret scanning alerts for a repository',
      inputSchema: {
        type: 'object',
        properties: {
          owner: {
            type: 'string',
            description: 'The owner of the repository',
          },
          repo: {
            type: 'string',
            description: 'The name of the repository',
          },
          state: {
            type: 'string',
            description: 'Filter by state',
            enum: ['open', 'resolved'],
          },
          secret_type: {
            type: 'string',
            description: 'A comma-separated list of secret types to return',
          },
          resolution: {
            type: 'string',
            description: 'Filter by resolution',
            enum: ['false_positive', 'wont_fix', 'revoked', 'used_in_tests', 'pattern_deleted', 'pattern_edited'],
          },
        },
        required: ['owner', 'repo'],
      },
    },
    handler: async (args: ListSecretScanningAlertsParams) => {
      try {
        const { data } = await octokit.secretScanning.listAlertsForRepo({
          owner: args.owner,
          repo: args.repo,
          state: args.state,
          secret_type: args.secret_type,
          resolution: args.resolution,
        });

        return data.map((alert) => ({
          number: alert.number,
          created_at: alert.created_at,
          updated_at: alert.updated_at,
          url: alert.url,
          html_url: alert.html_url,
          locations_url: alert.locations_url,
          state: alert.state,
          resolution: alert.resolution,
          resolved_at: alert.resolved_at,
          resolved_by: alert.resolved_by ? {
            login: alert.resolved_by.login,
            type: alert.resolved_by.type,
          } : null,
          resolution_comment: alert.resolution_comment,
          secret_type: alert.secret_type,
          secret_type_display_name: alert.secret_type_display_name,
          secret: alert.secret,
          push_protection_bypassed: alert.push_protection_bypassed,
          push_protection_bypassed_by: alert.push_protection_bypassed_by ? {
            login: alert.push_protection_bypassed_by.login,
            type: alert.push_protection_bypassed_by.type,
          } : null,
          push_protection_bypassed_at: alert.push_protection_bypassed_at,
          validity: alert.validity,
        }));
      } catch (error: any) {
        if (error.status === 404 || error.status === 403) {
          return {
            error: 'Secret scanning is not enabled for this repository or you do not have permission',
          };
        }
        throw error;
      }
    },
  });

  // Get secret scanning alert tool
  tools.push({
    tool: {
      name: 'get_secret_scanning_alert',
      description: 'Get a specific secret scanning alert',
      inputSchema: {
        type: 'object',
        properties: {
          owner: {
            type: 'string',
            description: 'The owner of the repository',
          },
          repo: {
            type: 'string',
            description: 'The name of the repository',
          },
          alertNumber: {
            type: 'number',
            description: 'The number of the alert',
          },
        },
        required: ['owner', 'repo', 'alertNumber'],
      },
    },
    handler: async (args: GetSecretScanningAlertParams) => {
      try {
        const { data } = await octokit.secretScanning.getAlert({
          owner: args.owner,
          repo: args.repo,
          alert_number: args.alertNumber,
        });

        return {
          number: data.number,
          created_at: data.created_at,
          updated_at: data.updated_at,
          url: data.url,
          html_url: data.html_url,
          locations_url: data.locations_url,
          state: data.state,
          resolution: data.resolution,
          resolved_at: data.resolved_at,
          resolved_by: data.resolved_by ? {
            login: data.resolved_by.login,
            type: data.resolved_by.type,
            id: data.resolved_by.id,
          } : null,
          resolution_comment: data.resolution_comment,
          secret_type: data.secret_type,
          secret_type_display_name: data.secret_type_display_name,
          secret: data.secret,
          push_protection_bypassed: data.push_protection_bypassed,
          push_protection_bypassed_by: data.push_protection_bypassed_by ? {
            login: data.push_protection_bypassed_by.login,
            type: data.push_protection_bypassed_by.type,
            id: data.push_protection_bypassed_by.id,
          } : null,
          push_protection_bypassed_at: data.push_protection_bypassed_at,
          validity: data.validity,
        };
      } catch (error: any) {
        if (error.status === 404) {
          return {
            error: 'Alert not found or you do not have permission to view it',
          };
        }
        throw error;
      }
    },
  });

  // List secret scanning alert locations tool
  tools.push({
    tool: {
      name: 'list_secret_scanning_alert_locations',
      description: 'List locations for a secret scanning alert',
      inputSchema: {
        type: 'object',
        properties: {
          owner: {
            type: 'string',
            description: 'The owner of the repository',
          },
          repo: {
            type: 'string',
            description: 'The name of the repository',
          },
          alertNumber: {
            type: 'number',
            description: 'The number of the alert',
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
        required: ['owner', 'repo', 'alertNumber'],
      },
    },
    handler: async (args: ListSecretScanningAlertLocationsParams) => {
      try {
        const { data } = await octokit.secretScanning.listLocationsForAlert({
          owner: args.owner,
          repo: args.repo,
          alert_number: args.alertNumber,
          page: args.page,
          per_page: args.perPage,
        });

        return data.map((location) => ({
          type: location.type,
          details: location.details,
        }));
      } catch (error: any) {
        if (error.status === 404) {
          return {
            error: 'Alert not found or you do not have permission to view locations',
          };
        }
        throw error;
      }
    },
  });

  // List secret scanning alerts for organization
  tools.push({
    tool: {
      name: 'list_org_secret_scanning_alerts',
      description: 'List secret scanning alerts for an organization',
      inputSchema: {
        type: 'object',
        properties: {
          org: {
            type: 'string',
            description: 'The organization name',
          },
          state: {
            type: 'string',
            description: 'Filter by state',
            enum: ['open', 'resolved'],
          },
          secret_type: {
            type: 'string',
            description: 'A comma-separated list of secret types to return',
          },
          resolution: {
            type: 'string',
            description: 'Filter by resolution',
            enum: ['false_positive', 'wont_fix', 'revoked', 'used_in_tests', 'pattern_deleted', 'pattern_edited'],
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
        required: ['org'],
      },
    },
    handler: async (args: ListOrgSecretScanningAlertsParams) => {
      try {
        const { data } = await octokit.secretScanning.listAlertsForOrg({
          org: args.org,
          state: args.state,
          secret_type: args.secret_type,
          resolution: args.resolution,
          page: args.page,
          per_page: args.perPage,
        });

        return data.map((alert) => ({
          number: alert.number,
          created_at: alert.created_at,
          updated_at: alert.updated_at,
          url: alert.url,
          html_url: alert.html_url,
          locations_url: alert.locations_url,
          state: alert.state,
          resolution: alert.resolution,
          resolved_at: alert.resolved_at,
          resolved_by: alert.resolved_by ? {
            login: alert.resolved_by.login,
            type: alert.resolved_by.type,
          } : null,
          secret_type: alert.secret_type,
          secret_type_display_name: alert.secret_type_display_name,
          repository: {
            name: alert.repository.name,
            full_name: alert.repository.full_name,
            owner: {
              login: alert.repository.owner.login,
            },
          },
          push_protection_bypassed: alert.push_protection_bypassed,
          push_protection_bypassed_by: alert.push_protection_bypassed_by ? {
            login: alert.push_protection_bypassed_by.login,
          } : null,
          validity: alert.validity,
        }));
      } catch (error: any) {
        if (error.status === 404 || error.status === 403) {
          return {
            error: 'Unable to access organization secret scanning alerts',
          };
        }
        throw error;
      }
    },
  });

  // Add write operations if not in read-only mode
  if (!readOnly) {
    // Update secret scanning alert tool
    tools.push({
      tool: {
        name: 'update_secret_scanning_alert',
        description: 'Update a secret scanning alert',
        inputSchema: {
          type: 'object',
          properties: {
            owner: {
              type: 'string',
              description: 'The owner of the repository',
            },
            repo: {
              type: 'string',
              description: 'The name of the repository',
            },
            alertNumber: {
              type: 'number',
              description: 'The number of the alert',
            },
            state: {
              type: 'string',
              description: 'Sets the state of the secret scanning alert',
              enum: ['open', 'resolved'],
            },
            resolution: {
              type: 'string',
              description: 'Resolution when marking as resolved',
              enum: ['false_positive', 'wont_fix', 'revoked', 'used_in_tests', null],
            },
            resolution_comment: {
              type: 'string',
              description: 'An optional comment when resolving',
            },
          },
          required: ['owner', 'repo', 'alertNumber', 'state'],
        },
      },
      handler: async (args: UpdateSecretScanningAlertParams) => {
        const { data } = await octokit.secretScanning.updateAlert({
          owner: args.owner,
          repo: args.repo,
          alert_number: args.alertNumber,
          state: args.state,
          resolution: args.resolution,
          resolution_comment: args.resolution_comment,
        });

        return {
          number: data.number,
          state: data.state,
          resolution: data.resolution,
          resolved_at: data.resolved_at,
          resolved_by: data.resolved_by ? {
            login: data.resolved_by.login,
          } : null,
          resolution_comment: data.resolution_comment,
          html_url: data.html_url,
        };
      },
    });
  }

  return tools;
}
