/**
 * browser-queue.ts — In-memory task queue for GlowForge browser agent
 *
 * Singleton queue used by the Vite dev server plugin.
 * Tasks expire after ttl_seconds (default 300 = 5 min).
 * Results are stored (most recent first) up to maxResults.
 */

export interface BrowserTask {
  id: string
  created_at: string
  ttl_seconds: number
  action: string
  target_url?: string
  params?: Record<string, unknown>
  callback_url?: string    // POST result here on completion
  source?: string          // who submitted ("twitter-intel", "loom", "manual")
  correlation_id?: string  // caller's own ID for matching
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

// ─── Queue ──────────────────────────────────────────────────────────────────

class BrowserQueue {
  private tasks: BrowserTask[] = []
  private results: TaskResult[] = []
  private readonly maxResults = 200

  // ── Enqueue ───────────────────────────────────────────────────────────────

  enqueue(
    input: Omit<BrowserTask, 'id' | 'created_at'> & { id?: string; created_at?: string }
  ): BrowserTask {
    const task: BrowserTask = {
      id: input.id ?? crypto.randomUUID(),
      created_at: input.created_at ?? new Date().toISOString(),
      ttl_seconds: input.ttl_seconds ?? 300,
      action: input.action,
      target_url: input.target_url,
      params: input.params ?? {},
      callback_url: input.callback_url,
      source: input.source,
      correlation_id: input.correlation_id,
    }
    this.tasks.push(task)
    return task
  }

  // ── Dequeue (FIFO, skip expired) ──────────────────────────────────────────

  dequeue(): BrowserTask | null {
    const now = Date.now()
    while (this.tasks.length > 0) {
      const task = this.tasks.shift()!
      if (!this._isExpired(task, now)) {
        // Store for callback resolution when result arrives
        if (task.callback_url) {
          this.completedTasks.set(task.id, task)
        }
        return task
      }
      // Auto-record expired task as a result
      this._recordExpired(task)
    }
    return null
  }

  // ── Task lookup (for callback resolution) ──────────────────────────────────

  private completedTasks = new Map<string, BrowserTask>() // task_id → original task

  // ── Results ───────────────────────────────────────────────────────────────

  addResult(input: Omit<TaskResult, 'id'>): TaskResult {
    const result: TaskResult = { id: crypto.randomUUID(), ...input }
    this.results.unshift(result)
    if (this.results.length > this.maxResults) {
      this.results.length = this.maxResults
    }

    // Fire callback if the original task had a callback_url
    const originalTask = this.completedTasks.get(input.task_id)
    if (originalTask?.callback_url) {
      this._fireCallback(originalTask.callback_url, result, originalTask).catch(() => {})
    }
    this.completedTasks.delete(input.task_id)

    return result
  }

  private async _fireCallback(url: string, result: TaskResult, task: BrowserTask): Promise<void> {
    try {
      const body = JSON.stringify({
        task_id: result.task_id,
        correlation_id: task.correlation_id,
        source: task.source,
        status: result.status,
        data: result.data,
        error: result.error,
        completed_at: result.completed_at,
      })
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        signal: AbortSignal.timeout(5000),
      })
    } catch {
      // Fire-and-forget — don't let callback failures affect the queue
    }
  }

  // ── Queries ───────────────────────────────────────────────────────────────

  status(): QueueStatus {
    const now = Date.now()
    const pending = this.tasks.filter((t) => !this._isExpired(t, now)).length
    return {
      pending,
      total_in_queue: this.tasks.length,
      results_stored: this.results.length,
      recent_results: this.results.slice(0, 20),
    }
  }

  listPending(): BrowserTask[] {
    const now = Date.now()
    return this.tasks.filter((t) => !this._isExpired(t, now))
  }

  listResults(limit = 50): TaskResult[] {
    return this.results.slice(0, limit)
  }

  getResult(taskId: string): TaskResult | undefined {
    return this.results.find((r) => r.task_id === taskId)
  }

  clear(): void {
    this.tasks = []
    this.results = []
  }

  // ── Internal ──────────────────────────────────────────────────────────────

  private _isExpired(task: BrowserTask, now = Date.now()): boolean {
    const created = new Date(task.created_at).getTime()
    return (now - created) / 1000 > task.ttl_seconds
  }

  private _recordExpired(task: BrowserTask): void {
    this.addResult({
      task_id: task.id,
      status: 'expired',
      completed_at: new Date().toISOString(),
    })
  }
}

// Singleton — shared across all middleware calls in the same Vite process
export const browserQueue = new BrowserQueue()
