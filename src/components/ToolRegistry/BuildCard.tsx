/**
 * BuildCard.tsx — Compact card for tools with an active build.yaml
 *
 * Replaces ToolCard in the registry list when a tool's build.yaml exists
 * and status is not 'ready'. Slots into the same list position with the
 * same px-3 py-2.5 footprint.
 *
 * Visual states:
 *   pending  — faded, dashed border, "Queued" label
 *   building — pulsing blue border glow, animated progress bar
 *   testing  — pulsing amber border glow, amber progress bar
 *   ready    — green border (briefly, before transition to ToolCard)
 *   failed   — red border, error snippet, Retry button
 */

import { useEffect, useState } from 'react'
import { Hammer, RefreshCw, X } from 'lucide-react'
import { cn } from '../../lib/utils'
import {
  computeProgress,
  getCurrentPhase,
  getCurrentStep,
  formatElapsed,
  getElapsedSeconds,
  PHASE_STATUS_SYMBOL,
  STATUS_LABELS,
} from '../../api/build'
import type { BuildManifest } from '../../types'

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  manifest: BuildManifest
  selected: boolean
  onSelect: () => void
  onRetry?: () => void
  onDismiss?: () => void
}

// ─── Status → style map ───────────────────────────────────────────────────────

const STATUS_BORDER: Record<BuildManifest['status'], string> = {
  pending:  'border border-dashed border-[var(--color-border)]',
  building: 'border build-card-building',
  testing:  'border build-card-testing',
  ready:    'border border-[var(--color-green)]',
  failed:   'border border-[var(--color-red)]',
}

const STATUS_OPACITY: Record<BuildManifest['status'], string> = {
  pending:  'opacity-60',
  building: 'opacity-100',
  testing:  'opacity-100',
  ready:    'opacity-100',
  failed:   'opacity-90',
}

// ─── Component ────────────────────────────────────────────────────────────────

