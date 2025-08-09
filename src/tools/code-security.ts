import { Octokit } from '@octokit/rest';
import { ToolConfig } from '../types.js';

export function createCodeSecurityTools(octokit: Octokit, readOnly: boolean): ToolConfig[] {
  const tools: ToolConfig[] = [];

  // List code scanning alerts tool
  tools.push({
    tool: {
      name: 'list_code_scanning_alerts',
      description: 'List code scanning alerts for a repository',
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
            description: 'Filter code scanning alerts by state',
            enum: ['open', 'closed', 'dismissed', 'fixed'],
          },
          ref: {
            type: 'string',
            description: 'The Git reference for the results you want to list',
          },
          tool_name: {
            type: 'string',
            description: 'The name of the tool used for code scanning',
          },
          severity: {
            type: 'string',
            description: 'Filter code scanning alerts by severity',
            enum: ['critical', 'high', 'medium', 'low', 'warning', 'note', 'error'],
          },
        },
        required: ['owner', 'repo'],
      },
    },
    handler: async (args: any) => {
      try {
        const { data } = await octokit.codeScanning.listAlertsForRepo({
          owner: args.owner,
          repo: args.repo,
          state: args.state,
          ref: args.ref,
          tool_name: args.tool_name,
          severity: args.severity,
        });

        return data.map((alert: any) => ({
          number: alert.number,
          state: alert.state,
          rule: {
            id: alert.rule.id,
            severity: alert.rule.severity,
            description: alert.rule.description,
            name: alert.rule.name,
            tags: alert.rule.tags,
          },
          tool: {
            name: alert.tool.name,
            version: alert.tool.version,
          },
          most_recent_instance: alert.most_recent_instance ? {
            ref: alert.most_recent_instance.ref,
            state: alert.most_recent_instance.state,
            location: alert.most_recent_instance.location,
            message: alert.most_recent_instance.message,
          } : null,
          created_at: alert.created_at,
          updated_at: alert.updated_at,
          html_url: alert.html_url,
        }));
      } catch (error: any) {
        if (error.status === 404) {
          return {
            error: 'Code scanning is not enabled for this repository or you do not have permission to view alerts',
          };
        }
        throw error;
      }
    },
  });

  // Get code scanning alert tool
  tools.push({
    tool: {
      name: 'get_code_scanning_alert',
      description: 'Get a specific code scanning alert',
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
    handler: async (args: any) => {
      try {
        const { data } = await octokit.codeScanning.getAlert({
          owner: args.owner,
          repo: args.repo,
          alert_number: args.alertNumber,
        });

        return {
          number: data.number,
          state: data.state,
          dismissed_by: data.dismissed_by ? {
            login: data.dismissed_by.login,
          } : null,
          dismissed_at: data.dismissed_at,
          dismissed_reason: data.dismissed_reason,
          dismissed_comment: data.dismissed_comment,
          rule: {
            id: data.rule.id,
            severity: data.rule.severity,
            description: data.rule.description,
            name: data.rule.name,
            tags: data.rule.tags,
            full_description: data.rule.full_description,
            help: data.rule.help,
          },
          tool: {
            name: data.tool.name,
            version: data.tool.version,
          },
          most_recent_instance: data.most_recent_instance ? {
            ref: data.most_recent_instance.ref,
            state: data.most_recent_instance.state,
            commit_sha: data.most_recent_instance.commit_sha,
            location: data.most_recent_instance.location,
            message: data.most_recent_instance.message,
            classifications: data.most_recent_instance.classifications,
          } : null,
          created_at: data.created_at,
          updated_at: data.updated_at,
          fixed_at: data.fixed_at,
          instances_url: data.instances_url,
          html_url: data.html_url,
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

  // Get repository security advisories
  tools.push({
    tool: {
      name: 'list_repository_security_advisories',
      description: 'List security advisories in a repository',
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
            enum: ['triage', 'draft', 'published', 'closed'],
          },
        },
        required: ['owner', 'repo'],
      },
    },
    handler: async (args: any) => {
      try {
        const { data } = await octokit.securityAdvisories.listRepositoryAdvisories({
          owner: args.owner,
          repo: args.repo,
          state: args.state,
        });

        return data.map((advisory: any) => ({
          ghsa_id: advisory.ghsa_id,
          cve_id: advisory.cve_id,
          summary: advisory.summary,
          description: advisory.description,
          severity: advisory.severity,
          state: advisory.state,
          created_at: advisory.created_at,
          updated_at: advisory.updated_at,
          published_at: advisory.published_at,
          closed_at: advisory.closed_at,
          withdrawn_at: advisory.withdrawn_at,
          vulnerabilities: advisory.vulnerabilities,
          cvss: advisory.cvss,
          cwes: advisory.cwes,
          html_url: advisory.html_url,
        }));
      } catch (error: any) {
        if (error.status === 404 || error.status === 403) {
          return {
            error: 'Security advisories not available for this repository or you do not have permission',
          };
        }
        throw error;
      }
    },
  });

  // Get repository vulnerability alerts
  tools.push({
    tool: {
      name: 'check_vulnerability_alerts',
      description: 'Check if vulnerability alerts are enabled for a repository',
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
        },
        required: ['owner', 'repo'],
      },
    },
    handler: async (args: any) => {
      try {
        await octokit.repos.checkVulnerabilityAlerts({
          owner: args.owner,
          repo: args.repo,
        });

        return {
          enabled: true,
          message: 'Vulnerability alerts are enabled for this repository',
        };
      } catch (error: any) {
        if (error.status === 404) {
          return {
            enabled: false,
            message: 'Vulnerability alerts are not enabled for this repository',
          };
        }
        throw error;
      }
    },
  });

  // Get SARIF upload status
  tools.push({
    tool: {
      name: 'get_sarif_upload',
      description: 'Get information about a SARIF upload',
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
          sarif_id: {
            type: 'string',
            description: 'The SARIF upload ID',
          },
        },
        required: ['owner', 'repo', 'sarif_id'],
      },
    },
    handler: async (args: any) => {
      try {
        const { data } = await octokit.codeScanning.getSarif({
          owner: args.owner,
          repo: args.repo,
          sarif_id: args.sarif_id,
        });

        return {
          status: data.processing_status,
          analyses_url: data.analyses_url,
          errors: data.errors,
        };
      } catch (error: any) {
        if (error.status === 404) {
          return {
            error: 'SARIF upload not found',
          };
        }
        throw error;
      }
    },
  });

  // Add write operations if not in read-only mode
  if (!readOnly) {
    // Update code scanning alert
    tools.push({
      tool: {
        name: 'update_code_scanning_alert',
        description: 'Update a code scanning alert',
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
              description: 'The state to set for the alert',
              enum: ['open', 'dismissed'],
            },
            dismissed_reason: {
              type: 'string',
              description: 'The reason for dismissing the alert',
              enum: ['false positive', 'won\'t fix', 'used in tests', null],
            },
            dismissed_comment: {
              type: 'string',
              description: 'An optional comment when dismissing',
            },
          },
          required: ['owner', 'repo', 'alertNumber', 'state'],
        },
      },
      handler: async (args: any) => {
        const { data } = await octokit.codeScanning.updateAlert({
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
          dismissed_by: data.dismissed_by ? {
            login: data.dismissed_by.login,
          } : null,
          dismissed_at: data.dismissed_at,
          dismissed_reason: data.dismissed_reason,
          dismissed_comment: data.dismissed_comment,
          html_url: data.html_url,
        };
      },
    });

    // Upload SARIF data
    tools.push({
      tool: {
        name: 'upload_sarif',
        description: 'Upload SARIF data for code scanning',
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
            sarif: {
              type: 'string',
              description: 'SARIF data as a string (will be gzipped)',
            },
            ref: {
              type: 'string',
              description: 'The ref to associate results with',
            },
            commit_sha: {
              type: 'string',
              description: 'The commit SHA to associate results with',
            },
            tool_name: {
              type: 'string',
              description: 'The name of the tool used to generate the SARIF',
            },
          },
          required: ['owner', 'repo', 'sarif', 'commit_sha'],
        },
      },
      handler: async (args: any) => {
        const { gzip } = await import('zlib');
        const { promisify } = await import('util');
        const gzipAsync = promisify(gzip);
        
        // Properly gzip the SARIF data as required by GitHub API
        const sarifBuffer = Buffer.from(
          typeof args.sarif === 'string' ? args.sarif : JSON.stringify(args.sarif)
        );
        const gzippedBuffer = await gzipAsync(sarifBuffer);
        const gzippedSarif = gzippedBuffer.toString('base64');

        const { data } = await octokit.codeScanning.uploadSarif({
          owner: args.owner,
          repo: args.repo,
          sarif: gzippedSarif,
          ref: args.ref,
          commit_sha: args.commit_sha,
          tool_name: args.tool_name,
        });

        return {
          id: data.id,
          url: data.url,
        };
      },
    });

    // Enable vulnerability alerts
    tools.push({
      tool: {
        name: 'enable_vulnerability_alerts',
        description: 'Enable vulnerability alerts for a repository',
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
          },
          required: ['owner', 'repo'],
        },
      },
      handler: async (args: any) => {
        await octokit.repos.enableVulnerabilityAlerts({
          owner: args.owner,
          repo: args.repo,
        });

        return {
          success: true,
          message: 'Vulnerability alerts enabled successfully',
        };
      },
    });

    // Disable vulnerability alerts
    tools.push({
      tool: {
        name: 'disable_vulnerability_alerts',
        description: 'Disable vulnerability alerts for a repository',
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
          },
          required: ['owner', 'repo'],
        },
      },
      handler: async (args: any) => {
        await octokit.repos.disableVulnerabilityAlerts({
          owner: args.owner,
          repo: args.repo,
        });

        return {
          success: true,
          message: 'Vulnerability alerts disabled successfully',
        };
      },
    });
  }

  return tools;
}
