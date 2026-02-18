// ============================================================
// Lantern types — lifted from ~/tools/Lantern/desktop/src/renderer/types.ts
// ============================================================

export type ProjectType = 'php' | 'proxy' | 'static' | 'unknown'
export type ProjectStatus = 'stopped' | 'starting' | 'running' | 'stopping' | 'error' | 'needs_config'
export type ProjectKind = 'service' | 'project' | 'capability' | 'website' | 'tool'

export interface DocEntry {
  path: string
  kind: string
  source?: 'manual' | 'discovered' | string
  exists?: boolean
  size?: number | null
  mtime?: string | null
}

export interface EndpointEntry {
  method: string
  path: string
  description?: string
  category?: string
  risk?: string
  body_hint?: string
  source?: 'manual' | 'discovered' | string
}

export interface RoutingConfig {
  triggers?: string[]
  risk?: string
  requires_confirmation?: boolean
  max_concurrent?: number
  agents?: string[]
}

export interface ToolSummary {
  id: string
  name: string
  kind: ProjectKind
  description: string | null
  tags: string[]
  enabled: boolean
  status: ProjectStatus
  domain: string | null
  base_url: string | null
  upstream_url: string | null
  health_endpoint: string | null
  health_status: string
  requires_confirmation: boolean
  max_concurrent: number
  triggers: string[]
  risk: string | null
  agents: string[]
}

export interface ToolDetail extends ToolSummary {
  path: string
  repo_path: string
  run_cmd: string | null
  endpoints: EndpointEntry[]
  docs: DocEntry[]
  docs_available?: DocEntry[]
  discovered_endpoints?: EndpointEntry[]
  routing: RoutingConfig | null
  depends_on: string[]
  repo_url: string | null
}

export interface ProjectHealthStatus {
  status: 'healthy' | 'unhealthy' | 'unreachable' | 'error' | 'unknown'
  latency_ms: number | null
  checked_at: string | null
  error: string | null
}

export interface SystemHealth {
  dns: { status: 'ok' | 'warning' | 'error' | 'unknown'; message: string }
  caddy: { status: 'ok' | 'warning' | 'error' | 'unknown'; message: string }
  tls: { status: 'ok' | 'warning' | 'error' | 'unknown'; message: string }
  daemon: { status: 'ok' | 'warning' | 'error' | 'unknown'; message: string }
}

export interface ApiResponse<T> {
  data: T
  meta?: Record<string, unknown>
}

// ============================================================
// Loom types — from Loom API
// ============================================================

export type TraceStatus =
  | 'running'
  | 'paused'
  | 'awaiting_confirmation'
  | 'awaiting_input'
  | 'success'
  | 'partial'
  | 'failed'
  | 'error'

export interface TraceState {
  trace_id: string
  status: TraceStatus
  action: string
  user_prompt: string
  plan: string
  tasks: LoomTask[]
  artifacts: Record<string, TaskArtifact>
  created_at: string
  updated_at: string
  error?: string
}

export interface LoomTask {
  task_id: string
  description: string
  agent?: string
  tool?: string
  status?: 'pending' | 'running' | 'done' | 'error' | 'skipped'
  depends_on?: string[]
}

export interface TaskArtifact {
  task_id: string
  status: 'done' | 'error' | 'skipped'
  output?: string
  error?: string
}

export interface TraceHistoryEntry {
  trace_id: string
  status: TraceStatus
  user_prompt: string
  created_at: string
  updated_at: string
}

export interface ScheduledTask {
  id: string
  schedule: string
  action: 'agent' | 'http' | 'shell' | 'prompt' | 'trace'
  enabled: boolean
  enabled_override: boolean | null
  timezone?: string | null
  last_fired?: string | null
  message?: string
  url?: string
  command?: string
  prompt?: string
}

export interface PromptResponse {
  trace_id: string
  status: string
}
