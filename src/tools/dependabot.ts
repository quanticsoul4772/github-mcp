import { Octokit } from '@octokit/rest';
import { ToolConfig } from '../types.js';

interface ListDependabotAlertsParams {
  owner: string;
  repo: string;
  state?: string;
  severity?: string;
}

interface GetDependabotAlertParams {
  owner: string;
  repo: string;
  alertNumber: number;
}

interface ListDependabotSecretsParams {
  owner: string;
  repo: string;
  page?: number;
  perPage?: number;
}

interface UpdateDependabotAlertParams {
  owner: string;
  repo: string;
  alertNumber: number;
  state: string;
  dismissed_reason?: string;
  dismissed_comment?: string;
}

interface SetDependabotSecretParams {
  owner: string;
  repo: string;
  secret_name: string;
  encrypted_value: string;
  key_id: string;
}

interface DeleteDependabotSecretParams {
  owner: string;
  repo: string;
  secret_name: string;
}

export function createDependabotTools(octokit: Octokit, readOnly: boolean): ToolConfig[] {
  const tools: ToolConfig[] = [];

  // List Dependabot alerts tool
  tools.push({
    tool: {
      name: 'list_dependabot_alerts',
      description: 'List Dependabot alerts for a repository',
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
            description: 'Filter dependabot alerts by state',
            enum: ['auto_dismissed', 'dismissed', 'fixed', 'open'],
          },
          severity: {
            type: 'string',
            description: 'Filter dependabot alerts by severity',
            enum: ['low', 'medium', 'high', 'critical'],
          },
        },
        required: ['owner', 'repo'],
      },
    },
    handler: async (args: ListDependabotAlertsParams) => {
      try {
        const { data } = await octokit.dependabot.listAlertsForRepo({
          owner: args.owner,
          repo: args.repo,
          state: args.state,
          severity: args.severity,
        });

        return data.map((alert) => ({
          number: alert.number,
          state: alert.state,
          dependency: {
            package: alert.dependency.package,
            manifest_path: alert.dependency.manifest_path,
            scope: alert.dependency.scope,
          },
          security_advisory: {
            ghsa_id: alert.security_advisory.ghsa_id,
            cve_id: alert.security_advisory.cve_id,
            summary: alert.security_advisory.summary,
            description: alert.security_advisory.description,
            severity: alert.security_advisory.severity,
            published_at: alert.security_advisory.published_at,
            updated_at: alert.security_advisory.updated_at,
            withdrawn_at: alert.security_advisory.withdrawn_at,
          },
          security_vulnerability: {
            package: alert.security_vulnerability.package,
            severity: alert.security_vulnerability.severity,
            vulnerable_version_range: alert.security_vulnerability.vulnerable_version_range,
            first_patched_version: alert.security_vulnerability.first_patched_version,
          },
          url: alert.url,
          html_url: alert.html_url,
          created_at: alert.created_at,
          updated_at: alert.updated_at,
          dismissed_at: alert.dismissed_at,
          dismissed_by: alert.dismissed_by ? {
            login: alert.dismissed_by.login,
          } : null,
          dismissed_reason: alert.dismissed_reason,
          dismissed_comment: alert.dismissed_comment,
          fixed_at: alert.fixed_at,
          auto_dismissed_at: alert.auto_dismissed_at,
        }));
      } catch (error: any) {
        if (error.status === 404 || error.status === 403) {
          return {
            error: 'Dependabot alerts not available for this repository or you do not have permission',
          };
        }
        throw error;
      }
    },
  });

  // Get Dependabot alert tool
  tools.push({
    tool: {
      name: 'get_dependabot_alert',
      description: 'Get a specific Dependabot alert',
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
    handler: async (args: GetDependabotAlertParams) => {
      try {
        const { data } = await octokit.dependabot.getAlert({
          owner: args.owner,
          repo: args.repo,
          alert_number: args.alertNumber,
        });

        return {
          number: data.number,
          state: data.state,
          dependency: {
            package: data.dependency.package,
            manifest_path: data.dependency.manifest_path,
            scope: data.dependency.scope,
          },
          security_advisory: {
            ghsa_id: data.security_advisory.ghsa_id,
            cve_id: data.security_advisory.cve_id,
            summary: data.security_advisory.summary,
            description: data.security_advisory.description,
            severity: data.security_advisory.severity,
            identifiers: data.security_advisory.identifiers,
            references: data.security_advisory.references,
            published_at: data.security_advisory.published_at,
            updated_at: data.security_advisory.updated_at,
            withdrawn_at: data.security_advisory.withdrawn_at,
            vulnerabilities: data.security_advisory.vulnerabilities,
            cvss: data.security_advisory.cvss,
            cwes: data.security_advisory.cwes,
          },
          security_vulnerability: {
            package: data.security_vulnerability.package,
            severity: data.security_vulnerability.severity,
            vulnerable_version_range: data.security_vulnerability.vulnerable_version_range,
            first_patched_version: data.security_vulnerability.first_patched_version,
          },
          url: data.url,
          html_url: data.html_url,
          created_at: data.created_at,
          updated_at: data.updated_at,
          dismissed_at: data.dismissed_at,
          dismissed_by: data.dismissed_by ? {
            login: data.dismissed_by.login,
          } : null,
          dismissed_reason: data.dismissed_reason,
          dismissed_comment: data.dismissed_comment,
          fixed_at: data.fixed_at,
          auto_dismissed_at: data.auto_dismissed_at,
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

  // List Dependabot secrets tool
  tools.push({
    tool: {
      name: 'list_dependabot_secrets',
      description: 'List Dependabot secrets for a repository',
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
    handler: async (args: ListDependabotSecretsParams) => {
      try {
        const { data } = await octokit.dependabot.listRepoSecrets({
          owner: args.owner,
          repo: args.repo,
          page: args.page,
          per_page: args.perPage,
        });

        return {
          total_count: data.total_count,
          secrets: data.secrets.map((secret) => ({
            name: secret.name,
            created_at: secret.created_at,
            updated_at: secret.updated_at,
          })),
        };
      } catch (error: any) {
        if (error.status === 404 || error.status === 403) {
          return {
            error: 'Unable to access Dependabot secrets for this repository',
          };
        }
        throw error;
      }
    },
  });

  // Add write operations if not in read-only mode
  if (!readOnly) {
    // Update Dependabot alert tool
    tools.push({
      tool: {
        name: 'update_dependabot_alert',
        description: 'Update a Dependabot alert',
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
              description: 'The state of the Dependabot alert',
              enum: ['dismissed', 'open'],
            },
            dismissed_reason: {
              type: 'string',
              description: 'The reason for dismissing the alert',
              enum: ['fix_started', 'inaccurate', 'no_bandwidth', 'not_used', 'tolerable_risk'],
            },
            dismissed_comment: {
              type: 'string',
              description: 'An optional comment when dismissing',
            },
          },
          required: ['owner', 'repo', 'alertNumber', 'state'],
        },
      },
      handler: async (args: UpdateDependabotAlertParams) => {
        const { data } = await octokit.dependabot.updateAlert({
          owner: args.owner,
          repo: args.repo,
          alert_number: args.alertNumber,
          state: args.state,
          dismissed_reason: args.dismissed_reason,
          dismissed_comment: args.dismissed_comment,
        });

        return {
          number: data.number,
          state: data.state,
          dismissed_at: data.dismissed_at,
          dismissed_by: data.dismissed_by ? {
            login: data.dismissed_by.login,
          } : null,
          dismissed_reason: data.dismissed_reason,
          dismissed_comment: data.dismissed_comment,
          html_url: data.html_url,
        };
      },
    });

    // Create or update Dependabot secret tool
    tools.push({
      tool: {
        name: 'set_dependabot_secret',
        description: 'Create or update a Dependabot secret',
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
            secret_name: {
              type: 'string',
              description: 'The name of the secret',
            },
            encrypted_value: {
              type: 'string',
              description: 'The encrypted value of the secret',
            },
            key_id: {
              type: 'string',
              description: 'The ID of the key used to encrypt the secret',
            },
          },
          required: ['owner', 'repo', 'secret_name', 'encrypted_value', 'key_id'],
        },
      },
      handler: async (args: SetDependabotSecretParams) => {
        await octokit.dependabot.createOrUpdateRepoSecret({
          owner: args.owner,
          repo: args.repo,
          secret_name: args.secret_name,
          encrypted_value: args.encrypted_value,
          key_id: args.key_id,
        });

        return {
          success: true,
          message: `Dependabot secret ${args.secret_name} set successfully`,
        };
      },
    });

    // Delete Dependabot secret tool
    tools.push({
      tool: {
        name: 'delete_dependabot_secret',
        description: 'Delete a Dependabot secret',
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
            secret_name: {
              type: 'string',
              description: 'The name of the secret',
            },
          },
          required: ['owner', 'repo', 'secret_name'],
        },
      },
      handler: async (args: DeleteDependabotSecretParams) => {
        await octokit.dependabot.deleteRepoSecret({
          owner: args.owner,
          repo: args.repo,
          secret_name: args.secret_name,
        });

        return {
          success: true,
          message: `Dependabot secret ${args.secret_name} deleted successfully`,
        };
      },
    });
  }

  return tools;
}
