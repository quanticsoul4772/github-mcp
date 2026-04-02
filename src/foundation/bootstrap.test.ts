/**
 * Tests for bootstrap DI setup
 */
import { describe, it, expect, vi } from 'vitest';
import { bootstrap, getServices } from './bootstrap.js';
import { DI_TOKENS } from './interfaces.js';

const makeOctokit = () => ({
  repos: { get: vi.fn(), getContent: vi.fn(), createOrUpdateFileContents: vi.fn() },
  issues: { listForRepo: vi.fn(), get: vi.fn(), create: vi.fn(), update: vi.fn() },
  pulls: { list: vi.fn(), get: vi.fn(), create: vi.fn(), update: vi.fn() },
});

describe('bootstrap', () => {
  it('should register octokit in the container', () => {
    const octokit = makeOctokit();
    const container = bootstrap(octokit as any);
    expect(container.resolve(DI_TOKENS.Octokit)).toBe(octokit);
  });

  it('should register GitHubClient', () => {
    const octokit = makeOctokit();
    const container = bootstrap(octokit as any);
    const client = container.resolve(DI_TOKENS.GitHubClient);
    expect(client).toBeDefined();
    expect(typeof (client as any).getRepository).toBe('function');
  });

  it('should register IssueRepository', () => {
    const octokit = makeOctokit();
    const container = bootstrap(octokit as any);
    const repo = container.resolve(DI_TOKENS.IssueRepository);
    expect(repo).toBeDefined();
    expect(typeof (repo as any).list).toBe('function');
  });

  it('should register IssueService', () => {
    const octokit = makeOctokit();
    const container = bootstrap(octokit as any);
    const service = container.resolve(DI_TOKENS.IssueService);
    expect(service).toBeDefined();
    expect(typeof (service as any).listIssues).toBe('function');
  });
});

describe('getServices', () => {
  it('should return githubClient and issueService', () => {
    const octokit = makeOctokit();
    const container = bootstrap(octokit as any);
    const services = getServices(container);
    expect(services.githubClient).toBeDefined();
    expect(services.issueService).toBeDefined();
  });

  it('should return a githubClient with getRepository method', () => {
    const octokit = makeOctokit();
    const container = bootstrap(octokit as any);
    const { githubClient } = getServices(container);
    expect(typeof githubClient.getRepository).toBe('function');
  });

  it('should return an issueService with listIssues method', () => {
    const octokit = makeOctokit();
    const container = bootstrap(octokit as any);
    const { issueService } = getServices(container);
    expect(typeof issueService.listIssues).toBe('function');
  });
});
