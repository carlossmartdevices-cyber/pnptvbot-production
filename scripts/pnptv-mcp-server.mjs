#!/usr/bin/env node
/**
 * PNPtv MCP Server
 * Custom Model Context Protocol server for PNPtv Telegram Bot development
 * 
 * Uses @modelcontextprotocol/sdk from fabrica-de-bots repository
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const server = new McpServer({
  name: 'pnptv-bot-tools',
  version: '1.0.0',
  description: 'MCP tools for PNPtv Telegram Bot development',
});

// ============================================
// CODE GENERATION TOOLS
// ============================================

/**
 * Create a new Telegram bot handler
 */
server.tool(
  'create_telegram_handler',
  {
    handlerName: z.string().describe('Name of the handler (e.g., subscriptionHandler)'),
    handlerType: z.enum(['command', 'action', 'on', 'hears']).describe('Type of Telegraf handler'),
    trigger: z.string().describe('Command/action trigger (e.g., "subscribe" or /subscribe)'),
    description: z.string().describe('Description of what the handler does'),
    withPayment: z.boolean().optional().describe('Include payment integration'),
    withDatabase: z.boolean().optional().describe('Include database operations'),
  },
  async ({ handlerName, handlerType, trigger, description, withPayment, withDatabase }) => {
    const imports = [
      "const logger = require('../../utils/logger');",
    ];
    
    if (withPayment) {
      imports.push("const StripeService = require('../../services/stripeService');");
    }
    if (withDatabase) {
      imports.push("const { query } = require('../../config/postgres');");
    }

    const code = `${imports.join('\n')}

/**
 * ${description}
 * @module handlers/${handlerName}
 */
module.exports = (bot) => {
  bot.${handlerType}('${trigger}', async (ctx) => {
    try {
      const userId = ctx.from?.id;
      const username = ctx.from?.username || 'Unknown';
      
      logger.info('${handlerName} triggered', { userId, username });
      
      // TODO: Implement handler logic
      ${withPayment ? `
      // Payment integration example
      // const paymentIntent = await StripeService.createPaymentIntent(amount, userId);
      ` : ''}
      ${withDatabase ? `
      // Database query example
      // const result = await query('SELECT * FROM users WHERE telegram_id = $1', [userId]);
      ` : ''}
      
      await ctx.reply('${handlerName} executed successfully');
      
    } catch (error) {
      logger.error('Error in ${handlerName}:', {
        error: error.message,
        userId: ctx.from?.id,
      });
      await ctx.reply('❌ An error occurred. Please try again later.');
    }
  });
};
`;

    const filePath = `src/bot/handlers/${handlerName}.js`;
    await fs.writeFile(filePath, code, 'utf-8');
    
    return {
      content: [{
        type: 'text',
        text: `✅ Created handler at ${filePath}\n\nTo use this handler, add to your bot initialization:\n\nconst ${handlerName} = require('./handlers/${handlerName}');\n${handlerName}(bot);`,
      }],
    };
  }
);

/**
 * Create a new service class
 */
server.tool(
  'create_service',
  {
    serviceName: z.string().describe('Name of the service class (e.g., NotificationService)'),
    methods: z.array(z.object({
      name: z.string(),
      params: z.array(z.string()).optional(),
      description: z.string(),
    })).describe('Array of method definitions'),
    withRedis: z.boolean().optional().describe('Include Redis caching'),
    withDatabase: z.boolean().optional().describe('Include database operations'),
  },
  async ({ serviceName, methods, withRedis, withDatabase }) => {
    const imports = [
      "const logger = require('../../utils/logger');",
    ];
    
    if (withRedis) {
      imports.push("const cache = require('../../config/redis');");
    }
    if (withDatabase) {
      imports.push("const { query } = require('../../config/postgres');");
    }

    const methodsCode = methods.map(m => {
      const params = m.params?.join(', ') || '';
      return `
  /**
   * ${m.description}
   */
  static async ${m.name}(${params}) {
    try {
      logger.info('${serviceName}.${m.name} called'${params ? `, { ${m.params?.map(p => p).join(', ')} }` : ''});
      
      // TODO: Implement ${m.name}
      ${withRedis ? `
      // Redis caching example
      // const cached = await cache.get('key');
      // if (cached) return JSON.parse(cached);
      ` : ''}
      ${withDatabase ? `
      // Database query example
      // const result = await query('SELECT ...', []);
      // return result.rows;
      ` : ''}
      
      return null;
    } catch (error) {
      logger.error('Error in ${serviceName}.${m.name}:', error);
      throw error;
    }
  }`;
    }).join('\n');

    const code = `${imports.join('\n')}

/**
 * ${serviceName}
 * @class
 */
class ${serviceName} {
${methodsCode}
}

module.exports = ${serviceName};
`;

    const filePath = `src/services/${serviceName.charAt(0).toLowerCase() + serviceName.slice(1)}.js`;
    await fs.writeFile(filePath, code, 'utf-8');
    
    return {
      content: [{
        type: 'text',
        text: `✅ Created service at ${filePath}`,
      }],
    };
  }
);

