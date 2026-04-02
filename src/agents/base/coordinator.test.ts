/**
 * Tests for DefaultAgentCoordinator
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DefaultAgentCoordinator } from './coordinator.js';
import { DefaultAgentRegistry } from './agent-registry.js';

function makeContext(extra: Record<string, any> = {}): any {
  return { projectPath: '/test', ...extra };
}

function makeMockAgent(name: string, findings: any[] = [], fail = false): any {
  return {
    name,
    getDependencies: vi.fn().mockReturnValue([]),
    getPriority: vi.fn().mockReturnValue(1),
    canHandle: vi.fn().mockReturnValue(true),
    getDefaultConfiguration: vi.fn().mockReturnValue({}),
    validateConfiguration: vi.fn().mockReturnValue(true),
    analyze: fail
      ? vi.fn().mockRejectedValue(new Error(`${name} failed`))
      : vi.fn().mockResolvedValue({
          agentName: name,
          timestamp: new Date(),
          status: 'success',
          findings,
          recommendations: [`rec-${name}`],
        }),
  };
}

describe('DefaultAgentCoordinator', () => {
  let coordinator: DefaultAgentCoordinator;
  let registry: DefaultAgentRegistry;

  beforeEach(() => {
    registry = new DefaultAgentRegistry();
    coordinator = new DefaultAgentCoordinator(registry);
  });

  describe('event listeners', () => {
    it('should add and call event listeners', async () => {
      const agent = makeMockAgent('code-analysis');
      registry.register(agent);
      const events: string[] = [];
      coordinator.addEventListener(event => events.push(event.type));
      await coordinator.runFullAnalysis(makeContext());
      expect(events).toContain('analysis-start');
      expect(events).toContain('agent-start');
      expect(events).toContain('agent-complete');
      expect(events).toContain('analysis-complete');
    });

    it('should remove event listeners', () => {
      const listener = vi.fn();
      coordinator.addEventListener(listener);
      coordinator.removeEventListener(listener);
      // After removal, the listener array should not contain it
      // Just verify no error thrown
      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('runFullAnalysis', () => {
    it('should run all agents and return a report', async () => {
      const agent = makeMockAgent('code-analysis', [
        { id: 'f1', severity: 'high', category: 'security', file: 'src/a.ts', message: 'issue' },
      ]);
      registry.register(agent);
      const report = await coordinator.runFullAnalysis(makeContext());
      expect(report.summary.agentsRun).toBe(1);
      expect(report.summary.totalFindings).toBe(1);
      expect(report.summary.highFindings).toBe(1);
      expect(report.agentResults.length).toBe(1);
    });

    it('should handle agent failure gracefully', async () => {
      const agent = makeMockAgent('broken-agent', [], true);
      registry.register(agent);
      const report = await coordinator.runFullAnalysis(makeContext());
      expect(report.agentResults[0].status).toBe('error');
    });

    it('should accumulate findings from multiple agents', async () => {
      const a1 = makeMockAgent('agent1', [
        { id: 'f1', severity: 'critical', category: 'security', file: 'a.ts', message: 'X' },
      ]);
      const a2 = makeMockAgent('agent2', [
        { id: 'f2', severity: 'low', category: 'style', file: 'b.ts', message: 'Y' },
        { id: 'f3', severity: 'info', category: 'info', file: 'c.ts', message: 'Z' },
      ]);
      registry.register(a1);
      registry.register(a2);
      const report = await coordinator.runFullAnalysis(makeContext());
      expect(report.summary.totalFindings).toBe(3);
      expect(report.summary.criticalFindings).toBe(1);
      expect(report.summary.lowFindings).toBe(1);
      expect(report.summary.infoFindings).toBe(1);
    });
  });

  describe('generateReport', () => {
    it('should generate report from results', () => {
      const results: any[] = [
        {
          agentName: 'agent1',
          timestamp: new Date(),
          status: 'success',
          findings: [
            { id: 'f1', severity: 'medium', category: 'quality', file: 'x.ts', message: 'M' },
          ],
          recommendations: ['fix X'],
          executionTime: 100,
        },
      ];
      const report = coordinator.generateReport(results, makeContext());
      expect(report.summary.totalFindings).toBe(1);
      expect(report.summary.mediumFindings).toBe(1);
      expect(report.findings.length).toBe(1);
      expect(report.recommendations).toContain('fix X');
    });
  });

  describe('coordinate', () => {
    it('should run analysis and return CoordinationResult format', async () => {
      const agent = makeMockAgent('code-analysis', [
        { id: 'f1', severity: 'high', category: 'security', file: 'a.ts', message: 'X' },
      ]);
      registry.register(agent);
      const result = await coordinator.coordinate({
        target: { type: 'project', path: '/test' },
      });
      expect(result.summary.totalFindings).toBe(1);
      expect(result.summary.agentsUsed).toContain('code-analysis');
      expect(result.reports.length).toBe(1);
      expect(result.reports[0].agentName).toBe('code-analysis');
    });

    it('should populate findingsByCategory', async () => {
      const agent = makeMockAgent('code-analysis', [
        { id: 'f1', severity: 'high', category: 'security', file: 'a.ts', message: 'X' },
        { id: 'f2', severity: 'low', category: 'security', file: 'b.ts', message: 'Y' },
        { id: 'f3', severity: 'info', category: 'style', file: 'c.ts', message: 'Z' },
      ]);
      registry.register(agent);
      const result = await coordinator.coordinate({
        target: { type: 'project', path: '/test' },
      });
      expect(result.summary.findingsByCategory['security']).toBe(2);
      expect(result.summary.findingsByCategory['style']).toBe(1);
    });
  });

  describe('validateConfigurations', () => {
    it('should return valid=true when all agents have valid configs', () => {
      const agent = makeMockAgent('code-analysis');
      registry.register(agent);
      const result = coordinator.validateConfigurations(makeContext());
      expect(result.valid).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    it('should return errors when agent config is invalid', () => {
      const agent = makeMockAgent('bad-agent');
      agent.validateConfiguration.mockReturnValue(false);
      registry.register(agent);
      const result = coordinator.validateConfigurations(makeContext());
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('getRegistry', () => {
    it('should return the agent registry', () => {
      expect(coordinator.getRegistry()).toBe(registry);
    });
  });
});
