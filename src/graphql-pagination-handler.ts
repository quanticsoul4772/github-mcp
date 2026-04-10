/**
 * Advanced GraphQL pagination handling for GitHub API responses
 * Provides efficient cursor-based pagination with auto-pagination support
 */

import { Octokit } from '@octokit/rest';
import { logger } from './logger.js';

export interface GraphQLPaginationOptions {
  first?: number;
  after?: string;
  maxPages?: number;
  maxItems?: number;
  autoPage?: boolean;
  onProgress?: (current: number, total?: number) => void;
}

export interface GraphQLPageInfo {
  hasNextPage: boolean;
  endCursor?: string;
  hasPreviousPage?: boolean;
  startCursor?: string;
}

export interface GraphQLPaginatedResult<T> {
  nodes: T[];
  edges?: Array<{ node: T; cursor: string }>;
  pageInfo: GraphQLPageInfo;
  totalCount?: number;
}

export interface GraphQLPaginationResponse<T> {
  data: T[];
  pageInfo: GraphQLPageInfo;
  totalCount?: number;
  hasMore: boolean;
  nextCursor?: string;
}

export interface GraphQLQueryBuilder {
  query: string;
  variables: Record<string, unknown>;
  extractData: (result: Record<string, unknown>) => GraphQLPaginatedResult<unknown>;
}

/**
 * GraphQL-specific pagination handler for GitHub API
 */
export class GraphQLPaginationHandler {
  private readonly defaultFirst: number = 100;
  private readonly defaultMaxPages: number = 10;

  constructor(private octokit: Octokit) {}

  /**
   * Execute a paginated GraphQL query
   */
  async paginate<T>(
    queryBuilder: GraphQLQueryBuilder,
    options: GraphQLPaginationOptions = {}
  ): Promise<GraphQLPaginationResponse<T>> {
    const {
      first = this.defaultFirst,
      after,
      autoPage = false,
    } = options;

    if (autoPage) {
      return this.autoPaginate<T>(queryBuilder, options);
    }

    // Single page query
    const variables = {
      ...queryBuilder.variables,
      first,
      after,
    };

    const result = await this.octokit.graphql(queryBuilder.query, variables) as Record<string, unknown>;
    const extracted = queryBuilder.extractData(result);

    return {
      data: (extracted.nodes || extracted.edges?.map(e => e.node) || []) as T[],
      pageInfo: extracted.pageInfo,
      totalCount: extracted.totalCount,
      hasMore: extracted.pageInfo.hasNextPage,
      nextCursor: extracted.pageInfo.endCursor,
    };
  }

  /**
   * Auto-paginate through all results
   */
  async autoPaginate<T>(
    queryBuilder: GraphQLQueryBuilder,
    options: GraphQLPaginationOptions = {}
  ): Promise<GraphQLPaginationResponse<T>> {
    const {
      first = this.defaultFirst,
      maxPages = this.defaultMaxPages,
      maxItems,
      onProgress,
    } = options;

    const allData: T[] = [];
    let currentCursor: string | undefined = options.after;
    let page = 1;
    let totalCount: number | undefined;
    let lastPageInfo: GraphQLPageInfo | undefined;

    while (page <= maxPages) {
      if (maxItems && allData.length >= maxItems) {
        break;
      }

      const variables = {
        ...queryBuilder.variables,
        first: maxItems && allData.length + first > maxItems ? maxItems - allData.length : first,
        after: currentCursor,
      };

      try {
        const result = await this.octokit.graphql(queryBuilder.query, variables) as Record<string, unknown>;
        const extracted = queryBuilder.extractData(result);

        const pageData = (extracted.nodes || extracted.edges?.map(e => e.node) || []) as T[];

        // Respect maxItems limit
        if (maxItems) {
          const remaining = maxItems - allData.length;
          allData.push(...pageData.slice(0, remaining));
        } else {
          allData.push(...pageData);
        }

        lastPageInfo = extracted.pageInfo;
        totalCount = extracted.totalCount;
        currentCursor = extracted.pageInfo.endCursor;

        if (onProgress) {
          onProgress(allData.length, totalCount);
        }

        if (!extracted.pageInfo.hasNextPage || pageData.length === 0) {
          break;
        }

        page++;
      } catch (error) {
        logger.error(`Error fetching page ${page}`, { page, error: error instanceof Error ? error.message : String(error) });
        break;
      }
    }

    return {
      data: allData,
      pageInfo: lastPageInfo ?? { hasNextPage: false },
      totalCount,
      hasMore: lastPageInfo?.hasNextPage ?? false,
      nextCursor: lastPageInfo?.endCursor,
    };
  }

