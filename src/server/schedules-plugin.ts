/**
 * schedules-plugin.ts — Vite plugin that proxies schedule CRUD to schedules.yaml
 *
 * The Loom API only supports toggling schedules (PATCH /schedules/:id).
 * Creating and deleting requires direct file access. This plugin handles it.
 *
 * POST   /api/schedules        — create (append entry to schedules.yaml)
 * DELETE /api/schedules/:id    — remove entry from schedules.yaml
 *
 * Schedules file path: $LOOM_SCHEDULES_PATH or ~/tools/Loom/schedules.yaml
 */

import type { Plugin } from 'vite'
import type { IncomingMessage, ServerResponse } from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import yaml from 'js-yaml'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, DELETE, OPTIONS',
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

/** Resolve the Loom schedules.yaml path. */
function schedulesYamlPath(): string {
  return (
    process.env.LOOM_SCHEDULES_PATH ||
    path.join(os.homedir(), 'tools', 'Loom', 'schedules.yaml')
  )
}

/** Read and parse schedules.yaml → Record<id, config>. Returns {} if missing. */
function readSchedules(): Record<string, Record<string, unknown>> {
  const p = schedulesYamlPath()
  if (!fs.existsSync(p)) return {}
  const content = fs.readFileSync(p, 'utf8')
  const parsed = yaml.load(content)
  return (parsed as Record<string, Record<string, unknown>>) ?? {}
}

/** Write a schedules object back to schedules.yaml. */
function writeSchedules(schedules: Record<string, Record<string, unknown>>): void {
  const p = schedulesYamlPath()
  // Use yaml.dump with sane options: block style, 2-space indent, no inline
  const content = yaml.dump(schedules, {
    indent: 2,
    lineWidth: 120,
    noRefs: true,
  })
  fs.writeFileSync(p, content, 'utf8')
}

// ─── Input validation ─────────────────────────────────────────────────────────

const VALID_ACTIONS = new Set(['agent', 'http', 'shell', 'prompt', 'trace'])

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

interface CreateScheduleInput {
  id: string
  schedule: string
  action: string
  message?: string
  url?: string
  command?: string
  prompt?: string
  timezone?: string
  enabled?: boolean
  timeout?: number
  method?: string
}

// ─── Plugin ───────────────────────────────────────────────────────────────────

export function schedulesPlugin(): Plugin {
  return {
    name: 'glowforge:schedules',
    enforce: 'pre',

    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url ?? ''
        const method = (req.method ?? 'GET').toUpperCase()

        if (!url.startsWith('/api/schedules')) return next()

        // CORS preflight
        if (method === 'OPTIONS') {
          res.writeHead(204, CORS_HEADERS)
          res.end()
          return
        }

        // DELETE /api/schedules/:id
        const deleteMatch = url.match(/^\/api\/schedules\/([^/?]+)$/)
        if (deleteMatch && method === 'DELETE') {
          const id = decodeURIComponent(deleteMatch[1])
          try {
            const schedules = readSchedules()
            if (!(id in schedules)) {
              json(res, 404, { error: `Schedule '${id}' not found in schedules.yaml` })
              return
            }
            delete schedules[id]
            writeSchedules(schedules)
            json(res, 200, { ok: true, deleted: id })
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err)
            json(res, 500, { error: msg })
          }
          return
        }

        // POST /api/schedules — create
        if (url === '/api/schedules' && method === 'POST') {
          try {
            const body = await parseBody(req)
            const input = body as unknown as CreateScheduleInput

            // Validate required fields
            if (!input.id || typeof input.id !== 'string') {
              json(res, 400, { error: 'id is required' })
              return
            }
            if (!input.schedule || typeof input.schedule !== 'string') {
              json(res, 400, { error: 'schedule is required' })
              return
            }
            if (!input.action || !VALID_ACTIONS.has(input.action)) {
              json(res, 400, { error: `action must be one of: ${[...VALID_ACTIONS].join(', ')}` })
              return
            }

            const id = slugify(input.id)
            if (!id) {
              json(res, 400, { error: 'id must contain alphanumeric characters' })
              return
            }

            // Read existing schedules
            const schedules = readSchedules()
            if (id in schedules) {
              json(res, 409, { error: `Schedule '${id}' already exists` })
              return
            }

            // Build the entry
            const entry: Record<string, unknown> = {
              schedule: input.schedule.trim(),
              action: input.action,
              enabled: input.enabled !== false,
            }

            if (input.timezone?.trim()) entry.timezone = input.timezone.trim()
            if (input.timeout && input.timeout > 0) entry.timeout = input.timeout

            // Action-specific fields
            if (input.action === 'agent' || input.action === 'prompt') {
              const msg = (input.message || input.prompt || '').trim()
              if (!msg) {
                json(res, 400, { error: `message is required for action=${input.action}` })
                return
              }
              entry[input.action === 'prompt' ? 'prompt' : 'message'] = msg
            } else if (input.action === 'http') {
              if (!input.url?.trim()) {
                json(res, 400, { error: 'url is required for action=http' })
                return
              }
              entry.url = input.url.trim()
              entry.method = (input.method || 'GET').toUpperCase()
            } else if (input.action === 'shell') {
              if (!input.command?.trim()) {
                json(res, 400, { error: 'command is required for action=shell' })
                return
              }
              entry.command = input.command.trim()
            }

            // Append and save
            schedules[id] = entry
            writeSchedules(schedules)

            json(res, 201, { ok: true, id, entry })
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err)
            json(res, 500, { error: msg })
          }
          return
        }

        // Any other /api/schedules/* — not handled here
        next()
      })
    },
  }
}
