/**
 * Tests for CodeAnalysisAgent — targeting uncovered branches
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs/promises';
import { CodeAnalysisAgent } from './code-analysis-agent.js';
import { AnalysisContext } from '../types/agent-interfaces.js';

describe('CodeAnalysisAgent branch coverage', () => {
  let agent: CodeAnalysisAgent;
  let tmpDir: string;

  beforeEach(async () => {
    agent = new CodeAnalysisAgent();
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'code-analysis-test-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  function makeContext(files: string[]): AnalysisContext {
    return { projectPath: tmpDir, files };
  }

  // -------------------------------------------------------
  // line 95: isJavaScriptFile branch in analyzeSyntax
  // Needs a .js or .ts file to enter the JS-specific block
  // -------------------------------------------------------
  it('should enter JS-specific syntax analysis for .ts file (line 95)', async () => {
    const testFile = 'sample.ts';
    // Write a file that is a TS file — triggers isJavaScriptFile(file) → true
    await fs.writeFile(
      path.join(tmpDir, testFile),
      `function hello() {\n  return "world"\n}\n`
    );

    const result = await agent.analyze(makeContext([testFile]));
    expect(result.status).toBe('success');
    // The agent at minimum analyzed the JS/TS file and entered the branch
    expect(result.findings).toBeDefined();
  });

  // -------------------------------------------------------
  // line 248: long line > 120 chars triggers style finding
  // -------------------------------------------------------
  it('should flag a line longer than 120 characters (line 248)', async () => {
    const testFile = 'long-line.ts';
    const longLine = '// ' + 'x'.repeat(120); // 123 chars total
    await fs.writeFile(path.join(tmpDir, testFile), `${longLine}\n`);

    const result = await agent.analyze(makeContext([testFile]));
    expect(result.status).toBe('success');
    expect(result.findings.some(f => f.message?.includes('Line too long'))).toBe(true);
  });

  // -------------------------------------------------------
  // line 271: empty catch block pattern
  // Pattern: line has "catch", next line is "{", next-next is "}"
  // -------------------------------------------------------
  it('should flag an empty catch block (line 271)', async () => {
    const testFile = 'empty-catch.ts';
    await fs.writeFile(
      path.join(tmpDir, testFile),
      `try {\n  doSomething();\n} catch (e)\n{\n}\n`
    );

    const result = await agent.analyze(makeContext([testFile]));
    expect(result.status).toBe('success');
    expect(result.findings.some(f => f.message?.includes('Empty catch block'))).toBe(true);
  });

  // -------------------------------------------------------
  // line 383: complexityScore > 5 triggers a recommendation
  // Need 6+ complexity findings → function with >15 conditions
  // -------------------------------------------------------
  it('should recommend refactoring when complexityScore > 5 (line 383)', async () => {
    const testFile = 'high-complexity.ts';
    // A function with 16 if-statements → complexityScore = 5 (10 findings after reaching >10)
    const conditions = Array.from({ length: 20 }, (_, i) => `  if (x === ${i + 1}) { y = ${i + 1}; }`).join('\n');
    const content = `function complexFunction(x: number): number {\n  let y = 0;\n${conditions}\n  return y;\n}\n`;
    await fs.writeFile(path.join(tmpDir, testFile), content);

    const result = await agent.analyze(makeContext([testFile]));
    expect(result.status).toBe('success');
    expect(result.recommendations?.some(r => r.includes('refactoring'))).toBe(true);
  });

  // -------------------------------------------------------
  // canHandle / getPriority / getDependencies
  // -------------------------------------------------------
  it('should handle supported file types', () => {
    expect(agent.canHandle('ts')).toBe(true);
    expect(agent.canHandle('js')).toBe(true);
    expect(agent.canHandle('tsx')).toBe(true);
    expect(agent.canHandle('jsx')).toBe(true);
    expect(agent.canHandle('json')).toBe(true);
    expect(agent.canHandle('md')).toBe(false);
  });

  it('should return priority 10', () => {
    expect(agent.getPriority()).toBe(10);
  });
});
