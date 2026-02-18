import { useEffect, useState, useCallback } from 'react'
import {
  Briefcase, ChevronDown, ChevronUp, RefreshCw, ExternalLink,
  CheckCircle, XCircle, AlertCircle, Clock, Loader2, Ban, X,
} from 'lucide-react'
import { listHistory } from '../../api/loom'
import { cn } from '../../lib/utils'
import { relativeTime, STATUS_LABEL, ACTION_LABELS, TERMINAL_STATUSES } from './statusUtils'
import type { TraceHistoryEntry, TraceStatus } from '../../types'

interface Message {
  id: string
  prompt: string
  traceId: string
}

interface JobPanelProps {
  messages: Message[]
  statusMap: Record<string, { status: TraceStatus; action?: string }>
  cancelledIds: Set<string>
  onCancel: (traceId: string) => void
  onLoadHistory: (entry: TraceHistoryEntry) => void
}

const STATUS_ICON: Record<string, React.ReactNode> = {
  success:   <CheckCircle className="size-3 text-[var(--color-green)] shrink-0" />,
  partial:   <CheckCircle className="size-3 text-[var(--color-yellow)] shrink-0" />,
  failed:    <XCircle className="size-3 text-[var(--color-red)] shrink-0" />,
  error:     <AlertCircle className="size-3 text-[var(--color-red)] shrink-0" />,
  running:   <Loader2 className="size-3 text-[var(--color-accent)] shrink-0 animate-spin" />,
  cancelled: <Ban className="size-3 text-[var(--color-text-muted)] shrink-0" />,
}

