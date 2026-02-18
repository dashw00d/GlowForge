import { useEffect, useState, useRef } from 'react'
import { CheckCircle, XCircle, Loader2, Clock, ChevronDown, ChevronUp } from 'lucide-react'
import { getTraceStatus } from '../../api/loom'
import { cn } from '../../lib/utils'
import type { TraceState, TraceStatus } from '../../types'

interface Props {
  traceId: string
  prompt: string
}

const TERMINAL: TraceStatus[] = ['success', 'partial', 'failed', 'error']
const POLL_MS = 1500

export function TraceCard({ traceId, prompt }: Props) {
  const [state, setState] = useState<TraceState | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(true)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    async function poll() {
      try {
        const s = await getTraceStatus(traceId)
        setState(s)
        if (TERMINAL.includes(s.status)) {
          if (pollRef.current) clearInterval(pollRef.current)
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Poll failed')
        if (pollRef.current) clearInterval(pollRef.current)
      }
    }

    poll()
    pollRef.current = setInterval(poll, POLL_MS)
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [traceId])

  const status = state?.status ?? 'running'
  const isTerminal = TERMINAL.includes(status)

  return (
    <div className={cn(
      'rounded-lg border transition-colors',
      status === 'success' && 'border-[var(--color-green-subtle)] bg-[var(--color-green-subtle)]',
      (status === 'failed' || status === 'error') && 'border-[var(--color-red-subtle)] bg-[var(--color-red-subtle)]',
      status === 'partial' && 'border-[var(--color-yellow-subtle)] bg-[var(--color-yellow-subtle)]',
      !isTerminal && 'border-[var(--color-border)] bg-[var(--color-surface-raised)]',
    )}>
      {/* Header */}
      <button
        className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left"
        onClick={() => setExpanded(!expanded)}
      >
        <StatusIcon status={status} />
        <div className="flex-1 min-w-0">
          <p className="text-sm text-[var(--color-text-primary)] truncate">{prompt}</p>
          <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">
            {traceId} · {status}
          </p>
        </div>
        {expanded ? (
          <ChevronUp className="size-3.5 text-[var(--color-text-muted)] shrink-0" />
        ) : (
          <ChevronDown className="size-3.5 text-[var(--color-text-muted)] shrink-0" />
        )}
      </button>

      {/* Body */}
      {expanded && (
        <div className="px-3 pb-3 space-y-2">
          {/* Plan */}
          {state?.plan && (
            <div className="text-xs text-[var(--color-text-secondary)] bg-[var(--color-surface)] rounded p-2 border border-[var(--color-border-subtle)]">
              {state.plan}
            </div>
          )}

          {/* Tasks */}
          {state?.tasks && state.tasks.length > 0 && (
            <div className="space-y-1">
              {state.tasks.map((task) => {
                const artifact = state.artifacts?.[task.task_id]
                const taskStatus = artifact?.status ?? task.status ?? 'pending'
                return (
                  <div key={task.task_id} className="flex items-start gap-2">
                    <TaskStatusIcon status={taskStatus} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-[var(--color-text-primary)]">{task.description}</p>
                      {artifact?.output && (
                        <pre className="text-[10px] font-mono text-[var(--color-text-secondary)] mt-1 bg-[var(--color-surface)] rounded p-1.5 overflow-x-auto max-h-24 border border-[var(--color-border-subtle)]">
                          {artifact.output.slice(0, 400)}{artifact.output.length > 400 ? '…' : ''}
                        </pre>
                      )}
                      {artifact?.error && (
                        <p className="text-[10px] text-[var(--color-red)] mt-1">{artifact.error}</p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Error */}
          {(error || state?.error) && (
            <p className="text-xs text-[var(--color-red)]">{error || state?.error}</p>
          )}
        </div>
      )}
    </div>
  )
}

function StatusIcon({ status }: { status: TraceStatus | string }) {
  if (status === 'success') return <CheckCircle className="size-4 text-[var(--color-green)] shrink-0" />
  if (status === 'failed' || status === 'error') return <XCircle className="size-4 text-[var(--color-red)] shrink-0" />
  if (status === 'partial') return <CheckCircle className="size-4 text-[var(--color-yellow)] shrink-0" />
  return <Loader2 className="size-4 text-[var(--color-accent)] shrink-0 animate-spin" />
}

function TaskStatusIcon({ status }: { status: string }) {
  if (status === 'done') return <CheckCircle className="size-3 text-[var(--color-green)] shrink-0 mt-0.5" />
  if (status === 'error') return <XCircle className="size-3 text-[var(--color-red)] shrink-0 mt-0.5" />
  if (status === 'running') return <Loader2 className="size-3 text-[var(--color-accent)] shrink-0 mt-0.5 animate-spin" />
  if (status === 'skipped') return <ChevronDown className="size-3 text-[var(--color-text-muted)] shrink-0 mt-0.5" />
  return <Clock className="size-3 text-[var(--color-text-muted)] shrink-0 mt-0.5" />
}
