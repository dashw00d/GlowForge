/**
 * scaffold-plugin.ts — Vite plugin that handles tool scaffolding
 *
 * POST /api/scaffold — create a tool directory + lantern.yaml + README.md + build.yaml
 *
 * The frontend wizard calls this to set up the filesystem, then calls
 * Lantern's POST /api/projects to register the new tool.
 *
 * build.yaml is written with status: pending so the tool appears immediately
 * as a BuildCard in the registry. Loom then updates it as it works.
 */

import type { Plugin } from 'vite'
import type { IncomingMessage, ServerResponse } from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
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

// ─── lantern.yaml generator ───────────────────────────────────────────────────

interface ScaffoldInput {
  name: string
  displayName?: string
  description?: string
  kind?: 'service' | 'tool' | 'website'
  type?: 'proxy' | 'static' | 'php'
  template?: string
  customPath?: string
  tags?: string[]
}

interface TemplateConfig {
  type: string
  runCmd: string | null
  runCwd: string | null
  healthEndpoint: string | null
  root: string | null
}

const TEMPLATE_CONFIGS: Record<string, TemplateConfig> = {
  fastapi: {
    type: 'proxy',
    runCmd: '.venv/bin/uvicorn main:app --host 0.0.0.0 --port ${PORT}',
    runCwd: '.',
    healthEndpoint: '/health',
    root: null,
  },
  vite: {
    type: 'proxy',
    runCmd: 'npx vite --port ${PORT}',
    runCwd: '.',
    healthEndpoint: null,
    root: null,
  },
  nextjs: {
    type: 'proxy',
    runCmd: 'npx next dev -p ${PORT}',
    runCwd: '.',
    healthEndpoint: '/api/health',
    root: null,
  },
  nuxt: {
    type: 'proxy',
    runCmd: 'npx nuxi dev --port ${PORT}',
    runCwd: '.',
    healthEndpoint: null,
    root: null,
  },
  django: {
    type: 'proxy',
    runCmd: 'python manage.py runserver 127.0.0.1:${PORT}',
    runCwd: '.',
    healthEndpoint: null,
    root: null,
  },
  static: {
    type: 'static',
    runCmd: null,
    runCwd: null,
    healthEndpoint: null,
    root: '.',
  },
  laravel: {
    type: 'php',
    runCmd: null,
    runCwd: null,
    healthEndpoint: null,
    root: 'public',
  },
  script: {
    type: 'proxy',
    runCmd: 'node index.js',
    runCwd: '.',
    healthEndpoint: null,
    root: null,
  },
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64)
}

function generateLanternYaml(input: ScaffoldInput): string {
  const name = slugify(input.name)
  const displayName = input.displayName || name
  const description = input.description || `${displayName} — created via GlowForge`
  const kind = input.kind || 'tool'
  const template = input.template || ''
  const cfg = TEMPLATE_CONFIGS[template]

  const domainSlug = name.replace(/-/g, '')
  const type = cfg?.type || input.type || 'proxy'

  const lines: string[] = [
    `id: ${name}`,
    `name: ${displayName}`,
    `description: "${description.replace(/"/g, "'")}"`,
    ``,
    `kind: ${kind}`,
    `type: ${type}`,
    ``,
    `domain: ${domainSlug}.glow`,
    ``,
  ]

  if (cfg?.healthEndpoint) {
    lines.push(`health_endpoint: ${cfg.healthEndpoint}`, ``)
  }

  if (cfg?.runCmd) {
    lines.push(`run:`)
    lines.push(`  cmd: ${cfg.runCmd}`)
    if (cfg.runCwd) lines.push(`  cwd: ${cfg.runCwd}`)
    lines.push(``)
  }

  if (cfg?.root) {
    lines.push(`root: ${cfg.root}`, ``)
  }

  const tags = input.tags?.length ? input.tags : [kind]
  lines.push(`tags:`)
  for (const tag of tags) {
    lines.push(`  - ${tag}`)
  }
  lines.push(``)

  lines.push(`docs:`)
  lines.push(`  - README.md`)
  lines.push(``)

  lines.push(`docs_auto:`)
  lines.push(`  enabled: true`)
  lines.push(`  patterns:`)
  lines.push(`    - README.md`)
  lines.push(`    - "*.md"`)
  lines.push(`  ignore:`)
  lines.push(`    - node_modules/**`)
  lines.push(`    - .git/**`)
  lines.push(`    - .venv/**`)
  lines.push(``)

  lines.push(`routing:`)
  lines.push(`  triggers:`)
  lines.push(`    - ${name}`)
  lines.push(`  risk: low`)
  lines.push(`  requires_confirmation: false`)

  return lines.join('\n')
}

