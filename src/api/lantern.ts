import type {
  ApiResponse,
  ToolSummary,
  ToolDetail,
  ProjectHealthStatus,
  SystemHealth,
} from '../types'

export const LANTERN_BASE = '/lantern-api'
const BASE = LANTERN_BASE
const LOOM_BASE_TTL_MS = 5000

let loomBaseCache: { value: string; expiresAt: number } | null = null

async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }))
    throw new Error(err.message || `HTTP ${res.status}`)
  }
  return res.json()
}

// Tools (registry view)
export async function listTools(): Promise<ToolSummary[]> {
  const r = await req<ApiResponse<ToolSummary[]>>('GET', '/api/tools')
  return r.data
}

export async function getTool(id: string): Promise<ToolDetail> {
  const r = await req<ApiResponse<ToolDetail>>('GET', `/api/tools/${encodeURIComponent(id)}`)
  return r.data
}

export interface DocFile {
  path: string
  content: string | null
  error: string | null
  exists?: boolean
  kind?: string
  mtime?: string | null
  size?: number | null
  source?: string
}

export async function getToolDocs(id: string): Promise<DocFile[]> {
  const r = await req<ApiResponse<{ docs: Array<{
    path: string
    content?: string | null
    error?: string | null
    exists?: boolean
    kind?: string
    mtime?: string | null
    size?: number | null
    source?: string
  }> }>>(
    'GET',
    `/api/tools/${encodeURIComponent(id)}/docs`
  )
  return (r.data?.docs ?? []).map((d) => ({
    path: d.path,
    content: d.content ?? null,
    error: d.error ?? null,
    exists: d.exists,
    kind: d.kind,
    mtime: d.mtime ?? null,
    size: d.size ?? null,
    source: d.source,
  }))
}

// Health
export async function getProjectHealth(): Promise<Record<string, ProjectHealthStatus>> {
  const r = await req<ApiResponse<Record<string, ProjectHealthStatus>>>('GET', '/api/health')
  return r.data
}

export async function getSystemHealth(): Promise<SystemHealth> {
  const r = await req<ApiResponse<SystemHealth>>('GET', '/api/system/health')
  return r.data
}

// Lifecycle — NOTE: Lantern's /api/projects/:name routes match by DISPLAY NAME
// (e.g. "Loom", "GhostGraph") NOT by id (e.g. "loom", "ghostgraph")
// Always pass `tool.name` not `tool.id` to these functions.
export async function activateTool(name: string): Promise<void> {
  await req('POST', `/api/projects/${encodeURIComponent(name)}/activate`)
}

export async function deactivateTool(name: string): Promise<void> {
  await req('POST', `/api/projects/${encodeURIComponent(name)}/deactivate`)
}

export async function restartTool(name: string): Promise<void> {
  await req('POST', `/api/projects/${encodeURIComponent(name)}/restart`)
}

/** Unregister a project from Lantern. Does NOT delete files on disk.
 *  Pass the display name (e.g. "Loom"), not the id (e.g. "loom"). */
export async function deleteProject(name: string): Promise<void> {
  await req('DELETE', `/api/projects/${encodeURIComponent(name)}`)
}

// Resolve Loom base URL via Vite proxy
export async function getLoomBaseUrl(): Promise<string> {
  const now = Date.now()
  if (loomBaseCache && now < loomBaseCache.expiresAt) {
    return loomBaseCache.value
  }

  try {
    const r = await req<ApiResponse<ToolDetail>>('GET', '/api/tools/loom')
    const resolved = (r.data.base_url || r.data.upstream_url || '').trim().replace(/\/+$/, '')
    if (resolved.startsWith('http://') || resolved.startsWith('https://')) {
      loomBaseCache = {
        value: resolved,
        expiresAt: now + LOOM_BASE_TTL_MS,
      }
      return resolved
    }
  } catch {
    // Fallback below keeps local dev working even if Lantern lookup fails.
  }

  const fallback = '/loom-api'
  loomBaseCache = {
    value: fallback,
    expiresAt: now + LOOM_BASE_TTL_MS,
  }
  return fallback
}

// ─── Tool Creation ────────────────────────────────────────────────────────────

export interface LanternTemplate {
  name: string
  description: string
  type: string
  run_cmd: string | null
  builtin: boolean
  features?: Record<string, unknown>
  root?: string | null
  run_cwd?: string
  run_env?: Record<string, unknown>
}

export interface CreateProjectInput {
  name: string
  description?: string
  kind?: string
  type?: string
  path?: string
  tags?: string[]
}

/** Register a new project with Lantern (does not write files). */
export async function createProject(input: CreateProjectInput): Promise<ToolSummary> {
  const r = await req<ApiResponse<ToolSummary>>('POST', '/api/projects', input)
  return r.data
}

/** Reset a project's runtime config from its local lantern.yaml/lantern.yml. */
export async function resetProjectFromManifest(name: string): Promise<ToolSummary> {
  const r = await req<ApiResponse<ToolSummary>>('POST', `/api/projects/${encodeURIComponent(name)}/reset`)
  return r.data
}

/** Trigger Lantern to refresh discovery for a project (re-scan endpoints, docs). */
export async function refreshProjectDiscovery(name: string): Promise<void> {
  await req('POST', `/api/projects/${encodeURIComponent(name)}/discovery/refresh`)
}

/** List available project templates from Lantern. */
export async function listTemplates(): Promise<LanternTemplate[]> {
  const r = await req<ApiResponse<LanternTemplate[]>>('GET', '/api/templates')
  return r.data
}

/** Scaffold a tool via the GlowForge dev server (writes lantern.yaml + README). */
export interface ScaffoldInput {
  name: string
  displayName?: string
  description?: string
  kind?: string
  template?: string
  customPath?: string
  tags?: string[]
}

export interface ScaffoldResult {
  ok: boolean
  name: string
  path: string
  yaml_path: string
  readme_path: string
  build_yaml_path?: string  // written when status: pending to enable BuildCard immediately
}

export async function scaffoldTool(input: ScaffoldInput): Promise<ScaffoldResult> {
  const res = await fetch('/api/scaffold', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }))
    const msg = (err as { message?: string; error?: string }).message || (err as { error?: string }).error
    throw new Error(msg || `Scaffold failed: HTTP ${res.status}`)
  }
  return res.json() as Promise<ScaffoldResult>
}
