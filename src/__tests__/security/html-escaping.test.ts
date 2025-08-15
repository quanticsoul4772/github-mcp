/**
 * Security tests for HTML escaping functionality
 * 
 * These tests verify that our HTML escaping implementation properly prevents
 * XSS attacks and handles edge cases securely.
 */

import {
  escapeHtml,
  escapeHtmlAttribute,
  escapeJavaScript,
  isHtmlSafe,
  stripHtmlTags,
  safeHtmlTemplate,
  safeStringify
} from '../../utils/html-security.js';

import {
  ReportGenerator,
  generateHtmlReport,
  generatePlainTextReport,
  type ReportData
} from '../../agents/reporting/report-generator.js';

describe('HTML Security - XSS Prevention', () => {
  describe('escapeHtml', () => {
    it('should escape basic HTML characters', () => {
      expect(escapeHtml('<script>alert("xss")</script>'))
        .toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;&#x2F;script&gt;');
    });

    it('should escape all dangerous characters', () => {
      const dangerous = '&<>"\'`=/:';
      const expected = '&amp;&lt;&gt;&quot;&#x27;&#x60;&#x3D;&#x2F;&#x3A;';
      expect(escapeHtml(dangerous)).toBe(expected);
    });

    it('should handle empty strings', () => {
      expect(escapeHtml('')).toBe('');
    });

    it('should handle strings without dangerous characters', () => {
      const safe = 'Hello World 123';
      expect(escapeHtml(safe)).toBe(safe);
    });

    it('should throw error for non-string input', () => {
      expect(() => escapeHtml(null as any)).toThrow('escapeHtml expects a string input');
      expect(() => escapeHtml(123 as any)).toThrow('escapeHtml expects a string input');
      expect(() => escapeHtml({} as any)).toThrow('escapeHtml expects a string input');
    });

    it('should prevent XSS injection attempts', () => {
      const xssAttempts = [
        '<img src="x" onerror="alert(1)">',
        '<svg onload="alert(1)">',
        'javascript:alert(1)',
        '<iframe src="javascript:alert(1)"></iframe>',
        '<script>document.cookie</script>',
        '<div onclick="alert(1)">Click me</div>',
        '"><script>alert(1)</script>',
        '\';alert(1);//',
        '<script>fetch("/steal-data")</script>'
      ];

      xssAttempts.forEach(attempt => {
        const escaped = escapeHtml(attempt);
        expect(escaped).not.toContain('<script');
        // These should be escaped, so we check they contain the escaped versions
        if (attempt.includes('javascript:')) {
          expect(escaped).toContain('javascript&#x3A;');
        }
        if (attempt.includes('onerror=')) {
          expect(escaped).toContain('onerror&#x3D;');
        }
        if (attempt.includes('onload=')) {
          expect(escaped).toContain('onload&#x3D;');
        }
        if (attempt.includes('onclick=')) {
          expect(escaped).toContain('onclick&#x3D;');
        }
      });
    });
  });

  describe('escapeHtmlAttribute', () => {
    it('should escape attribute-specific characters', () => {
      const input = 'user"input with spaces';
      const result = escapeHtmlAttribute(input);
      expect(result).toBe('user&quot;input&#x20;with&#x20;spaces');
    });

    it('should handle attribute injection attempts', () => {
      const malicious = '" onmouseover="alert(1)" x="';
      const escaped = escapeHtmlAttribute(malicious);
      expect(escaped).toContain('&quot;&#x20;onmouseover&#x3D;&quot;alert(1)&quot;&#x20;x&#x3D;&quot;');
      expect(escaped).not.toContain('onmouseover="alert'); // Should not contain unescaped version
    });
  });

  describe('escapeJavaScript', () => {
    it('should escape JavaScript string breakers', () => {
      const input = 'alert("hello"); //comment';
      const result = escapeJavaScript(input);
      expect(result).toBe('alert(\\\"hello\\\"); \\x2F\\x2Fcomment');
    });

    it('should handle newlines and control characters', () => {
      const input = 'line1\nline2\r\tindented';
      const result = escapeJavaScript(input);
      expect(result).toBe('line1\\nline2\\r\\tindented');
    });

    it('should prevent script injection in JavaScript context', () => {
      const malicious = '"; alert("xss"); //';
      const escaped = escapeJavaScript(malicious);
      expect(escaped).toBe('\\\"; alert(\\\"xss\\\"); \\x2F\\x2F');
    });
  });

  describe('isHtmlSafe', () => {
    it('should identify safe strings', () => {
      expect(isHtmlSafe('Hello World 123')).toBe(true);
      expect(isHtmlSafe('user@example.com')).toBe(true);
      expect(isHtmlSafe('')).toBe(true);
    });

    it('should identify unsafe strings', () => {
      expect(isHtmlSafe('<script>')).toBe(false);
      expect(isHtmlSafe('user"input')).toBe(false);
      expect(isHtmlSafe('a&b')).toBe(false);
    });

    it('should handle non-string inputs', () => {
      expect(isHtmlSafe(null as any)).toBe(false);
      expect(isHtmlSafe(undefined as any)).toBe(false);
      expect(isHtmlSafe(123 as any)).toBe(false);
    });
  });

  describe('stripHtmlTags', () => {
    it('should remove HTML tags', () => {
      const html = '<p>Hello <strong>world</strong>!</p>';
      expect(stripHtmlTags(html)).toBe('Hello world!');
    });

    it('should decode common entities', () => {
      const html = '&lt;script&gt;alert(&quot;test&quot;)&lt;/script&gt;';
      expect(stripHtmlTags(html)).toBe('<script>alert("test")</script>');
    });

    it('should handle malformed HTML', () => {
      const malformed = '<p>Unclosed tag <div>content';
      expect(stripHtmlTags(malformed)).toBe('Unclosed tag content');
    });
  });

  describe('safeHtmlTemplate', () => {
    it('should safely interpolate values', () => {
      const template = '<div class="{{className}}">{{content}}</div>';
      const values = {
        className: 'user-content',
        content: '<script>alert("xss")</script>'
      };
      
      const result = safeHtmlTemplate(template, values);
      expect(result).toBe('<div class="user-content">&lt;script&gt;alert(&quot;xss&quot;)&lt;&#x2F;script&gt;</div>');
    });

    it('should handle missing values', () => {
      const template = '<div>{{missing}}</div>';
      const result = safeHtmlTemplate(template, {});
      expect(result).toBe('<div></div>');
    });

    it('should validate inputs', () => {
      expect(() => safeHtmlTemplate(123 as any, {})).toThrow();
      expect(() => safeHtmlTemplate('template', null as any)).toThrow();
    });
  });

  describe('safeStringify', () => {
    it('should handle various data types safely', () => {
      expect(safeStringify('string')).toBe('string');
      expect(safeStringify('<script>')).toBe('&lt;script&gt;');
      expect(safeStringify(123)).toBe('123');
      expect(safeStringify(true)).toBe('true');
      expect(safeStringify(null)).toBe('');
      expect(safeStringify(undefined)).toBe('');
    });

    it('should safely stringify objects', () => {
      const obj = { key: '<script>alert("xss")</script>' };
      const result = safeStringify(obj);
      expect(result).toContain('&lt;script&gt;');
      expect(result).not.toContain('<script>');
    });
  });
});

