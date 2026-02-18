/**
 * build.ts — Frontend API client for the GlowForge build system
 *
 * Reads build.yaml manifests via the Vite dev server plugin at /api/build/*
 * Used by BuildCard, BuildDetail, and ToolList polling.
 */

import type { BuildManifest, BuildSummary, BuildPhase, BuildStep } from '../types'

// ─── Base request ─────────────────────────────────────────────────────────────

async function req<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`/api/build${path}`, options)
  if (res.status === 404) return null as T
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error((err as { error?: string }).error || `HTTP ${res.status}`)
  }
  return res.json() as T
}

// ─── Core API ─────────────────────────────────────────────────────────────────

/**
 * Fetch and parse the build.yaml for a tool.
 * Returns null if no build.yaml exists (tool is not being built / already done).
 */
export async function fetchBuildStatus(toolId: string): Promise<BuildManifest | null> {
  return req<BuildManifest | null>(`/${encodeURIComponent(toolId)}`)
}

/**
 * Check whether a build.yaml exists for a tool (fast probe, no parse).
 */
export async function hasBuildManifest(toolId: string): Promise<boolean> {
  const result = await req<{ exists: boolean } | null>(
    `/${encodeURIComponent(toolId)}/exists`
  )
  return result?.exists ?? false
}

/**
 * Fetch multiple tools' build manifests in parallel.
 * Returns a map of toolId → BuildManifest (omitting nulls).
 *
 * Uses /exists probe first to avoid 404 console spam for tools without build.yaml.
 */
export async function fetchBuildStatuses(
  toolIds: string[]
): Promise<Map<string, BuildManifest>> {
  // Step 1: probe existence for all tools (returns {exists: bool} with 200, never 404)
  const existResults = await Promise.allSettled(
    toolIds.map(async (id) => ({ id, exists: await hasBuildManifest(id) }))
  )

  // Only fetch full status for tools that have a build.yaml
  const withManifest = existResults
    .filter((r) => r.status === 'fulfilled' && r.value.exists)
    .map((r) => (r as PromiseFulfilledResult<{ id: string; exists: boolean }>).value.id)

  if (withManifest.length === 0) return new Map()

  // Step 2: fetch full manifests only where they exist
  const results = await Promise.allSettled(
    withManifest.map(async (id) => {
      const manifest = await fetchBuildStatus(id)
      return { id, manifest }
    })
  )

  const map = new Map<string, BuildManifest>()
  for (const result of results) {
    if (result.status === 'fulfilled' && result.value.manifest) {
      map.set(result.value.id, result.value.manifest)
    }
  }
  return map
}

// ─── Derived helpers ──────────────────────────────────────────────────────────

/** Find the currently active phase (in_progress or first pending). */
export function getCurrentPhase(manifest: BuildManifest): BuildPhase | null {
  return (
    manifest.phases.find((p) => p.status === 'in_progress') ??
    manifest.phases.find((p) => p.status === 'pending') ??
    null
  )
}

/** Find the currently active step within the active phase. */
export function getCurrentStep(manifest: BuildManifest): BuildStep | null {
  const phase = getCurrentPhase(manifest)
  if (!phase?.steps) return null
  return (
    phase.steps.find((s) => s.status === 'in_progress') ??
    phase.steps.find((s) => s.status === 'pending') ??
    null
  )
}

/** Compute elapsed seconds since build started. */
export function getElapsedSeconds(manifest: BuildManifest): number {
  const start = new Date(manifest.started_at).getTime()
  const end = manifest.completed_at
    ? new Date(manifest.completed_at).getTime()
    : Date.now()
  return Math.max(0, Math.round((end - start) / 1000))
}

/** Format elapsed seconds as "Xm Ys" or "Xs". */
export function formatElapsed(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return s > 0 ? `${m}m ${s}s` : `${m}m`
}

/**
 * Compute progress 0–1 from phases if manifest.progress is stale/missing.
 * Each phase has equal weight; steps within a phase contribute proportionally.
 */
export function computeProgress(manifest: BuildManifest): number {
  // Trust the manifest's own progress field when available and non-zero
  if (manifest.progress > 0) return manifest.progress

  const phases = manifest.phases
  if (!phases.length) return 0

  const phaseWeight = 1 / phases.length
  let total = 0

  for (const phase of phases) {
    if (phase.status === 'done' || phase.status === 'skipped') {
      total += phaseWeight
    } else if (phase.status === 'in_progress') {
      const steps = phase.steps
      if (steps && steps.length > 0) {
        const doneSteps = steps.filter((s) => s.status === 'done').length
        const inProgressSteps = steps.filter((s) => s.status === 'in_progress').length
        const stepFraction = (doneSteps + inProgressSteps * 0.5) / steps.length
        total += phaseWeight * stepFraction
      } else {
        total += phaseWeight * 0.5
      }
    }
    // pending / failed = 0 contribution
  }

  return Math.min(1, Math.max(0, total))
}

/**
 * Build a full BuildSummary from a manifest.
 */
export function buildSummary(manifest: BuildManifest): BuildSummary {
  const elapsedSeconds = getElapsedSeconds(manifest)
  return {
    manifest,
    currentPhase: getCurrentPhase(manifest),
    currentStep: getCurrentStep(manifest),
    elapsedSeconds,
    elapsedFormatted: formatElapsed(elapsedSeconds),
  }
}

/**
 * Returns true if the build is still active (needs polling).
 */
export function isActiveBuild(manifest: BuildManifest): boolean {
  return manifest.status === 'building' || manifest.status === 'testing' || manifest.status === 'pending'
}

/**
 * Returns true if the build is in a terminal state.
 */
export function isTerminalBuild(manifest: BuildManifest): boolean {
  return manifest.status === 'ready' || manifest.status === 'failed'
}

// ─── Status display helpers ───────────────────────────────────────────────────

export const STATUS_LABELS: Record<BuildManifest['status'], string> = {
  pending:  'Queued',
  building: 'Building',
  testing:  'Testing',
  ready:    'Ready',
  failed:   'Failed',
}

export const STATUS_COLORS: Record<BuildManifest['status'], string> = {
  pending:  'text-[var(--color-text-muted)]',
  building: 'text-[var(--color-accent)]',
  testing:  'text-[var(--color-yellow)]',
  ready:    'text-[var(--color-green)]',
  failed:   'text-[var(--color-red)]',
}

export const PHASE_STATUS_SYMBOL: Record<BuildPhase['status'], string> = {
  pending:     '○',
  in_progress: '◐',
  done:        '✓',
  failed:      '✗',
  skipped:     '—',
}
