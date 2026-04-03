/**
 * Tests for TestingAgent — targeting uncovered branches
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs/promises';
import { TestingAgent } from './testing-agent.js';
import { AnalysisContext } from '../types/agent-interfaces.js';

describe('TestingAgent branch coverage', () => {
  let agent: TestingAgent;
  let tmpDir: string;

  beforeEach(async () => {
    agent = new TestingAgent();
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'testing-agent-test-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  function makeContext(files: string[]): AnalysisContext {
    return { projectPath: tmpDir, files };
  }

  // --------------------------------------------------------
  // line 274: !hasTest (test file with no test cases)
  // --------------------------------------------------------
  it('should flag a test file containing no test cases (line 274)', async () => {
    const testFile = 'empty-suite.test.ts';
    await fs.writeFile(
      path.join(tmpDir, testFile),
      `
describe('EmptySuite', () => {
  // No test cases
  const helper = () => true;
});
`
    );

    const result = await agent.analyze(makeContext([testFile]));
    expect(result.status).toBe('success');
    expect(result.findings.some(f => f.message?.toLowerCase().includes('no test'))).toBe(true);
  });

  // --------------------------------------------------------
  // line 283: testCount > 20 (test file with >20 test cases)
  // --------------------------------------------------------
  it('should flag a test file with more than 20 tests (line 283)', async () => {
    const testFile = 'large-suite.test.ts';
    const cases = Array.from(
      { length: 21 },
      (_, i) => `  it('test case ${i + 1}', () => { expect(true).toBe(true); });`
    ).join('\n');

    await fs.writeFile(
      path.join(tmpDir, testFile),
      `describe('LargeSuite', () => {\n${cases}\n});\n`
    );

    const result = await agent.analyze(makeContext([testFile]));
    expect(result.status).toBe('success');
    expect(result.findings.some(f => f.message?.includes('Large number'))).toBe(true);
  });

  // --------------------------------------------------------
  // line 330: weak assertion (toBeTruthy / toBeFalsy)
  // --------------------------------------------------------
  it('should flag weak toBeTruthy() assertions (line 330)', async () => {
    const testFile = 'weak-assertions.test.ts';
    await fs.writeFile(
      path.join(tmpDir, testFile),
      `
describe('WeakAssertions', () => {
  it('uses toBeTruthy', () => {
    expect(someValue).toBeTruthy();
  });

  it('uses toBeFalsy', () => {
    expect(otherValue).toBeFalsy();
  });
});
`
    );

    const result = await agent.analyze(makeContext([testFile]));
    expect(result.status).toBe('success');
    expect(result.findings.some(f => f.category === 'weak-assertion')).toBe(true);
  });

  // --------------------------------------------------------
  // analyzeTestQuality: content is null (readFile returns null)
  // --------------------------------------------------------
  it('should handle non-existent test file gracefully (content === null)', async () => {
    const result = await agent.analyze(
      makeContext(['does-not-exist.test.ts'])
    );
    expect(result.status).toBe('success');
    // No crash, empty or minimal findings
  });

  // --------------------------------------------------------
  // canHandle / getPriority / getDependencies
  // --------------------------------------------------------
  it('should handle source file types', () => {
    expect(agent.canHandle('ts')).toBe(true);
    expect(agent.canHandle('js')).toBe(true);
    expect(agent.canHandle('tsx')).toBe(true);
    expect(agent.canHandle('jsx')).toBe(true);
    expect(agent.canHandle('md')).toBe(false);
  });

  it('should return priority 30', () => {
    expect(agent.getPriority()).toBe(30);
  });

  it('should return code-analysis as dependency', () => {
    expect(agent.getDependencies()).toContain('code-analysis');
  });
});
