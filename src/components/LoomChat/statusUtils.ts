/**
 * statusUtils.ts — shared status helpers for TraceCard and JobPanel
 *
 * Extracted from HistoryDrawer + TraceCard to avoid duplication.
 */

import type { TraceStatus } from '../../types'

// ── Relative time ──────────────────────────────────────────

export function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const s = Math.floor(diff / 1000)
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

// ── Status → CSS class map ─────────────────────────────────

export const STATUS_LABEL: Record<TraceStatus | string, string> = {
  success:               'text-[var(--color-green)]',
  partial:               'text-[var(--color-yellow)]',
  failed:                'text-[var(--color-red)]',
  error:                 'text-[var(--color-red)]',
  running:               'text-[var(--color-accent)]',
  cancelled:             'text-[var(--color-text-muted)]',
  paused:                'text-[var(--color-yellow)]',
  awaiting_confirmation: 'text-[var(--color-yellow)]',
  awaiting_input:        'text-[var(--color-yellow)]',
  await_user:            'text-[var(--color-yellow)]',
}

// ── Rotating verb arrays (used by TraceCard) ───────────────

export const ACTION_VERBS: Record<string, string[]> = {
  route:        ['Understanding request', 'Categorizing intent', 'Figuring out approach'],
  select_tools: ['Selecting tools', 'Matching capabilities', 'Picking the right tools'],
  hydrate:      ['Loading context', 'Reading documentation', 'Gathering tool details'],
  break_tasks:  ['Breaking down tasks', 'Planning steps', 'Decomposing work'],
  assign:       ['Assigning tasks', 'Dispatching to agents', 'Setting up workers'],
  implement:    ['Working on it', 'Executing tasks', 'Building output'],
  review:       ['Reviewing results', 'Checking quality', 'Validating output'],
}
export const FALLBACK_VERBS = ['Working', 'Processing', 'Thinking']

// ── Concise action labels (used by JobPanel) ───────────────

export const ACTION_LABELS: Record<string, string> = {
  route:        'Routing',
  select_tools: 'Selecting tools',
  hydrate:      'Loading context',
  break_tasks:  'Planning',
  assign:       'Assigning',
  implement:    'Executing',
  review:       'Reviewing',
}

// ── Terminal status check ──────────────────────────────────

export const TERMINAL_STATUSES: TraceStatus[] = ['success', 'partial', 'failed', 'error']
