import { useEffect, useState, useCallback } from 'react'
import { History, ChevronDown, ChevronUp, CheckCircle, XCircle, AlertCircle, Clock, RefreshCw, ExternalLink } from 'lucide-react'
import { listHistory } from '../../api/loom'
import { cn } from '../../lib/utils'
import type { TraceHistoryEntry, TraceStatus } from '../../types'

interface Props {
  onLoad: (entry: TraceHistoryEntry) => void
  loadedIds: Set<string>
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const s = Math.floor(diff / 1000)
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

const STATUS_ICON: Record<string, React.ReactNode> = {
  success: <CheckCircle className="size-3 text-[var(--color-green)] shrink-0" />,
  partial: <CheckCircle className="size-3 text-[var(--color-yellow)] shrink-0" />,
  failed: <XCircle className="size-3 text-[var(--color-red)] shrink-0" />,
  error: <AlertCircle className="size-3 text-[var(--color-red)] shrink-0" />,
  running: <Clock className="size-3 text-[var(--color-accent)] shrink-0" />,
}

const STATUS_LABEL: Record<TraceStatus | string, string> = {
  success: 'text-[var(--color-green)]',
  partial: 'text-[var(--color-yellow)]',
  failed: 'text-[var(--color-red)]',
  error: 'text-[var(--color-red)]',
  running: 'text-[var(--color-accent)]',
}

export function HistoryDrawer({ onLoad, loadedIds }: Props) {
  const [open, setOpen] = useState(false)
  const [entries, setEntries] = useState<TraceHistoryEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await listHistory(20)
      setEntries(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load history')
    } finally {
      setLoading(false)
    }
  }, [])

  // Load on open, refresh when re-opened
  useEffect(() => {
    if (open) load()
  }, [open, load])

  const recentCount = entries.length

  return (
    <div className="border-b border-[var(--color-border-subtle)] shrink-0">
      {/* Toggle row */}
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'w-full flex items-center gap-2 px-4 py-2 text-xs transition-colors',
          'hover:bg-[var(--color-surface-raised)]',
          open ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-text-muted)]'
        )}
      >
        <History className="size-3 shrink-0" />
        <span className="font-medium">
          Recent traces
          {recentCount > 0 && !open && (
            <span className="ml-1.5 px-1 py-0.5 rounded-full bg-[var(--color-surface-raised)] text-[var(--color-text-muted)]">
              {recentCount}
            </span>
          )}
        </span>
        {open ? (
          <ChevronUp className="size-3 ml-auto shrink-0" />
        ) : (
          <ChevronDown className="size-3 ml-auto shrink-0" />
        )}
      </button>

      {/* Expanded list */}
      {open && (
        <div className="border-t border-[var(--color-border-subtle)]">
          {/* Toolbar */}
          <div className="flex items-center justify-end px-4 py-1">
            <button
              onClick={load}
              disabled={loading}
              className="flex items-center gap-1 text-[10px] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors"
            >
              <RefreshCw className={cn('size-2.5', loading && 'animate-spin')} />
              refresh
            </button>
          </div>

          {error && (
            <p className="px-4 py-2 text-xs text-[var(--color-red)]">
              {error}
            </p>
          )}

          {!loading && !error && entries.length === 0 && (
            <p className="px-4 py-3 text-xs text-[var(--color-text-muted)] text-center">
              No past traces yet.
            </p>
          )}

          <div className="max-h-56 overflow-y-auto">
            {entries.map((entry) => {
              const alreadyLoaded = loadedIds.has(entry.trace_id)
              return (
                <div
                  key={entry.trace_id}
                  className="flex items-start gap-2.5 px-4 py-2 border-b border-[var(--color-border-subtle)] last:border-0 hover:bg-[var(--color-surface-raised)] transition-colors"
                >
                  {/* Status icon */}
                  <span className="mt-0.5">
                    {STATUS_ICON[entry.status] ?? <Clock className="size-3 text-[var(--color-text-muted)] shrink-0" />}
                  </span>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-[var(--color-text-primary)] truncate leading-snug">
                      {entry.user_prompt || '(no prompt)'}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span
                        className={cn(
                          'text-[10px]',
                          STATUS_LABEL[entry.status] ?? 'text-[var(--color-text-muted)]'
                        )}
                      >
                        {entry.status}
                      </span>
                      <span className="text-[10px] text-[var(--color-text-muted)]">
                        {relativeTime(entry.updated_at || entry.created_at)}
                      </span>
                      <span className="text-[10px] text-[var(--color-text-muted)] font-mono truncate">
                        {entry.trace_id.slice(0, 12)}
                      </span>
                    </div>
                  </div>

                  {/* Load button */}
                  <button
                    onClick={() => onLoad(entry)}
                    disabled={alreadyLoaded}
                    title={alreadyLoaded ? 'Already in session' : 'Load into session'}
                    className={cn(
                      'shrink-0 flex items-center gap-1 px-2 py-0.5 rounded text-[10px] transition-colors mt-0.5',
                      alreadyLoaded
                        ? 'text-[var(--color-text-muted)] cursor-default'
                        : 'text-[var(--color-accent)] hover:bg-[var(--color-accent-subtle)] cursor-pointer'
                    )}
                  >
                    <ExternalLink className="size-2.5" />
                    {alreadyLoaded ? 'loaded' : 'load'}
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
