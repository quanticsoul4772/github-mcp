/**
 * TypeScript interfaces for GitHub GraphQL API responses
 * 
 * This file contains comprehensive type definitions for all GraphQL responses
 * used throughout the application, providing type safety and better IDE support.
 */

// Common GraphQL types
export interface PageInfo {
  hasNextPage: boolean;
  endCursor: string | null;
  hasPreviousPage?: boolean;
  startCursor?: string | null;
}

export interface Actor {
  login: string;
  avatarUrl?: string;
  url?: string;
}

export interface User extends Actor {
  id: string;
  name: string | null;
  email: string | null;
  bio: string | null;
  company: string | null;
  location: string | null;
  createdAt: string;
  followers?: { totalCount: number };
  following?: { totalCount: number };
  repositories?: { totalCount: number };
}

export interface Repository {
  id: string;
  name: string;
  nameWithOwner: string;
  description: string | null;
  url: string;
  createdAt: string;
  updatedAt: string;
  pushedAt: string | null;
  stargazerCount: number;
  forkCount: number;
  watchers?: { totalCount: number };
  issues?: { totalCount: number };
  pullRequests?: { totalCount: number };
  releases?: { totalCount: number };
  collaborators?: { totalCount: number };
  diskUsage?: number;
  isArchived: boolean;
  isDisabled: boolean;
  isFork: boolean;
  isTemplate: boolean;
  visibility: 'PUBLIC' | 'PRIVATE' | 'INTERNAL';
  owner: Actor;
  primaryLanguage?: Language;
  licenseInfo?: License;
}

export interface Language {
  name: string;
  color: string | null;
}

export interface License {
  name: string;
  spdxId: string | null;
}

export interface Topic {
  name: string;
}

export interface Label {
  name: string;
  color: string;
}

// Discussion-specific types
export interface DiscussionCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  emoji: string | null;
  createdAt: string;
  updatedAt: string;
  isAnswerable: boolean;
}

export interface DiscussionComment {
  id: string;
  body: string;
  bodyHTML?: string;
  createdAt: string;
  updatedAt?: string;
  author: Actor | null;
  upvoteCount?: number;
  viewerHasUpvoted?: boolean;
  viewerCanUpvote?: boolean;
  viewerCanDelete?: boolean;
  viewerCanUpdate?: boolean;
  replies?: {
    totalCount: number;
    nodes: DiscussionComment[];
  };
}

export interface Discussion {
  id: string;
  number: number;
  title: string;
  body: string;
  bodyHTML?: string;
  createdAt: string;
  updatedAt: string;
  author: Actor | null;
  category: DiscussionCategory;
  comments?: {
    totalCount: number;
    pageInfo?: PageInfo;
    nodes?: DiscussionComment[];
  };
  upvoteCount: number;
  viewerHasUpvoted?: boolean;
  viewerCanUpvote?: boolean;
  viewerCanDelete?: boolean;
  viewerCanUpdate?: boolean;
  url: string;
  repository?: Pick<Repository, 'name' | 'nameWithOwner'>;
}

// Issue-specific types
export interface Issue {
  id: string;
  number: number;
  title: string;
  body: string | null;
  url: string;
  state: 'OPEN' | 'CLOSED';
  createdAt: string;
  updatedAt: string;
  author: Actor | null;
  repository: Pick<Repository, 'name' | 'nameWithOwner'>;
  labels?: {
    nodes: Label[];
  };
  comments?: {
    totalCount: number;
  };
}

// Contribution and commit types
export interface ContributionsCollection {
  totalCommitContributions: number;
  totalIssueContributions: number;
  totalPullRequestContributions: number;
  totalPullRequestReviewContributions: number;
}

export interface Contributor extends User {
  contributionsCollection: ContributionsCollection;
}

export interface CommitAuthor {
  user?: Pick<User, 'login'> | null;
  date: string;
}

export interface Commit {
  committedDate: string;
  author: CommitAuthor | null;
  additions: number;
  deletions: number;
  changedFiles: number;
  messageHeadline: string;
}

export interface CommitHistory {
  totalCount: number;
  nodes: Commit[];
}

export interface GitRef {
  name: string;
  target?: {
    history?: CommitHistory;
  } | null;
}

// Language statistics types
export interface LanguageEdge {
  size: number;
  node: Language;
}

export interface LanguageConnection {
  edges: LanguageEdge[];
}

// Repository topics types
export interface RepositoryTopic {
  topic: Topic;
}

