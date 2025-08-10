/**
 * GraphQL query complexity calculation for GitHub's point-based rate limiting
 * 
 * GitHub GraphQL API uses a point-based rate limiting system:
 * - 5000 points per hour
 * - Different queries cost different points based on complexity
 * - Nested queries and connections increase complexity
 * 
 * Reference: https://docs.github.com/en/graphql/overview/resource-limitations
 */

interface ComplexityConfig {
  baseQueryCost: number;
  fieldCosts: Record<string, number>;
  connectionMultiplier: number;
  nestedQueryMultiplier: number;
  maxComplexityPerQuery: number;
}

interface QueryAnalysis {
  estimatedPoints: number;
  breakdown: {
    baseFields: number;
    connections: number;
    nestedQueries: number;
    totalFields: number;
  };
  warnings: string[];
}

/**
 * Default complexity configuration based on GitHub's GraphQL API patterns
 */
const DEFAULT_COMPLEXITY_CONFIG: ComplexityConfig = {
  baseQueryCost: 1,
  fieldCosts: {
    // High-cost fields
    'history': 5,
    'commits': 5,
    'collaborators': 3,
    'languages': 2,
    'repositoryTopics': 1,
    'issues': 2,
    'pullRequests': 2,
    'releases': 2,
    'discussions': 3,
    'projectsV2': 4,
    'milestones': 2,
    'reactions': 1,
    'reviews': 2,
    'assignees': 1,
    'labels': 1,
    'comments': 1,
    
    // Search operations (higher cost)
    'search': 10,
    'repositories': 5,
    'users': 3,
    'organizations': 3,
    
    // Medium-cost fields
    'defaultBranchRef': 2,
    'primaryLanguage': 1,
    'licenseInfo': 1,
    'owner': 1,
    'author': 1,
    'creator': 1,
    
    // Low-cost scalar fields
    'id': 0,
    'name': 0,
    'login': 0,
    'title': 0,
    'description': 0,
    'url': 0,
    'createdAt': 0,
    'updatedAt': 0,
    'stargazerCount': 0,
    'forkCount': 0,
    'state': 0,
    'number': 0,
  },
  connectionMultiplier: 1.5,
  nestedQueryMultiplier: 2,
  maxComplexityPerQuery: 1000,
};

/**
 * Calculates the estimated complexity points for a GraphQL query
 */
export class GraphQLComplexityCalculator {
  private config: ComplexityConfig;

  constructor(config: Partial<ComplexityConfig> = {}) {
    this.config = { ...DEFAULT_COMPLEXITY_CONFIG, ...config };
  }

  /**
   * Calculate complexity for a GraphQL query string
   */
  calculateQueryComplexity(query: string, variables: Record<string, any> = {}): QueryAnalysis {
    const analysis: QueryAnalysis = {
      estimatedPoints: 0,
      breakdown: {
        baseFields: 0,
        connections: 0,
        nestedQueries: 0,
        totalFields: 0,
      },
      warnings: [],
    };

    try {
      // Parse the query to extract field information
      const fields = this.extractFields(query);
      const connections = this.extractConnections(query, variables);
      const nestedQueries = this.extractNestedQueries(query);

      // Calculate base field costs
      let baseFieldCost = this.config.baseQueryCost;
      for (const field of fields) {
        const fieldCost = this.config.fieldCosts[field] || 1;
        baseFieldCost += fieldCost;
      }
      analysis.breakdown.baseFields = baseFieldCost;
      analysis.breakdown.totalFields = fields.length;

      // Calculate connection costs (based on 'first' parameter)
      let connectionCost = 0;
      for (const connection of connections) {
        const multiplier = this.config.connectionMultiplier;
        const connectionBaseCost = this.config.fieldCosts[connection.field] || 2;
        const itemCount = connection.first || 10; // Default 'first' value
        connectionCost += Math.ceil(connectionBaseCost * multiplier * Math.log(itemCount + 1));
      }
      analysis.breakdown.connections = connectionCost;

      // Calculate nested query costs
      let nestedQueryCost = 0;
      for (const nestedQuery of nestedQueries) {
        const multiplier = this.config.nestedQueryMultiplier;
        const nestingLevel = nestedQuery.level || 1;
        nestedQueryCost += Math.ceil(multiplier * Math.pow(nestingLevel, 1.5));
      }
      analysis.breakdown.nestedQueries = nestedQueryCost;

      // Calculate total estimated points
      analysis.estimatedPoints = baseFieldCost + connectionCost + nestedQueryCost;

      // Add warnings for high complexity
      if (analysis.estimatedPoints > this.config.maxComplexityPerQuery) {
        analysis.warnings.push(
          `Query complexity (${analysis.estimatedPoints}) exceeds recommended maximum (${this.config.maxComplexityPerQuery})`
        );
      }

      if (connections.some(c => (c.first || 10) > 100)) {
        analysis.warnings.push('Large connection limits detected - consider pagination for better performance');
      }

      if (nestedQueries.length > 3) {
        analysis.warnings.push('High query nesting detected - consider breaking into multiple queries');
      }

    } catch (error) {
      analysis.warnings.push(`Failed to parse query: ${error instanceof Error ? error.message : 'Unknown error'}`);
      // Fallback to conservative estimate
      analysis.estimatedPoints = 50;
    }

    return analysis;
  }

