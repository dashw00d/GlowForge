import { useEffect, useState, useCallback, useRef } from 'react'
import { RefreshCw, Search, Plus } from 'lucide-react'
import { listTools } from '../../api/lantern'
import { fetchBuildStatuses, isActiveBuild } from '../../api/build'
import { ToolCard } from './ToolCard'
import { BuildCard } from './BuildCard'
import { Spinner } from '../ui/Spinner'
import { ScheduleManager } from './ScheduleManager'
import { BrowserQueueDrawer } from './BrowserQueueDrawer'
import { PinnedEndpointsDrawer } from './PinnedEndpointsDrawer'
import { NewToolModal } from './NewToolModal'
import type { ToolSummary, BuildManifest } from '../../types'

interface Props {
  selectedId: string | null
  onSelect: (id: string) => void
  /** Called whenever build manifest state changes — lets App.tsx decide which detail panel to show */
  onBuildManifestUpdate?: (manifests: Map<string, BuildManifest>) => void
  /** Bump this number to trigger an immediate tool list reload (e.g. after deletion). */
  refreshKey?: number
}

export function ToolList({ selectedId, onSelect, onBuildManifestUpdate, refreshKey }: Props) {
  const [tools, setTools] = useState<ToolSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [showNewTool, setShowNewTool] = useState(false)
  const [buildManifests, setBuildManifests] = useState<Map<string, BuildManifest>>(new Map())

  // Keep a ref to the current tool IDs so the fast-poll effect doesn't need them as deps
  const toolIdsRef = useRef<string[]>([])

  // ── Build manifest loading ──────────────────────────────────────────────────

  const loadBuilds = useCallback(async (toolIds: string[]) => {
    if (toolIds.length === 0) return
    try {
      const manifests = await fetchBuildStatuses(toolIds)
      setBuildManifests(manifests)
      onBuildManifestUpdate?.(manifests)
    } catch {
      // Non-fatal — build status is best-effort
    }
  }, [onBuildManifestUpdate])

  // ── Tool list loading ───────────────────────────────────────────────────────

  // Track if initial build check has been done
  const buildCheckDone = useRef(false)

  const load = useCallback(async () => {
    setError(null)
    try {
      const data = await listTools()
      setTools(data)
      toolIdsRef.current = data.map((t) => t.id)
      // Only check builds once on initial load, not every 10s poll
      if (!buildCheckDone.current) {
        buildCheckDone.current = true
        await loadBuilds(toolIdsRef.current)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load tools')
    } finally {
      setLoading(false)
    }
  }, [loadBuilds])

  // Main polling interval: 10s (covers tool status changes)
  useEffect(() => {
    load()
    const id = setInterval(load, 10_000)
    return () => clearInterval(id)
  }, [load])

  // Immediate reload when parent bumps refreshKey (e.g. after tool deletion)
  useEffect(() => {
    if (refreshKey && refreshKey > 0) load()
  }, [refreshKey]) // eslint-disable-line react-hooks/exhaustive-deps

  // Fast build manifest polling: 3s when any active builds are present
  const hasActiveBuilds = [...buildManifests.values()].some(isActiveBuild)

  useEffect(() => {
    if (!hasActiveBuilds) return
    const id = setInterval(() => loadBuilds(toolIdsRef.current), 3_000)
    return () => clearInterval(id)
  }, [hasActiveBuilds, loadBuilds])

  // ── Filtering ───────────────────────────────────────────────────────────────

  const filtered = tools.filter((t) => {
    if (!query) return true
    const q = query.toLowerCase()
    return (
      t.name.toLowerCase().includes(q) ||
      t.description?.toLowerCase().includes(q) ||
      t.tags.some((tag) => tag.toLowerCase().includes(q))
    )
  })

  const running = tools.filter((t) => t.status === 'running').length
  const building = [...buildManifests.values()].filter(isActiveBuild).length

  // ── Retry handler ───────────────────────────────────────────────────────────

  async function handleRetry(toolId: string) {
    // Clear the failed manifest locally so we stop showing BuildCard
    // The actual retry would be triggered by the user re-prompting Loom
    setBuildManifests((prev) => {
      const next = new Map(prev)
      next.delete(toolId)
      return next
    })
    await load()
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-3 py-2.5 border-b border-[var(--color-border)] flex items-center justify-between shrink-0">
        <div>
          <h2 className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">
            Tool Registry
          </h2>
          {!loading && (
            <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">
              {running}/{tools.length} running
              {building > 0 && (
                <span className="ml-1 text-[var(--color-accent)]">
                  · {building} building
                </span>
              )}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowNewTool(true)}
            className="text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-colors p-1 rounded"
            title="New Tool"
          >
            <Plus className="size-3" />
          </button>
          <button
            onClick={load}
            className="text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors p-1 rounded"
            title="Refresh"
          >
            <RefreshCw className="size-3" />
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="px-2 py-1.5 border-b border-[var(--color-border-subtle)] shrink-0">
        <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-[var(--color-surface-raised)]">
          <Search className="size-3 text-[var(--color-text-muted)] shrink-0" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter tools..."
            className="flex-1 bg-transparent text-xs text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] outline-none"
          />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="flex items-center justify-center py-8">
            <Spinner className="text-[var(--color-text-muted)]" />
          </div>
        )}
        {error && !loading && (
          <div className="px-3 py-4 text-xs text-[var(--color-red)]">
            <p className="font-medium">Lantern unreachable</p>
            <p className="text-[var(--color-text-muted)] mt-1">{error}</p>
          </div>
        )}
        {!loading && !error && filtered.length === 0 && (
          <div className="px-3 py-6 text-center text-xs text-[var(--color-text-muted)]">
            {query ? 'No tools match your search.' : 'No tools registered.'}
          </div>
        )}
        <div className="group">
          {filtered.map((tool) => {
            const manifest = buildManifests.get(tool.id)
            const hasActiveBuild = manifest != null && isActiveBuild(manifest)

            if (hasActiveBuild) {
              return (
                <BuildCard
                  key={tool.id}
                  manifest={manifest!}
                  selected={tool.id === selectedId}
                  onSelect={() => onSelect(tool.id)}
                  onRetry={() => handleRetry(tool.id)}
                  onDismiss={() => {
                    setBuildManifests((prev) => {
                      const next = new Map(prev)
                      next.delete(tool.id)
                      return next
                    })
                  }}
                />
              )
            }

            return (
              <ToolCard
                key={tool.id}
                tool={tool}
                selected={tool.id === selectedId}
                onSelect={() => onSelect(tool.id)}
                onRefresh={load}
              />
            )
          })}
        </div>
      </div>

      {/* Schedule manager — pinned to bottom */}
      <PinnedEndpointsDrawer />
      <ScheduleManager />

      {/* Browser queue drawer — below schedule manager */}
      <BrowserQueueDrawer />

      {/* New Tool modal — rendered outside panel flow */}
      {showNewTool && (
        <NewToolModal
          onClose={() => setShowNewTool(false)}
          onCreated={(name) => {
            setShowNewTool(false)
            load()
            onSelect(name)
          }}
        />
      )}
    </div>
  )
}