  /**
   * Create paginated query builder for discussions
   */
  createDiscussionsQuery(owner: string, repo: string, categoryId?: string): GraphQLQueryBuilder {
    return {
      query: `
        query($owner: String!, $repo: String!, $first: Int!, $after: String, $categoryId: ID) {
          repository(owner: $owner, name: $repo) {
            discussions(first: $first, after: $after, categoryId: $categoryId) {
              totalCount
              pageInfo {
                hasNextPage
                endCursor
                hasPreviousPage
                startCursor
              }
              nodes {
                id
                number
                title
                body
                createdAt
                updatedAt
                author {
                  login
                }
                category {
                  id
                  name
                  slug
                }
                comments {
                  totalCount
                }
                upvoteCount
                url
              }
            }
          }
        }
      `,
      variables: { owner, repo, categoryId },
      extractData: (result: Record<string, unknown>) => (result['repository'] as Record<string, unknown>)['discussions'] as GraphQLPaginatedResult<unknown>,
    };
  }

  /**
   * Create paginated query builder for discussion comments
   */
  createDiscussionCommentsQuery(
    owner: string,
    repo: string,
    discussionNumber: number
  ): GraphQLQueryBuilder {
    return {
      query: `
        query($owner: String!, $repo: String!, $number: Int!, $first: Int!, $after: String) {
          repository(owner: $owner, name: $repo) {
            discussion(number: $number) {
              comments(first: $first, after: $after) {
                totalCount
                pageInfo {
                  hasNextPage
                  endCursor
                  hasPreviousPage
                  startCursor
                }
                nodes {
                  id
                  body
                  bodyHTML
                  createdAt
                  updatedAt
                  author {
                    login
                    avatarUrl
                  }
                  upvoteCount
                  viewerHasUpvoted
                  viewerCanUpvote
                  viewerCanDelete
                  viewerCanUpdate
                  replies(first: 5) {
                    totalCount
                    nodes {
                      id
                      body
                      createdAt
                      author {
                        login
                      }
                    }
                  }
                }
              }
            }
          }
        }
      `,
      variables: { owner, repo, number: discussionNumber },
      extractData: (result: Record<string, unknown>) => ((result['repository'] as Record<string, unknown>)['discussion'] as Record<string, unknown>)['comments'] as GraphQLPaginatedResult<unknown>,
    };
  }

  /**
   * Create paginated query builder for project items
   */
  createProjectItemsQuery(projectId: string): GraphQLQueryBuilder {
    return {
      query: `
        query($projectId: ID!, $first: Int!, $after: String) {
          node(id: $projectId) {
            ... on ProjectV2 {
              items(first: $first, after: $after) {
                totalCount
                pageInfo {
                  hasNextPage
                  endCursor
                  hasPreviousPage
                  startCursor
                }
                nodes {
                  id
                  type
                  createdAt
                  updatedAt
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
                  fieldValues(first: 20) {
                    nodes {
                      ... on ProjectV2ItemFieldTextValue {
                        text
                        field {
                          ... on ProjectV2FieldCommon {
                            name
                          }
                        }
                      }
                      ... on ProjectV2ItemFieldNumberValue {
                        number
                        field {
                          ... on ProjectV2FieldCommon {
                            name
                          }
                        }
                      }
                      ... on ProjectV2ItemFieldSingleSelectValue {
                        name
                        field {
                          ... on ProjectV2FieldCommon {
                            name
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      `,
      variables: { projectId },
      extractData: (result: Record<string, unknown>) => (result['node'] as Record<string, unknown>)['items'] as GraphQLPaginatedResult<unknown>,
    };
  }

