/**
 * Tests for Code Security tools
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createCodeSecurityTools } from './code-security.js';

const makeAlert = (number = 1) => ({
  number,
  state: 'open',
  dismissed_by: null,
  dismissed_at: null,
  dismissed_reason: null,
  dismissed_comment: null,
  rule: {
    id: 'js/sql-injection',
    severity: 'high',
    description: 'SQL injection vulnerability',
    name: 'SQL Injection',
    tags: ['security'],
    full_description: 'Full description here',
    help: 'Avoid string concatenation',
  },
  tool: { name: 'CodeQL', version: '2.10.0' },
  most_recent_instance: {
    ref: 'refs/heads/main',
    state: 'open',
    commit_sha: 'abc123',
    location: { path: 'src/db.ts', start_line: 42 },
    message: { text: 'This query...' },
    classifications: [],
  },
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  fixed_at: null,
  instances_url: 'https://api.github.com/repos/owner/repo/code-scanning/alerts/1/instances',
  html_url: `https://github.com/owner/repo/security/code-scanning/${number}`,
});

const makeAdvisory = () => ({
  ghsa_id: 'GHSA-xxxx-yyyy-zzzz',
  cve_id: 'CVE-2024-12345',
  summary: 'Test advisory',
  description: 'Advisory description',
  severity: 'high',
  state: 'published',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-02T00:00:00Z',
  published_at: '2024-01-02T00:00:00Z',
  closed_at: null,
  withdrawn_at: null,
  vulnerabilities: [],
  cvss: { vector_string: 'CVSS:3.1/AV:N', score: 7.5 },
  cwes: [],
  html_url: 'https://github.com/owner/repo/security/advisories/GHSA-xxxx-yyyy-zzzz',
});

const makeOctokit = () => ({
  codeScanning: {
    listAlertsForRepo: vi.fn(),
    getAlert: vi.fn(),
    getSarif: vi.fn(),
    updateAlert: vi.fn(),
    uploadSarif: vi.fn(),
  },
  securityAdvisories: {
    listRepositoryAdvisories: vi.fn(),
  },
  repos: {
    checkVulnerabilityAlerts: vi.fn(),
    enableVulnerabilityAlerts: vi.fn(),
    disableVulnerabilityAlerts: vi.fn(),
  },
});

describe('Code Security Tools', () => {
  let mockOctokit: ReturnType<typeof makeOctokit>;
  let tools: ReturnType<typeof createCodeSecurityTools>;

  beforeEach(() => {
    mockOctokit = makeOctokit();
    tools = createCodeSecurityTools(mockOctokit as any, false);
  });

  // ============================================================================
  // list_code_scanning_alerts
  // ============================================================================

  describe('list_code_scanning_alerts', () => {
    let handler: (args: unknown) => Promise<unknown>;

    beforeEach(() => {
      const tool = tools.find(t => t.tool.name === 'list_code_scanning_alerts');
      expect(tool).toBeDefined();
      handler = tool!.handler;
    });

    it('should be registered', () => {
      expect(tools.find(t => t.tool.name === 'list_code_scanning_alerts')).toBeDefined();
    });

    it('should list code scanning alerts', async () => {
      mockOctokit.codeScanning.listAlertsForRepo.mockResolvedValue({
        data: [makeAlert(1), makeAlert(2)],
      });

      const result = (await handler({ owner: 'owner', repo: 'repo' })) as any[];
      expect(result).toHaveLength(2);
      expect(result[0].number).toBe(1);
      expect(result[0].state).toBe('open');
      expect(result[0].rule.name).toBe('SQL Injection');
      expect(result[0].tool.name).toBe('CodeQL');
    });

    it('should pass filters to API', async () => {
      mockOctokit.codeScanning.listAlertsForRepo.mockResolvedValue({ data: [] });

      await handler({ owner: 'owner', repo: 'repo', state: 'open', severity: 'high', tool_name: 'CodeQL', ref: 'refs/heads/main' });
      expect(mockOctokit.codeScanning.listAlertsForRepo).toHaveBeenCalledWith(
        expect.objectContaining({ state: 'open', severity: 'high', tool_name: 'CodeQL', ref: 'refs/heads/main' })
      );
    });

    it('should return error on 404', async () => {
      const error = Object.assign(new Error('Not Found'), { status: 404 });
      mockOctokit.codeScanning.listAlertsForRepo.mockRejectedValue(error);

      const result = (await handler({ owner: 'owner', repo: 'repo' })) as any;
      expect(result.error).toContain('not enabled');
    });

    it('should rethrow non-404 errors', async () => {
      const error = Object.assign(new Error('Server error'), { status: 500 });
      mockOctokit.codeScanning.listAlertsForRepo.mockRejectedValue(error);

      await expect(handler({ owner: 'owner', repo: 'repo' })).rejects.toThrow('Server error');
    });

    it('should map most_recent_instance correctly', async () => {
      mockOctokit.codeScanning.listAlertsForRepo.mockResolvedValue({
        data: [makeAlert(1)],
      });

      const result = (await handler({ owner: 'owner', repo: 'repo' })) as any[];
      expect(result[0].most_recent_instance.ref).toBe('refs/heads/main');
      expect(result[0].most_recent_instance.location.path).toBe('src/db.ts');
    });

    it('should handle null most_recent_instance', async () => {
      const alertNoInstance = { ...makeAlert(1), most_recent_instance: null };
      mockOctokit.codeScanning.listAlertsForRepo.mockResolvedValue({ data: [alertNoInstance] });

      const result = (await handler({ owner: 'owner', repo: 'repo' })) as any[];
      expect(result[0].most_recent_instance).toBeNull();
    });
  });

  // ============================================================================
  // get_code_scanning_alert
  // ============================================================================

  describe('get_code_scanning_alert', () => {
    let handler: (args: unknown) => Promise<unknown>;

    beforeEach(() => {
      const tool = tools.find(t => t.tool.name === 'get_code_scanning_alert');
      expect(tool).toBeDefined();
      handler = tool!.handler;
    });

    it('should return alert details', async () => {
      mockOctokit.codeScanning.getAlert.mockResolvedValue({ data: makeAlert(5) });

      const result = (await handler({ owner: 'owner', repo: 'repo', alertNumber: 5 })) as any;
      expect(mockOctokit.codeScanning.getAlert).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        alert_number: 5,
      });
      expect(result.number).toBe(5);
      expect(result.rule.full_description).toBe('Full description here');
      expect(result.most_recent_instance.commit_sha).toBe('abc123');
    });

    it('should handle dismissed alert', async () => {
      const dismissed = {
        ...makeAlert(3),
        state: 'dismissed',
        dismissed_by: { login: 'secbot', id: 99 },
        dismissed_at: '2024-01-10T00:00:00Z',
        dismissed_reason: 'false positive',
        dismissed_comment: 'Not exploitable here',
      };
      mockOctokit.codeScanning.getAlert.mockResolvedValue({ data: dismissed });

      const result = (await handler({ owner: 'owner', repo: 'repo', alertNumber: 3 })) as any;
      expect(result.dismissed_by).toEqual({ login: 'secbot' });
      expect(result.dismissed_reason).toBe('false positive');
    });

    it('should return error on 404', async () => {
      const error = Object.assign(new Error('Not Found'), { status: 404 });
      mockOctokit.codeScanning.getAlert.mockRejectedValue(error);

      const result = (await handler({ owner: 'owner', repo: 'repo', alertNumber: 999 })) as any;
      expect(result.error).toContain('not found');
    });

    it('should rethrow non-404 errors', async () => {
      const error = Object.assign(new Error('Server error'), { status: 500 });
      mockOctokit.codeScanning.getAlert.mockRejectedValue(error);

      await expect(handler({ owner: 'owner', repo: 'repo', alertNumber: 1 })).rejects.toThrow('Server error');
    });
  });

  // ============================================================================
  // list_repository_security_advisories
  // ============================================================================

  describe('list_repository_security_advisories', () => {
    let handler: (args: unknown) => Promise<unknown>;

    beforeEach(() => {
      const tool = tools.find(t => t.tool.name === 'list_repository_security_advisories');
      expect(tool).toBeDefined();
      handler = tool!.handler;
    });

    it('should list advisories', async () => {
      mockOctokit.securityAdvisories.listRepositoryAdvisories.mockResolvedValue({
        data: [makeAdvisory()],
      });

      const result = (await handler({ owner: 'owner', repo: 'repo' })) as any[];
      expect(result).toHaveLength(1);
      expect(result[0].ghsa_id).toBe('GHSA-xxxx-yyyy-zzzz');
      expect(result[0].severity).toBe('high');
      expect(result[0].state).toBe('published');
    });

    it('should handle 404/403 with error object', async () => {
      const error = Object.assign(new Error('Forbidden'), { status: 403 });
      mockOctokit.securityAdvisories.listRepositoryAdvisories.mockRejectedValue(error);

      const result = (await handler({ owner: 'owner', repo: 'repo' })) as any;
      expect(result.error).toBeDefined();
    });

    it('should rethrow non-404/403 errors', async () => {
      const error = Object.assign(new Error('Server error'), { status: 500 });
      mockOctokit.securityAdvisories.listRepositoryAdvisories.mockRejectedValue(error);

      await expect(handler({ owner: 'owner', repo: 'repo' })).rejects.toThrow('Server error');
    });
  });

  // ============================================================================
  // check_vulnerability_alerts
  // ============================================================================

  describe('check_vulnerability_alerts', () => {
    let handler: (args: unknown) => Promise<unknown>;

    beforeEach(() => {
      const tool = tools.find(t => t.tool.name === 'check_vulnerability_alerts');
      expect(tool).toBeDefined();
      handler = tool!.handler;
    });

    it('should return enabled=true when alerts are on', async () => {
      mockOctokit.repos.checkVulnerabilityAlerts.mockResolvedValue({});

      const result = (await handler({ owner: 'owner', repo: 'repo' })) as any;
      expect(result.enabled).toBe(true);
    });

    it('should return enabled=false on 404', async () => {
      const error = Object.assign(new Error('Not Found'), { status: 404 });
      mockOctokit.repos.checkVulnerabilityAlerts.mockRejectedValue(error);

      const result = (await handler({ owner: 'owner', repo: 'repo' })) as any;
      expect(result.enabled).toBe(false);
    });

    it('should rethrow non-404 errors', async () => {
      const error = Object.assign(new Error('Server error'), { status: 500 });
      mockOctokit.repos.checkVulnerabilityAlerts.mockRejectedValue(error);

      await expect(handler({ owner: 'owner', repo: 'repo' })).rejects.toThrow('Server error');
    });
  });

  // ============================================================================
  // get_sarif_upload
  // ============================================================================

  describe('get_sarif_upload', () => {
    let handler: (args: unknown) => Promise<unknown>;

    beforeEach(() => {
      const tool = tools.find(t => t.tool.name === 'get_sarif_upload');
      expect(tool).toBeDefined();
      handler = tool!.handler;
    });

    it('should return SARIF upload status', async () => {
      mockOctokit.codeScanning.getSarif.mockResolvedValue({
        data: {
          processing_status: 'complete',
          analyses_url: 'https://api.github.com/repos/owner/repo/code-scanning/analyses?sarif_id=abc',
          errors: [],
        },
      });

      const result = (await handler({ owner: 'owner', repo: 'repo', sarif_id: 'abc123' })) as any;
      expect(result.status).toBe('complete');
      expect(result.errors).toHaveLength(0);
    });

    it('should return error on 404', async () => {
      const error = Object.assign(new Error('Not Found'), { status: 404 });
      mockOctokit.codeScanning.getSarif.mockRejectedValue(error);

      const result = (await handler({ owner: 'owner', repo: 'repo', sarif_id: 'bad' })) as any;
      expect(result.error).toContain('not found');
    });

    it('should rethrow non-404 errors', async () => {
      const error = Object.assign(new Error('Server error'), { status: 500 });
      mockOctokit.codeScanning.getSarif.mockRejectedValue(error);

      await expect(handler({ owner: 'owner', repo: 'repo', sarif_id: 'id' })).rejects.toThrow('Server error');
    });
  });

  // ============================================================================
  // Write-mode tools
  // ============================================================================

  describe('write-mode registration', () => {
    it('should register write tools when not read-only', () => {
      const writeTools = ['update_code_scanning_alert', 'upload_sarif', 'enable_vulnerability_alerts', 'disable_vulnerability_alerts'];
      for (const name of writeTools) {
        expect(tools.find(t => t.tool.name === name)).toBeDefined();
      }
    });

    it('should NOT register write tools in read-only mode', () => {
      const readOnlyTools = createCodeSecurityTools(mockOctokit as any, true);
      expect(readOnlyTools.find(t => t.tool.name === 'update_code_scanning_alert')).toBeUndefined();
      expect(readOnlyTools.find(t => t.tool.name === 'upload_sarif')).toBeUndefined();
      expect(readOnlyTools.find(t => t.tool.name === 'enable_vulnerability_alerts')).toBeUndefined();
    });
  });

  describe('update_code_scanning_alert', () => {
    let handler: (args: unknown) => Promise<unknown>;

    beforeEach(() => {
      const tool = tools.find(t => t.tool.name === 'update_code_scanning_alert');
      handler = tool!.handler;
    });

    it('should update an alert', async () => {
      const updated = { ...makeAlert(1), state: 'dismissed', dismissed_reason: 'false positive', dismissed_comment: 'fp', dismissed_at: '2024-01-10T00:00:00Z', dismissed_by: { login: 'user1' } };
      mockOctokit.codeScanning.updateAlert.mockResolvedValue({ data: updated });

      const result = (await handler({
        owner: 'owner',
        repo: 'repo',
        alertNumber: 1,
        state: 'dismissed',
        dismissed_reason: 'false positive',
        dismissed_comment: 'fp',
      })) as any;

      expect(mockOctokit.codeScanning.updateAlert).toHaveBeenCalledWith(
        expect.objectContaining({ alert_number: 1, state: 'dismissed' })
      );
      expect(result.state).toBe('dismissed');
      expect(result.dismissed_by).toEqual({ login: 'user1' });
    });
  });

  describe('upload_sarif', () => {
    let handler: (args: unknown) => Promise<unknown>;

    beforeEach(() => {
      const tool = tools.find(t => t.tool.name === 'upload_sarif');
      handler = tool!.handler;
    });

    it('should upload SARIF data', async () => {
      mockOctokit.codeScanning.uploadSarif.mockResolvedValue({
        data: { id: 'sarif-123', url: 'https://api.github.com/repos/owner/repo/code-scanning/sarifs/sarif-123' },
      });

      const result = (await handler({
        owner: 'owner',
        repo: 'repo',
        sarif: '{"runs":[]}',
        commit_sha: 'abc123',
        ref: 'refs/heads/main',
      })) as any;

      expect(result.id).toBe('sarif-123');
      expect(mockOctokit.codeScanning.uploadSarif).toHaveBeenCalledWith(
        expect.objectContaining({ owner: 'owner', repo: 'repo', commit_sha: 'abc123' })
      );
    });
  });

  describe('enable_vulnerability_alerts', () => {
    let handler: (args: unknown) => Promise<unknown>;

    beforeEach(() => {
      const tool = tools.find(t => t.tool.name === 'enable_vulnerability_alerts');
      handler = tool!.handler;
    });

    it('should enable vulnerability alerts', async () => {
      mockOctokit.repos.enableVulnerabilityAlerts.mockResolvedValue({});

      const result = (await handler({ owner: 'owner', repo: 'repo' })) as any;
      expect(result.success).toBe(true);
      expect(mockOctokit.repos.enableVulnerabilityAlerts).toHaveBeenCalledWith({ owner: 'owner', repo: 'repo' });
    });
  });

  describe('disable_vulnerability_alerts', () => {
    let handler: (args: unknown) => Promise<unknown>;

    beforeEach(() => {
      const tool = tools.find(t => t.tool.name === 'disable_vulnerability_alerts');
      handler = tool!.handler;
    });

    it('should disable vulnerability alerts', async () => {
      mockOctokit.repos.disableVulnerabilityAlerts.mockResolvedValue({});

      const result = (await handler({ owner: 'owner', repo: 'repo' })) as any;
      expect(result.success).toBe(true);
      expect(mockOctokit.repos.disableVulnerabilityAlerts).toHaveBeenCalledWith({ owner: 'owner', repo: 'repo' });
    });
  });
});
