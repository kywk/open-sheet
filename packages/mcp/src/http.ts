import type { IncomingMessage, ServerResponse } from 'node:http'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { createServer, type ServerOptions } from './server.js'

export type HttpHandler = (
  req: IncomingMessage,
  res: ServerResponse,
  body?: unknown,
) => Promise<void>

/**
 * Stateless: a fresh server and transport per request, so a client can point at
 * the endpoint and post without a session handshake. The cost is per-request
 * setup, which is nothing next to compiling a workbook.
 */
export function createHttpHandler(options: ServerOptions): HttpHandler {
  return async (req, res, body) => {
    const server = createServer(options)
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined })

    res.on('close', () => {
      void transport.close()
      void server.close()
    })

    await server.connect(transport)
    await transport.handleRequest(req, res, body)
  }
}
