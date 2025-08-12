import { Octokit } from '@octokit/rest';
import { ToolConfig } from '../types.js';
import { GraphQLPaginationHandler, GraphQLPaginationOptions, GraphQLPaginationUtils } from '../graphql-pagination-handler.js';
import {
  validateGraphQLInput,
  validateGraphQLVariableValue,
  ProjectBoardsSchema,
  MilestonesWithIssuesSchema,
  CrossRepoProjectViewSchema,
  GraphQLValidationError
} from '../graphql-validation.js';
import { withErrorHandling } from '../errors.js';

/**
 * Creates GitHub Projects V2 management tools using GraphQL API.
 * 
 * GitHub Projects V2 is a powerful project management system that is only
 * accessible through GraphQL. These tools provide comprehensive project
 * management capabilities including board management, item tracking, and
 * custom field operations.
 * 
 * @param octokit - Configured Octokit instance with GraphQL support
 * @param readOnly - Whether to exclude write operations (create, update, delete)
 * @returns Array of project management tool configurations
 * 
 * @example
 * ```typescript
 * const tools = createProjectManagementTools(octokit, false);
 * // Returns tools: get_project_boards, get_project_items, etc.
 * ```
 * 
 * @see https://docs.github.com/en/issues/planning-and-tracking-with-projects/automating-your-project/using-the-api-to-manage-projects
 */
