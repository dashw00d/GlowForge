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
  history?: Array<{
    status: 'healthy' | 'unhealthy' | 'unreachable' | 'error' | 'unknown'
    checked_at: string
    latency_ms?: number | null
  }>
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
  | 'await_user'        // Loom /history alias for awaiting_input
  | 'success'
  | 'partial'
  | 'failed'
  | 'error'

export interface TraceState {
  trace_id: string
  status: TraceStatus
  action: string
  iteration?: number
  user_prompt?: string
  plan?: string
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
  // Loom may return output as a plain string or as {_raw_text: string}
  output?: string | { _raw_text: string }
  error?: string
}

export interface TraceHistoryEntry {
  trace_id: string
  status: TraceStatus
  user_prompt?: string
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

/** Response from DELETE /traces/{id}. Loom returns HTTP 200 for any ID,
 *  including nonexistent ones — check processes_killed to detect ghost cancels. */
export interface CancelTraceResult {
  trace_id: string
  status: string          // "cancelled"
  processes_killed: number
}

// ─── Build System Types ───────────────────────────────────────────────────────

export type BuildStatus = 'pending' | 'building' | 'testing' | 'ready' | 'failed'

export type PhaseStatus = 'pending' | 'in_progress' | 'done' | 'failed' | 'skipped'

export interface BuildStep {
  name: string
  status: PhaseStatus
  file?: string
  /** Timestamp when this step entered in_progress status */
  started_at?: string
  /** Timestamp when this step completed */
  completed_at?: string
}

export interface BuildPhase {
  id: string
  name: string
  status: PhaseStatus
  started_at?: string
  completed_at?: string
  /** Files created or modified during this phase */
  artifacts?: string[]
  /** Granular steps within the phase (optional) */
  steps?: BuildStep[]
}

export interface BuildLogEntry {
  time: string
  msg: string
}

export interface BuildManifest {
  /** Tool ID — matches lantern.yaml id */
  tool_id: string
  /** Display name */
  name: string
  /** Original user prompt that triggered the build */
  prompt: string
  /** Overall build status */
  status: BuildStatus
  /** When the build started */
  started_at: string
  /** 0–1 progress float, computed from phase completion */
  progress: number
  /** Set when status → ready | failed */
  completed_at?: string
  /** Set when status → failed */
  error?: string
  /** Ordered list of build phases */
  phases: BuildPhase[]
  /** Append-only build log */
  log: BuildLogEntry[]
}

/** Computed helper — current active phase (in_progress or first pending) */
export interface BuildSummary {
  manifest: BuildManifest
  /** Derived: current phase being worked on */
  currentPhase: BuildPhase | null
  /** Derived: current step being worked on */
  currentStep: BuildStep | null
  /** Derived: elapsed seconds since started_at */
  elapsedSeconds: number
  /** Derived: "2m 15s" formatted elapsed */
  elapsedFormatted: string
}
