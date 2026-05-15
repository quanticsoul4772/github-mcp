/**
 * Tests for Secret Scanning tools
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createSecretScanningTools } from './secret-scanning.js';

const makeAlert = (number = 1) => ({
  number,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  url: `https://api.github.com/repos/owner/repo/secret-scanning/alerts/${number}`,
  html_url: `https://github.com/owner/repo/security/secret-scanning/${number}`,
  locations_url: `https://api.github.com/repos/owner/repo/secret-scanning/alerts/${number}/locations`,
  state: 'open',
  resolution: null,
  resolved_at: null,
  resolved_by: null,
  resolution_comment: null,
  secret_type: 'github_personal_access_token',
  secret_type_display_name: 'GitHub Personal Access Token',
  secret: 'ghp_XXXXXXXXXXXXXXXXXXXX',
  push_protection_bypassed: false,
  push_protection_bypassed_by: null,
  push_protection_bypassed_at: null,
  validity: 'unknown',
});

const makeOrgAlert = (number = 1, repo = 'my-repo') => ({
  ...makeAlert(number),
  repository: {
    name: repo,
    full_name: `myorg/${repo}`,
    owner: { login: 'myorg' },
  },
});

const makeOctokit = () => ({
  secretScanning: {
    listAlertsForRepo: vi.fn(),
    getAlert: vi.fn(),
    listLocationsForAlert: vi.fn(),
    listAlertsForOrg: vi.fn(),
    updateAlert: vi.fn(),
  },
});

describe('Secret Scanning Tools', () => {
  let mockOctokit: ReturnType<typeof makeOctokit>;
  let tools: ReturnType<typeof createSecretScanningTools>;

  beforeEach(() => {
    mockOctokit = makeOctokit();
    tools = createSecretScanningTools(mockOctokit as any, false);
  });

  // ============================================================================
  // list_secret_scanning_alerts
  // ============================================================================

  describe('list_secret_scanning_alerts', () => {
    let handler: (args: unknown) => Promise<unknown>;

    beforeEach(() => {
      const tool = tools.find(t => t.tool.name === 'list_secret_scanning_alerts');
      expect(tool).toBeDefined();
      handler = tool!.handler;
    });

    it('should be registered', () => {
      expect(tools.find(t => t.tool.name === 'list_secret_scanning_alerts')).toBeDefined();
    });

    it('should list alerts', async () => {
      mockOctokit.secretScanning.listAlertsForRepo.mockResolvedValue({
        data: [makeAlert(1), makeAlert(2)],
      });

      const result = (await handler({ owner: 'owner', repo: 'repo' })) as any[];
      expect(result).toHaveLength(2);
      expect(result[0].number).toBe(1);
      expect(result[0].state).toBe('open');
      expect(result[0].secret_type).toBe('github_personal_access_token');
      expect(result[0].resolved_by).toBeNull();
    });

    it('should pass filters', async () => {
      mockOctokit.secretScanning.listAlertsForRepo.mockResolvedValue({ data: [] });

      await handler({ owner: 'owner', repo: 'repo', state: 'open', secret_type: 'github_personal_access_token', resolution: 'false_positive' });
      expect(mockOctokit.secretScanning.listAlertsForRepo).toHaveBeenCalledWith(
        expect.objectContaining({ state: 'open', secret_type: 'github_personal_access_token', resolution: 'false_positive' })
      );
    });

    it('should return error on 404', async () => {
      const error = Object.assign(new Error('Not Found'), { status: 404 });
      mockOctokit.secretScanning.listAlertsForRepo.mockRejectedValue(error);

      const result = (await handler({ owner: 'owner', repo: 'repo' })) as any;
      expect(result.error).toContain('not enabled');
    });

    it('should return error on 403', async () => {
      const error = Object.assign(new Error('Forbidden'), { status: 403 });
      mockOctokit.secretScanning.listAlertsForRepo.mockRejectedValue(error);

      const result = (await handler({ owner: 'owner', repo: 'repo' })) as any;
      expect(result.error).toBeDefined();
    });

    it('should rethrow non-404/403 errors', async () => {
      const error = Object.assign(new Error('Server error'), { status: 500 });
      mockOctokit.secretScanning.listAlertsForRepo.mockRejectedValue(error);

      await expect(handler({ owner: 'owner', repo: 'repo' })).rejects.toThrow('Server error');
    });

    it('should map resolved_by when present', async () => {
      const resolved = {
        ...makeAlert(3),
        state: 'resolved',
        resolution: 'revoked',
        resolved_at: '2024-02-01T00:00:00Z',
        resolved_by: { login: 'secbot', type: 'Bot' },
        push_protection_bypassed: true,
        push_protection_bypassed_by: { login: 'devuser', type: 'User' },
      };
      mockOctokit.secretScanning.listAlertsForRepo.mockResolvedValue({ data: [resolved] });

      const result = (await handler({ owner: 'owner', repo: 'repo' })) as any[];
      expect(result[0].resolved_by).toEqual({ login: 'secbot', type: 'Bot' });
      expect(result[0].push_protection_bypassed_by).toEqual({ login: 'devuser', type: 'User' });
    });
  });

  // ============================================================================
  // get_secret_scanning_alert
  // ============================================================================

  describe('get_secret_scanning_alert', () => {
    let handler: (args: unknown) => Promise<unknown>;

    beforeEach(() => {
      const tool = tools.find(t => t.tool.name === 'get_secret_scanning_alert');
      expect(tool).toBeDefined();
      handler = tool!.handler;
    });

    it('should return alert details', async () => {
      mockOctokit.secretScanning.getAlert.mockResolvedValue({ data: makeAlert(5) });

      const result = (await handler({ owner: 'owner', repo: 'repo', alertNumber: 5 })) as any;
      expect(mockOctokit.secretScanning.getAlert).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        alert_number: 5,
      });
      expect(result.number).toBe(5);
      expect(result.secret_type).toBe('github_personal_access_token');
    });

    it('should map resolved_by with id', async () => {
      const resolved = {
        ...makeAlert(2),
        resolved_by: { login: 'admin', type: 'User', id: 99 },
        push_protection_bypassed_by: { login: 'dev', type: 'User', id: 100 },
      };
      mockOctokit.secretScanning.getAlert.mockResolvedValue({ data: resolved });

      const result = (await handler({ owner: 'owner', repo: 'repo', alertNumber: 2 })) as any;
      expect(result.resolved_by).toEqual({ login: 'admin', type: 'User', id: 99 });
      expect(result.push_protection_bypassed_by).toEqual({ login: 'dev', type: 'User', id: 100 });
    });

    it('should return error on 404', async () => {
      const error = Object.assign(new Error('Not Found'), { status: 404 });
      mockOctokit.secretScanning.getAlert.mockRejectedValue(error);

      const result = (await handler({ owner: 'owner', repo: 'repo', alertNumber: 999 })) as any;
      expect(result.error).toContain('not found');
    });
  });

  // ============================================================================
  // list_secret_scanning_alert_locations
  // ============================================================================

  describe('list_secret_scanning_alert_locations', () => {
    let handler: (args: unknown) => Promise<unknown>;

    beforeEach(() => {
      const tool = tools.find(t => t.tool.name === 'list_secret_scanning_alert_locations');
      expect(tool).toBeDefined();
      handler = tool!.handler;
    });

    it('should list alert locations', async () => {
      mockOctokit.secretScanning.listLocationsForAlert.mockResolvedValue({
        data: [
          { type: 'commit', details: { path: 'src/config.ts', start_line: 10, end_line: 10, blob_sha: 'abc123' } },
        ],
      });

      const result = (await handler({ owner: 'owner', repo: 'repo', alertNumber: 1 })) as any[];
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('commit');
      expect(result[0].details.path).toBe('src/config.ts');
    });

    it('should return error on 404', async () => {
      const error = Object.assign(new Error('Not Found'), { status: 404 });
      mockOctokit.secretScanning.listLocationsForAlert.mockRejectedValue(error);

      const result = (await handler({ owner: 'owner', repo: 'repo', alertNumber: 999 })) as any;
      expect(result.error).toContain('not found');
    });

    it('should rethrow non-404 errors', async () => {
      const error = Object.assign(new Error('Server error'), { status: 500 });
      mockOctokit.secretScanning.listLocationsForAlert.mockRejectedValue(error);

      await expect(handler({ owner: 'owner', repo: 'repo', alertNumber: 1 })).rejects.toThrow('Server error');
    });
  });

  // ============================================================================
  // list_org_secret_scanning_alerts
  // ============================================================================

  describe('list_org_secret_scanning_alerts', () => {
    let handler: (args: unknown) => Promise<unknown>;

    beforeEach(() => {
      const tool = tools.find(t => t.tool.name === 'list_org_secret_scanning_alerts');
      expect(tool).toBeDefined();
      handler = tool!.handler;
    });

    it('should list org alerts', async () => {
      mockOctokit.secretScanning.listAlertsForOrg.mockResolvedValue({
        data: [makeOrgAlert(1, 'repo-a'), makeOrgAlert(2, 'repo-b')],
      });

      const result = (await handler({ org: 'myorg' })) as any[];
      expect(result).toHaveLength(2);
      expect(result[0].repository.full_name).toBe('myorg/repo-a');
      expect(result[0].state).toBe('open');
    });

    it('should handle null repository fields gracefully', async () => {
      const alertNullRepo = {
        ...makeOrgAlert(1),
        repository: null,
      };
      mockOctokit.secretScanning.listAlertsForOrg.mockResolvedValue({ data: [alertNullRepo] });

      const result = (await handler({ org: 'myorg' })) as any[];
      expect(result[0].repository.name).toBe('');
      expect(result[0].repository.owner.login).toBe('');
    });

    it('should handle 403 error', async () => {
      const error = Object.assign(new Error('Forbidden'), { status: 403 });
      mockOctokit.secretScanning.listAlertsForOrg.mockRejectedValue(error);

      const result = (await handler({ org: 'myorg' })) as any;
      expect(result.error).toBeDefined();
    });
  });

  // ============================================================================
  // Write-mode tools
  // ============================================================================

  describe('write-mode registration', () => {
    it('should register update_secret_scanning_alert when not read-only', () => {
      expect(tools.find(t => t.tool.name === 'update_secret_scanning_alert')).toBeDefined();
    });

    it('should NOT register write tools in read-only mode', () => {
      const readOnlyTools = createSecretScanningTools(mockOctokit as any, true);
      expect(readOnlyTools.find(t => t.tool.name === 'update_secret_scanning_alert')).toBeUndefined();
    });
  });

  describe('update_secret_scanning_alert', () => {
    let handler: (args: unknown) => Promise<unknown>;

    beforeEach(() => {
      const tool = tools.find(t => t.tool.name === 'update_secret_scanning_alert');
      handler = tool!.handler;
    });

    it('should update an alert', async () => {
      const updated = {
        ...makeAlert(1),
        state: 'resolved',
        resolution: 'revoked',
        resolved_at: '2024-03-01T00:00:00Z',
        resolved_by: { login: 'admin' },
        resolution_comment: 'Token revoked',
      };
      mockOctokit.secretScanning.updateAlert.mockResolvedValue({ data: updated });

      const result = (await handler({
        owner: 'owner',
        repo: 'repo',
        alertNumber: 1,
        state: 'resolved',
        resolution: 'revoked',
        resolution_comment: 'Token revoked',
      })) as any;

      expect(mockOctokit.secretScanning.updateAlert).toHaveBeenCalledWith(
        expect.objectContaining({ alert_number: 1, state: 'resolved', resolution: 'revoked' })
      );
      expect(result.state).toBe('resolved');
      expect(result.resolution).toBe('revoked');
      expect(result.resolved_by).toEqual({ login: 'admin' });
    });
  });
});
