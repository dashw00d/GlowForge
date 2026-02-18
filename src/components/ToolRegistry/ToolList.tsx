import { useEffect, useState, useCallback } from 'react'
import { RefreshCw, Search, Plus } from 'lucide-react'
import { listTools } from '../../api/lantern'
import { ToolCard } from './ToolCard'
import { Spinner } from '../ui/Spinner'
import { ScheduleManager } from './ScheduleManager'
import { BrowserQueueDrawer } from './BrowserQueueDrawer'
import { NewToolModal } from './NewToolModal'
import type { ToolSummary } from '../../types'

interface Props {
  selectedId: string | null
  onSelect: (id: string) => void
}

export function ToolList({ selectedId, onSelect }: Props) {
  const [tools, setTools] = useState<ToolSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [showNewTool, setShowNewTool] = useState(false)

  const load = useCallback(async () => {
    setError(null)
    try {
      const data = await listTools()
      setTools(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load tools')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    const interval = setInterval(load, 10_000)
    return () => clearInterval(interval)
  }, [load])

  const filtered = tools.filter((t) => {
    if (!query) return true
    const q = query.toLowerCase()
    return (
      t.name.toLowerCase().includes(q) ||
      t.description?.toLowerCase().includes(q) ||
      t.tags.some((tag) => tag.toLowerCase().includes(q))
    )
  })

  const running = filtered.filter((t) => t.status === 'running').length

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
          {filtered.map((tool) => (
            <ToolCard
              key={tool.id}
              tool={tool}
              selected={tool.id === selectedId}
              onSelect={() => onSelect(tool.id)}
              onRefresh={load}
            />
          ))}
        </div>
      </div>

      {/* Schedule manager — pinned to bottom */}
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
