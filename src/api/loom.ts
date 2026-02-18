import { getLoomBaseUrl } from './lantern'
import type { TraceState, TraceHistoryEntry, ScheduledTask, PromptResponse, CancelTraceResult } from '../types'

async function base(): Promise<string> {
  return getLoomBaseUrl()
}

async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
  const b = await base()
  const res = await fetch(`${b}${path}`, {
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

// Chat / traces
export interface SendPromptOptions {
  workspace?: string
  toolId?: string
  toolName?: string
}

export async function sendPrompt(prompt: string, options?: SendPromptOptions): Promise<PromptResponse> {
  return req<PromptResponse>('POST', '/prompt', {
    prompt,
    workspace: options?.workspace,
    tool_id: options?.toolId,
    tool_name: options?.toolName,
  })
}

export async function getTraceStatus(traceId: string): Promise<TraceState> {
  return req<TraceState>('GET', `/status/${traceId}`)
}

export async function confirmTrace(traceId: string, approved: boolean, response = ''): Promise<void> {
  await req('POST', `/confirm/${traceId}`, { approved, response })
}

export async function cancelTrace(traceId: string): Promise<CancelTraceResult | null> {
  try {
    const result = await req<CancelTraceResult>('DELETE', `/traces/${traceId}`)
    // Loom returns HTTP 200 for any ID, including nonexistent ones.
    // A processes_killed of 0 indicates a likely ghost cancel (no real trace was running).
    if (result.processes_killed === 0) {
      console.warn(
        `[GlowForge] cancelTrace(${traceId}): processes_killed=0 — ` +
        `Loom may have echo-cancelled a nonexistent trace (ghost record risk).`
      )
    }
    return result
  } catch {
    return null
  }
}

export async function listHistory(limit = 20): Promise<TraceHistoryEntry[]> {
  // Loom /history returns { "runs": [...] } — not "history"
  const r = await req<{ runs?: TraceHistoryEntry[]; history?: TraceHistoryEntry[] }>('GET', `/history?limit=${limit}`)
  return r.runs ?? r.history ?? []
}

// Schedules
export async function listSchedules(): Promise<ScheduledTask[]> {
  const r = await req<{ schedules: ScheduledTask[] | Record<string, ScheduledTask> }>('GET', '/schedules')
  const raw = r.schedules ?? []
  // API may return either an array (each item has .id) or a Record<id, task>
  if (Array.isArray(raw)) {
    return raw
  }
  return Object.entries(raw).map(([id, task]) => ({ ...task, id }))
}

export async function toggleSchedule(id: string, enabled: boolean): Promise<void> {
  await req('PATCH', `/schedules/${encodeURIComponent(id)}`, { enabled })
}

// ─── Schedule CRUD (via GlowForge Vite plugin — writes to schedules.yaml) ────

export interface CreateScheduleInput {
  id: string
  schedule: string
  action: 'agent' | 'http' | 'shell' | 'prompt'
  message?: string
  url?: string
  command?: string
  prompt?: string
  timezone?: string
  enabled?: boolean
  timeout?: number
  method?: string
}

export interface CreateScheduleResult {
  ok: boolean
  id: string
  entry: Record<string, unknown>
}

/** Create a new schedule entry in schedules.yaml via the GlowForge Vite plugin. */
export async function createSchedule(input: CreateScheduleInput): Promise<CreateScheduleResult> {
  const res = await fetch('/api/schedules', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  const data = await res.json().catch(() => ({ message: res.statusText }))
  if (!res.ok) {
    const msg = (data as { message?: string; error?: string }).message || (data as { error?: string }).error
    throw new Error(msg || `HTTP ${res.status}`)
  }
  return data as CreateScheduleResult
}

/** Delete a schedule entry from schedules.yaml via the GlowForge Vite plugin. */
export async function deleteSchedule(id: string): Promise<void> {
  const res = await fetch(`/api/schedules/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({ message: res.statusText }))
    const msg = (data as { message?: string; error?: string }).message || (data as { error?: string }).error
    throw new Error(msg || `HTTP ${res.status}`)
  }
}
