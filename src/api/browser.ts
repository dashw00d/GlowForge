/**
 * browser.ts — Frontend API client for the GlowForge browser task queue
 *
 * Talks to the Vite dev server plugin at /api/browser/*
 * Used by the Queue UI component.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export interface BrowserTask {
  id: string
  created_at: string
  ttl_seconds: number
  action: string
  target_url?: string
  params?: Record<string, unknown>
}

export type ResultStatus = 'success' | 'error' | 'expired'

export interface TaskResult {
  id: string
  task_id: string
  status: ResultStatus
  data?: unknown
  error?: string
  completed_at: string
}

export interface QueueStatus {
  pending: number
  total_in_queue: number
  results_stored: number
  recent_results: TaskResult[]
}

export interface EnqueueInput {
  action: string
  target_url?: string
  params?: Record<string, unknown>
  ttl_seconds?: number
}

// ─── Base ────────────────────────────────────────────────────────────────────

const BASE = '/api/browser'

async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })

  if (res.status === 204) return null as T

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error((err as { error?: string }).error || `HTTP ${res.status}`)
  }

  return res.json() as T
}

// ─── Queue API ────────────────────────────────────────────────────────────────

/** Enqueue a new browser task (dispatch from GlowForge UI). */
export async function enqueueTask(input: EnqueueInput): Promise<BrowserTask> {
  return req<BrowserTask>('POST', '/tasks', input)
}

/** Fetch queue status: pending count, recent results. */
export async function getQueueStatus(): Promise<QueueStatus> {
  return req<QueueStatus>('GET', '/queue')
}

/** List all pending (non-expired) tasks. */
export async function getPendingTasks(): Promise<BrowserTask[]> {
  const data = await req<{ tasks: BrowserTask[] }>('GET', '/queue/pending')
  return data?.tasks ?? []
}

/** List recent results (up to limit). */
export async function getResults(limit = 50): Promise<TaskResult[]> {
  const data = await req<{ results: TaskResult[] }>('GET', `/queue/results?limit=${limit}`)
  return data?.results ?? []
}

/** Clear the queue (dev utility). */
export async function clearQueue(): Promise<void> {
  await req('DELETE', '/queue')
}

// ─── Convenience ─────────────────────────────────────────────────────────────

/** Dispatch a navigate task. */
export function dispatchNavigate(url: string, ttl = 300): Promise<BrowserTask> {
  return enqueueTask({ action: 'navigate', target_url: url, ttl_seconds: ttl })
}

/** Dispatch a scroll_feed task (Twitter / any feed). */
export function dispatchScrollFeed(
  url: string,
  opts: { scroll_times?: number; max_items?: number; collect?: boolean } = {}
): Promise<BrowserTask> {
  return enqueueTask({
    action: 'scroll_feed',
    target_url: url,
    params: { scroll_times: 5, max_items: 50, collect: true, ...opts },
  })
}

/** Dispatch a screenshot task. */
export function dispatchScreenshot(url: string): Promise<BrowserTask> {
  return enqueueTask({ action: 'screenshot', target_url: url })
}

/** Dispatch a scrape task with selector map. */
export function dispatchScrape(
  url: string,
  selectors: Record<string, string>,
  multi = false
): Promise<BrowserTask> {
  return enqueueTask({
    action: 'scrape',
    target_url: url,
    params: { selectors, multi },
  })
}

/** Dispatch a Twitter like task. */
export function dispatchLike(tweetUrl: string, sandbox = false): Promise<BrowserTask> {
  return enqueueTask({
    action: 'like',
    target_url: tweetUrl,
    params: { tweet_url: tweetUrl, sandbox },
  })
}

/** Dispatch a Twitter follow task. */
export function dispatchFollow(handle: string, sandbox = false): Promise<BrowserTask> {
  return enqueueTask({
    action: 'follow',
    target_url: `https://x.com/${handle.replace(/^@/, '')}`,
    params: { handle, sandbox },
  })
}
