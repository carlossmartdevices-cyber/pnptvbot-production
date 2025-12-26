# MCP Server Setup Guide - Fabrica de Bots (MCP SDK)

## Overview

This guide explains how to use the `fabrica-de-bots` repository, which contains the **Model Context Protocol (MCP) TypeScript SDK** (`@modelcontextprotocol/sdk` v1.23.0). This SDK enables you to create custom MCP servers for AI-powered code generation and automation.

## Prerequisites

- Node.js >= 18.0.0
- npm >= 9.0.0
- Continue IDE extension installed in VS Code
- TypeScript knowledge (recommended)

## What's Included

The `fabrica-de-bots` repo contains:
- **MCP SDK**: Full TypeScript implementation of Model Context Protocol
- **Server components**: `stdio`, `sse`, `streamableHttp` transports
- **Client components**: For building MCP clients
- **Validation utilities**: Zod-based schema validation
- **Examples**: Sample implementations

## Setup Instructions

### 1. Clone & Build the SDK

```bash
# Clone into a sibling directory
cd C:\Users\carlo\Documents
git clone https://github.com/carlossmartdevices-cyber/fabrica-de-bots.git
cd fabrica-de-bots

# Install dependencies
npm install

# Build the SDK
npm run build
```

### 2. Create a Custom MCP Server for PNPtv

Create a new file `pnptv-mcp-server.js` in your project:

```javascript
// pnptv-mcp-server.js
import { McpServer } from '../fabrica-de-bots/dist/esm/server/mcp.js';
import { StdioServerTransport } from '../fabrica-de-bots/dist/esm/server/stdio.js';

const server = new McpServer({
  name: 'pnptv-bot-tools',
  version: '1.0.0',
});

// Register your custom tools here
server.tool('generate_handler', 'Generate Telegram bot handlers', async (params) => {
  // Implementation
  return { content: [{ type: 'text', text: 'Handler generated' }] };
});

// Start the server
const transport = new StdioServerTransport();
await server.connect(transport);
```

### 3. Configure Continue to Use Your MCP Server

Edit `.continue/config.yaml`:

```yaml
mcpServers:
  # PNPtv Custom MCP Server (using fabrica-de-bots SDK)
  - command: node
    args: ["./pnptv-mcp-server.js"]
    env:
      BOT_TOKEN: "${BOT_TOKEN}"
      NODE_OPTIONS: "--experimental-vm-modules"
```

### 4. Environment Variables

Ensure the following environment variables are set in your `.env` file:

```env
# MCP Server Configuration
NODE_OPTIONS=--experimental-vm-modules

# Your existing bot tokens
BOT_TOKEN=your_telegram_bot_token
```

### 5. Restart Continue

1. Close VS Code completely
2. Reopen VS Code
3. The Continue extension will reload and connect to the MCP server

## SDK Components

The fabrica-de-bots SDK includes:

### Server Transports
- `StdioServerTransport` - For command-line based MCP servers
- `SSEServerTransport` - For Server-Sent Events over HTTP
- `StreamableHTTPServerTransport` - For HTTP streaming

### Client Components
- `Client` - For building MCP clients
- `StdioClientTransport` - Connect to stdio servers
- `SSEClientTransport` - Connect to SSE servers

### Validation
- Zod-based schema validation
- JSON Schema compatibility

## Creating Custom Tools

## Creating Custom Tools

### Example: PNPtv Bot Tools Server

Create `scripts/mcp-server.mjs`:

```javascript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import fs from 'fs/promises';
import path from 'path';

const server = new McpServer({
  name: 'pnptv-tools',
  version: '1.0.0',
});

// Tool: Generate Telegram Handler
server.tool(
  'create_handler',
  {
    name: z.string().describe('Handler name'),
    type: z.enum(['command', 'callback', 'message']).describe('Handler type'),
    description: z.string().describe('What the handler does'),
  },
  async ({ name, type, description }) => {
    const template = generateHandlerTemplate(name, type, description);
    const filePath = `src/bot/handlers/${name}.js`;
    await fs.writeFile(filePath, template);
    return {
      content: [{ type: 'text', text: `Created handler at ${filePath}` }],
    };
  }
);

// Tool: Analyze Code
server.tool(
  'analyze_code',
  {
    filePath: z.string().describe('Path to file to analyze'),
  },
  async ({ filePath }) => {
    const content = await fs.readFile(filePath, 'utf-8');
    // Perform analysis...
    return {
      content: [{ type: 'text', text: `Analysis of ${filePath}:\n...` }],
    };
  }
);

// Tool: Run Tests
server.tool(
  'run_tests',
  {
    testFile: z.string().optional().describe('Specific test file'),
  },
  async ({ testFile }) => {
    const { exec } = await import('child_process');
    const cmd = testFile ? `npm test -- ${testFile}` : 'npm test';
    // Run tests...
    return {
      content: [{ type: 'text', text: 'Tests completed' }],
    };
  }
);

function generateHandlerTemplate(name, type, description) {
  return `/**
 * ${description}
 * @module handlers/${name}
 */
