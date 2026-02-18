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

export async function listHistory(limit = 20): Promise<TraceHistoryEntry[]> {
  const r = await req<{ history: TraceHistoryEntry[] }>('GET', `/history?limit=${limit}`)
  return r.history ?? []
}

// Schedules
export async function listSchedules(): Promise<ScheduledTask[]> {
  const r = await req<{ schedules: Record<string, ScheduledTask> }>('GET', '/schedules')
  return Object.entries(r.schedules ?? {}).map(([id, task]) => ({ ...task, id }))
}

export async function toggleSchedule(id: string, enabled: boolean): Promise<void> {
  await req('PATCH', `/schedules/${encodeURIComponent(id)}`, { enabled })
}