  /**
   * Create paginated query builder for repository collaborators
   */
  createCollaboratorsQuery(
    owner: string,
    repo: string,
    affiliation?: 'ALL' | 'DIRECT' | 'OUTSIDE'
  ): GraphQLQueryBuilder {
    return {
      query: `
        query($owner: String!, $repo: String!, $first: Int!, $after: String, $affiliation: CollaboratorAffiliation) {
          repository(owner: $owner, name: $repo) {
            collaborators(first: $first, after: $after, affiliation: $affiliation) {
              totalCount
              pageInfo {
                hasNextPage
                endCursor
                hasPreviousPage
                startCursor
              }
              nodes {
                login
                name
                email
                avatarUrl
                url
                company
                location
                bio
                createdAt
                contributionsCollection {
                  totalCommitContributions
                  totalIssueContributions
                  totalPullRequestContributions
                  totalPullRequestReviewContributions
                }
              }
            }
          }
        }
      `,
      variables: { owner, repo, affiliation },
      extractData: (result: Record<string, unknown>) => (result['repository'] as Record<string, unknown>)['collaborators'] as GraphQLPaginatedResult<unknown>,
    };
  }

  /**
   * Create paginated query builder for commit history
   */
  createCommitHistoryQuery(
    owner: string,
    repo: string,
    branch?: string,
    since?: string,
    until?: string
  ): GraphQLQueryBuilder {
    return {
      query: `
        query($owner: String!, $repo: String!, $branch: String, $first: Int!, $after: String, $since: GitTimestamp, $until: GitTimestamp) {
          repository(owner: $owner, name: $repo) {
            ref(qualifiedName: $branch) {
              target {
                ... on Commit {
                  history(first: $first, after: $after, since: $since, until: $until) {
                    totalCount
                    pageInfo {
                      hasNextPage
                      endCursor
                      hasPreviousPage
                      startCursor
                    }
                    nodes {
                      oid
                      messageHeadline
                      messageBody
                      committedDate
                      authoredDate
                      author {
                        name
                        email
                        user {
                          login
                          avatarUrl
                        }
                      }
                      committer {
                        name
                        email
                        user {
                          login
                        }
                      }
                      additions
                      deletions
                      changedFiles
                      parents {
                        totalCount
                      }
                    }
                  }
                }
              }
            }
            defaultBranchRef {
              target {
                ... on Commit {
                  history(first: $first, after: $after, since: $since, until: $until) {
                    totalCount
                    pageInfo {
                      hasNextPage
                      endCursor
                      hasPreviousPage
                      startCursor
                    }
                    nodes {
                      oid
                      messageHeadline
                      messageBody
                      committedDate
                      authoredDate
                      author {
                        name
                        email
                        user {
                          login
                          avatarUrl
                        }
                      }
                      committer {
                        name
                        email
                        user {
                          login
                        }
                      }
                      additions
                      deletions
                      changedFiles
                      parents {
                        totalCount
                      }
                    }
                  }
                }
              }
            }
          }
        }
      `,
      variables: { owner, repo, branch, since, until },
      extractData: (result: Record<string, unknown>) => {
        const repository = result['repository'] as Record<string, unknown>;
        const ref = repository['ref'] as Record<string, unknown> | undefined;
        const defaultBranchRef = repository['defaultBranchRef'] as Record<string, unknown> | undefined;
        const refTarget = ref?.['target'] as Record<string, unknown> | undefined;
        const defaultTarget = defaultBranchRef?.['target'] as Record<string, unknown> | undefined;
        return (refTarget?.['history'] ?? defaultTarget?.['history']) as GraphQLPaginatedResult<unknown>;
      },
    };
  }