export function JobPanel({ messages, statusMap, cancelledIds, onCancel, onLoadHistory }: JobPanelProps) {
  const [open, setOpen] = useState(false)
  const [historyEntries, setHistoryEntries] = useState<TraceHistoryEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadHistory = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await listHistory(20)
      setHistoryEntries(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load history')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (open) loadHistory()
  }, [open, loadHistory])

  // Partition session messages into active vs past
  const sessionIds = new Set(messages.map((m) => m.traceId))

  const activeMessages = messages.filter((m) => {
    if (cancelledIds.has(m.traceId)) return false
    const info = statusMap[m.traceId]
    if (!info) return true // still polling, assume active
    return !TERMINAL_STATUSES.includes(info.status)
  })

  const pastMessages = messages.filter((m) => {
    if (cancelledIds.has(m.traceId)) return true
    const info = statusMap[m.traceId]
    if (!info) return false
    return TERMINAL_STATUSES.includes(info.status)
  })

  // History entries not already in the session
  const extraHistory = historyEntries.filter((e) => !sessionIds.has(e.trace_id))

  const activeCount = activeMessages.length

  return (
    <div className="border-b border-[var(--color-border-subtle)] shrink-0">
      {/* Toggle row */}
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'w-full flex items-center gap-2 px-4 py-2 text-xs transition-colors',
          'hover:bg-[var(--color-surface-raised)]',
          open ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-text-muted)]',
        )}
      >
        <Briefcase className="size-3 shrink-0" />
        <span className="font-medium">
          Jobs
          {activeCount > 0 && (
            <span
              className="ml-1.5 px-1.5 py-0.5 rounded-full text-[10px]"
              style={{
                backgroundColor: 'var(--color-accent-subtle)',
                color: 'var(--color-accent)',
              }}
            >
              {activeCount}
            </span>
          )}
        </span>
        {open ? (
          <ChevronUp className="size-3 ml-auto shrink-0" />
        ) : (
          <ChevronDown className="size-3 ml-auto shrink-0" />
        )}
      </button>

      {/* Expanded panel */}
      {open && (
        <div className="border-t border-[var(--color-border-subtle)]">
          {/* Toolbar */}
          <div className="flex items-center justify-end px-4 py-1">
            <button
              onClick={loadHistory}
              disabled={loading}
              className="flex items-center gap-1 text-[10px] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors"
            >
              <RefreshCw className={cn('size-2.5', loading && 'animate-spin')} />
              refresh
            </button>
          </div>

          <div className="max-h-72 overflow-y-auto">
            {/* ── Active section ────────────────────────── */}
            {activeMessages.length > 0 && (
              <>
                <div className="px-4 py-1">
                  <span
                    className="text-[10px] font-semibold uppercase tracking-wider"
                    style={{ color: 'var(--color-text-muted)' }}
                  >
                    Active
                  </span>
                </div>
                {[...activeMessages].reverse().map((msg) => {
                  const info = statusMap[msg.traceId]
                  const action = info?.action
                  const label = action ? ACTION_LABELS[action] ?? action : 'Starting'
                  return (
                    <div
                      key={msg.traceId}
                      className="flex items-center gap-2.5 px-4 py-2 border-b border-[var(--color-border-subtle)] last:border-0 hover:bg-[var(--color-surface-raised)] transition-colors"
                    >
                      <Loader2 className="size-3 shrink-0 animate-spin" style={{ color: 'var(--color-accent)' }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-[var(--color-text-primary)] truncate leading-snug">
                          {msg.prompt}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] text-[var(--color-accent)]">
                            {label}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => onCancel(msg.traceId)}
                        title="Cancel"
                        className="shrink-0 p-1 rounded transition-colors"
                        style={{ color: 'var(--color-text-muted)' }}
                        onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--color-red)' }}
                        onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--color-text-muted)' }}
                      >
                        <X className="size-3" />
                      </button>
                    </div>
                  )
                })}
              </>
            )}

            {/* ── Past section ──────────────────────────── */}
            {(pastMessages.length > 0 || extraHistory.length > 0) && (
              <>
                <div className="px-4 py-1 mt-1">
                  <span
                    className="text-[10px] font-semibold uppercase tracking-wider"
                    style={{ color: 'var(--color-text-muted)' }}
                  >
                    Past
                  </span>
                </div>

                {/* Session past traces */}
                {[...pastMessages].reverse().map((msg) => {
                  const info = statusMap[msg.traceId]
                  const isCancelled = cancelledIds.has(msg.traceId)
                  const displayStatus = isCancelled ? 'cancelled' : (info?.status ?? 'running')
                  return (
                    <div
                      key={msg.traceId}
                      className="flex items-center gap-2.5 px-4 py-2 border-b border-[var(--color-border-subtle)] last:border-0 hover:bg-[var(--color-surface-raised)] transition-colors"
                    >
                      <span className="mt-0.5">
                        {STATUS_ICON[displayStatus] ?? <Clock className="size-3 text-[var(--color-text-muted)] shrink-0" />}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-[var(--color-text-primary)] truncate leading-snug">
                          {msg.prompt}
                        </p>
                        <span
                          className={cn(
                            'text-[10px]',
                            STATUS_LABEL[displayStatus] ?? 'text-[var(--color-text-muted)]',
                          )}
                        >
                          {displayStatus}
                        </span>
                      </div>
                    </div>
                  )
                })}

                {/* Backend history entries not in session */}
                {extraHistory.map((entry) => {
                  const alreadyLoaded = sessionIds.has(entry.trace_id)
                  return (
                    <div
                      key={entry.trace_id}
                      className="flex items-start gap-2.5 px-4 py-2 border-b border-[var(--color-border-subtle)] last:border-0 hover:bg-[var(--color-surface-raised)] transition-colors"
                    >
                      <span className="mt-0.5">
                        {STATUS_ICON[entry.status] ?? <Clock className="size-3 text-[var(--color-text-muted)] shrink-0" />}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-[var(--color-text-primary)] truncate leading-snug">
                          {entry.user_prompt || '(no prompt)'}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span
                            className={cn(
                              'text-[10px]',
                              STATUS_LABEL[entry.status] ?? 'text-[var(--color-text-muted)]',
                            )}
                          >
                            {entry.status}
                          </span>
                          <span className="text-[10px] text-[var(--color-text-muted)]">
                            {relativeTime(entry.updated_at || entry.created_at)}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => onLoadHistory(entry)}
                        disabled={alreadyLoaded}
                        title={alreadyLoaded ? 'Already in session' : 'Load into session'}
                        className={cn(
                          'shrink-0 flex items-center gap-1 px-2 py-0.5 rounded text-[10px] transition-colors mt-0.5',
                          alreadyLoaded
                            ? 'text-[var(--color-text-muted)] cursor-default'
                            : 'text-[var(--color-accent)] hover:bg-[var(--color-accent-subtle)] cursor-pointer',
                        )}
                      >
                        <ExternalLink className="size-2.5" />
                        {alreadyLoaded ? 'loaded' : 'load'}
                      </button>
                    </div>
                  )
                })}
              </>
            )}

            {/* Empty state */}
            {activeMessages.length === 0 && pastMessages.length === 0 && extraHistory.length === 0 && !loading && !error && (
              <p className="px-4 py-3 text-xs text-[var(--color-text-muted)] text-center">
                No jobs yet.
              </p>
            )}

            {error && (
              <p className="px-4 py-2 text-xs text-[var(--color-red)]">
                {error}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
