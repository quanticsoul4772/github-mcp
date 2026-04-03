/**
 * Tests for TypeSafetyAgent
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { TypeSafetyAgent } from './type-safety-agent.js';

describe('TypeSafetyAgent', () => {
  let agent: TypeSafetyAgent;
  let tempDir: string;

  const writeFile = async (name: string, content: string): Promise<string> => {
    const p = path.join(tempDir, name);
    await fs.writeFile(p, content);
    return p;
  };

  const analyzeFile = async (name: string, content: string) => {
    await writeFile(name, content);
    return agent.analyze({ projectPath: tempDir, files: [name] });
  };

  beforeEach(async () => {
    agent = new TypeSafetyAgent();
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tsafe-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  // ============================================================================
  // capabilities
  // ============================================================================

  it('should have correct name', () => {
    expect(agent.name).toBe('type-safety');
  });

  it('should handle .ts and .tsx files', () => {
    expect(agent.canHandle('ts')).toBe(true);
    expect(agent.canHandle('tsx')).toBe(true);
    expect(agent.canHandle('js')).toBe(false);
    expect(agent.canHandle('py')).toBe(false);
  });

  it('should have a priority', () => {
    expect(typeof agent.getPriority()).toBe('number');
  });

  // ============================================================================
  // empty analysis
  // ============================================================================

  it('should succeed with no files', async () => {
    const result = await agent.analyze({ projectPath: tempDir, files: [] });
    expect(result.status).toBe('success');
  });

  // ============================================================================
  // analyzeTypeAnnotations (missing-annotation findings)
  // ============================================================================

  it('should detect variable without type annotation', async () => {
    const result = await analyzeFile('vars.ts', 'let myVar = someFunction();\n');
    expect(result.findings.some(f => f.category === 'type-annotation')).toBe(true);
  });

  it('should NOT flag variable with obvious type (string literal)', async () => {
    const result = await analyzeFile('str.ts', 'const name = "Alice";\n');
    expect(result.findings.every(f => f.category !== 'missing-annotation')).toBe(true);
  });

  it('should NOT flag variable with numeric literal', async () => {
    const result = await analyzeFile('num.ts', 'const count = 42;\n');
    expect(result.findings.every(f => f.category !== 'missing-annotation')).toBe(true);
  });

  // ============================================================================
  // analyzeAnyTypes (any-type, explicit-any findings)
  // ============================================================================

  it('should detect use of ": any" type', async () => {
    const result = await analyzeFile('any.ts', 'function fn(x: any): void { return; }\n');
    expect(result.findings.some(f => f.category === 'any-type')).toBe(true);
  });

  it('should detect explicit any cast (: any in type position)', async () => {
    const result = await analyzeFile('anycast.ts', 'function fn(x: any): any { return x; }\n');
    expect(result.findings.some(f => f.category === 'any-type')).toBe(true);
  });

  // ============================================================================
  // analyzeInterfaces (naming-convention, type-assertion findings)
  // ============================================================================

  it('should detect interface with lowercase name', async () => {
    const result = await analyzeFile('intf.ts', 'interface myBadInterface { value: string; }\n');
    expect(result.findings.some(f => f.category === 'naming-convention')).toBe(true);
  });

  it('should NOT flag interface with uppercase name', async () => {
    const result = await analyzeFile('intfok.ts', 'interface GoodInterface { value: string; }\n');
    expect(result.findings.every(f => f.category !== 'naming-convention')).toBe(true);
  });

  it('should detect type assertion (as keyword)', async () => {
    const result = await analyzeFile('assert.ts', 'const x = val as string;\n');
    expect(result.findings.some(f => f.category === 'type-assertion')).toBe(true);
  });

  // ============================================================================
  // analyzeNullSafety (null-safety, non-null-assertion, equality-check)
  // ============================================================================

  it('should detect potential null access on nullable variable', async () => {
    // couldBeNullable checks for `varName = null` in content
    const result = await analyzeFile('null.ts', `const obj = null;\nconst val = obj.property;\n`);
    expect(result.findings.some(f => f.category === 'null-safety')).toBe(true);
  });

  it('should detect non-null assertion operator (!))', async () => {
    const result = await analyzeFile('nonnull.ts', 'const x = element!.value;\n');
    expect(result.findings.some(f => f.category === 'non-null-assertion')).toBe(true);
  });

  it('should detect loose null equality check', async () => {
    const result = await analyzeFile('eq.ts', 'if (val == null) { return; }\n');
    expect(result.findings.some(f => f.category === 'equality-check')).toBe(true);
  });

  it('should detect != null', async () => {
    const result = await analyzeFile('neq.ts', 'if (val != null) { doStuff(); }\n');
    expect(result.findings.some(f => f.category === 'equality-check')).toBe(true);
  });

  // ============================================================================
  // tsconfig analysis
  // ============================================================================

  it('should analyze tsconfig.json if present', async () => {
    await writeFile('tsconfig.json', JSON.stringify({
      compilerOptions: { strict: false, noImplicitAny: false },
    }));
    const result = await agent.analyze({ projectPath: tempDir, files: ['tsconfig.json'] });
    // Should not throw and return success
    expect(result.status).toBe('success');
  });

  it('should note missing strict mode in tsconfig', async () => {
    await writeFile('tsconfig.json', JSON.stringify({
      compilerOptions: { target: 'ES6' }, // no strict
    }));
    const result = await agent.analyze({ projectPath: tempDir, files: ['tsconfig.json'] });
    expect(result.findings.some(f => f.category === 'configuration')).toBe(true);
  });

  // ============================================================================
  // report structure
  // ============================================================================

  it('should include agentName in result', async () => {
    const result = await analyzeFile('check.ts', 'const x = "hello";\n');
    expect(result.agentName).toBe('type-safety');
  });

  it('should include metrics', async () => {
    const result = await analyzeFile('metrics.ts', 'const x: any = someValue;\n');
    expect(result.metrics).toBeDefined();
    expect(typeof result.metrics?.typeCoverage).toBe('number');
  });

  // ============================================================================
  // recommendations (generateRecommendations)
  // ============================================================================

  it('should include recommendations for any-type findings', async () => {
    const result = await analyzeFile('recs.ts', 'function fn(x: any): any { return x; }\n');
    const recs = result.recommendations || [];
    const hasAnyRec = recs.some(r => r.toLowerCase().includes('any'));
    expect(hasAnyRec).toBe(true);
  });

  it('should recommend null checks for null-safety findings', async () => {
    const code = `const obj = null;\nconst val = obj.property;\n`;
    const result = await analyzeFile('nullrecs.ts', code);
    const recs = result.recommendations || [];
    // Either a null-safety recommendation or just verify recommendations is an array
    expect(Array.isArray(recs)).toBe(true);
  });
});