export function BuildCard({ manifest, selected, onSelect, onRetry, onDismiss }: Props) {
  const { status, name, phases, error } = manifest
  const [elapsed, setElapsed] = useState(() => getElapsedSeconds(manifest))

  // Tick elapsed every second while active
  useEffect(() => {
    if (status === 'ready' || status === 'failed') return
    const id = setInterval(() => setElapsed(getElapsedSeconds(manifest)), 1000)
    return () => clearInterval(id)
  }, [manifest, status])

  const progress = computeProgress(manifest)
  const currentPhase = getCurrentPhase(manifest)
  const currentStep = getCurrentStep(manifest)

  const isActive = status === 'building' || status === 'testing'
  const isFailed = status === 'failed'
  const isPending = status === 'pending'

  // Current action label: step name > phase name > status label
  const actionLabel =
    currentStep?.name ??
    currentPhase?.name ??
    STATUS_LABELS[status]

  return (
    <button
      onClick={onSelect}
      className={cn(
        'w-full text-left px-3 py-2.5 flex flex-col gap-1.5 transition-colors',
        'border-b border-[var(--color-border-subtle)]',
        'hover:bg-[var(--color-surface-raised)]',
        selected && 'bg-[var(--color-accent-subtle)]',
        STATUS_OPACITY[status],
        STATUS_BORDER[status]
      )}
    >
      {/* ── Row 1: icon + name + status badge + elapsed ── */}
      <div className="flex items-center gap-2 w-full">
        {/* Hammer icon — subtle pulse when active */}
        <span
          className={cn(
            'shrink-0 text-[var(--color-text-muted)]',
            isActive && 'animate-pulse'
          )}
        >
          <Hammer className="size-3.5" />
        </span>

        {/* Tool name */}
        <span
          className={cn(
            'flex-1 text-sm font-medium truncate',
            isFailed
              ? 'text-[var(--color-red)]'
              : 'text-[var(--color-text-primary)]'
          )}
        >
          {name}
        </span>

        {/* Elapsed time */}
        {!isPending && (
          <span className="text-[10px] text-[var(--color-text-muted)] shrink-0 tabular-nums">
            {formatElapsed(elapsed)}
          </span>
        )}

        {/* Pending label */}
        {isPending && (
          <span className="text-[10px] text-[var(--color-text-muted)] shrink-0">
            Queued
          </span>
        )}

        {/* Action buttons: retry / dismiss */}
        {isFailed && onRetry && (
          <span
            onClick={(e) => { e.stopPropagation(); onRetry() }}
            title="Retry build"
            className="shrink-0 inline-flex items-center justify-center size-5 rounded hover:bg-[var(--color-surface-raised)] text-[var(--color-red)] hover:text-[var(--color-text-primary)] transition-colors cursor-pointer"
          >
            <RefreshCw className="size-3" />
          </span>
        )}
        {onDismiss && (
          <span
            onClick={(e) => { e.stopPropagation(); onDismiss() }}
            title="Dismiss"
            className="shrink-0 inline-flex items-center justify-center size-5 rounded hover:bg-[var(--color-surface-raised)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors cursor-pointer"
          >
            <X className="size-3" />
          </span>
        )}
      </div>

      {/* ── Row 2: Progress bar ── */}
      {!isPending && (
        <ProgressBar progress={progress} status={status} />
      )}

      {/* ── Row 3: Current step / error ── */}
      {isFailed ? (
        <p className="text-[10px] text-[var(--color-red)] truncate">
          {error ? error.slice(0, 80) : 'Build failed'}
        </p>
      ) : isActive ? (
        <p className="text-[10px] text-[var(--color-text-secondary)] truncate">
          {status === 'building' ? '⚙ ' : '🔬 '}
          {actionLabel}
        </p>
      ) : null}

      {/* ── Row 4: Phase checklist (compact) ── */}
      {phases.length > 0 && (
        <PhaseChecklist phases={phases} />
      )}
    </button>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ProgressBar({
  progress,
  status,
}: {
  progress: number
  status: BuildManifest['status']
}) {
  const pct = Math.max(0, Math.min(100, Math.round(progress * 100)))

  // Track bar class
  const isAmber = status === 'testing'
  const isGreen = status === 'ready'
  const isRed = status === 'failed'

  let fillClass = ''
  let fillStyle: React.CSSProperties = {}

  if (isAmber) {
    fillClass = 'build-progress-bar-amber'
  } else if (isGreen) {
    fillStyle = { background: 'var(--color-green)' }
  } else if (isRed) {
    fillStyle = { background: 'var(--color-red)' }
  } else {
    fillClass = 'build-progress-bar'
  }

  return (
    <div className="w-full h-1 rounded-full overflow-hidden bg-[var(--color-border)]">
      <div
        className={cn('h-full rounded-full transition-all duration-500', fillClass)}
        style={{ width: `${pct}%`, ...fillStyle }}
      />
    </div>
  )
}

function PhaseChecklist({ phases }: { phases: BuildManifest['phases'] }) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
      {phases.map((phase) => {
        const symbol = PHASE_STATUS_SYMBOL[phase.status]
        const isDone = phase.status === 'done'
        const isActive = phase.status === 'in_progress'
        const isFailed = phase.status === 'failed'

        return (
          <span
            key={phase.id}
            title={`${phase.name}: ${phase.status}`}
            className={cn(
              'inline-flex items-center gap-0.5 text-[9px]',
              isDone && 'text-[var(--color-green)]',
              isActive && 'text-[var(--color-accent)] font-medium',
              isFailed && 'text-[var(--color-red)]',
              !isDone && !isActive && !isFailed && 'text-[var(--color-text-muted)]'
            )}
          >
            <span
              className={cn(isActive && 'animate-pulse')}
            >
              {symbol}
            </span>
            <span className="truncate max-w-[60px]">
              {phase.name.replace('Implementation', 'Impl').replace('Registration', 'Reg')}
            </span>
          </span>
        )
      })}
    </div>
  )
}
