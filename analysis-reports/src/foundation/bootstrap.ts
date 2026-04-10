import { Octokit } from '@octokit/rest';
import { Container } from './container.js';
import { DI_TOKENS, IGitHubClient, IIssueRepository, IIssueService } from './interfaces.js';
import { GitHubClient } from './github-client.js';
import { IssueRepository } from '../repositories/issue-repository.js';
import { IssueService } from '../services/issue-service.js';

/**
 * Bootstrap the application with dependency injection
 * This function sets up all the dependencies and returns a configured container
 */
export function bootstrap(octokit: Octokit): Container {
  const container = new Container();

  // Register core dependencies
  container.register(DI_TOKENS.Octokit, octokit);

  // Register GitHub client abstraction
  const githubClient: IGitHubClient = new GitHubClient(octokit);
  container.register(DI_TOKENS.GitHubClient, githubClient);

  // Register repositories
  const issueRepository: IIssueRepository = new IssueRepository(githubClient);
  container.register(DI_TOKENS.IssueRepository, issueRepository);

  // Register services
  const issueService: IIssueService = new IssueService(issueRepository);
  container.register(DI_TOKENS.IssueService, issueService);

  return container;
}

/**
 * Get configured services from container
 * This provides a convenient way to access services without knowing about DI tokens
 */
export interface ConfiguredServices {
  githubClient: IGitHubClient;
  issueService: IIssueService;
}

export function getServices(container: Container): ConfiguredServices {
  return {
    githubClient: container.resolve<IGitHubClient>(DI_TOKENS.GitHubClient),
    issueService: container.resolve<IIssueService>(DI_TOKENS.IssueService),
  };
}
