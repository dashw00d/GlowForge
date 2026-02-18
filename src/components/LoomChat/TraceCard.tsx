import { useEffect, useState, useRef } from 'react'
import { CheckCircle, XCircle, Loader2, Clock, ChevronDown, ChevronUp, Copy, Check } from 'lucide-react'
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
  const isRunning = !isTerminal

  return (
    <div
      className="rounded-lg border transition-colors"
      style={{
        borderColor: statusBorderColor(status),
        backgroundColor: statusBgColor(status),
      }}
    >
      {/* Header — click to collapse */}
      <button
        className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left"
        onClick={() => setExpanded((v) => !v)}
      >
        <StatusIcon status={status} />
        <div className="flex-1 min-w-0">
          <p
            className="text-sm truncate"
            style={{ color: 'var(--color-text-primary)' }}
          >
            {prompt}
          </p>
          <p
            className="text-[10px] mt-0.5 font-mono"
            style={{ color: 'var(--color-text-muted)' }}
          >
            {traceId.slice(0, 16)}
            {isRunning && (
              <span
                className="ml-2 animate-pulse"
                style={{ color: 'var(--color-accent)' }}
              >
                {state?.action ?? 'running'}…
              </span>
            )}
            {isTerminal && (
              <span
                className="ml-2"
                style={{ color: statusTextColor(status) }}
              >
                {status}
              </span>
            )}
          </p>
        </div>
        {expanded ? (
          <ChevronUp className="size-3.5 shrink-0" style={{ color: 'var(--color-text-muted)' }} />
        ) : (
          <ChevronDown className="size-3.5 shrink-0" style={{ color: 'var(--color-text-muted)' }} />
        )}
      </button>

      {/* Body */}
      {expanded && (
        <div className="px-3 pb-3 space-y-2">

          {/* Plan — shown more prominently while running */}
          {state?.plan && (
            <div
              className="text-xs rounded p-2 border"
              style={{
                color: isRunning ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                backgroundColor: isRunning ? 'var(--color-surface)' : 'transparent',
                borderColor: isRunning ? 'var(--color-accent-subtle)' : 'var(--color-border-subtle)',
                borderLeftWidth: isRunning ? '3px' : '1px',
                borderLeftColor: isRunning ? 'var(--color-accent)' : 'var(--color-border-subtle)',
              }}
            >
              {state.plan}
            </div>
          )}

          {/* Tasks */}
          {state?.tasks && state.tasks.length > 0 && (
            <div className="space-y-1.5">
              {state.tasks.map((task) => {
                const artifact = state.artifacts?.[task.task_id]
                const taskStatus = artifact?.status ?? task.status ?? 'pending'
                return (
                  <div key={task.task_id} className="flex items-start gap-2">
                    <TaskStatusIcon status={taskStatus} />
                    <div className="flex-1 min-w-0">
                      <p
                        className="text-xs leading-snug"
                        style={{ color: 'var(--color-text-primary)' }}
                      >
                        {task.description}
                      </p>
                      {artifact?.output && (
                        <ArtifactBlock output={artifact.output} />
                      )}
                      {artifact?.error && (
                        <p
                          className="text-[10px] mt-1"
                          style={{ color: 'var(--color-red)' }}
                        >
                          {artifact.error}
                        </p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Poll / trace error */}
          {(error || state?.error) && (
            <p
              className="text-xs"
              style={{ color: 'var(--color-red)' }}
            >
              {error || state?.error}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

// ── ArtifactBlock ─────────────────────────────────────────

const MAX_COLLAPSED_LINES = 8

function ArtifactBlock({ output }: { output: string }) {
  const lines = output.split('\n')
  const isLong = lines.length > MAX_COLLAPSED_LINES
  const [outputExpanded, setOutputExpanded] = useState(false)
  const [copied, setCopied] = useState(false)

  const displayed = isLong && !outputExpanded
    ? lines.slice(0, MAX_COLLAPSED_LINES).join('\n')
    : output

  async function handleCopy(e: React.MouseEvent) {
    e.stopPropagation()
    try {
      await navigator.clipboard.writeText(output)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // clipboard API unavailable (e.g. non-https) — silently ignore
    }
  }

  return (
    <div
      className="relative mt-1 rounded border group/artifact"
      style={{
        backgroundColor: 'var(--color-surface)',
        borderColor: 'var(--color-border-subtle)',
      }}
    >
      {/* Copy button — shown on hover */}
      <button
        onClick={handleCopy}
        title="Copy output"
        className={cn(
          'absolute top-1 right-1 flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] transition-all',
          'opacity-0 group-hover/artifact:opacity-100',
        )}
        style={{
          backgroundColor: copied ? 'var(--color-green-subtle)' : 'var(--color-surface-raised)',
          color: copied ? 'var(--color-green)' : 'var(--color-text-muted)',
          border: `1px solid ${copied ? 'var(--color-green-subtle)' : 'var(--color-border)'}`,
        }}
      >
        {copied ? (
          <>
            <Check className="size-2.5" />
            Copied!
          </>
        ) : (
          <>
            <Copy className="size-2.5" />
            Copy
          </>
        )}
      </button>

      {/* Output text */}
      <pre
        className="text-[10px] font-mono p-2 pr-14 overflow-x-auto"
        style={{
          color: 'var(--color-text-secondary)',
          maxHeight: outputExpanded ? 'none' : '12rem',
          overflowY: outputExpanded ? 'visible' : 'auto',
        }}
      >
        {displayed}
        {isLong && !outputExpanded && (
          <span style={{ color: 'var(--color-text-muted)' }}>…</span>
        )}
      </pre>

      {/* Expand / collapse for long outputs */}
      {isLong && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            setOutputExpanded((v) => !v)
          }}
          className="w-full flex items-center justify-center gap-1 py-1 text-[10px] border-t transition-colors"
          style={{
            borderColor: 'var(--color-border-subtle)',
            color: 'var(--color-text-muted)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = 'var(--color-text-secondary)'
            e.currentTarget.style.backgroundColor = 'var(--color-surface-raised)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'var(--color-text-muted)'
            e.currentTarget.style.backgroundColor = 'transparent'
          }}
        >
          {outputExpanded ? (
            <><ChevronUp className="size-2.5" /> Collapse</>
          ) : (
            <><ChevronDown className="size-2.5" /> {lines.length - MAX_COLLAPSED_LINES} more lines</>
          )}
        </button>
      )}
    </div>
  )
}

// ── Icons ─────────────────────────────────────────────────

function StatusIcon({ status }: { status: TraceStatus | string }) {
  if (status === 'success') return <CheckCircle className="size-4 shrink-0" style={{ color: 'var(--color-green)' }} />
  if (status === 'failed' || status === 'error') return <XCircle className="size-4 shrink-0" style={{ color: 'var(--color-red)' }} />
  if (status === 'partial') return <CheckCircle className="size-4 shrink-0" style={{ color: 'var(--color-yellow)' }} />
  return <Loader2 className="size-4 shrink-0 animate-spin" style={{ color: 'var(--color-accent)' }} />
}

function TaskStatusIcon({ status }: { status: string }) {
  if (status === 'done') return <CheckCircle className="size-3 shrink-0 mt-0.5" style={{ color: 'var(--color-green)' }} />
  if (status === 'error') return <XCircle className="size-3 shrink-0 mt-0.5" style={{ color: 'var(--color-red)' }} />
  if (status === 'running') return <Loader2 className="size-3 shrink-0 mt-0.5 animate-spin" style={{ color: 'var(--color-accent)' }} />
  if (status === 'skipped') return <ChevronDown className="size-3 shrink-0 mt-0.5" style={{ color: 'var(--color-text-muted)' }} />
  return <Clock className="size-3 shrink-0 mt-0.5" style={{ color: 'var(--color-text-muted)' }} />
}

// ── Color helpers ─────────────────────────────────────────

function statusBorderColor(status: string): string {
  if (status === 'success') return 'var(--color-green-subtle)'
  if (status === 'failed' || status === 'error') return 'var(--color-red-subtle)'
  if (status === 'partial') return 'var(--color-yellow-subtle)'
  return 'var(--color-border)'
}

function statusBgColor(status: string): string {
  if (status === 'success') return 'var(--color-green-subtle)'
  if (status === 'failed' || status === 'error') return 'var(--color-red-subtle)'
  if (status === 'partial') return 'var(--color-yellow-subtle)'
  return 'var(--color-surface-raised)'
}

function statusTextColor(status: string): string {
  if (status === 'success') return 'var(--color-green)'
  if (status === 'failed' || status === 'error') return 'var(--color-red)'
  if (status === 'partial') return 'var(--color-yellow)'
  return 'var(--color-accent)'
}
