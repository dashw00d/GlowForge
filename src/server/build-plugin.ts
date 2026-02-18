/**
 * build-plugin.ts — Vite plugin that serves build.yaml data
 *
 * Routes:
 *   GET /api/build/:toolId           — read ~/tools/{id}/build.yaml → JSON BuildManifest
 *   GET /api/build/:toolId/exists    — check if build.yaml exists (fast probe)
 *   POST /api/build/:toolId/write    — write build.yaml (dev utility, for testing)
 *
 * The plugin resolves tool paths relative to the user's home directory.
 * Tools live at ~/tools/{toolId}/build.yaml
 */

import type { Plugin } from 'vite'
import type { IncomingMessage, ServerResponse } from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import yaml from 'js-yaml'
import type { BuildManifest } from '../types.js'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
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

function parseBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let raw = ''
    req.on('data', (chunk) => (raw += chunk))
    req.on('end', () => resolve(raw))
    req.on('error', reject)
  })
}

/** Resolve the build.yaml path for a tool (case-insensitive directory match). */
function buildYamlPath(toolId: string): string {
  // Sanitize — prevent path traversal
  const safe = toolId.replace(/[^a-zA-Z0-9_-]/g, '')
  const toolsDir = path.join(os.homedir(), 'tools')

  // Try exact match first (fast path)
  const exactPath = path.join(toolsDir, safe, 'build.yaml')
  if (fs.existsSync(exactPath)) return exactPath

  // Fall back to case-insensitive directory scan
  try {
    const entries = fs.readdirSync(toolsDir)
    const match = entries.find((e) => e.toLowerCase() === safe.toLowerCase())
    if (match) return path.join(toolsDir, match, 'build.yaml')
  } catch {
    // readdirSync failed — fall through, will 404 gracefully below
  }

  return exactPath
}

/** Parse and validate a build.yaml file. Throws on invalid YAML or missing required fields. */
function parseBuildYaml(content: string): BuildManifest {
  const raw = yaml.load(content) as Record<string, unknown>

  if (!raw || typeof raw !== 'object') {
    throw new Error('build.yaml is not a valid YAML object')
  }

  // Required fields
  const required = ['tool_id', 'name', 'status', 'started_at']
  for (const field of required) {
    if (!(field in raw)) {
      throw new Error(`build.yaml missing required field: ${field}`)
    }
  }

  return {
    tool_id: String(raw.tool_id),
    name: String(raw.name),
    prompt: String(raw.prompt ?? ''),
    status: (raw.status ?? 'pending') as BuildManifest['status'],
    started_at: String(raw.started_at),
    progress: typeof raw.progress === 'number' ? raw.progress : 0,
    completed_at: raw.completed_at ? String(raw.completed_at) : undefined,
    error: raw.error ? String(raw.error) : undefined,
    phases: Array.isArray(raw.phases) ? raw.phases as BuildManifest['phases'] : [],
    log: Array.isArray(raw.log) ? raw.log as BuildManifest['log'] : [],
  }
}

// ─── Plugin ───────────────────────────────────────────────────────────────────

export function buildPlugin(): Plugin {
  return {
    name: 'glowforge:build',
    enforce: 'pre',

    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url ?? ''
        const method = (req.method ?? 'GET').toUpperCase()

        if (!url.startsWith('/api/build/')) return next()

        if (method === 'OPTIONS') {
          res.writeHead(204, CORS_HEADERS)
          res.end()
          return
        }

        // Strip query string
        const path_ = url.split('?')[0]

        // GET /api/build/:toolId/exists — fast probe
        const existsMatch = path_.match(/^\/api\/build\/([^/]+)\/exists$/)
        if (method === 'GET' && existsMatch) {
          const toolId = decodeURIComponent(existsMatch[1])
          const yamlPath = buildYamlPath(toolId)
          json(res, 200, { exists: fs.existsSync(yamlPath) })
          return
        }

        // GET /api/build/:toolId — read and parse build.yaml
        const readMatch = path_.match(/^\/api\/build\/([^/]+)$/)
        if (method === 'GET' && readMatch) {
          const toolId = decodeURIComponent(readMatch[1])
          const yamlPath = buildYamlPath(toolId)

          if (!fs.existsSync(yamlPath)) {
            json(res, 404, { error: 'build.yaml not found', tool_id: toolId })
            return
          }

          try {
            const content = fs.readFileSync(yamlPath, 'utf8')
            const manifest = parseBuildYaml(content)
            json(res, 200, manifest)
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err)
            json(res, 500, { error: `Failed to parse build.yaml: ${msg}` })
          }
          return
        }

        // POST /api/build/:toolId/write — write build.yaml (dev/test utility)
        const writeMatch = path_.match(/^\/api\/build\/([^/]+)\/write$/)
        if (method === 'POST' && writeMatch) {
          const toolId = decodeURIComponent(writeMatch[1])
          const yamlPath = buildYamlPath(toolId)

          try {
            const body = await parseBody(req)
            fs.mkdirSync(path.dirname(yamlPath), { recursive: true })
            fs.writeFileSync(yamlPath, body, 'utf8')
            json(res, 200, { ok: true, path: yamlPath })
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err)
            json(res, 500, { error: msg })
          }
          return
        }

        next()
      })

      console.log('\n  🔨 GlowForge build.yaml API mounted at /api/build/\n')
    },
  }
}
