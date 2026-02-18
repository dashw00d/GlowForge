import type {
  ApiResponse,
  ToolSummary,
  ToolDetail,
  ProjectHealthStatus,
  SystemHealth,
} from '../types'

const BASE = 'http://127.0.0.1:4777'

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
}

export async function getToolDocs(id: string): Promise<DocFile[]> {
  const r = await req<ApiResponse<{ docs: Array<{ path: string; content?: string | null; error?: string | null }> }>>(
    'GET',
    `/api/tools/${encodeURIComponent(id)}/docs`
  )
  return (r.data?.docs ?? []).map((d) => ({
    path: d.path,
    content: d.content ?? null,
    error: d.error ?? null,
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

// Lifecycle
export async function activateTool(id: string): Promise<void> {
  await req('POST', `/api/projects/${encodeURIComponent(id)}/activate`)
}

export async function deactivateTool(id: string): Promise<void> {
  await req('POST', `/api/projects/${encodeURIComponent(id)}/deactivate`)
}

export async function restartTool(id: string): Promise<void> {
  await req('POST', `/api/projects/${encodeURIComponent(id)}/restart`)
}

// Resolve Loom base URL via Lantern
let _loomBaseUrl: string | null = null
let _loomBaseUrlFetchedAt = 0

export async function getLoomBaseUrl(): Promise<string> {
  const now = Date.now()
  if (_loomBaseUrl && now - _loomBaseUrlFetchedAt < 5 * 60 * 1000) {
    return _loomBaseUrl
  }
  try {
    const tool = await getTool('loom')
    const url = tool.base_url || tool.upstream_url
    if (url) {
      _loomBaseUrl = url.replace(/\/$/, '')
      _loomBaseUrlFetchedAt = now
      return _loomBaseUrl
    }
  } catch {
    // fall through to default
  }
  // Fallback: Loom's default port
  return 'http://127.0.0.1:8410'
}