/**
 * Create a new database model
 */
server.tool(
  'create_model',
  {
    modelName: z.string().describe('Name of the model (e.g., SubscriptionModel)'),
    tableName: z.string().describe('Database table name'),
    fields: z.array(z.object({
      name: z.string(),
      type: z.string(),
      nullable: z.boolean().optional(),
    })).describe('Array of field definitions'),
  },
  async ({ modelName, tableName, fields }) => {
    const fieldsDoc = fields.map(f => ` * @property {${f.type}} ${f.name}`).join('\n');
    
    const code = `const { query, pool } = require('../config/postgres');
const logger = require('../utils/logger');

/**
 * ${modelName}
 * @typedef {Object} ${modelName.replace('Model', '')}
${fieldsDoc}
 */
class ${modelName} {
  /**
   * Create table if not exists
   */
  static async initTable() {
    try {
      await query(\`
        CREATE TABLE IF NOT EXISTS ${tableName} (
          id SERIAL PRIMARY KEY,
          ${fields.map(f => `${f.name} ${f.type}${f.nullable ? '' : ' NOT NULL'}`).join(',\n          ')},
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      \`);
      logger.info('${tableName} table initialized');
    } catch (error) {
      logger.error('Error initializing ${tableName} table:', error);
      throw error;
    }
  }

  /**
   * Find by ID
   */
  static async findById(id) {
    try {
      const result = await query(
        'SELECT * FROM ${tableName} WHERE id = $1',
        [id]
      );
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Error in ${modelName}.findById:', error);
      throw error;
    }
  }

  /**
   * Find all with optional filters
   */
  static async findAll(filters = {}) {
    try {
      let sql = 'SELECT * FROM ${tableName}';
      const values = [];
      
      if (Object.keys(filters).length > 0) {
        const conditions = Object.entries(filters).map(([key, value], i) => {
          values.push(value);
          return \`\${key} = $\${i + 1}\`;
        });
        sql += ' WHERE ' + conditions.join(' AND ');
      }
      
      const result = await query(sql, values);
      return result.rows;
    } catch (error) {
      logger.error('Error in ${modelName}.findAll:', error);
      throw error;
    }
  }

  /**
   * Create new record
   */
  static async create(data) {
    try {
      const keys = Object.keys(data);
      const values = Object.values(data);
      const placeholders = values.map((_, i) => \`$\${i + 1}\`).join(', ');
      
      const result = await query(
        \`INSERT INTO ${tableName} (\${keys.join(', ')}) VALUES (\${placeholders}) RETURNING *\`,
        values
      );
      
      logger.info('${modelName} record created', { id: result.rows[0].id });
      return result.rows[0];
    } catch (error) {
      logger.error('Error in ${modelName}.create:', error);
      throw error;
    }
  }

  /**
   * Update record
   */
  static async update(id, data) {
    try {
      const entries = Object.entries(data);
      const setClause = entries.map(([key], i) => \`\${key} = $\${i + 1}\`).join(', ');
      const values = [...entries.map(([, v]) => v), id];
      
      const result = await query(
        \`UPDATE ${tableName} SET \${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = $\${values.length} RETURNING *\`,
        values
      );
      
      return result.rows[0];
    } catch (error) {
      logger.error('Error in ${modelName}.update:', error);
      throw error;
    }
  }

  /**
   * Delete record
   */
  static async delete(id) {
    try {
      await query('DELETE FROM ${tableName} WHERE id = $1', [id]);
      logger.info('${modelName} record deleted', { id });
      return true;
    } catch (error) {
      logger.error('Error in ${modelName}.delete:', error);
      throw error;
    }
  }
}

module.exports = ${modelName};
`;

    const filePath = `src/models/${modelName.charAt(0).toLowerCase() + modelName.slice(1)}.js`;
    await fs.writeFile(filePath, code, 'utf-8');
    
    return {
      content: [{
        type: 'text',
        text: `✅ Created model at ${filePath}`,
      }],
    };
  }
);