describe('ReportGenerator', () => {
  let generator: ReportGenerator;
  let mockReportData: ReportData;

  beforeEach(() => {
    generator = new ReportGenerator();
    mockReportData = {
      title: 'Test Report',
      summary: 'This is a test report summary',
      sections: [
        {
          title: 'Section 1',
          content: 'Section content',
          data: {
            key1: 'value1',
            key2: '<script>alert("xss")</script>'
          }
        }
      ],
      metadata: {
        generatedAt: new Date('2024-01-01T00:00:00Z'),
        generatedBy: 'Test User',
        version: '1.0.0',
        repository: 'test/repo',
        branch: 'main'
      }
    };
  });

  describe('generateReport', () => {
    it('should generate secure HTML report', () => {
      const html = generator.generateReport(mockReportData);
      
      // Should contain escaped content in data table
      expect(html).toContain('&lt;script&gt;'); // Properly escaped
      expect(html).not.toContain('<script>alert');
      
      // Should contain proper HTML structure
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<html lang="en">');
      expect(html).toContain('Test Report');
    });

    it('should escape malicious input in all fields', () => {
      const maliciousData: ReportData = {
        title: '<script>alert("title")</script>',
        summary: '<img src="x" onerror="alert(1)">',
        sections: [
          {
            title: '<svg onload="alert(1)">',
            content: '"><script>alert("content")</script>',
            data: {
              malicious: '<iframe src="javascript:alert(1)"></iframe>'
            }
          }
        ],
        metadata: {
          generatedAt: new Date(),
          generatedBy: '<script>alert("user")</script>',
          version: '"><script>alert("version")</script>',
          repository: 'javascript:alert("repo")',
          branch: '<script>alert("branch")</script>'
        }
      };

      const html = generator.generateReport(maliciousData);
      
      // Verify no unescaped scripts
      expect(html).not.toContain('<script>alert');
      expect(html).toContain('javascript&#x3A;alert'); // Should be escaped
      expect(html).toContain('onerror&#x3D;'); // Should be escaped
      expect(html).toContain('onload&#x3D;'); // Should be escaped
      
      // Verify content is properly escaped
      expect(html).toContain('&lt;script&gt;');
      expect(html).toContain('&lt;img');
      expect(html).toContain('&lt;svg');
      expect(html).toContain('&lt;iframe');
    });

    it('should validate input data', () => {
      expect(() => generator.generateReport(null as any)).toThrow();
      expect(() => generator.generateReport({} as any)).toThrow();
      
      const invalidData = { ...mockReportData, title: null };
      expect(() => generator.generateReport(invalidData as any)).toThrow();
    });
  });

  describe('generatePlainTextReport', () => {
    it('should generate safe plain text report', () => {
      const text = generator.generatePlainTextReport(mockReportData);
      
      expect(text).toContain('TEST REPORT');
      expect(text).toContain('Section 1');
      expect(text).toContain('Generated: 2024-01-01T00:00:00.000Z');
      expect(text).not.toContain('<script>');
    });
  });
});

