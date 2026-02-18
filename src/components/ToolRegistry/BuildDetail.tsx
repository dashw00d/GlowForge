/**
 * BuildDetail.tsx — Expanded right-panel view for a tool being built
 *
 * Replaces ToolDetail when build.yaml exists with status ≠ ready.
 * Polls build.yaml every 3s while active.
 *
 * Layout:
 *   Header — name, status badge, elapsed, close button
 *   Tabs   — Overview | Log
 *   Overview: prompt callout, phase list with steps + artifacts
 *   Log:      monospace auto-scrolling build log
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import {
  X,
  RefreshCw,
  Clock,
  Terminal,
  Layers,
  FileCode,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  CheckSquare,
  Square,
  Loader2,
} from 'lucide-react'
import { fetchBuildStatus, buildSummary, isActiveBuild, STATUS_LABELS, PHASE_STATUS_SYMBOL } from '../../api/build'
import { cn } from '../../lib/utils'
import type { BuildManifest, BuildPhase, BuildStep, BuildLogEntry } from '../../types'

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  toolId: string
  onClose: () => void
  onRetry?: () => void
  /** Called when build transitions to 'ready' — parent can swap to ToolDetail */
  onReady?: () => void
}

type Tab = 'overview' | 'log'

// ─── Status display ───────────────────────────────────────────────────────────

const STATUS_COLOR: Record<BuildManifest['status'], string> = {
  pending:  'text-[var(--color-text-muted)] bg-[var(--color-surface-raised)]',
  building: 'text-[var(--color-accent)] bg-[var(--color-accent-subtle)]',
  testing:  'text-[var(--color-yellow)] bg-[var(--color-yellow-subtle)]',
  ready:    'text-[var(--color-green)] bg-[var(--color-green-subtle)]',
  failed:   'text-[var(--color-red)] bg-[var(--color-red-subtle)]',
}

// ─── Component ────────────────────────────────────────────────────────────────