function generateReadme(input: ScaffoldInput, _toolPath: string): string {
  const name = slugify(input.name)
  const displayName = input.displayName || name
  const description = input.description || `${displayName} tool`
  const template = input.template || 'none'

  return [
    `# ${displayName}`,
    ``,
    description,
    ``,
    `## Setup`,
    ``,
    `Created via GlowForge tool wizard.`,
    ``,
    `**Template:** ${template}`,
    `**Path:** \`${_toolPath}\``,
    ``,
    `## Usage`,
    ``,
    `_Add usage instructions here._`,
    ``,
    `## Development`,
    ``,
    `_Add development notes here._`,
  ].join('\n')
}

// ─── build.yaml generator ─────────────────────────────────────────────────────

function generateBuildYaml(input: ScaffoldInput, slug: string): string {
  const displayName = input.displayName || slug
  const description = input.description || `Build ${displayName}`
  const now = new Date().toISOString()

  // Standard phases for every tool build
  const phases = [
    {
      id: 'scaffold',
      name: 'Project Scaffold',
      desc: 'Create directory structure, lantern.yaml, README, and config files',
    },
    {
      id: 'core',
      name: 'Core Implementation',
      desc: 'Main tool logic — the primary feature implementation',
    },
    {
      id: 'api',
      name: 'API Endpoints',
      desc: 'HTTP routes, health endpoint, and external interfaces',
    },
    {
      id: 'test',
      name: 'Testing & Verification',
      desc: 'Run tests, verify build, check health and functionality',
    },
    {
      id: 'register',
      name: 'Lantern Registration',
      desc: 'Register with Lantern, start service, verify health endpoint',
    },
  ]

  const lines: string[] = [
    `# build.yaml — generated by GlowForge tool wizard`,
    `# Loom builder agent updates this file as it works`,
    ``,
    `tool_id: ${slug}`,
    `name: "${displayName.replace(/"/g, "'")}"`,
    `prompt: "${description.replace(/"/g, "'")}"`,
    `status: pending`,
    `started_at: "${now}"`,
    `progress: 0`,
    ``,
    `phases:`,
  ]

  for (const phase of phases) {
    lines.push(`  - id: ${phase.id}`)
    lines.push(`    name: ${phase.name}`)
    lines.push(`    status: pending`)
    lines.push(`    # ${phase.desc}`)
  }

  lines.push(``)
  lines.push(`log:`)
  lines.push(`  - time: "${now}"`)
  lines.push(`    msg: "Tool created via GlowForge wizard — awaiting Loom builder"`)
  lines.push(``)

  return lines.join('\n')
}

// ─── Plugin ───────────────────────────────────────────────────────────────────

export function scaffoldPlugin(): Plugin {
  return {
    name: 'glowforge:scaffold',
    enforce: 'pre',

    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url ?? ''
        const method = (req.method ?? 'GET').toUpperCase()

        if (!url.startsWith('/api/scaffold')) return next()

        if (method === 'OPTIONS') {
          res.writeHead(204, CORS_HEADERS)
          res.end()
          return
        }

        if (method !== 'POST') {
          return next()
        }

        try {
          const body = await parseBody(req)
          const input = body as unknown as ScaffoldInput

          if (!input.name || typeof input.name !== 'string') {
            json(res, 400, { error: 'name is required' })
            return
          }

          const name = slugify(input.name)
          if (!name) {
            json(res, 400, { error: 'name must contain alphanumeric characters' })
            return
          }

          // Determine path
          const toolPath =
            typeof input.customPath === 'string' && input.customPath.trim()
              ? input.customPath.trim().replace('~', os.homedir())
              : path.join(os.homedir(), 'tools', name)

          // Create directory
          fs.mkdirSync(toolPath, { recursive: true })

          // Write lantern.yaml
          const yamlContent = generateLanternYaml(input)
          const yamlPath = path.join(toolPath, 'lantern.yaml')
          fs.writeFileSync(yamlPath, yamlContent, 'utf8')

          // Write README.md
          const readmeContent = generateReadme(input, toolPath)
          const readmePath = path.join(toolPath, 'README.md')
          fs.writeFileSync(readmePath, readmeContent, 'utf8')

          // Write build.yaml — enables BuildCard in registry immediately (status: pending)
          const buildYamlContent = generateBuildYaml(input, name)
          const buildYamlPath = path.join(toolPath, 'build.yaml')
          fs.writeFileSync(buildYamlPath, buildYamlContent, 'utf8')

          json(res, 201, {
            ok: true,
            name,
            path: toolPath,
            yaml_path: yamlPath,
            readme_path: readmePath,
            build_yaml_path: buildYamlPath,
          })
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err)
          json(res, 500, { error: msg })
        }
      })
    },
  }
}