export interface RepositoryTopicConnection {
  nodes: RepositoryTopic[];
}

// GraphQL Response Types for specific queries

// Repository insights responses
export interface RepositoryInsightsResponse {
  repository: Repository & {
    watchers: { totalCount: number };
    issues: { totalCount: number };
    pullRequests: { totalCount: number };
    releases: { totalCount: number };
    languages: LanguageConnection;
    collaborators: { totalCount: number };
    repositoryTopics: RepositoryTopicConnection;
    licenseInfo: License | null;
    visibility: 'PUBLIC' | 'PRIVATE' | 'INTERNAL';
  };
}

export interface ContributionStatsResponse {
  repository: {
    collaborators: {
      totalCount: number;
      nodes: Contributor[];
    };
    defaultBranchRef: GitRef | null;
  };
}

export interface CommitActivityResponse {
  repository: {
    ref?: {
      target?: {
        history?: CommitHistory;
      } | null;
    } | null;
    defaultBranchRef: GitRef | null;
  };
}

// Discussion responses
export interface ListDiscussionsResponse {
  repository: {
    discussions: {
      totalCount: number;
      pageInfo: PageInfo;
      nodes: Discussion[];
    };
  };
}

export interface GetDiscussionResponse {
  repository: {
    discussion: Discussion;
  };
}

export interface GetDiscussionCommentsResponse {
  repository: {
    discussion: {
      comments: {
        totalCount: number;
        pageInfo: PageInfo;
        nodes: DiscussionComment[];
      };
    };
  };
}

export interface ListDiscussionCategoriesResponse {
  repository: {
    discussionCategories: {
      totalCount: number;
      nodes: DiscussionCategory[];
    };
  };
}

export interface SearchDiscussionsResponse {
  search: {
    discussionCount: number;
    nodes: Discussion[];
  };
}

export interface CreateDiscussionResponse {
  createDiscussion: {
    discussion: Discussion;
  };
}

export interface AddDiscussionCommentResponse {
  addDiscussionComment: {
    comment: DiscussionComment;
  };
}

export interface UpdateDiscussionResponse {
  updateDiscussion: {
    discussion: Discussion;
  };
}

// Search responses
export interface SearchResult {
  repositoryCount: number;
  issueCount: number;
  userCount: number;
  discussionCount: number;
  pageInfo: PageInfo;
  nodes: Array<Repository | Issue | User | Discussion>;
}

export interface CrossRepoSearchResponse {
  search: SearchResult;
}

// Generic repository response for simple queries
export interface SimpleRepositoryResponse {
  repository: {
    id: string;
  };
}

// Type guards for runtime validation
export function isRepository(node: any): node is Repository {
  return node && typeof node.id === 'string' && typeof node.name === 'string' && node.stargazerCount !== undefined;
}

export function isIssue(node: any): node is Issue {
  return node && typeof node.id === 'string' && typeof node.number === 'number' && node.state !== undefined;
}

export function isUser(node: any): node is User {
  return node && typeof node.id === 'string' && typeof node.login === 'string' && node.followers !== undefined;
}

export function isDiscussion(node: any): node is Discussion {
  return node && typeof node.id === 'string' && typeof node.number === 'number' && node.upvoteCount !== undefined;
}

// Validation utilities
export function validatePageInfo(pageInfo: any): pageInfo is PageInfo {
  return pageInfo && typeof pageInfo.hasNextPage === 'boolean';
}

export function validateActor(actor: any): actor is Actor {
  return actor && typeof actor.login === 'string';
}

export function validateRepository(repo: any): repo is Repository {
  return repo && 
    typeof repo.id === 'string' && 
    typeof repo.name === 'string' && 
    typeof repo.stargazerCount === 'number';
}

// Utility type for GraphQL responses with error handling
export interface GraphQLResponse<T> {
  data?: T;
  errors?: Array<{
    message: string;
    locations?: Array<{
      line: number;
      column: number;
    }>;
    path?: string[];
  }>;
}

// Helper function to safely extract data from GraphQL responses
export function extractGraphQLData<T>(response: GraphQLResponse<T>): T {
  if (response.errors && response.errors.length > 0) {
    const errorMessages = response.errors.map(error => error.message).join(', ');
    throw new Error(`GraphQL errors: ${errorMessages}`);
  }
  
  if (!response.data) {
    throw new Error('No data returned from GraphQL query');
  }
  
  return response.data;
}