// ============================================
// TESTING TOOLS
// ============================================

/**
 * Run tests
 */
server.tool(
  'run_tests',
  {
    testPath: z.string().optional().describe('Specific test file or pattern'),
    coverage: z.boolean().optional().describe('Include coverage report'),
    watch: z.boolean().optional().describe('Run in watch mode'),
  },
  async ({ testPath, coverage, watch }) => {
    let cmd = 'npm test';
    const args = [];
    
    if (testPath) args.push(testPath);
    if (coverage) args.push('--coverage');
    if (watch) args.push('--watch');
    
    if (args.length) cmd += ' -- ' + args.join(' ');
    
    try {
      const { stdout, stderr } = await execAsync(cmd, { cwd: process.cwd() });
      return {
        content: [{
          type: 'text',
          text: `📋 Test Results:\n\n${stdout}\n${stderr}`,
        }],
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `❌ Tests failed:\n\n${error.stdout || ''}\n${error.stderr || ''}\n${error.message}`,
        }],
      };
    }
  }
);

// ============================================
// DATABASE TOOLS
// ============================================

/**
 * Run database migration
 */
server.tool(
  'run_migration',
  {
    migrationFile: z.string().optional().describe('Specific migration file'),
  },
  async ({ migrationFile }) => {
    const cmd = migrationFile
      ? `node scripts/migrate.js ${migrationFile}`
      : 'npm run migrate';
    
    try {
      const { stdout, stderr } = await execAsync(cmd, { cwd: process.cwd() });
      return {
        content: [{
          type: 'text',
          text: `✅ Migration completed:\n\n${stdout}${stderr}`,
        }],
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `❌ Migration failed:\n\n${error.message}`,
        }],
      };
    }
  }
);

// ============================================
// CODE ANALYSIS TOOLS
// ============================================

/**
 * Analyze a file for issues
 */
server.tool(
  'analyze_file',
  {
    filePath: z.string().describe('Path to file to analyze'),
  },
  async ({ filePath: targetPath }) => {
    try {
      const content = await fs.readFile(targetPath, 'utf-8');
      const lines = content.split('\n');
      
      const issues = [];
      
      // Check for common issues
      lines.forEach((line, index) => {
        const lineNum = index + 1;
        
        // Check for console.log
        if (line.includes('console.log')) {
          issues.push(`Line ${lineNum}: Found console.log (use logger instead)`);
        }
        
        // Check for unprotected JSON.parse
        if (line.includes('JSON.parse') && !lines.slice(Math.max(0, index - 3), index).some(l => l.includes('try'))) {
          issues.push(`Line ${lineNum}: JSON.parse without try-catch`);
        }
        
        // Check for TODO/FIXME
        if (line.includes('TODO') || line.includes('FIXME')) {
          issues.push(`Line ${lineNum}: ${line.trim()}`);
        }
        
        // Check for hardcoded secrets
        if (/(?:password|secret|key|token)\s*[:=]\s*['"][^'"]+['"]/i.test(line)) {
          issues.push(`Line ${lineNum}: Potential hardcoded secret`);
        }
      });
      
      return {
        content: [{
          type: 'text',
          text: issues.length > 0
            ? `📋 Analysis of ${targetPath}:\n\n${issues.map(i => `• ${i}`).join('\n')}`
            : `✅ No issues found in ${targetPath}`,
        }],
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `❌ Error analyzing file: ${error.message}`,
        }],
      };
    }
  }
);

/**
 * Run ESLint
 */
server.tool(
  'lint_code',
  {
    targetPath: z.string().optional().describe('Path to lint (default: src/)'),
    fix: z.boolean().optional().describe('Auto-fix issues'),
  },
  async ({ targetPath, fix }) => {
    const target = targetPath || 'src/';
    const cmd = fix
      ? `npm run lint:fix -- ${target}`
      : `npm run lint -- ${target}`;
    
    try {
      const { stdout, stderr } = await execAsync(cmd, { cwd: process.cwd() });
      return {
        content: [{
          type: 'text',
          text: `📋 Lint Results:\n\n${stdout}${stderr}`,
        }],
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `⚠️ Lint found issues:\n\n${error.stdout || error.message}`,
        }],
      };
    }
  }
);

// ============================================
// START SERVER
// ============================================

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('🚀 PNPtv MCP Server started successfully');
}

main().catch((error) => {
  console.error('Failed to start MCP server:', error);
  process.exit(1);
});