const logger = require('../../utils/logger');

module.exports = (bot) => {
  bot.${type === 'command' ? 'command' : type === 'callback' ? 'action' : 'on'}('${name}', async (ctx) => {
    try {
      // TODO: Implement ${name} handler
      await ctx.reply('Handler ${name} executed');
    } catch (error) {
      logger.error('Error in ${name}:', error);
      await ctx.reply('An error occurred');
    }
  });
};
`;
}

// Start server
const transport = new StdioServerTransport();
await server.connect(transport);
console.error('PNPtv MCP Server running on stdio');
```

### Using the SDK Directly (Alternative)

If you have the fabrica-de-bots repo locally:

```javascript
// Import directly from the SDK
import { McpServer } from '../fabrica-de-bots/dist/esm/server/mcp.js';
import { StdioServerTransport } from '../fabrica-de-bots/dist/esm/server/stdio.js';
```

## Usage Examples

### Example 1: Create a New Handler

In Continue chat:
```
Use the create_handler tool to make a new subscription handler
- Name: subscriptionHandler
- Type: command  
- Description: Handle /subscribe command with payment integration
```

### Example 2: Analyze Code

```
Use the analyze_code tool on src/bot/services/paymentSecurityService.js
Check for security issues and suggest improvements
```

### Example 3: Run Tests

```
Use the run_tests tool to run tests for the payment module
```

## Continue Configuration

### Basic Config (`.continue/config.yaml`)

```yaml
name: PNPtv Development
version: 1.0.0
schema: v1

models:
  - name: Claude
    provider: anthropic
    model: claude-sonnet-4-20250514
    apiKey: ${ANTHROPIC_API_KEY}

mcpServers:
  # Your custom PNPtv MCP server
  - command: node
    args: ["scripts/mcp-server.mjs"]
    env:
      NODE_OPTIONS: "--experimental-vm-modules"
```

### With NPM Package (if published)

```yaml
mcpServers:
  - command: npx
    args: ["-y", "@modelcontextprotocol/sdk", "run", "pnptv-tools"]
```

## Troubleshooting

### Build Errors

**Error:** `npm run build` fails

**Solution:**
```bash
cd C:\Users\carlo\Documents\fabrica-de-bots
rm -rf node_modules dist
npm install
npm run build
```

### MCP Server Won't Start

**Error:** `ERR_MODULE_NOT_FOUND`

**Solution:**
1. Ensure you're using `"type": "module"` in package.json
2. Use `.mjs` extension for ES modules
3. Add `NODE_OPTIONS=--experimental-vm-modules`

### Import Errors

**Error:** `Cannot find module`

**Solution:**
```bash
# Install the SDK as a dependency
npm install @modelcontextprotocol/sdk

# Or link locally
cd C:\Users\carlo\Documents\fabrica-de-bots
npm link
cd C:\Users\carlo\Documents\pnptvbot-production
npm link @modelcontextprotocol/sdk
```

## SDK API Reference

### McpServer

```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

const server = new McpServer({
  name: string,      // Server name
  version: string,   // Server version
});

// Register a tool
server.tool(
  name: string,           // Tool name
  schema: ZodSchema,      // Parameter schema
  handler: async (params) => Result  // Handler function
);

// Register a resource
server.resource(
  uri: string,
  handler: async () => Resource
);

// Connect transport
await server.connect(transport);
```

### Transports

```typescript
// Stdio (for CLI-based servers)
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
const transport = new StdioServerTransport();

// SSE (for HTTP-based servers)
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
const transport = new SSEServerTransport(req, res);

// HTTP Streaming
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
```

## Security Considerations

1. **API Keys**: Never commit API keys to version control
   - Store in `.env` file (add to `.gitignore`)
   - Use GitHub Secrets for CI/CD

2. **Access Control**: Restrict MCP server access
   - Only run on development machines
   - Use authentication for remote instances

3. **Data Privacy**: Be cautious with sensitive data
   - Don't send production credentials to the MCP
   - Use anonymized/dummy data for testing

## Integration with PNPtv Bot

### Full PNPtv MCP Server Example

Create `scripts/pnptv-mcp-server.mjs`:

```javascript
#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import fs from 'fs/promises';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const server = new McpServer({
  name: 'pnptv-bot-tools',
  version: '1.0.0',
});

// === CODE GENERATION TOOLS ===

server.tool(
  'create_telegram_handler',
  {
    handlerName: z.string(),
    handlerType: z.enum(['command', 'action', 'on']),
    command: z.string(),
    description: z.string(),
  },
  async ({ handlerName, handlerType, command, description }) => {
    const code = `
const logger = require('../../utils/logger');

/**
 * ${description}
 */
module.exports = (bot) => {
  bot.${handlerType}('${command}', async (ctx) => {
    try {
      const userId = ctx.from?.id;
      logger.info('${handlerName} called', { userId });
      
      // TODO: Implement handler logic
      await ctx.reply('${handlerName} executed successfully');
    } catch (error) {
      logger.error('Error in ${handlerName}:', error);
      await ctx.reply('An error occurred. Please try again.');
    }
  });
};
`;
    const filePath = \`src/bot/handlers/\${handlerName}.js\`;
    await fs.writeFile(filePath, code);
    return { content: [{ type: 'text', text: \`Created \${filePath}\` }] };
  }
);

server.tool(
  'create_service',
  {
    serviceName: z.string(),
    methods: z.array(z.string()),
  },
  async ({ serviceName, methods }) => {
    const methodsCode = methods.map(m => \`
  static async \${m}() {
    try {
      // TODO: Implement \${m}
      logger.info('\${serviceName}.\${m} called');
    } catch (error) {
      logger.error('Error in \${serviceName}.\${m}:', error);
      throw error;
    }
  }\`).join('\\n');

    const code = \`
const logger = require('../../utils/logger');

class \${serviceName} {
\${methodsCode}
}

module.exports = \${serviceName};
\`;
    const filePath = \`src/services/\${serviceName}.js\`;
    await fs.writeFile(filePath, code);
    return { content: [{ type: 'text', text: \`Created \${filePath}\` }] };
  }
);

// === TESTING TOOLS ===

server.tool(
  'run_tests',
  {
    testPath: z.string().optional(),
    coverage: z.boolean().optional(),
  },
  async ({ testPath, coverage }) => {
    const cmd = coverage 
      ? \`npm run test -- --coverage \${testPath || ''}\`
      : \`npm test -- \${testPath || ''}\`;
    
    try {
      const { stdout, stderr } = await execAsync(cmd);
      return { content: [{ type: 'text', text: stdout || stderr }] };
    } catch (error) {
      return { content: [{ type: 'text', text: \`Test failed: \${error.message}\` }] };
    }
  }
);

// === DATABASE TOOLS ===

server.tool(
  'run_migration',
  {
    migrationName: z.string().optional(),
  },
  async ({ migrationName }) => {
    const cmd = migrationName 
      ? \`npm run migrate -- \${migrationName}\`
      : 'npm run migrate';
    
    const { stdout } = await execAsync(cmd);
    return { content: [{ type: 'text', text: stdout }] };
  }
);

// Start server
const transport = new StdioServerTransport();
await server.connect(transport);
console.error('PNPtv MCP Server started');
```

### Add to package.json

```json
{
  "scripts": {
    "mcp-server": "node scripts/pnptv-mcp-server.mjs"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.23.0",
    "zod": "^3.22.0"
  }
}
```

## Additional Resources

- [MCP Specification](https://spec.modelcontextprotocol.io/)
- [MCP TypeScript SDK Docs](https://github.com/modelcontextprotocol/typescript-sdk)
- [Continue.dev Documentation](https://docs.continue.dev/)
- [Telegram Bot API](https://core.telegram.org/bots/api)
- [Fabrica de Bots (MCP SDK Fork)](https://github.com/carlossmartdevices-cyber/fabrica-de-bots)
- [Zod Schema Validation](https://zod.dev/)

## Quick Start Checklist

- [ ] Clone fabrica-de-bots: `git clone https://github.com/carlossmartdevices-cyber/fabrica-de-bots.git`
- [ ] Install dependencies: `cd fabrica-de-bots && npm install`
- [ ] Build SDK: `npm run build`
- [ ] Create MCP server script in `scripts/pnptv-mcp-server.mjs`
- [ ] Configure Continue in `.continue/config.yaml`
- [ ] Restart VS Code
- [ ] Test MCP tools in Continue chat

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review Continue logs: VS Code Output panel → "Continue"
3. Check MCP server logs: `npm run dev` in fabrica-de-bots directory
4. Open an issue in the project repository

---

**Last Updated**: November 26, 2025
**Version**: 1.0.0
