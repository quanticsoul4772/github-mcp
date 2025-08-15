/**
 * GitHub Projects V2 Automation Example
 * 
 * This example demonstrates automated project management using GraphQL tools:
 * 1. List organization projects
 * 2. Get project structure and custom fields  
 * 3. Add items to projects automatically
 * 4. Update project item fields
 */

async function projectsAutomation(mcpClient, orgName) {
  console.log(`🏗️ Starting Projects V2 automation for ${orgName}...`);

  // Step 1: Get all organization projects
  console.log('\n📊 Fetching organization projects...');
  const projects = await mcpClient.callTool('get_project_boards', {
    owner: orgName,
    first: 10
  });

  console.log(`Found ${projects.total_count} projects:`);
  projects.projects.forEach(project => {
    console.log(`  - ${project.title} (#${project.number})`);
    console.log(`    ${project.shortDescription}`);
    console.log(`    ${project.public ? '🌍 Public' : '🔒 Private'} | ${project.closed ? '❌ Closed' : '✅ Open'}`);
  });

  // Step 2: Select the active development project
  const devProject = projects.projects.find(p => 
    p.title.toLowerCase().includes('development') || 
    p.title.toLowerCase().includes('sprint')
  );

  if (!devProject) {
    throw new Error('No development project found');
  }

  console.log(`\n🎯 Selected project: ${devProject.title}`);

  // Step 3: Get project structure and custom fields
  console.log('\n🔧 Analyzing project structure...');
  const projectFields = await mcpClient.callTool('get_project_fields', {
    projectId: devProject.id
  });

  console.log(`Project has ${projectFields.fields.length} custom fields:`);
  projectFields.fields.forEach(field => {
    console.log(`  - ${field.name} (${field.dataType})`);
    if (field.options) {
      console.log(`    Options: ${field.options.map(o => o.name).join(', ')}`);
    }
  });

  // Step 4: Get current project items
  console.log('\n📋 Fetching current project items...');
  const projectItems = await mcpClient.callTool('get_project_items', {
    projectId: devProject.id,
    first: 20
  });

  console.log(`Project has ${projectItems.total_count} items:`);
  const itemsByStatus = {};
  
  projectItems.items.forEach(item => {
    const status = item.fieldValues?.find(fv => fv.field.name === 'Status')?.value || 'No Status';
    itemsByStatus[status] = (itemsByStatus[status] || 0) + 1;
    
    console.log(`  - ${item.content?.title || 'No title'} (${item.content?.type})`);
    console.log(`    Status: ${status}`);
  });

  console.log(`\n📈 Items by status:`);
  Object.entries(itemsByStatus).forEach(([status, count]) => {
    console.log(`  ${status}: ${count} items`);
  });

  // Step 5: Find issues that should be added to project
  console.log('\n🔍 Finding issues to add to project...');
  
  // This would typically search for issues with specific labels
    // Prefer reliable filtering: fetch and filter client-side against current project items
    const newIssues = await mcpClient.callTool('search_issues_advanced', {
      query: `org:${orgName} is:open label:"needs-triage"`,
      first: 5
    });
    const existingItemContentIds = new Set(
      projectItems.items
        .map(i => i.content?.node_id)
        .filter(Boolean)
    );
    const candidateIssues = newIssues.issues.filter(i => !existingItemContentIds.has(i.node_id));

  for (const issue of newIssues.issues.slice(0, 3)) { // Limit to 3 for demo
    console.log(`\n➕ Adding issue: ${issue.title}`);
    
    const newItem = await mcpClient.callTool('create_project_item', {
      projectId: devProject.id,
      contentId: issue.node_id,
      contentType: 'Issue'
    });

    console.log(`   ✅ Added as project item: ${newItem.id}`);

    // Set initial field values
    const statusField = projectFields.fields.find(f => f.name === 'Status');
    const priorityField = projectFields.fields.find(f => f.name === 'Priority'); 

    if (statusField) {
      const todoOption = statusField.options?.find(o => o.name.toLowerCase().includes('todo'));
      if (todoOption) {
        await mcpClient.callTool('update_project_item', {
          itemId: newItem.id,
          fieldId: statusField.id,
          value: todoOption.id
        });
        console.log(`   📝 Set status to: ${todoOption.name}`);
      }
    }

    if (priorityField && issue.labels.some(l => l.name.includes('urgent'))) {
      const highPriority = priorityField.options?.find(o => o.name.toLowerCase().includes('high'));
      if (highPriority) {
        await mcpClient.callTool('update_project_item', {
          itemId: newItem.id, 
          fieldId: priorityField.id,
          value: highPriority.id
        });
        console.log(`   🔥 Set priority to: High`);
      }
    }

    addedItems.push({
      item: newItem,
      issue: issue
    });
  }

  // Step 6: Generate project status report
  console.log('\n📊 Generating project status report...');
  
  const updatedItems = await mcpClient.callTool('get_project_items', {
    projectId: devProject.id,
    first: 50
  });

  const report = generateProjectReport(devProject, updatedItems, projectFields.fields);
  console.log(report);

  console.log('\n✨ Project automation completed successfully!');

  return {
    project: devProject,
    addedItems: addedItems,
    report: report
  };
}

