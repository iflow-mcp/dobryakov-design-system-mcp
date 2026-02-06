#!/usr/bin/env node
import { McpRequest, McpResponse } from '../../types/mcp.js';
import { mcpServer } from '../server.js';
import logger from '../../utils/logger.js';

/**
 * stdio transport for MCP server (for SSH tunnel)
 * Reads JSON-RPC 2.0 requests from stdin and writes responses to stdout
 */
export class StdioTransport {
  private apiKey: string | undefined;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.API_KEY;
  }

  /**
   * Start listening for requests on stdin
   */
  start(): void {
    logger.info('MCP stdio transport started');

    // Read from stdin line by line
    process.stdin.setEncoding('utf8');
    let buffer = '';

    process.stdin.on('data', (chunk: string) => {
      buffer += chunk;
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.trim()) {
          this.processLine(line);
        }
      }
    });

    process.stdin.on('end', () => {
      if (buffer.trim()) {
        this.processLine(buffer);
      }
      logger.info('MCP stdio transport closed');
      process.exit(0);
    });
  }

  /**
   * Process a single line of input
   */
  private async processLine(line: string): Promise<void> {
    try {
      // Parse JSON-RPC request
      const request: McpRequest = JSON.parse(line);

      // Process request
      const response: McpResponse = await mcpServer.processRequest(request, this.apiKey);

      // Write response to stdout
      console.log(JSON.stringify(response));
    } catch (error) {
      logger.error({ error, line }, 'Error processing stdio MCP request');

      const errorResponse: McpResponse = {
        jsonrpc: '2.0',
        id: null,
        error: {
          code: -32700,
          message: error instanceof Error ? error.message : 'Parse error',
        },
      };

      console.log(JSON.stringify(errorResponse));
    }
  }

  /**
   * Stop listening
   */
  stop(): void {
    process.stdin.end();
  }
}

// Start the stdio transport when run as a script
if (import.meta.url === `file://${process.argv[1]}`) {
  const apiKey = process.env.API_KEY;
  const transport = new StdioTransport(apiKey);
  transport.start();
}
