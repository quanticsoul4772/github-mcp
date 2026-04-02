/**
 * Tests for Dependabot tools
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createDependabotTools } from './dependabot.js';

// Minimal alert shape
const makeAlert = (number = 1) => ({
  number,
  state: 'open',
  dependency: {
    package: { ecosystem: 'npm', name: 'lodash' },
    manifest_path: 'package.json',
    scope: 'runtime',
  },
  security_advisory: {
    ghsa_id: 'GHSA-xxxx-yyyy-zzzz',
    cve_id: 'CVE-2021-23456',
    summary: 'Prototype Pollution in lodash',
    description: 'Affected versions allow prototype pollution.',
    severity: 'high',
    identifiers: [],
    references: [],
    published_at: '2021-01-01T00:00:00Z',
    updated_at: '2021-06-01T00:00:00Z',
    withdrawn_at: null,
    vulnerabilities: [],
    cvss: { vector_string: 'CVSS:3.1/AV:N', score: 7.5 },
    cwes: [],
  },
  security_vulnerability: {
    package: { ecosystem: 'npm', name: 'lodash' },
    severity: 'high',
    vulnerable_version_range: '< 4.17.21',
    first_patched_version: { identifier: '4.17.21' },
  },
  url: `https://api.github.com/repos/owner/repo/dependabot/alerts/${number}`,
  html_url: `https://github.com/owner/repo/security/dependabot/${number}`,
  created_at: '2021-01-15T00:00:00Z',
  updated_at: '2021-01-15T00:00:00Z',
  dismissed_at: null,
  dismissed_by: null,
  dismissed_reason: null,
  dismissed_comment: null,
  fixed_at: null,
  auto_dismissed_at: null,
});

const makeOctokit = () => ({
  dependabot: {
    listAlertsForRepo: vi.fn(),
    getAlert: vi.fn(),
    listRepoSecrets: vi.fn(),
    updateAlert: vi.fn(),
    createOrUpdateRepoSecret: vi.fn(),
    deleteRepoSecret: vi.fn(),
  },
});

describe('Dependabot Tools', () => {
  let mockOctokit: ReturnType<typeof makeOctokit>;
  let tools: ReturnType<typeof createDependabotTools>;

  beforeEach(() => {
    mockOctokit = makeOctokit();
    tools = createDependabotTools(mockOctokit as any, false);
  });

  // ============================================================================
  // list_dependabot_alerts
  // ============================================================================

  describe('list_dependabot_alerts', () => {
    let handler: (args: unknown) => Promise<unknown>;

    beforeEach(() => {
      const tool = tools.find(t => t.tool.name === 'list_dependabot_alerts');
      expect(tool).toBeDefined();
      handler = tool!.handler;
    });

    it('should be registered', () => {
      expect(tools.find(t => t.tool.name === 'list_dependabot_alerts')).toBeDefined();
    });

    it('should list alerts successfully', async () => {
      mockOctokit.dependabot.listAlertsForRepo.mockResolvedValue({
        data: [makeAlert(1), makeAlert(2)],
      });

      const result = (await handler({ owner: 'owner', repo: 'repo' })) as any[];
      expect(result).toHaveLength(2);
      expect(result[0].number).toBe(1);
      expect(result[0].state).toBe('open');
      expect(result[0].security_advisory.severity).toBe('high');
      expect(result[0].dependency.package.name).toBe('lodash');
    });

    it('should pass state and severity filters', async () => {
      mockOctokit.dependabot.listAlertsForRepo.mockResolvedValue({ data: [] });

      await handler({ owner: 'owner', repo: 'repo', state: 'open', severity: 'critical' });
      expect(mockOctokit.dependabot.listAlertsForRepo).toHaveBeenCalledWith(
        expect.objectContaining({ state: 'open', severity: 'critical' })
      );
    });

    it('should return error object on 404', async () => {
      const error = Object.assign(new Error('Not Found'), { status: 404 });
      mockOctokit.dependabot.listAlertsForRepo.mockRejectedValue(error);

      const result = (await handler({ owner: 'owner', repo: 'repo' })) as any;
      expect(result.error).toContain('not available');
    });

    it('should return error object on 403', async () => {
      const error = Object.assign(new Error('Forbidden'), { status: 403 });
      mockOctokit.dependabot.listAlertsForRepo.mockRejectedValue(error);

      const result = (await handler({ owner: 'owner', repo: 'repo' })) as any;
      expect(result.error).toBeDefined();
    });

    it('should rethrow non-404/403 errors', async () => {
      const error = Object.assign(new Error('Server error'), { status: 500 });
      mockOctokit.dependabot.listAlertsForRepo.mockRejectedValue(error);

      await expect(handler({ owner: 'owner', repo: 'repo' })).rejects.toThrow('Server error');
    });

    it('should handle dismissed_by field when present', async () => {
      const alertWithDismissal = {
        ...makeAlert(3),
        dismissed_at: '2021-02-01T00:00:00Z',
        dismissed_by: { login: 'securitybot', id: 99 },
        dismissed_reason: 'tolerable_risk',
        dismissed_comment: 'Low exploitability',
      };
      mockOctokit.dependabot.listAlertsForRepo.mockResolvedValue({ data: [alertWithDismissal] });

      const result = (await handler({ owner: 'owner', repo: 'repo' })) as any[];
      expect(result[0].dismissed_by).toEqual({ login: 'securitybot' });
      expect(result[0].dismissed_reason).toBe('tolerable_risk');
    });
  });

  // ============================================================================
  // get_dependabot_alert
  // ============================================================================

  describe('get_dependabot_alert', () => {
    let handler: (args: unknown) => Promise<unknown>;

    beforeEach(() => {
      const tool = tools.find(t => t.tool.name === 'get_dependabot_alert');
      expect(tool).toBeDefined();
      handler = tool!.handler;
    });

    it('should return alert details', async () => {
      mockOctokit.dependabot.getAlert.mockResolvedValue({ data: makeAlert(5) });

      const result = (await handler({ owner: 'owner', repo: 'repo', alertNumber: 5 })) as any;
      expect(mockOctokit.dependabot.getAlert).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        alert_number: 5,
      });
      expect(result.number).toBe(5);
      expect(result.security_advisory.ghsa_id).toBe('GHSA-xxxx-yyyy-zzzz');
      expect(result.security_vulnerability.vulnerable_version_range).toBe('< 4.17.21');
    });

    it('should return error object on 404', async () => {
      const error = Object.assign(new Error('Not Found'), { status: 404 });
      mockOctokit.dependabot.getAlert.mockRejectedValue(error);

      const result = (await handler({ owner: 'owner', repo: 'repo', alertNumber: 999 })) as any;
      expect(result.error).toContain('not found');
    });
  });

  // ============================================================================
  // list_dependabot_secrets
  // ============================================================================

  describe('list_dependabot_secrets', () => {
    let handler: (args: unknown) => Promise<unknown>;

    beforeEach(() => {
      const tool = tools.find(t => t.tool.name === 'list_dependabot_secrets');
      expect(tool).toBeDefined();
      handler = tool!.handler;
    });

    it('should list secrets successfully', async () => {
      mockOctokit.dependabot.listRepoSecrets.mockResolvedValue({
        data: {
          total_count: 2,
          secrets: [
            { name: 'NPM_TOKEN', created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z' },
            { name: 'DOCKER_TOKEN', created_at: '2024-01-02T00:00:00Z', updated_at: '2024-01-02T00:00:00Z' },
          ],
        },
      });

      const result = (await handler({ owner: 'owner', repo: 'repo' })) as any;
      expect(result.total_count).toBe(2);
      expect(result.secrets).toHaveLength(2);
      expect(result.secrets[0].name).toBe('NPM_TOKEN');
    });

    it('should handle 404/403 with error object', async () => {
      const error = Object.assign(new Error('Not Found'), { status: 404 });
      mockOctokit.dependabot.listRepoSecrets.mockRejectedValue(error);

      const result = (await handler({ owner: 'owner', repo: 'repo' })) as any;
      expect(result.error).toBeDefined();
    });
  });

  // ============================================================================
  // Write-mode tools
  // ============================================================================

  describe('write-mode registration', () => {
    it('should register write tools when not read-only', () => {
      const writeTools = ['update_dependabot_alert', 'set_dependabot_secret', 'delete_dependabot_secret'];
      for (const name of writeTools) {
        expect(tools.find(t => t.tool.name === name)).toBeDefined();
      }
    });

    it('should NOT register write tools in read-only mode', () => {
      const readOnlyTools = createDependabotTools(mockOctokit as any, true);
      expect(readOnlyTools.find(t => t.tool.name === 'update_dependabot_alert')).toBeUndefined();
      expect(readOnlyTools.find(t => t.tool.name === 'set_dependabot_secret')).toBeUndefined();
      expect(readOnlyTools.find(t => t.tool.name === 'delete_dependabot_secret')).toBeUndefined();
    });
  });

  describe('update_dependabot_alert', () => {
    let handler: (args: unknown) => Promise<unknown>;

    beforeEach(() => {
      const tool = tools.find(t => t.tool.name === 'update_dependabot_alert');
      handler = tool!.handler;
    });

    it('should update alert state', async () => {
      const updatedAlert = { ...makeAlert(1), state: 'dismissed', dismissed_reason: 'tolerable_risk' };
      mockOctokit.dependabot.updateAlert.mockResolvedValue({ data: updatedAlert });

      const result = (await handler({
        owner: 'owner',
        repo: 'repo',
        alertNumber: 1,
        state: 'dismissed',
        dismissed_reason: 'tolerable_risk',
        dismissed_comment: 'Reviewed and accepted',
      })) as any;

      expect(mockOctokit.dependabot.updateAlert).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        alert_number: 1,
        state: 'dismissed',
        dismissed_reason: 'tolerable_risk',
        dismissed_comment: 'Reviewed and accepted',
      });
      expect(result.state).toBe('dismissed');
    });
  });

  describe('set_dependabot_secret', () => {
    let handler: (args: unknown) => Promise<unknown>;

    beforeEach(() => {
      const tool = tools.find(t => t.tool.name === 'set_dependabot_secret');
      handler = tool!.handler;
    });

    it('should set a secret and return success', async () => {
      mockOctokit.dependabot.createOrUpdateRepoSecret.mockResolvedValue({});

      const result = (await handler({
        owner: 'owner',
        repo: 'repo',
        secret_name: 'NPM_TOKEN',
        encrypted_value: 'base64encoded==',
        key_id: 'key123',
      })) as any;

      expect(mockOctokit.dependabot.createOrUpdateRepoSecret).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        secret_name: 'NPM_TOKEN',
        encrypted_value: 'base64encoded==',
        key_id: 'key123',
      });
      expect(result.success).toBe(true);
      expect(result.message).toContain('NPM_TOKEN');
    });
  });

  describe('delete_dependabot_secret', () => {
    let handler: (args: unknown) => Promise<unknown>;

    beforeEach(() => {
      const tool = tools.find(t => t.tool.name === 'delete_dependabot_secret');
      handler = tool!.handler;
    });

    it('should delete a secret and return success', async () => {
      mockOctokit.dependabot.deleteRepoSecret.mockResolvedValue({});

      const result = (await handler({
        owner: 'owner',
        repo: 'repo',
        secret_name: 'NPM_TOKEN',
      })) as any;

      expect(mockOctokit.dependabot.deleteRepoSecret).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        secret_name: 'NPM_TOKEN',
      });
      expect(result.success).toBe(true);
    });
  });
});