describe('Report Generation Functions', () => {
  const mockData: ReportData = {
    title: 'Security Test Report',
    summary: 'Testing XSS prevention',
    sections: [
      {
        title: 'XSS Test Section',
        content: '<script>alert("This should be escaped")</script>',
        data: {
          maliciousInput: '<img src="x" onerror="alert(1)">'
        }
      }
    ],
    metadata: {
      generatedAt: new Date('2024-01-01'),
      generatedBy: 'Security Tester',
      version: '1.0.0'
    }
  };

  it('should generate secure HTML report via convenience function', () => {
    const html = generateHtmlReport(mockData);
    
    expect(html).toContain('&lt;script&gt;'); // Properly escaped
    expect(html).toContain('&lt;img'); // Properly escaped
    expect(html).not.toContain('<script>alert');
    expect(html).toContain('onerror&#x3D;'); // Should be escaped
  });

  it('should generate secure plain text report via convenience function', () => {
    const text = generatePlainTextReport(mockData);
    
    expect(text).toContain('SECURITY TEST REPORT');
    expect(text).not.toContain('<script>'); // Should be stripped in plain text
    expect(text).not.toContain('<img'); // Should be stripped in plain text
  });
});

describe('Security Regression Tests', () => {
  it('should prevent the original DOM-based vulnerability', () => {
    // This test ensures we never regress to the vulnerable implementation
    const maliciousInput = '<script>alert("xss")</script>';
    
    // The old vulnerable code would have failed in Node.js anyway,
    // but this ensures our new implementation is secure
    const escaped = escapeHtml(maliciousInput);
    
    expect(escaped).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;&#x2F;script&gt;');
    expect(escaped).not.toContain('<script>');
    // Note: 'alert(' is still present but in escaped form, which is safe
  });

  it('should handle edge cases that could bypass escaping', () => {
    const edgeCases = [
      '\u003cscript\u003e',  // Unicode encoded
      '&lt;script&gt;',     // Already encoded
      '<SCRIPT>',            // Uppercase
      '<script\n>',          // With newline
      '<script\t>',          // With tab
      '<script >',           // With space
      '<<script>script>',    // Nested
      '<script><!--',        // With comment
      '<script>/*',          // With JS comment
    ];

    edgeCases.forEach(testCase => {
      const escaped = escapeHtml(testCase);
      expect(escaped).not.toMatch(/<script[^>]*>/i);
    });
  });

  it('should maintain performance with large inputs', () => {
    const largeInput = '<script>alert("xss")</script>'.repeat(10000);
    
    const start = Date.now();
    const escaped = escapeHtml(largeInput);
    const duration = Date.now() - start;
    
    // Should complete within reasonable time (less than 100ms for 10k repetitions)
    expect(duration).toBeLessThan(100);
    expect(escaped).not.toContain('<script>');
  });
});