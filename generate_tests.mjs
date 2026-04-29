import { TestGenerationAgent } from './build/agents/testing/test-generation.js';
import fs from 'fs/promises';
import path from 'path';

const testAgent = new TestGenerationAgent();

// Find TypeScript files without corresponding test files
async function findFilesWithoutTests(dir) {
  const files = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    
    if (entry.isDirectory() && !['node_modules', 'dist', 'build', 'coverage', '__tests__'].includes(entry.name)) {
      files.push(...await findFilesWithoutTests(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.ts') && !entry.name.includes('.test.') && !entry.name.includes('.spec.')) {
      // Check if test file exists
      const testFile = fullPath.replace('.ts', '.test.ts');
      const specFile = fullPath.replace('.ts', '.spec.ts');
      
      try {
        await fs.access(testFile);
      } catch {
        try {
          await fs.access(specFile);
        } catch {
          files.push(fullPath);
        }
      }
    }
  }
  
  return files;
}

const filesWithoutTests = await findFilesWithoutTests('src');
console.log(`Found ${filesWithoutTests.length} files without tests`);

const generatedTests = [];

for (const file of filesWithoutTests.slice(0, 5)) { // Limit to 5 files
  try {
    console.log(`Generating tests for ${file}...`);
    
    const testResult = await testAgent.generateTests({
      target: file,
      testType: 'unit',
      framework: 'vitest',
      coverage: { lines: 80, functions: 80, branches: 70 }
    });
    
    const testFilePath = file.replace('.ts', '.test.ts');
    await fs.writeFile(testFilePath, testResult.content);
    
    generatedTests.push({
      sourceFile: file,
      testFile: testFilePath,
      testCases: testResult.metadata.testCases
    });
    
    console.log(`✅ Generated ${testResult.metadata.testCases} test cases for ${file}`);
    
  } catch (error) {
    console.error(`❌ Failed to generate tests for ${file}:`, error.message);
  }
}

await fs.writeFile('generated-tests.json', JSON.stringify(generatedTests, null, 2));

console.log(`\nTest Generation Summary:`);
console.log(`Files processed: ${Math.min(filesWithoutTests.length, 5)}`);
console.log(`Tests generated: ${generatedTests.length}`);
console.log(`Total test cases: ${generatedTests.reduce((sum, t) => sum + t.testCases, 0)}`);