  /**
   * Extract field names from a GraphQL query
   */
  private extractFields(query: string): string[] {
    const fields: string[] = [];
    
    // Simple regex-based extraction - matches field names
    const fieldRegex = /(\w+)\s*(?:\([^)]*\))?\s*\{|(\w+)(?!\s*[:(])/g;
    let match;
    
    while ((match = fieldRegex.exec(query)) !== null) {
      const fieldName = match[1] || match[2];
      if (fieldName && 
          !['query', 'mutation', 'subscription', 'fragment', 'on'].includes(fieldName.toLowerCase()) &&
          !fieldName.startsWith('$')) {
        fields.push(fieldName);
      }
    }
    
    return [...new Set(fields)]; // Remove duplicates
  }

  /**
   * Extract connection fields with their limits
   */
  private extractConnections(query: string, variables: Record<string, any>): Array<{field: string, first?: number}> {
    const connections: Array<{field: string, first?: number}> = [];
    
    // Look for fields with 'first' parameter
    const connectionRegex = /(\w+)\s*\([^)]*first:\s*(?:\$(\w+)|(\d+))[^)]*\)/g;
    let match;
    
    while ((match = connectionRegex.exec(query)) !== null) {
      const fieldName = match[1];
      const variableName = match[2];
      const literalValue = match[3];
      
      if (!fieldName) continue;
      
      let firstValue: number | undefined;
      if (variableName && variables[variableName]) {
        firstValue = parseInt(variables[variableName]);
      } else if (literalValue) {
        firstValue = parseInt(literalValue);
      }
      
      connections.push({
        field: fieldName,
        first: firstValue,
      });
    }
    
    return connections;
  }

  /**
   * Extract nested query information
   */
  private extractNestedQueries(query: string): Array<{level: number}> {
    const nestedQueries: Array<{level: number}> = [];
    
    // Count nesting levels by counting opening braces
    let level = 0;
    let maxLevel = 0;
    let nestedCount = 0;
    
    for (const char of query) {
      if (char === '{') {
        level++;
        maxLevel = Math.max(maxLevel, level);
        if (level > 2) { // Consider nesting after query and first field level
          nestedCount++;
        }
      } else if (char === '}') {
        level--;
      }
    }
    
    // Add nested queries based on detected nesting
    for (let i = 0; i < Math.ceil(nestedCount / 3); i++) {
      nestedQueries.push({ level: Math.min(maxLevel - 1, 5) });
    }
    
    return nestedQueries;
  }

  /**
   * Get recommended query optimization suggestions
   */
  getOptimizationSuggestions(analysis: QueryAnalysis): string[] {
    const suggestions: string[] = [];

    if (analysis.estimatedPoints > 100) {
      suggestions.push('Consider breaking this query into smaller, focused queries');
    }

    if (analysis.breakdown.connections > analysis.breakdown.baseFields) {
      suggestions.push('Use pagination with smaller "first" values and implement pagination logic');
    }

    if (analysis.breakdown.nestedQueries > 20) {
      suggestions.push('Reduce query nesting depth by fetching related data in separate queries');
    }

    if (analysis.breakdown.totalFields > 20) {
      suggestions.push('Request only the fields you actually need to reduce complexity');
    }

    return suggestions;
  }

  /**
   * Estimate points for common query patterns
   */
  estimatePatternComplexity(pattern: 'repository_basic' | 'repository_detailed' | 'search_repositories' | 'user_profile' | 'batch_repositories'): number {
    const patterns = {
      'repository_basic': 5,
      'repository_detailed': 25,
      'search_repositories': 15,
      'user_profile': 8,
      'batch_repositories': 40,
    };

    return patterns[pattern] || 10;
  }
}

/**
 * Pre-configured calculator for GitHub GraphQL API
 */
export const githubComplexityCalculator = new GraphQLComplexityCalculator();

/**
 * Quick complexity estimation for common operations
 */
export function estimateGraphQLPoints(
  query: string, 
  variables: Record<string, any> = {},
  calculator: GraphQLComplexityCalculator = githubComplexityCalculator
): number {
  return calculator.calculateQueryComplexity(query, variables).estimatedPoints;
}

/**
 * Check if a query is within safe complexity limits
 */
export function isQueryComplexitySafe(
  query: string,
  variables: Record<string, any> = {},
  maxPoints: number = 50
): { safe: boolean; points: number; warnings: string[] } {
  const analysis = githubComplexityCalculator.calculateQueryComplexity(query, variables);
  
  return {
    safe: analysis.estimatedPoints <= maxPoints,
    points: analysis.estimatedPoints,
    warnings: analysis.warnings,
  };
}