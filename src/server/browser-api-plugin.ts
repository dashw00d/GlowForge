/**
 * browser-api-plugin.ts — Vite plugin that adds browser task queue API routes
 *
 * Routes (all under /api/browser/):
 *   GET  /api/browser/tasks            — dequeue next pending task (or 204)
 *   POST /api/browser/tasks            — enqueue a new task
 *   POST /api/browser/results/:id      — extension posts a task result
 *   GET  /api/browser/queue            — queue status (pending count, recent results)
 *   GET  /api/browser/queue/pending    — full list of pending tasks
 *   GET  /api/browser/queue/results    — full list of recent results
 *   DELETE /api/browser/queue          — clear the queue (dev utility)
 *
 * Used by:
 *   - Chrome extension: polls GET /tasks, posts to /results/:id
 *   - GlowForge Queue UI: dispatches tasks (POST /tasks), reads status
 */

import type { Plugin } from 'vite'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { browserQueue } from './browser-queue.js'

// ─── Helpers ─────────────────────────────────────────────────────────────────

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

function json(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body, null, 2)
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload),
    ...CORS_HEADERS,
  })
  res.end(payload)
}

function noContent(res: ServerResponse): void {
  res.writeHead(204, CORS_HEADERS)
  res.end()
}

function parseBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let raw = ''
    req.on('data', (chunk) => (raw += chunk))
    req.on('end', () => {
      try {
        resolve(raw ? (JSON.parse(raw) as Record<string, unknown>) : {})
      } catch {
        reject(new Error('Invalid JSON body'))
      }
    })
    req.on('error', reject)
  })
}

// ─── Plugin ───────────────────────────────────────────────────────────────────

export function browserQueuePlugin(): Plugin {
  return {
    name: 'glowforge:browser-queue',
    enforce: 'pre',

    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url ?? ''
        const method = (req.method ?? 'GET').toUpperCase()

        // Only handle /api/browser/* routes
        if (!url.startsWith('/api/browser/') && url !== '/api/browser') {
          return next()
        }

        // CORS preflight
        if (method === 'OPTIONS') {
          res.writeHead(204, CORS_HEADERS)
          res.end()
          return
        }

        try {
          await handleRequest(method, url, req, res)
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err)
          json(res, 500, { error: msg })
        }
      })

      console.log('\n  🔥 GlowForge browser queue API mounted at /api/browser/\n')
    },
  }
}

// ─── Request Router ───────────────────────────────────────────────────────────

async function handleRequest(
  method: string,
  url: string,
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  // Strip query string for routing
  const path = url.split('?')[0]

  // GET /api/browser/tasks — dequeue next pending task
  if (method === 'GET' && path === '/api/browser/tasks') {
    const task = browserQueue.dequeue()
    if (!task) {
      noContent(res)
    } else {
      json(res, 200, task)
    }
    return
  }

  // POST /api/browser/tasks — enqueue a new task
  if (method === 'POST' && path === '/api/browser/tasks') {
    const body = await parseBody(req)

    if (!body.action || typeof body.action !== 'string') {
      json(res, 400, { error: 'action is required' })
      return
    }

    const task = browserQueue.enqueue({
      action: body.action,
      target_url: typeof body.target_url === 'string' ? body.target_url : undefined,
      params: typeof body.params === 'object' && body.params !== null
        ? (body.params as Record<string, unknown>)
        : {},
      ttl_seconds: typeof body.ttl_seconds === 'number' ? body.ttl_seconds : 300,
      callback_url: typeof body.callback_url === 'string' ? body.callback_url : undefined,
      source: typeof body.source === 'string' ? body.source : undefined,
      correlation_id: typeof body.correlation_id === 'string' ? body.correlation_id : undefined,
    })

    json(res, 201, task)
    return
  }

  // POST /api/browser/results/:id — store task result from extension
  const resultsMatch = path.match(/^\/api\/browser\/results\/([^/]+)$/)
  if (method === 'POST' && resultsMatch) {
    const taskId = decodeURIComponent(resultsMatch[1])
    const body = await parseBody(req)

    const validStatuses = ['success', 'error', 'expired']
    const status = validStatuses.includes(body.status as string)
      ? (body.status as 'success' | 'error' | 'expired')
      : 'success'

    const result = browserQueue.addResult({
      task_id: taskId,
      status,
      data: body.data,
      error: typeof body.error === 'string' ? body.error : undefined,
      completed_at: typeof body.completed_at === 'string'
        ? body.completed_at
        : new Date().toISOString(),
    })

    json(res, 200, { ok: true, result_id: result.id })
    return
  }

  // GET /api/browser/queue — queue status
  if (method === 'GET' && path === '/api/browser/queue') {
    json(res, 200, browserQueue.status())
    return
  }

  // GET /api/browser/queue/pending — list pending tasks
  if (method === 'GET' && path === '/api/browser/queue/pending') {
    json(res, 200, { tasks: browserQueue.listPending() })
    return
  }

  // GET /api/browser/queue/results — list recent results (optional source filter)
  if (method === 'GET' && path === '/api/browser/queue/results') {
    const qs = new URLSearchParams(url.includes('?') ? url.split('?')[1] : '')
    const limit = Math.min(parseInt(qs.get('limit') ?? '50', 10), 200)
    json(res, 200, { results: browserQueue.listResults(limit) })
    return
  }

  // GET /api/browser/results/:id — get single result by task_id
  const singleResultMatch = path.match(/^\/api\/browser\/results\/([^/]+)$/)
  if (method === 'GET' && singleResultMatch) {
    const taskId = decodeURIComponent(singleResultMatch[1])
    const result = browserQueue.getResult(taskId)
    if (result) {
      json(res, 200, result)
    } else {
      json(res, 404, { error: 'No result for task_id' })
    }
    return
  }

  // DELETE /api/browser/queue — clear queue (dev utility)
  if (method === 'DELETE' && path === '/api/browser/queue') {
    browserQueue.clear()
    json(res, 200, { ok: true, message: 'Queue cleared' })
    return
  }

  // No match
  json(res, 404, { error: `No route: ${method} ${path}` })
}