function generateProjectReport(project, items, fields) {
  const statusField = fields.find(f => f.name === 'Status');
  const priorityField = fields.find(f => f.name === 'Priority');
  
  const statusCounts = {};
  const priorityCounts = {};
  const typesCounts = {};

  items.items.forEach(item => {
    // Count by status
    const status = item.fieldValues?.find(fv => fv.field.name === 'Status')?.value || 'No Status';
    statusCounts[status] = (statusCounts[status] || 0) + 1;

    // Count by priority  
    const priority = item.fieldValues?.find(fv => fv.field.name === 'Priority')?.value || 'No Priority';
    priorityCounts[priority] = (priorityCounts[priority] || 0) + 1;

    // Count by content type
    const type = item.content?.type || 'Unknown';
    typesCounts[type] = (typesCounts[type] || 0) + 1;
  });

  return `
📋 ${project.title} - Project Report
${'='.repeat(50)}

📊 Overview:
  • Total Items: ${items.total_count}
  • Project Status: ${project.closed ? 'Closed' : 'Active'}
  • Visibility: ${project.public ? 'Public' : 'Private'}

📈 Items by Status:
${Object.entries(statusCounts).map(([status, count]) => 
  `  • ${status}: ${count} items`
).join('\n')}

🔥 Items by Priority:
${Object.entries(priorityCounts).map(([priority, count]) => 
  `  • ${priority}: ${count} items`
).join('\n')}

📝 Items by Type:
${Object.entries(typesCounts).map(([type, count]) => 
  `  • ${type}: ${count} items`
).join('\n')}

🎯 Next Actions:
  • Review items in "Todo" status
  • Address high priority items first
  • Update project fields as work progresses
`;
}

// Error handling wrapper with retry logic
async function runProjectsAutomation(mcpClient, orgName, options = {}) {
  const { retries = 3, retryDelay = 1000 } = options;
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(attempt > 1 ? `\n🔄 Retry attempt ${attempt}/${retries}` : '');
      
      const result = await projectsAutomation(mcpClient, orgName);
      console.log('\n🎉 Project automation completed successfully!');
      return result;
      
    } catch (error) {
      console.error(`\n❌ Attempt ${attempt} failed:`, error.message);
      
      // Handle specific errors
      if (error.type === 'GraphQLError') {
        console.error('GraphQL Error Details:', error.details);
        
        if (error.message.includes('rate limit')) {
          console.error('💡 Rate limit hit, waiting before retry...');
          if (attempt < retries) {
            await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
            continue;
          }
        } else if (error.message.includes('not found')) {
          console.error('💡 Resource not found - check project access permissions');
          break; // Don't retry for not found errors
        }
      }
      
      if (attempt === retries) {
        console.error('\n💥 All retry attempts exhausted');
        throw error;
      }
      
      await new Promise(resolve => setTimeout(resolve, retryDelay));
    }
  }
}

// Example usage
export { runProjectsAutomation };

// If running directly
if (import.meta.url === new URL(import.meta.url).href) {
  // Mock MCP client for demonstration
  const mockClient = {
    async callTool(name, args) {
      console.log(`🔧 Calling ${name} with:`, JSON.stringify(args, null, 2));
      
      // Return realistic mock data based on tool name
      switch (name) {
        case 'get_project_boards':
          return {
            total_count: 3,
            projects: [
              {
                id: 'PN_kwHOABCD1234',
                number: 1,
                title: 'Development Sprint Q4',
                shortDescription: 'Current development sprint',
                public: false,
                closed: false
              }
            ]
          };
        default:
          return { mock: true, tool: name };
      }
    }
  };

  runProjectsAutomation(mockClient, 'myorg');
}