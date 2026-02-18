import { useEffect, useState, useCallback, useRef } from 'react'
import {
  Globe,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Send,
  CheckCircle,
  XCircle,
  Clock,
  Zap,
  Trash2,
} from 'lucide-react'
import {
  getQueueStatus,
  getPendingTasks,
  getResults,
  enqueueTask,
  clearQueue,
} from '../../api/browser'
import type { BrowserTask, TaskResult, QueueStatus } from '../../api/browser'
import { cn } from '../../lib/utils'

// ─── Constants ───────────────────────────────────────────────────────────────

const ACTIONS = [
  'navigate',
  'screenshot',
  'scrape',
  'scroll_feed',
  'click',
  'type',
  'like',
  'follow',
  'reply',
] as const

type ActionType = (typeof ACTIONS)[number]

const ACTION_COLOR: Record<ActionType, string> = {
  navigate:    'text-[var(--color-accent)] bg-[var(--color-accent-subtle)]',
  screenshot:  'text-[var(--color-text-secondary)] bg-[var(--color-surface-raised)]',
  scrape:      'text-[var(--color-yellow)] bg-[var(--color-yellow-subtle)]',
  scroll_feed: 'text-[var(--color-green)] bg-[var(--color-green-subtle)]',
  click:       'text-[var(--color-accent)] bg-[var(--color-accent-subtle)]',
  type:        'text-[var(--color-accent)] bg-[var(--color-accent-subtle)]',
  like:        'text-[var(--color-red)] bg-[var(--color-red-subtle)]',
  follow:      'text-[var(--color-green)] bg-[var(--color-green-subtle)]',
  reply:       'text-[var(--color-yellow)] bg-[var(--color-yellow-subtle)]',
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function ago(iso: string): string {
  const secs = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000))
  if (secs < 60) return `${secs}s ago`
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`
  return `${Math.floor(secs / 3600)}h ago`
}

function ttlLeft(task: BrowserTask): string {
  const created = new Date(task.created_at).getTime()
  const expiresAt = created + task.ttl_seconds * 1000
  const remaining = Math.max(0, Math.round((expiresAt - Date.now()) / 1000))
  if (remaining === 0) return 'expired'
  if (remaining < 60) return `${remaining}s`
  return `${Math.floor(remaining / 60)}m`
}

function shortId(id: string): string {
  return id.slice(0, 8)
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function BrowserQueueDrawer() {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<'pending' | 'results'>('pending')
  const [status, setStatus] = useState<QueueStatus | null>(null)
  const [pendingTasks, setPendingTasks] = useState<BrowserTask[]>([])
  const [results, setResults] = useState<TaskResult[]>([])
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [loadingStatus, setLoadingStatus] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Dispatch form
  const [action, setAction] = useState<ActionType>('navigate')
  const [targetUrl, setTargetUrl] = useState('')
  const [paramsJson, setParamsJson] = useState('')
  const [ttl, setTtl] = useState(300)
  const [showParams, setShowParams] = useState(false)
  const [dispatching, setDispatching] = useState(false)
  const [dispatchedId, setDispatchedId] = useState<string | null>(null)
  const [dispatchError, setDispatchError] = useState<string | null>(null)

  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── Data loading ────────────────────────────────────────────────────────────

  const loadStatus = useCallback(async () => {
    setLoadingStatus(true)
    setError(null)
    try {
      const s = await getQueueStatus()
      setStatus(s)
      setLastUpdated(new Date())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Queue unreachable')
    } finally {
      setLoadingStatus(false)
    }
  }, [])

  const loadTabData = useCallback(async () => {
    if (tab === 'pending') {
      try {
        const tasks = await getPendingTasks()
        setPendingTasks(tasks)
      } catch {
        // status error already shown
      }
    } else {
      try {
        const res = await getResults(30)
        setResults(res)
      } catch {
        // status error already shown
      }
    }
  }, [tab])

  const refresh = useCallback(async () => {
    await Promise.all([loadStatus(), loadTabData()])
  }, [loadStatus, loadTabData])

  // Poll when open
  useEffect(() => {
    if (!open) {
      if (pollTimer.current) clearInterval(pollTimer.current)
      return
    }
    refresh()
    pollTimer.current = setInterval(refresh, 5000)
    return () => {
      if (pollTimer.current) clearInterval(pollTimer.current)
    }
  }, [open, refresh])

  // Reload tab data when switching tabs
  useEffect(() => {
    if (open) loadTabData()
  }, [tab, open, loadTabData])

  // Passive poll for badge (when collapsed)
  useEffect(() => {
    if (open) return
    const t = setInterval(async () => {
      try {
        const s = await getQueueStatus()
        setStatus(s)
      } catch { /* ignore */ }
    }, 15000)
    return () => clearInterval(t)
  }, [open])

  // ── Dispatch ────────────────────────────────────────────────────────────────

  async function handleDispatch(e: React.FormEvent) {
    e.preventDefault()
    setDispatching(true)
    setDispatchedId(null)
    setDispatchError(null)

    let params: Record<string, unknown> | undefined
    if (paramsJson.trim()) {
      try {
        params = JSON.parse(paramsJson)
      } catch {
        setDispatchError('Invalid JSON in params')
        setDispatching(false)
        return
      }
    }

    try {
      const task = await enqueueTask({
        action,
        target_url: targetUrl || undefined,
        params,
        ttl_seconds: ttl,
      })
      setDispatchedId(task.id)
      setTargetUrl('')
      setParamsJson('')
      // Refresh data after dispatch
      setTimeout(refresh, 500)
    } catch (e) {
      setDispatchError(e instanceof Error ? e.message : 'Dispatch failed')
    } finally {
      setDispatching(false)
    }
  }

  async function handleClear() {
    if (!confirm('Clear all pending tasks?')) return
    await clearQueue()
    await refresh()
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  const pendingCount = status?.pending ?? 0
  const hasError = !!error

  return (
    <div className="border-t shrink-0" style={{ borderColor: 'var(--color-border)' }}>
      {/* Header toggle */}
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'w-full flex items-center gap-2 px-3 py-2 text-xs transition-colors',
          open
            ? 'text-[var(--color-text-primary)]'
            : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'
        )}
        style={open ? { backgroundColor: 'var(--color-surface-raised)' } : undefined}
      >
        <Globe className="size-3 shrink-0" />
        <span className="font-medium flex-1 text-left">Browser Queue</span>

        {/* Pending badge */}
        {!open && pendingCount > 0 && (
          <span
            className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold"
            style={{
              backgroundColor: 'var(--color-accent-subtle)',
              color: 'var(--color-accent)',
            }}
          >
            {pendingCount}
          </span>
        )}

        {/* Error badge */}
        {!open && hasError && (
          <span className="size-1.5 rounded-full bg-[var(--color-red)]" />
        )}

        {open ? (
          <ChevronUp className="size-3 shrink-0" />
        ) : (
          <ChevronDown className="size-3 shrink-0" />
        )}
      </button>

      {/* Expanded content */}
      {open && (
        <div className="border-t" style={{ borderColor: 'var(--color-border-subtle)' }}>
          {/* Status bar */}
          <StatusBar
            status={status}
            error={error}
            loading={loadingStatus}
            lastUpdated={lastUpdated}
            onRefresh={refresh}
            onClear={handleClear}
          />

          {/* Dispatch form */}
          <DispatchForm
            action={action}
            targetUrl={targetUrl}
            paramsJson={paramsJson}
            ttl={ttl}
            showParams={showParams}
            dispatching={dispatching}
            dispatchedId={dispatchedId}
            dispatchError={dispatchError}
            onActionChange={setAction}
            onUrlChange={setTargetUrl}
            onParamsChange={setParamsJson}
            onTtlChange={setTtl}
            onToggleParams={() => setShowParams((v) => !v)}
            onSubmit={handleDispatch}
          />

          {/* Tab switcher */}
          <div
            className="flex border-b text-[10px] font-medium"
            style={{ borderColor: 'var(--color-border-subtle)' }}
          >
            {(['pending', 'results'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  'flex-1 py-1.5 capitalize transition-colors',
                  tab === t
                    ? 'text-[var(--color-text-primary)] border-b-2 border-[var(--color-accent)]'
                    : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'
                )}
              >
                {t === 'pending' ? `Pending (${pendingCount})` : `Results (${status?.results_stored ?? 0})`}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="max-h-48 overflow-y-auto">
            {tab === 'pending' ? (
              pendingTasks.length === 0 ? (
                <EmptyState text="No pending tasks" />
              ) : (
                pendingTasks.map((task) => (
                  <PendingTaskRow key={task.id} task={task} />
                ))
              )
            ) : results.length === 0 ? (
              <EmptyState text="No results yet" />
            ) : (
              results.map((r) => <ResultRow key={r.id} result={r} />)
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBar({
  status,
  error,
  loading,
  lastUpdated,
  onRefresh,
  onClear,
}: {
  status: QueueStatus | null
  error: string | null
  loading: boolean
  lastUpdated: Date | null
  onRefresh: () => void
  onClear: () => void
}) {
  const connected = !error && status !== null

  return (
    <div className="flex items-center gap-2 px-3 py-1.5">
      {/* Connected dot */}
      <span
        className={cn(
          'size-1.5 rounded-full shrink-0',
          connected ? 'bg-[var(--color-green)]' : 'bg-[var(--color-red)]'
        )}
        style={
          connected
            ? { boxShadow: '0 0 4px var(--color-green)' }
            : undefined
        }
      />

      {/* Status text */}
      <span className="text-[10px] flex-1" style={{ color: 'var(--color-text-muted)' }}>
        {error
          ? `Error: ${error}`
          : connected
          ? lastUpdated
            ? `Updated ${ago(lastUpdated.toISOString())}`
            : 'Connected'
          : 'Connecting…'}
      </span>

      {/* Clear */}
      {connected && (status?.total_in_queue ?? 0) > 0 && (
        <button
          onClick={onClear}
          title="Clear queue"
          className="text-[var(--color-text-muted)] hover:text-[var(--color-red)] transition-colors"
        >
          <Trash2 className="size-3" />
        </button>
      )}

      {/* Refresh */}
      <button
        onClick={onRefresh}
        disabled={loading}
        className="text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors"
      >
        <RefreshCw className={cn('size-3', loading && 'animate-spin')} />
      </button>
    </div>
  )
}

function DispatchForm({
  action,
  targetUrl,
  paramsJson,
  ttl,
  showParams,
  dispatching,
  dispatchedId,
  dispatchError,
  onActionChange,
  onUrlChange,
  onParamsChange,
  onTtlChange,
  onToggleParams,
  onSubmit,
}: {
  action: ActionType
  targetUrl: string
  paramsJson: string
  ttl: number
  showParams: boolean
  dispatching: boolean
  dispatchedId: string | null
  dispatchError: string | null
  onActionChange: (a: ActionType) => void
  onUrlChange: (u: string) => void
  onParamsChange: (p: string) => void
  onTtlChange: (t: number) => void
  onToggleParams: () => void
  onSubmit: (e: React.FormEvent) => void
}) {
  return (
    <form
      onSubmit={onSubmit}
      className="px-3 py-2 space-y-1.5 border-b"
      style={{ borderColor: 'var(--color-border-subtle)' }}
    >
      {/* Row 1: action + TTL */}
      <div className="flex gap-1.5">
        <select
          value={action}
          onChange={(e) => onActionChange(e.target.value as ActionType)}
          className="flex-1 text-[10px] px-2 py-1 rounded border outline-none"
          style={{
            backgroundColor: 'var(--color-surface-raised)',
            borderColor: 'var(--color-border)',
            color: 'var(--color-text-primary)',
          }}
        >
          {ACTIONS.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>

        <div className="flex items-center gap-1">
          <input
            type="number"
            value={ttl}
            onChange={(e) => onTtlChange(Number(e.target.value))}
            min={10}
            max={3600}
            title="TTL (seconds)"
            className="w-14 text-[10px] px-1.5 py-1 rounded border outline-none text-right"
            style={{
              backgroundColor: 'var(--color-surface-raised)',
              borderColor: 'var(--color-border)',
              color: 'var(--color-text-primary)',
            }}
          />
          <span className="text-[9px]" style={{ color: 'var(--color-text-muted)' }}>s</span>
        </div>
      </div>

      {/* Row 2: target URL */}
      <input
        type="text"
        value={targetUrl}
        onChange={(e) => onUrlChange(e.target.value)}
        placeholder="https://..."
        className="w-full text-[10px] px-2 py-1 rounded border outline-none font-mono"
        style={{
          backgroundColor: 'var(--color-surface-raised)',
          borderColor: 'var(--color-border)',
          color: 'var(--color-text-primary)',
        }}
      />

      {/* Row 3: params toggle + textarea */}
      <button
        type="button"
        onClick={onToggleParams}
        className="text-[9px] transition-colors"
        style={{ color: 'var(--color-text-muted)' }}
      >
        {showParams ? '▾ hide params' : '▸ add params (JSON)'}
      </button>

      {showParams && (
        <textarea
          value={paramsJson}
          onChange={(e) => onParamsChange(e.target.value)}
          placeholder='{"scroll_times": 5}'
          rows={2}
          className="w-full text-[10px] px-2 py-1 rounded border outline-none font-mono resize-none"
          style={{
            backgroundColor: 'var(--color-surface-raised)',
            borderColor: 'var(--color-border)',
            color: 'var(--color-text-primary)',
          }}
        />
      )}

      {/* Feedback */}
      {dispatchedId && (
        <p className="text-[9px]" style={{ color: 'var(--color-green)' }}>
          ✓ Dispatched {shortId(dispatchedId)}
        </p>
      )}
      {dispatchError && (
        <p className="text-[9px]" style={{ color: 'var(--color-red)' }}>
          {dispatchError}
        </p>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={dispatching}
        className={cn(
          'w-full flex items-center justify-center gap-1.5 py-1 rounded text-[10px] font-medium transition-opacity',
          dispatching ? 'opacity-50 cursor-wait' : 'hover:opacity-90'
        )}
        style={{
          backgroundColor: 'var(--color-accent)',
          color: 'var(--color-bg-inverted, #fff)',
        }}
      >
        <Send className="size-2.5" />
        {dispatching ? 'Dispatching…' : 'Dispatch'}
      </button>
    </form>
  )
}

function PendingTaskRow({ task }: { task: BrowserTask }) {
  const color = ACTION_COLOR[task.action as ActionType] ?? 'text-[var(--color-text-secondary)] bg-[var(--color-surface-raised)]'
  const remaining = ttlLeft(task)
  const isExpiring = remaining.endsWith('s') && parseInt(remaining) < 30

  return (
    <div
      className="flex items-center gap-2 px-3 py-2 border-b last:border-0"
      style={{ borderColor: 'var(--color-border-subtle)' }}
    >
      {/* Action badge */}
      <span className={cn('shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium', color)}>
        {task.action}
      </span>

      {/* URL + meta */}
      <div className="flex-1 min-w-0">
        <p
          className="text-[10px] truncate"
          style={{ color: 'var(--color-text-primary)' }}
        >
          {task.target_url
            ? task.target_url.replace(/^https?:\/\//, '')
            : <span style={{ color: 'var(--color-text-muted)' }}>no url</span>}
        </p>
        <p className="text-[9px] font-mono" style={{ color: 'var(--color-text-muted)' }}>
          {shortId(task.id)} · {ago(task.created_at)}
        </p>
      </div>

      {/* TTL remaining */}
      <span
        className={cn(
          'shrink-0 text-[9px] font-mono',
          isExpiring ? 'text-[var(--color-red)]' : 'text-[var(--color-text-muted)]'
        )}
      >
        {remaining}
      </span>
    </div>
  )
}

function ResultRow({ result }: { result: TaskResult }) {
  const icons: Record<string, React.ReactNode> = {
    success: <CheckCircle className="size-3 text-[var(--color-green)]" />,
    error: <XCircle className="size-3 text-[var(--color-red)]" />,
    expired: <Clock className="size-3 text-[var(--color-text-muted)]" />,
  }

  return (
    <div
      className="flex items-center gap-2 px-3 py-2 border-b last:border-0"
      style={{ borderColor: 'var(--color-border-subtle)' }}
    >
      {/* Status icon */}
      <span className="shrink-0">{icons[result.status] ?? <Zap className="size-3" />}</span>

      {/* Task ID + error preview */}
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-mono" style={{ color: 'var(--color-text-primary)' }}>
          {shortId(result.task_id)}
        </p>
        {result.error && (
          <p className="text-[9px] truncate" style={{ color: 'var(--color-red)' }}>
            {result.error}
          </p>
        )}
      </div>

      {/* Timestamp */}
      <span className="shrink-0 text-[9px]" style={{ color: 'var(--color-text-muted)' }}>
        {ago(result.completed_at)}
      </span>
    </div>
  )
}

function EmptyState({ text }: { text: string }) {
  return (
    <p className="px-3 py-4 text-center text-xs" style={{ color: 'var(--color-text-muted)' }}>
      {text}
    </p>
  )
}