export function createProjectManagementTools(octokit: Octokit, readOnly: boolean): ToolConfig[] {
  const tools: ToolConfig[] = [];
  const paginationHandler = new GraphQLPaginationHandler(octokit);

  // Get project boards (GitHub Projects V2)
  tools.push({
    tool: {
      name: 'get_project_boards',
      description: 'Get GitHub Projects V2 boards for a repository or organization',
      inputSchema: {
        type: 'object',
        properties: {
          owner: {
            type: 'string',
            description: 'Repository owner or organization',
          },
          repo: {
            type: 'string',
            description: 'Repository name (optional, for repository-specific projects)',
          },
          first: {
            type: 'number',
            description: 'Number of projects to return (max 50)',
            minimum: 1,
            maximum: 50,
          },
        },
        required: ['owner'],
      },
    },
    handler: async (args: any) => {
      // Validate and sanitize input parameters
      const validatedArgs = validateGraphQLInput(ProjectBoardsSchema, args, 'get_project_boards');
      
      const query = validatedArgs.repo ? `
        query($owner: String!, $repo: String!, $first: Int!) {
          repository(owner: $owner, name: $repo) {
            projectsV2(first: $first) {
              totalCount
              nodes {
                id
                number
                title
                shortDescription
                readme
                url
                createdAt
                updatedAt
                closed
                public
                owner {
                  login
                }
                creator {
                  login
                }
                items(first: 20) {
      return withErrorHandling(
        'get_project_boards',
        async () => {
          const query = args.repo ? `
            query($owner: String!, $repo: String!, $first: Int!) {
              repository(owner: $owner, name: $repo) {
                projectsV2(first: $first) {
                  totalCount
                  nodes {
                    id
                    number
                    title
                    shortDescription
                    readme
                    url
                    createdAt
                    updatedAt
                    closed
                    public
                    owner {
                      login
                    }
                    creator {
                      login
                    }
                    items(first: 20) {
                      totalCount
                      nodes {
                        id
                        type
                        content {
                          ... on Issue {
                            number
                            title
                            state
                            url
                          }
                          ... on PullRequest {
                            number
                            title
                            state
                            url
                          }
                          ... on DraftIssue {
                            title
                            body
                          }
                        }
                      }
                    }
                    fields(first: 20) {
                      totalCount
                      nodes {
                        id
                        name
                        dataType
                        ... on ProjectV2SingleSelectField {
                          options {
                            id
                            name
                            color
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          ` : `
            query($owner: String!, $first: Int!) {
              user(login: $owner) {
                projectsV2(first: $first) {
                  totalCount
                  nodes {
                    id
                    number
                    title
                    shortDescription
                    readme
                    url
                    createdAt
                    updatedAt
                    closed
                    public
                    owner {
                      login
                    }
                    creator {
                      login
                    }
                    items(first: 20) {
                      totalCount
                      nodes {
                        id
                        type
                        content {
                          ... on Issue {
                            number
                            title
                            state
                            url
                            repository {
                              nameWithOwner
                            }
                          }
                          ... on PullRequest {
                            number
                            title
                            state
                            url
                            repository {
                              nameWithOwner
                            }
                          }
                          ... on DraftIssue {
                            title
                            body
                          }
                        }
                      }
                    }
                    fields(first: 20) {
                      totalCount
                      nodes {
                        id
                        name
                        dataType
                        ... on ProjectV2SingleSelectField {
                          options {
                            id
                            name
                            color
                          }
                        }
                      }
                    }
                  }
                }
              }
              organization(login: $owner) {
                projectsV2(first: $first) {
                  totalCount
                  nodes {
                    id
                    number
                    title
                    shortDescription
                    readme
                    url
                    createdAt
                    updatedAt
                    closed
                    public
                    owner {
                      login
                    }
                    creator {
                      login
                    }
                    items(first: 20) {
                      totalCount
                      nodes {
                        id
                        type
                        content {
                          ... on Issue {
                            number
                            title
                            state
                            url
                            repository {
                              nameWithOwner
                            }
                          }
                          ... on PullRequest {
                            number
                            title
                            state
                            url
                            repository {
                              nameWithOwner
                            }
                          }
                          ... on DraftIssue {
                            title
                            body
                          }
                        }
                      }
                    }
                    fields(first: 20) {
                      totalCount
                      nodes {
                        id
                        name
                        dataType
                        ... on ProjectV2SingleSelectField {
                          options {
                            id
                            name
                            color
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          `;

      // Validate GraphQL variables before execution
      const variables = {
        owner: validateGraphQLVariableValue(validatedArgs.owner, 'owner'),
        repo: validatedArgs.repo ? validateGraphQLVariableValue(validatedArgs.repo, 'repo') : undefined,
        first: validateGraphQLVariableValue(validatedArgs.first || 25, 'first'),
      };
      
      const result: any = await octokit.graphql(query, variables);

      let projects;
      if (validatedArgs.repo) {
        projects = result.repository?.projectsV2;
      } else {
        // Try user first, then organization
        projects = result.user?.projectsV2 || result.organization?.projectsV2;
      }

      if (!projects) {
        throw new Error(`No projects found for ${validatedArgs.owner}`);
      }
      const result: any = await (octokit as any).graphqlWithComplexity(query, {
        owner: args.owner,
        repo: args.repo,
        first: args.first || 25,
      });
          const result: any = await octokit.graphql(query, {
            owner: args.owner,
            repo: args.repo,
            first: args.first || 25,
          });

          let projects;
          if (args.repo) {
            if (!result.repository) {
              throw new Error(`Repository ${args.owner}/${args.repo} not found`);
            }
            projects = result.repository.projectsV2;
          } else {
            // Try user first, then organization
            projects = result.user?.projectsV2 || result.organization?.projectsV2;
          }

          if (!projects) {
            throw new Error(`No projects found for ${args.owner}`);
          }

          return {
            totalCount: projects.totalCount,
            projects: projects.nodes,
          };
        },
        { tool: 'get_project_boards', owner: args.owner, repo: args.repo }
      );
    },
  });

  // Get milestones with associated issues
  tools.push({
    tool: {
      name: 'get_milestones_with_issues',
      description: 'Get repository milestones with their associated issues and pull requests',
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
          state: {
            type: 'string',
            description: 'Filter by milestone state',
            enum: ['OPEN', 'CLOSED'],
          },
          first: {
            type: 'number',
            description: 'Number of milestones to return (max 25)',
            minimum: 1,
            maximum: 25,
          },
        },
        required: ['owner', 'repo'],
      },
    },
    handler: async (args: any) => {
      // Validate and sanitize input parameters
      const validatedArgs = validateGraphQLInput(MilestonesWithIssuesSchema, args, 'get_milestones_with_issues');
      
      const query = `
        query($owner: String!, $repo: String!, $first: Int!, $state: MilestoneState) {
          repository(owner: $owner, name: $repo) {
            milestones(first: $first, states: [$state], orderBy: {field: CREATED_AT, direction: DESC}) {
              totalCount
              nodes {
                id
                number
                title
                description
                state
                url
                createdAt
                updatedAt
                dueOn
                closedAt
                creator {
                  login
                  avatarUrl
                }
                issues(first: 50) {
      return withErrorHandling(
        'get_milestones_with_issues',
        async () => {
          const query = `
            query($owner: String!, $repo: String!, $first: Int!, $state: MilestoneState) {
              repository(owner: $owner, name: $repo) {
                milestones(first: $first, states: [$state], orderBy: {field: CREATED_AT, direction: DESC}) {
                  totalCount
                  nodes {
                    id
                    number
                    title
                    description
                    state
                    url
                    createdAt
                    updatedAt
                    dueOn
                    closedAt
                    creator {
                      login
                      avatarUrl
                    }
                    issues(first: 50) {
                      totalCount
                      nodes {
                        id
                        number
                        title
                        state
                        url
                        createdAt
                        author {
                          login
                        }
                        labels(first: 10) {
                          nodes {
                            name
                            color
                          }
                        }
                        assignees(first: 5) {
                          nodes {
                            login
                            avatarUrl
                          }
                        }
                      }
                    }
                    pullRequests(first: 50) {
                      totalCount
                      nodes {
                        id
                        number
                        title
                        state
                        url
                        createdAt
                        author {
                          login
                        }
                        labels(first: 10) {
                          nodes {
                            name
                            color
                          }
                        }
                        assignees(first: 5) {
                          nodes {
                            login
                            avatarUrl
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          `;

      // Validate GraphQL variables before execution
      const variables = {
        owner: validateGraphQLVariableValue(validatedArgs.owner, 'owner'),
        repo: validateGraphQLVariableValue(validatedArgs.repo, 'repo'),
        first: validateGraphQLVariableValue(validatedArgs.first || 10, 'first'),
        state: validatedArgs.state ? validateGraphQLVariableValue(validatedArgs.state, 'state') : undefined,
      };
      
      const result: any = await octokit.graphql(query, variables);
      const result: any = await (octokit as any).graphqlWithComplexity(query, {
        owner: args.owner,
        repo: args.repo,
        first: args.first || 10,
        state: args.state,
      });
          const result: any = await octokit.graphql(query, {
            owner: args.owner,
            repo: args.repo,
            first: args.first || 10,
            state: args.state,
          });

          if (!result.repository) {
            throw new Error(`Repository ${args.owner}/${args.repo} not found`);
          }

          const milestones = result.repository.milestones.nodes.map((milestone: any) => {
            const allIssues = milestone.issues.nodes;
            const allPullRequests = milestone.pullRequests.nodes;
            
            // Calculate progress
            const openIssues = allIssues.filter((issue: any) => issue.state === 'OPEN').length;
            const closedIssues = allIssues.filter((issue: any) => issue.state === 'CLOSED').length;
            const openPRs = allPullRequests.filter((pr: any) => pr.state === 'OPEN').length;
            const closedPRs = allPullRequests.filter((pr: any) => ['CLOSED', 'MERGED'].includes(pr.state)).length;
            
            const totalItems = allIssues.length + allPullRequests.length;
            const completedItems = closedIssues + closedPRs;
            const progressPercentage = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

            return {
              ...milestone,
              progress: {
                total: totalItems,
                completed: completedItems,
                percentage: progressPercentage,
                issues: {
                  open: openIssues,
                  closed: closedIssues,
                  total: allIssues.length,
                },
                pullRequests: {
                  open: openPRs,
                  closed: closedPRs,
                  total: allPullRequests.length,
                },
              },
            };
          });

          return {
            totalCount: result.repository.milestones.totalCount,
            milestones,
          };
        },
        { tool: 'get_milestones_with_issues', owner: args.owner, repo: args.repo, state: args.state }
      );
    },
  });

  // Cross-repository project view
  tools.push({
    tool: {
      name: 'get_cross_repo_project_view',
      description: 'Get a unified view of issues and PRs across multiple repositories for project management',
      inputSchema: {
        type: 'object',
        properties: {
          repositories: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                owner: { type: 'string' },
                repo: { type: 'string' },
              },
              required: ['owner', 'repo'],
            },
            description: 'List of repositories to include',
            maxItems: 5,
          },
          labels: {
            type: 'array',
            items: { type: 'string' },
            description: 'Filter by labels (optional)',
          },
          assignee: {
            type: 'string',
            description: 'Filter by assignee (optional)',
          },
          state: {
            type: 'string',
            description: 'Filter by state',
            enum: ['OPEN', 'CLOSED'],
          },
          milestone: {
            type: 'string',
            description: 'Filter by milestone title (optional)',
          },
        },
        required: ['repositories'],
      },
    },
    handler: async (args: any) => {
      // Validate and sanitize input parameters
      const validatedArgs = validateGraphQLInput(CrossRepoProjectViewSchema, args, 'get_cross_repo_project_view');
      
      const repositories = validatedArgs.repositories;
      const results = [];
      return withErrorHandling(
        'get_cross_repo_project_view',
        async () => {
          const repositories = args.repositories;
          const results = [];

          // Query each repository
          for (const repoInfo of repositories) {
            const query = `
              query($owner: String!, $repo: String!, $states: [IssueState!]) {
                repository(owner: $owner, name: $repo) {
                  name
                  nameWithOwner
                  url
                  issues(first: 50, states: $states, orderBy: {field: UPDATED_AT, direction: DESC}) {
                    totalCount
                    nodes {
                      id
                      number
                      title
                      body
                      state
                      url
                      createdAt
                      updatedAt
                      author {
                        login
                        avatarUrl
                      }
                      assignees(first: 5) {
                        nodes {
                          login
                          avatarUrl
                        }
                      }
                      labels(first: 10) {
                        nodes {
                          name
                          color
                        }
                      }
                      milestone {
                        title
                        dueOn
                        state
                      }
                      comments {
                        totalCount
                      }
                      reactions {
                        totalCount
                      }
                    }
                  }
                  pullRequests(first: 50, states: $states, orderBy: {field: UPDATED_AT, direction: DESC}) {
                    totalCount
                    nodes {
                      id
                      number
                      title
                      body
                      state
                      url
                      createdAt
                      updatedAt
                      author {
                        login
                        avatarUrl
                      }
                      assignees(first: 5) {
                        nodes {
                          login
                          avatarUrl
                        }
                      }
                      labels(first: 10) {
                        nodes {
                          name
                          color
                        }
                      }
                      milestone {
                        title
                        dueOn
                        state
                      }
                      reviews(first: 10) {
                        totalCount
                        nodes {
                          state
                          author {
                            login
                          }
                        }
                      }
                      mergeable
                      isDraft
                    }
                  }
                }
              }
            `;

            try {
              const result: any = await octokit.graphql(query, {
                owner: repoInfo.owner,
                repo: repoInfo.repo,
                states: args.state ? [args.state] : ['OPEN'],
              });

              if (!result.repository) {
                throw new Error(`Repository ${repoInfo.owner}/${repoInfo.repo} not found`);
              }

              results.push({
                repository: result.repository,
                issues: result.repository.issues.nodes,
                pullRequests: result.repository.pullRequests.nodes,
              });
            } catch (error) {
              // Log error for this repository but continue with others
              const errorMsg = (error && typeof error === 'object' && 'message' in error) ? (error as any).message : String(error);
              console.warn(`Failed to fetch data for repository ${repoInfo.owner}/${repoInfo.repo}:`, errorMsg);
              results.push({
                repository: {
                  name: repoInfo.repo,
                  nameWithOwner: `${repoInfo.owner}/${repoInfo.repo}`,
                  url: `https://github.com/${repoInfo.owner}/${repoInfo.repo}`,
                  error: `Failed to fetch repository data: ${errorMsg}`,
                },
                issues: [],
                pullRequests: [],
              });
            }
          }

        // Validate GraphQL variables before execution
        const variables = {
          owner: validateGraphQLVariableValue(repoInfo.owner, 'owner'),
          repo: validateGraphQLVariableValue(repoInfo.repo, 'repo'),
          states: validatedArgs.state ? [validateGraphQLVariableValue(validatedArgs.state, 'state')] : ['OPEN'],
        };
        
        const result: any = await octokit.graphql(query, variables);
        const result: any = await (octokit as any).graphqlWithComplexity(query, {
          owner: repoInfo.owner,
          repo: repoInfo.repo,
          states: args.state ? [args.state] : ['OPEN'],
        });
          // Apply filters
          let allIssues: any[] = [];
          let allPullRequests: any[] = [];

          for (const repoResult of results) {
            // Skip repositories with errors
            if (repoResult.repository.error) {
              continue;
            }

            let filteredIssues = repoResult.issues;
            let filteredPRs = repoResult.pullRequests;

            // Filter by labels
            if (args.labels && args.labels.length > 0) {
              filteredIssues = filteredIssues.filter((issue: any) =>
                args.labels.some((label: string) =>
                  issue.labels.nodes.some((issueLabel: any) => issueLabel.name === label)
                )
              );
              filteredPRs = filteredPRs.filter((pr: any) =>
                args.labels.some((label: string) =>
                  pr.labels.nodes.some((prLabel: any) => prLabel.name === label)
                )
              );
            }

        // Filter by labels
        if (validatedArgs.labels && validatedArgs.labels.length > 0) {
          filteredIssues = filteredIssues.filter((issue: any) =>
            validatedArgs.labels.some((label: string) =>
              issue.labels.nodes.some((issueLabel: any) => issueLabel.name === label)
            )
          );
          filteredPRs = filteredPRs.filter((pr: any) =>
            validatedArgs.labels.some((label: string) =>
              pr.labels.nodes.some((prLabel: any) => prLabel.name === label)
            )
          );
        }

        // Filter by assignee
        if (validatedArgs.assignee) {
          filteredIssues = filteredIssues.filter((issue: any) =>
            issue.assignees.nodes.some((assignee: any) => assignee.login === validatedArgs.assignee)
          );
          filteredPRs = filteredPRs.filter((pr: any) =>
            pr.assignees.nodes.some((assignee: any) => assignee.login === validatedArgs.assignee)
          );
        }

        // Filter by milestone
        if (validatedArgs.milestone) {
          filteredIssues = filteredIssues.filter((issue: any) => 
            issue.milestone?.title === validatedArgs.milestone
          );
          filteredPRs = filteredPRs.filter((pr: any) => 
            pr.milestone?.title === validatedArgs.milestone
          );
        }
            // Filter by assignee
            if (args.assignee) {
              filteredIssues = filteredIssues.filter((issue: any) =>
                issue.assignees.nodes.some((assignee: any) => assignee.login === args.assignee)
              );
              filteredPRs = filteredPRs.filter((pr: any) =>
                pr.assignees.nodes.some((assignee: any) => assignee.login === args.assignee)
              );
            }

            // Filter by milestone
            if (args.milestone) {
              filteredIssues = filteredIssues.filter((issue: any) => 
                issue.milestone?.title === args.milestone
              );
              filteredPRs = filteredPRs.filter((pr: any) => 
                pr.milestone?.title === args.milestone
              );
            }

            // Add repository context to each item
            allIssues.push(...filteredIssues.map((issue: any) => ({
              ...issue,
              repository: {
                name: repoResult.repository.name,
                nameWithOwner: repoResult.repository.nameWithOwner,
                url: repoResult.repository.url,
              },
              type: 'issue',
            })));

            allPullRequests.push(...filteredPRs.map((pr: any) => ({
              ...pr,
              repository: {
                name: repoResult.repository.name,
                nameWithOwner: repoResult.repository.nameWithOwner,
                url: repoResult.repository.url,
              },
              type: 'pullRequest',
            })));
          }

          // Combine and sort by updated date
          const allItems = [...allIssues, ...allPullRequests].sort(
            (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
          );

          // Generate summary statistics
          const summary = {
            totalItems: allItems.length,
            totalIssues: allIssues.length,
            totalPullRequests: allPullRequests.length,
            byRepository: results.map(r => ({
              repository: r.repository.nameWithOwner,
              issues: r.issues.length,
              pullRequests: r.pullRequests.length,
              error: r.repository.error,
            })),
            byState: {
              open: allItems.filter(item => item.state === 'OPEN').length,
              closed: allItems.filter(item => ['CLOSED', 'MERGED'].includes(item.state)).length,
            },
            byAssignee: Object.entries(
              allItems.reduce((acc: any, item) => {
                for (const assignee of item.assignees.nodes) {
                  acc[assignee.login] = (acc[assignee.login] || 0) + 1;
                }
                return acc;
              }, {})
            ).map(([login, count]) => ({ login, count }))
              .sort((a: any, b: any) => b.count - a.count),
          };

          return {
            summary,
            items: allItems,
            repositories: results.map(r => ({
              name: r.repository.name,
              nameWithOwner: r.repository.nameWithOwner,
              url: r.repository.url,
              error: r.repository.error,
            })),
          };
        },
        { tool: 'get_cross_repo_project_view', repositories: args.repositories }
      );
    },
  });

  // Get project items with pagination
  tools.push({
    tool: {
      name: 'get_project_items_paginated',
      description: 'Get project items with proper pagination support',
      inputSchema: {
        type: 'object',
        properties: {
          projectId: {
            type: 'string',
            description: 'Project ID (GraphQL Node ID)',
          },
          first: {
            type: 'number',
            description: 'Number of items to return per page (min 1, max 100)',
            minimum: 1,
            maximum: 100,
          },
          after: {
            type: 'string',
            description: 'Cursor for pagination',
          },
          autoPage: {
            type: 'boolean',
            description: 'Automatically paginate through all results',
          },
          maxPages: {
            type: 'number',
            description: 'Maximum number of pages to fetch (default 10)',
            minimum: 1,
          },
          maxItems: {
            type: 'number',
            description: 'Maximum number of items to fetch across all pages',
            minimum: 1,
          },
        },
        required: ['projectId'],
      },
    },
    handler: async (args: any) => {
      try {
        GraphQLPaginationUtils.validatePaginationParams(args);
      } catch (error) {
        throw new Error(`Invalid pagination parameters: ${error.message}`);
      }

      const queryBuilder = paginationHandler.createProjectItemsQuery(args.projectId);

      const paginationOptions: GraphQLPaginationOptions = {
        first: args.first,
        after: args.after,
        autoPage: args.autoPage,
        maxPages: args.maxPages,
        maxItems: args.maxItems,
      };

      const result = await paginationHandler.paginate(queryBuilder, paginationOptions);

      return {
        totalCount: result.totalCount,
        hasNextPage: result.hasMore,
        endCursor: result.nextCursor,
        pageInfo: result.pageInfo,
        items: result.data,
      };
    },
  });

  // Get repository collaborators with pagination
  tools.push({
    tool: {
      name: 'get_collaborators_paginated',
      description: 'Get repository collaborators with comprehensive pagination',
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
          affiliation: {
            type: 'string',
            description: 'Filter by affiliation',
            enum: ['ALL', 'DIRECT', 'OUTSIDE'],
          },
          first: {
            type: 'number',
            description: 'Number of collaborators to return per page (min 1, max 100)',
            minimum: 1,
            maximum: 100,
          },
          after: {
            type: 'string',
            description: 'Cursor for pagination',
          },
          autoPage: {
            type: 'boolean',
            description: 'Automatically paginate through all results',
          },
          maxPages: {
            type: 'number',
            description: 'Maximum number of pages to fetch (default 10)',
            minimum: 1,
          },
          maxItems: {
            type: 'number',
            description: 'Maximum number of items to fetch across all pages',
            minimum: 1,
          },
        },
        required: ['owner', 'repo'],
      },
    },
    handler: async (args: any) => {
      try {
        GraphQLPaginationUtils.validatePaginationParams(args);
      } catch (error) {
        throw new Error(`Invalid pagination parameters: ${error.message}`);
      }

      const queryBuilder = paginationHandler.createCollaboratorsQuery(
        args.owner,
        args.repo,
        args.affiliation
      );

      const paginationOptions: GraphQLPaginationOptions = {
        first: args.first,
        after: args.after,
        autoPage: args.autoPage,
        maxPages: args.maxPages,
        maxItems: args.maxItems,
      };

      const result = await paginationHandler.paginate(queryBuilder, paginationOptions);

      return {
        totalCount: result.totalCount,
        hasNextPage: result.hasMore,
        endCursor: result.nextCursor,
        pageInfo: result.pageInfo,
        collaborators: result.data,
      };
    },
  });

  return tools;
}