  /**
   * Create paginated query builder for search results
   */
  createSearchQuery(
    query: string,
    type: 'REPOSITORY' | 'ISSUE' | 'USER' | 'DISCUSSION'
  ): GraphQLQueryBuilder {
    return {
      query: `
        query($searchQuery: String!, $type: SearchType!, $first: Int!, $after: String) {
          search(query: $searchQuery, type: $type, first: $first, after: $after) {
            repositoryCount
            issueCount
            userCount
            discussionCount
            pageInfo {
              hasNextPage
              endCursor
              hasPreviousPage
              startCursor
            }
            nodes {
              ... on Repository {
                id
                name
                nameWithOwner
                description
                url
                stargazerCount
                forkCount
                createdAt
                updatedAt
                primaryLanguage {
                  name
                  color
                }
                owner {
                  login
                  avatarUrl
                }
                licenseInfo {
                  name
                  spdxId
                }
                repositoryTopics(first: 10) {
                  nodes {
                    topic {
                      name
                    }
                  }
                }
              }
              ... on Issue {
                id
                number
                title
                body
                url
                state
                createdAt
                updatedAt
                author {
                  login
                  avatarUrl
                }
                repository {
                  name
                  nameWithOwner
                }
                labels(first: 10) {
                  nodes {
                    name
                    color
                  }
                }
                comments {
                  totalCount
                }
              }
              ... on User {
                id
                login
                name
                email
                bio
                company
                location
                url
                avatarUrl
                createdAt
                followers {
                  totalCount
                }
                following {
                  totalCount
                }
                repositories {
                  totalCount
                }
              }
              ... on Discussion {
                id
                number
                title
                body
                url
                createdAt
                updatedAt
                author {
                  login
                  avatarUrl
                }
                repository {
                  name
                  nameWithOwner
                }
                category {
                  name
                  slug
                }
                upvoteCount
              }
            }
          }
        }
      `,
      variables: { searchQuery: query, type },
      extractData: (result: Record<string, unknown>) => {
        const search = result['search'] as Record<string, unknown>;
        return {
          nodes: search['nodes'] as unknown[],
          pageInfo: search['pageInfo'] as GraphQLPageInfo,
          totalCount:
            (search['repositoryCount'] as number | undefined) ??
            (search['issueCount'] as number | undefined) ??
            (search['userCount'] as number | undefined) ??
            (search['discussionCount'] as number | undefined),
        };
      },
    };
  }

  /**
   * Create a cached paginated fetcher to avoid duplicate requests
   */
  createCachedHandler(
    cache: Map<string, { data: unknown; timestamp: number }>,
    ttl: number = 5 * 60 * 1000 // 5 minutes
  ) {
    return async <T>(
      queryBuilder: GraphQLQueryBuilder,
      options: GraphQLPaginationOptions = {}
    ): Promise<GraphQLPaginationResponse<T>> => {
      const { onProgress: _onProgress, ...serializableOptions } = options;
      const cacheKey = JSON.stringify({
        query: queryBuilder.query,
        variables: queryBuilder.variables,
        options: serializableOptions,
      });
      const cached = cache.get(cacheKey);

      if (cached && Date.now() - cached.timestamp < ttl) {
        return cached.data as GraphQLPaginationResponse<T>;
      }

      const result = await this.paginate<T>(queryBuilder, options);
      cache.set(cacheKey, { data: result, timestamp: Date.now() });

      return result;
    };
  }
}

/**
 * Utility functions for common GraphQL pagination patterns
 */
export const GraphQLPaginationUtils = {
  /**
   * Validate pagination parameters
   */
  validatePaginationParams(options: GraphQLPaginationOptions): void {
    if (options.first !== undefined && (options.first < 1 || options.first > 100)) {
      throw new Error('first parameter must be between 1 and 100');
    }
    if (options.maxPages !== undefined && options.maxPages < 1) {
      throw new Error('maxPages must be positive');
    }
    if (options.maxItems !== undefined && options.maxItems < 1) {
      throw new Error('maxItems must be positive');
    }
  },

  /**
   * Create standard pagination response
   */
  createPaginationResponse<T>(
    data: T[],
    pageInfo: GraphQLPageInfo,
    totalCount?: number
  ): GraphQLPaginationResponse<T> {
    return {
      data,
      pageInfo,
      totalCount,
      hasMore: pageInfo.hasNextPage,
      nextCursor: pageInfo.endCursor,
    };
  },

  /**
   * Merge multiple paginated results
   */
  mergeResults<T>(results: Array<GraphQLPaginationResponse<T>>): GraphQLPaginationResponse<T> {
    const allData: T[] = [];
    let totalCount = 0;
    let hasMore = false;
    let lastPageInfo: GraphQLPageInfo | undefined;

    for (const result of results) {
      allData.push(...result.data);
      if (result.totalCount) {
        totalCount += result.totalCount;
      }
      if (result.hasMore) {
        hasMore = true;
      }
      lastPageInfo = result.pageInfo;
    }

    return {
      data: allData,
      pageInfo: lastPageInfo ?? { hasNextPage: false },
      totalCount: results.length > 0 ? totalCount : 0,
      hasMore,
      nextCursor: lastPageInfo?.endCursor,
    };
  },
};