export function BuildDetail({ toolId, onClose, onRetry, onReady }: Props) {
  const [manifest, setManifest] = useState<BuildManifest | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('overview')
  const [elapsed, setElapsed] = useState(0)

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const prevStatusRef = useRef<string | null>(null)

  const load = useCallback(async () => {
    try {
      const m = await fetchBuildStatus(toolId)
      if (!m) {
        setError('build.yaml not found')
        setLoading(false)
        return
      }
      setManifest(m)
      setError(null)

      // Notify parent when build goes ready
      if (m.status === 'ready' && prevStatusRef.current !== 'ready') {
        onReady?.()
      }
      prevStatusRef.current = m.status
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load build status')
    } finally {
      setLoading(false)
    }
  }, [toolId, onReady])

  // Initial load + polling
  useEffect(() => {
    load()

    // Poll every 3s
    pollRef.current = setInterval(load, 3000)
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [load])

  // Stop polling when terminal
  useEffect(() => {
    if (!manifest) return
    if (!isActiveBuild(manifest)) {
      if (pollRef.current) {
        clearInterval(pollRef.current)
        pollRef.current = null
      }
    }
  }, [manifest])

  // Elapsed counter
  useEffect(() => {
    if (!manifest || !isActiveBuild(manifest)) return
    const start = new Date(manifest.started_at).getTime()
    const tick = () => setElapsed(Math.round((Date.now() - start) / 1000))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [manifest])

  // ── Render helpers ──────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex flex-col h-full border-l border-[var(--color-border)] bg-[var(--color-surface)]">
        <Header name="Loading…" status={null} elapsed={null} onClose={onClose} />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="size-5 animate-spin text-[var(--color-text-muted)]" />
        </div>
      </div>
    )
  }

  if (error || !manifest) {
    return (
      <div className="flex flex-col h-full border-l border-[var(--color-border)] bg-[var(--color-surface)]">
        <Header name={toolId} status={null} elapsed={null} onClose={onClose} />
        <div className="flex-1 flex items-center justify-center gap-2 text-xs text-[var(--color-red)]">
          <AlertCircle className="size-4 shrink-0" />
          {error ?? 'No build manifest found'}
        </div>
      </div>
    )
  }

  const summary = buildSummary(manifest)
  const isActive = isActiveBuild(manifest)
  const displayElapsed = isActive ? elapsed : summary.elapsedSeconds

  return (
    <div className="flex flex-col h-full border-l border-[var(--color-border)] bg-[var(--color-surface)]">
      {/* Header */}
      <Header
        name={manifest.name}
        status={manifest.status}
        elapsed={displayElapsed}
        onClose={onClose}
        onRetry={manifest.status === 'failed' ? onRetry : undefined}
        onRefresh={isActive ? load : undefined}
      />

      {/* Prompt bar */}
      {manifest.prompt && (
        <div
          className="px-4 py-2 border-b shrink-0 border-l-2 border-l-[var(--color-accent)]"
          style={{ borderBottomColor: 'var(--color-border)', backgroundColor: 'var(--color-surface-raised)' }}
        >
          <p className="text-[10px] text-[var(--color-text-muted)] mb-0.5 font-semibold uppercase tracking-wider">
            Prompt
          </p>
          <p className="text-xs text-[var(--color-text-secondary)] line-clamp-2">
            {manifest.prompt}
          </p>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-[var(--color-border)] shrink-0">
        {(['overview', 'log'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'px-4 py-2 text-xs capitalize transition-colors flex items-center gap-1.5',
              tab === t
                ? 'text-[var(--color-accent)] border-b-2 border-[var(--color-accent)]'
                : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
            )}
          >
            {t === 'overview' ? <Layers className="size-3" /> : <Terminal className="size-3" />}
            {t}
            {t === 'log' && manifest.log.length > 0 && (
              <span className="text-[9px] px-1 rounded-full bg-[var(--color-surface-raised)] text-[var(--color-text-muted)]">
                {manifest.log.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">
        {tab === 'overview' ? (
          <OverviewTab manifest={manifest} currentPhaseId={summary.currentPhase?.id} currentStepName={summary.currentStep?.name} />
        ) : (
          <LogTab log={manifest.log} isActive={isActive} />
        )}
      </div>
    </div>
  )
}

// ─── Header ───────────────────────────────────────────────────────────────────

function Header({
  name,
  status,
  elapsed,
  onClose,
  onRetry,
  onRefresh,
}: {
  name: string
  status: BuildManifest['status'] | null
  elapsed: number | null
  onClose: () => void
  onRetry?: () => void
  onRefresh?: () => void
}) {
  return (
    <div className="px-4 py-3 border-b border-[var(--color-border)] flex items-center gap-2 shrink-0">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="font-semibold text-sm text-[var(--color-text-primary)] truncate">
            {name}
          </h3>
          {status && (
            <span
              className={cn(
                'text-[10px] font-medium px-1.5 py-0.5 rounded-full shrink-0',
                STATUS_COLOR[status]
              )}
            >
              {STATUS_LABELS[status]}
            </span>
          )}
        </div>
        {elapsed !== null && elapsed > 0 && (
          <div className="flex items-center gap-1 mt-0.5">
            <Clock className="size-2.5 text-[var(--color-text-muted)]" />
            <span className="text-[10px] text-[var(--color-text-muted)] tabular-nums">
              {formatElapsedDisplay(elapsed)}
            </span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-1 shrink-0">
        {onRefresh && (
          <button
            onClick={onRefresh}
            title="Refresh"
            className="p-1 rounded text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-raised)] transition-colors"
          >
            <RefreshCw className="size-3.5" />
          </button>
        )}
        {onRetry && (
          <button
            onClick={onRetry}
            title="Retry build"
            className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-[var(--color-red-subtle)] text-[var(--color-red)] hover:bg-[var(--color-red)] hover:text-white transition-colors"
          >
            <RefreshCw className="size-3" />
            Retry
          </button>
        )}
        <button
          onClick={onClose}
          className="p-1 rounded text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-raised)] transition-colors"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  )
}

function formatElapsedDisplay(secs: number): string {
  if (secs < 60) return `${secs}s elapsed`
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return s > 0 ? `${m}m ${s}s elapsed` : `${m}m elapsed`
}

// ─── Overview Tab ─────────────────────────────────────────────────────────────

function OverviewTab({
  manifest,
  currentPhaseId,
  currentStepName,
}: {
  manifest: BuildManifest
  currentPhaseId?: string
  currentStepName?: string
}) {
  return (
    <div className="p-4 space-y-4">
      {/* Error box */}
      {manifest.error && (
        <div
          className="flex gap-2 p-3 rounded-lg border border-[var(--color-red)]"
          style={{ backgroundColor: 'var(--color-red-subtle)' }}
        >
          <AlertCircle className="size-4 shrink-0 text-[var(--color-red)] mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-[var(--color-red)]">Build failed</p>
            <p className="text-xs text-[var(--color-text-secondary)] mt-1 break-all font-mono">
              {manifest.error}
            </p>
          </div>
        </div>
      )}

      {/* Phases */}
      <div>
        <h4 className="text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-2">
          Phases
        </h4>
        <div className="space-y-2">
          {manifest.phases.map((phase) => (
            <PhaseBlock
              key={phase.id}
              phase={phase}
              currentStepName={phase.id === currentPhaseId ? currentStepName : undefined}
            />
          ))}
        </div>
      </div>

      {/* Metadata */}
      <div>
        <h4 className="text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-2">
          Build Info
        </h4>
        <div className="space-y-1">
          <MetaRow label="Tool ID" value={manifest.tool_id} mono />
          <MetaRow label="Started" value={new Date(manifest.started_at).toLocaleTimeString()} />
          {manifest.completed_at && (
            <MetaRow label="Completed" value={new Date(manifest.completed_at).toLocaleTimeString()} />
          )}
          <MetaRow label="Progress" value={`${Math.round(manifest.progress * 100)}%`} />
        </div>
      </div>
    </div>
  )
}

function PhaseBlock({
  phase,
  currentStepName,
}: {
  phase: BuildPhase
  currentStepName?: string
}) {
  const [open, setOpen] = useState(
    phase.status === 'in_progress' || phase.status === 'failed'
  )

  const hasDetail = (phase.steps && phase.steps.length > 0) || (phase.artifacts && phase.artifacts.length > 0)

  const symbol = PHASE_STATUS_SYMBOL[phase.status]
  const isDone = phase.status === 'done'
  const isActive = phase.status === 'in_progress'
  const isFailed = phase.status === 'failed'
  const isSkipped = phase.status === 'skipped'

  const stepsDone = phase.steps?.filter((s) => s.status === 'done').length ?? 0
  const stepsTotal = phase.steps?.length ?? 0

  return (
    <div
      className={cn(
        'rounded-lg border transition-colors',
        isActive && 'border-[var(--color-accent)] bg-[var(--color-accent-subtle)]',
        isFailed && 'border-[var(--color-red)] bg-[var(--color-red-subtle)]',
        isDone && 'border-[var(--color-border-subtle)]',
        !isActive && !isFailed && !isDone && 'border-[var(--color-border-subtle)] opacity-60'
      )}
      style={!isActive && !isFailed && isDone ? { backgroundColor: 'var(--color-surface-raised)' } : undefined}
    >
      {/* Phase header */}
      <button
        onClick={() => hasDetail && setOpen((v) => !v)}
        className={cn(
          'w-full flex items-center gap-2 px-3 py-2 text-left',
          hasDetail && 'cursor-pointer'
        )}
      >
        {/* Status icon */}
        <span
          className={cn(
            'shrink-0 text-sm font-mono w-4 text-center',
            isDone && 'text-[var(--color-green)]',
            isActive && 'text-[var(--color-accent)] animate-pulse',
            isFailed && 'text-[var(--color-red)]',
            !isDone && !isActive && !isFailed && 'text-[var(--color-text-muted)]'
          )}
        >
          {symbol}
        </span>

        {/* Phase name */}
        <span
          className={cn(
            'flex-1 text-xs font-medium',
            isDone && 'text-[var(--color-text-secondary)]',
            isActive && 'text-[var(--color-text-primary)]',
            isFailed && 'text-[var(--color-red)]',
            isSkipped && 'text-[var(--color-text-muted)] line-through',
            !isDone && !isActive && !isFailed && !isSkipped && 'text-[var(--color-text-muted)]'
          )}
        >
          {phase.name}
        </span>

        {/* Step progress */}
        {stepsTotal > 0 && (
          <span className="text-[10px] text-[var(--color-text-muted)] shrink-0">
            {stepsDone}/{stepsTotal}
          </span>
        )}

        {/* Chevron */}
        {hasDetail && (
          <span className="text-[var(--color-text-muted)] shrink-0">
            {open ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
          </span>
        )}
      </button>

      {/* Phase details: steps + artifacts */}
      {open && hasDetail && (
        <div className="px-3 pb-3 space-y-2 border-t border-[var(--color-border-subtle)]">
          {/* Steps */}
          {phase.steps && phase.steps.length > 0 && (
            <div className="mt-2 space-y-1">
              {phase.steps.map((step, i) => (
                <StepRow
                  key={i}
                  step={step}
                  isCurrentStep={isActive && step.name === currentStepName}
                />
              ))}
            </div>
          )}

          {/* Artifacts */}
          {phase.artifacts && phase.artifacts.length > 0 && (
            <div className="mt-2">
              <p className="text-[9px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-1">
                Files
              </p>
              <div className="space-y-0.5">
                {phase.artifacts.map((artifact, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <FileCode className="size-2.5 text-[var(--color-text-muted)] shrink-0" />
                    <span className="text-[10px] font-mono text-[var(--color-text-secondary)]">
                      {artifact}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function StepRow({ step, isCurrentStep }: { step: BuildStep; isCurrentStep: boolean }) {
  const isDone = step.status === 'done'
  const isActive = step.status === 'in_progress'
  const isFailed = step.status === 'failed'

  return (
    <div
      className={cn(
        'flex items-center gap-2 text-xs rounded px-1 py-0.5',
        isCurrentStep && 'bg-[var(--color-accent-subtle)]'
      )}
    >
      {/* Checkbox-style icon */}
      <span className="shrink-0 text-[var(--color-text-muted)]">
        {isDone ? (
          <CheckSquare className="size-3 text-[var(--color-green)]" />
        ) : isActive ? (
          <Loader2 className="size-3 text-[var(--color-accent)] animate-spin" />
        ) : isFailed ? (
          <AlertCircle className="size-3 text-[var(--color-red)]" />
        ) : (
          <Square className="size-3 text-[var(--color-text-muted)]" />
        )}
      </span>

      {/* Step name */}
      <span
        className={cn(
          'flex-1',
          isDone && 'text-[var(--color-text-secondary)]',
          isActive && 'text-[var(--color-text-primary)] font-medium',
          isFailed && 'text-[var(--color-red)]',
          !isDone && !isActive && !isFailed && 'text-[var(--color-text-muted)]'
        )}
      >
        {step.name}
      </span>

      {/* File */}
      {step.file && (
        <span className="text-[9px] font-mono text-[var(--color-text-muted)] truncate max-w-[100px]">
          {step.file}
        </span>
      )}
    </div>
  )
}

function MetaRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-20 shrink-0 text-[var(--color-text-muted)]">{label}</span>
      <span className={cn('text-[var(--color-text-secondary)]', mono && 'font-mono text-[10px]')}>
        {value}
      </span>
    </div>
  )
}

// ─── Log Tab ──────────────────────────────────────────────────────────────────

function LogTab({ log, isActive }: { log: BuildLogEntry[]; isActive: boolean }) {
  const bottomRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when new entries arrive
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [log.length])

  if (log.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-xs text-[var(--color-text-muted)]">
        No log entries yet.
      </div>
    )
  }

  return (
    <div className="p-3 font-mono text-[11px] leading-relaxed">
      {log.map((entry, i) => (
        <LogLine key={i} entry={entry} />
      ))}
      {isActive && (
        <div className="flex items-center gap-1.5 mt-1 text-[var(--color-text-muted)]">
          <Loader2 className="size-2.5 animate-spin" />
          <span>Building…</span>
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  )
}

function LogLine({ entry }: { entry: BuildLogEntry }) {
  const time = new Date(entry.time)
  const timeStr = time.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })

  // Color-code log messages by content
  const isSuccess = entry.msg.startsWith('✓') || entry.msg.toLowerCase().includes('complete')
  const isError = entry.msg.toLowerCase().includes('error') || entry.msg.toLowerCase().includes('failed')
  const isInfo = entry.msg.startsWith('Starting') || entry.msg.startsWith('Creating')

  return (
    <div className="flex gap-2 hover:bg-[var(--color-surface-raised)] px-1 rounded">
      <span className="shrink-0 text-[var(--color-text-muted)] select-none tabular-nums">
        {timeStr}
      </span>
      <span
        className={cn(
          'break-all',
          isSuccess && 'text-[var(--color-green)]',
          isError && 'text-[var(--color-red)]',
          isInfo && 'text-[var(--color-accent)]',
          !isSuccess && !isError && !isInfo && 'text-[var(--color-text-secondary)]'
        )}
      >
        {entry.msg}
      </span>
    </div>
  )
}
