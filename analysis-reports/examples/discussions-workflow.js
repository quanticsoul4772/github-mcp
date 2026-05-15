/**
 * GitHub Discussions Workflow Example
 * 
 * This example demonstrates a complete discussion workflow using GraphQL tools:
 * 1. List discussion categories
 * 2. Create a new discussion
 * 3. Add comments to the discussion
 * 4. Search for related discussions
 */

async function discussionWorkflow(mcpClient) {
  console.log('🚀 Starting GitHub Discussions Workflow...');

  // Step 1: Get available discussion categories
  console.log('\n📋 Fetching discussion categories...');
  const categories = await mcpClient.callTool('list_discussion_categories', {
    owner: 'myorg',
    repo: 'myproject'
  });

  console.log(`Found ${categories.total_count} categories:`);
  categories.categories.forEach(cat => {
    console.log(`  - ${cat.name} (${cat.slug}): ${cat.description}`);
  });

  // Step 2: Create a new discussion in the appropriate category
  console.log('\n💬 Creating new discussion...');
  const ideasCategory = categories.categories.find(cat => cat.slug === 'ideas');
  
  if (!ideasCategory) {
    throw new Error('Ideas category not found');
  }

  const newDiscussion = await mcpClient.callTool('create_discussion', {
    owner: 'myorg', 
    repo: 'myproject',
    title: 'GraphQL API Performance Improvements',
    body: `## Proposal

I'd like to propose several improvements to our GraphQL API performance:

### Current Issues
- Query complexity limits are too restrictive
- Caching is not properly implemented  
- N+1 query problems in nested resolvers

### Proposed Solutions
1. Implement DataLoader for batching
2. Add Redis caching layer
3. Optimize database queries
4. Increase complexity limits for authenticated users

### Expected Benefits
- 50% reduction in response times
- Better scalability for complex queries
- Improved developer experience

What are your thoughts on this approach?`,
    categoryId: ideasCategory.id
  });

  console.log(`✅ Created discussion: ${newDiscussion.title}`);
  console.log(`   URL: ${newDiscussion.url}`);

  // Step 3: Add a follow-up comment
  console.log('\n💭 Adding follow-up comment...');
  const comment = await mcpClient.callTool('add_discussion_comment', {
    discussionId: newDiscussion.id,
    body: `I've also created a draft PR with some initial performance improvements: #123

The changes include:
- ✅ DataLoader implementation for user resolution
- ✅ Query complexity analysis middleware  
- 🚧 Redis caching (in progress)

Would love to get feedback before proceeding with the full implementation.`
  });

  console.log(`✅ Added comment: ${comment.id}`);

  // Step 4: Search for related discussions
  console.log('\n🔍 Searching for related discussions...');
  const relatedDiscussions = await mcpClient.callTool('search_discussions', {
    query: 'GraphQL performance caching',
    owner: 'myorg',
    repo: 'myproject', 
    first: 5
  });

  console.log(`Found ${relatedDiscussions.total_count} related discussions:`);
  relatedDiscussions.discussions.forEach(discussion => {
    console.log(`  - "${discussion.title}" by ${discussion.author.login}`);
    console.log(`    ${discussion.url}`);
  });

  // Step 5: Get the full discussion with comments
  console.log('\n📖 Retrieving full discussion...');
  const fullDiscussion = await mcpClient.callTool('get_discussion', {
    owner: 'myorg',
    repo: 'myproject',
    discussionNumber: newDiscussion.number
  });

  console.log(`\n📊 Discussion Statistics:`);
  console.log(`  - Title: ${fullDiscussion.title}`);
  console.log(`  - Author: ${fullDiscussion.author.login}`);  
  console.log(`  - Category: ${fullDiscussion.category.name}`);
  console.log(`  - Comments: ${fullDiscussion.comments.totalCount}`);
  console.log(`  - Upvotes: ${fullDiscussion.upvoteCount}`);
  console.log(`  - Can upvote: ${fullDiscussion.viewerCanUpvote ? '✅' : '❌'}`);
  console.log(`  - Can edit: ${fullDiscussion.viewerCanUpdate ? '✅' : '❌'}`);

  console.log('\n✨ Discussion workflow completed successfully!');

  return {
    discussion: fullDiscussion,
    comment: comment,
    relatedDiscussions: relatedDiscussions.discussions
  };
}

// Error handling wrapper
async function runDiscussionWorkflow(mcpClient) {
  try {
    const result = await discussionWorkflow(mcpClient);
    console.log('\n🎉 Workflow completed successfully!');
    return result;
  } catch (error) {
    console.error('\n❌ Workflow failed:', error.message);
    
    // Handle specific GraphQL errors
    if (error.type === 'GraphQLError') {
      console.error('GraphQL Error Details:', error.details);
      
      // Provide specific guidance based on error type
      if (error.message.includes('not accessible by integration')) {
        console.error('💡 Solution: Check that discussions are enabled and your PAT has the required scopes');
      } else if (error.message.includes('rate limit')) {
        console.error('💡 Solution: Wait for rate limit reset or reduce query complexity');
      }
    }
    
    throw error;
  }
}

// Example usage
export { runDiscussionWorkflow };

// If running directly
if (import.meta.url === new URL(import.meta.url).href) {
  // Mock MCP client for demonstration
  const mockClient = {
    async callTool(name, args) {
      console.log(`🔧 Calling ${name} with:`, JSON.stringify(args, null, 2));
      // Return mock data based on tool name
      // In real usage, this would be the actual MCP client
      return { mock: true };
    }
  };

  runDiscussionWorkflow(mockClient);
}