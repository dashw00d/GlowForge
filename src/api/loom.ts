import { getLoomBaseUrl } from './lantern'
import type { TraceState, TraceHistoryEntry, ScheduledTask, PromptResponse } from '../types'

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
export async function sendPrompt(prompt: string): Promise<PromptResponse> {
  return req<PromptResponse>('POST', '/prompt', { prompt })
}

export async function getTraceStatus(traceId: string): Promise<TraceState> {
  return req<TraceState>('GET', `/status/${traceId}`)
}

export async function confirmTrace(traceId: string, approved: boolean, response = ''): Promise<void> {
  await req('POST', `/confirm/${traceId}`, { approved, response })
}

export async function cancelTrace(traceId: string): Promise<boolean> {
  try {
    await req('DELETE', `/traces/${traceId}`)
    return true
  } catch {
    return false
  }
}

export async function listHistory(limit = 20): Promise<TraceHistoryEntry[]> {
  const r = await req<{ history: TraceHistoryEntry[] }>('GET', `/history?limit=${limit}`)
  return r.history ?? []
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
  const data = await res.json().catch(() => ({ error: res.statusText }))
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || `HTTP ${res.status}`)
  }
  return data as CreateScheduleResult
}

/** Delete a schedule entry from schedules.yaml via the GlowForge Vite plugin. */
export async function deleteSchedule(id: string): Promise<void> {
  const res = await fetch(`/api/schedules/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error((data as { error?: string }).error || `HTTP ${res.status}`)
  }
}
