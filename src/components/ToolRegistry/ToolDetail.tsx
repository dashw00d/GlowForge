import { useEffect, useRef, useState } from 'react'
import { X, ExternalLink, Zap, FileText, Activity, Play, Square, AlertCircle, Calendar, MessageSquare, Globe, Terminal, Layers, ChevronDown, ChevronUp, Trash2, Plus, Check, ScrollText, RefreshCw, Search, Clipboard, ClipboardCheck, FlaskConical, Star, Repeat2, History, Pencil, StickyNote } from 'lucide-react'
import { isPinned, togglePin, pinKey } from '../../lib/pinnedEndpoints'
import { loadNote, saveNote } from '../../lib/toolNotes'
import { getTool, getProjectHealth, activateTool, deactivateTool, getToolDocs, deleteProject, restartTool, LANTERN_BASE } from '../../api/lantern'
import type { DocFile } from '../../api/lantern'
import { listSchedules, toggleSchedule, createSchedule, deleteSchedule } from '../../api/loom'
import type { CreateScheduleInput } from '../../api/loom'
import { Spinner } from '../ui/Spinner'
import { StatusDot } from '../ui/StatusDot'
import { MarkdownView } from '../ui/MarkdownView'
import { cn } from '../../lib/utils'
import type { ToolDetail as IToolDetail, ProjectHealthStatus, ScheduledTask, EndpointEntry } from '../../types'

interface Props {
  toolId: string
  onClose: () => void
  onDeleted?: () => void
}

type Tab = 'overview' | 'endpoints' | 'docs' | 'schedules' | 'logs' | 'timeline'

type DeleteState = 'idle' | 'confirm' | 'deleting'

export function ToolDetail({ toolId, onClose, onDeleted }: Props) {
  const [tool, setTool] = useState<IToolDetail | null>(null)
  const [health, setHealth] = useState<ProjectHealthStatus | null>(null)
  const [healthHistory, setHealthHistory] = useState<Array<{ status: ProjectHealthStatus['status']; ts: number }>>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('overview')
  const [toggling, setToggling] = useState(false)
  const [restarting, setRestarting] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [deleteState, setDeleteState] = useState<DeleteState>('idle')
  const [deleteError, setDeleteError] = useState<string | null>(null)

  async function refreshHealth() {
    try {
      // Health is keyed by display name (e.g. "GhostGraph"), not lowercase id
      const h = await getProjectHealth().then((all) => all[tool?.name ?? toolId] ?? null)
      setHealth(h)
      setHealthHistory((prev) => {
        const status = h?.status ?? 'unknown'
        const next = [...prev, { status, ts: Date.now() }]
        return next.length > 20 ? next.slice(next.length - 20) : next
      })
    } catch (e) {
      console.error('Health refresh failed:', e)
    }
  }

  useEffect(() => {
    setLoading(true)
    // Fetch tool + full health map in parallel; look up health by display name
    Promise.all([
      getTool(toolId),
      getProjectHealth(),
    ])
      .then(([t, allHealth]) => {
        const h = allHealth[t.name] ?? null
        setTool(t)
        setHealth(h)
        setHealthHistory((prev) => {
          const status = h?.status ?? 'unknown'
          const next = [...prev, { status, ts: Date.now() }]
          return next.length > 20 ? next.slice(next.length - 20) : next
        })
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [toolId])

  // Poll health every 15s while the detail panel is open
  useEffect(() => {
    const id = setInterval(refreshHealth, 15_000)
    return () => clearInterval(id)
  }, [toolId])

  async function handleToggle() {
    if (!tool) return
    setToggling(true)
    setActionError(null)
    try {
      if (tool.status === 'running') {
        await deactivateTool(tool.name)
      } else {
        await activateTool(tool.name)
      }
      const [t, allHealth] = await Promise.all([
        getTool(toolId),
        getProjectHealth(),
      ])
      setTool(t)
      setHealth(allHealth[t.name] ?? null)
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Action failed')
    } finally {
      setToggling(false)
    }
  }

  const isRunning = tool?.status === 'running'

  async function handleRestart() {
    if (!tool) return
    setRestarting(true)
    setActionError(null)
    try {
      await restartTool(tool.name)
      // Brief pause — give the service a moment to restart before polling state
      await new Promise((r) => setTimeout(r, 1200))
      const [t, allHealth] = await Promise.all([
        getTool(toolId),
        getProjectHealth(),
      ])
      setTool(t)
      setHealth(allHealth[t.name] ?? null)
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Restart failed')
    } finally {
      setRestarting(false)
    }
  }

  async function handleDelete() {
    setDeleteState('deleting')
    setDeleteError(null)
    try {
      await deleteProject(tool?.name ?? toolId)
      onDeleted?.()
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : 'Delete failed')
      setDeleteState('idle')
    }
  }

  return (
    <div className="flex flex-col h-full border-l border-[var(--color-border)] bg-[var(--color-surface)]">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[var(--color-border)] flex items-start justify-between shrink-0">
        <div className="min-w-0">
          {loading ? (
            <Spinner />
          ) : tool ? (
            <>
              <div className="flex items-center gap-2">
                <StatusDot status={tool.status} />
                <h3 className="font-semibold text-sm text-[var(--color-text-primary)] truncate">
                  {tool.name}
                </h3>
              </div>
              {tool.description && (
                <p className="text-xs text-[var(--color-text-secondary)] mt-1 line-clamp-2">
                  {tool.description}
                </p>
              )}
              <div className="flex items-center gap-2 mt-2">
                {tool.domain && (
                  <a
                    href={`https://${tool.domain}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] text-[var(--color-accent)] hover:underline flex items-center gap-1"
                  >
                    {tool.domain}
                    <ExternalLink className="size-2.5" />
                  </a>
                )}
                {health?.latency_ms != null && (
                  <span className="text-[10px] text-[var(--color-text-muted)]">
                    {health.latency_ms}ms
                  </span>
                )}
              </div>
            </>
          ) : (
            <p className="text-xs text-[var(--color-red)]">Failed to load</p>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0 ml-2">
          {/* Delete confirmation inline UI */}
          {deleteState === 'confirm' && (
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-[var(--color-text-muted)] mr-1 whitespace-nowrap">
                Delete?
              </span>
              <button
                onClick={() => { setDeleteState('idle'); setDeleteError(null) }}
                className="px-2 py-0.5 rounded text-[10px] transition-colors"
                style={{ backgroundColor: 'var(--color-surface-raised)', color: 'var(--color-text-muted)' }}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="px-2 py-0.5 rounded text-[10px] font-medium transition-colors"
                style={{ backgroundColor: 'var(--color-red)', color: '#fff' }}
              >
                Delete
              </button>
            </div>
          )}

          {/* Deleting spinner */}
          {deleteState === 'deleting' && (
            <div className="flex items-center gap-1.5 text-[10px] text-[var(--color-text-muted)]">
              <Spinner className="size-3" />
              Deleting…
            </div>
          )}

          {/* Normal controls — hidden while confirming/deleting */}
          {deleteState === 'idle' && (
            <>
              {tool && (
                <button
                  onClick={handleToggle}
                  disabled={toggling}
                  className={cn(
                    'flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors',
                    isRunning
                      ? 'bg-[var(--color-red-subtle)] text-[var(--color-red)] hover:bg-[var(--color-red)] hover:text-white'
                      : 'bg-[var(--color-green-subtle)] text-[var(--color-green)] hover:bg-[var(--color-green)] hover:text-white'
                  )}
                >
                  {toggling ? (
                    <Spinner className="size-3" />
                  ) : isRunning ? (
                    <Square className="size-3" />
                  ) : (
                    <Play className="size-3" />
                  )}
                  {isRunning ? 'Stop' : 'Start'}
                </button>
              )}

              {/* Restart button — only when tool is running */}
              {tool && isRunning && (
                <button
                  onClick={handleRestart}
                  disabled={restarting || toggling}
                  title="Restart tool"
                  className={cn(
                    'p-1 rounded transition-colors',
                    restarting
                      ? 'text-[var(--color-accent)] cursor-wait'
                      : 'text-[var(--color-text-muted)] hover:text-[var(--color-accent)] hover:bg-[var(--color-accent-subtle)]'
                  )}
                >
                  {restarting
                    ? <Repeat2 className="size-3.5 animate-spin" />
                    : <Repeat2 className="size-3.5" />
                  }
                </button>
              )}

              {/* Trash button — only when tool is loaded */}
              {tool && (
                <button
                  onClick={() => setDeleteState('confirm')}
                  title="Delete tool"
                  className="p-1 rounded text-[var(--color-text-muted)] hover:text-[var(--color-red)] hover:bg-[var(--color-red-subtle)] transition-colors"
                >
                  <Trash2 className="size-3.5" />
                </button>
              )}
            </>
          )}

          <button
            onClick={onClose}
            className="p-1 rounded text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-raised)] transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>

      {/* Action error banner (start/stop/restart failures) */}
      {actionError && (
        <div
          className="flex items-center gap-2 px-4 py-2 text-xs border-b"
          style={{
            backgroundColor: 'var(--color-red-subtle)',
            borderColor: 'var(--color-red)',
            color: 'var(--color-red)',
          }}
        >
          <AlertCircle className="size-3 shrink-0" />
          <span className="flex-1">{actionError}</span>
          <button
            onClick={() => setActionError(null)}
            className="shrink-0 opacity-70 hover:opacity-100"
          >
            <X className="size-3" />
          </button>
        </div>
      )}

      {/* Delete error banner */}
      {deleteError && (
        <div
          className="flex items-center gap-2 px-4 py-2 text-xs border-b"
          style={{
            backgroundColor: 'var(--color-red-subtle)',
            borderColor: 'var(--color-red)',
            color: 'var(--color-red)',
          }}
        >
          <AlertCircle className="size-3 shrink-0" />
          <span className="flex-1">{deleteError}</span>
          <button
            onClick={() => setDeleteError(null)}
            className="shrink-0 opacity-70 hover:opacity-100"
          >
            <X className="size-3" />
          </button>
        </div>
      )}

      {/* Tabs */}
      {tool && (
        <>
          <div className="flex border-b border-[var(--color-border)] shrink-0 overflow-x-auto">
            {(['overview', 'endpoints', 'docs', 'schedules', 'logs', 'timeline'] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  'px-3 py-2 text-xs capitalize transition-colors whitespace-nowrap',
                  tab === t
                    ? 'text-[var(--color-accent)] border-b-2 border-[var(--color-accent)]'
                    : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                )}
              >
                {t === 'overview' && <Activity className="size-3 inline mr-1" />}
                {t === 'endpoints' && <Zap className="size-3 inline mr-1" />}
                {t === 'docs' && <FileText className="size-3 inline mr-1" />}
                {t === 'schedules' && <Calendar className="size-3 inline mr-1" />}
                {t === 'logs' && <ScrollText className="size-3 inline mr-1" />}
                {t === 'timeline' && <History className="size-3 inline mr-1" />}
                {t}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {tab === 'overview' && (
              <OverviewTab tool={tool} health={health} history={healthHistory} />
            )}
            {tab === 'endpoints' && <EndpointsTab tool={tool} />}
            {tab === 'docs' && <DocsTab toolId={toolId} tool={tool} />}
            {tab === 'schedules' && <SchedulesTab toolId={toolId} toolName={tool.name} />}
            {tab === 'logs' && <LogsTab toolName={tool.name} />}
            {tab === 'timeline' && <TimelineTab history={healthHistory} />}
          </div>
        </>
      )}
    </div>
  )
}

function OverviewTab({
  tool,
  health,
  history,
}: {
  tool: IToolDetail
  health: ProjectHealthStatus | null
  history: Array<{ status: ProjectHealthStatus['status']; ts: number }>
}) {
  const [note, setNote] = useState(() => loadNote(tool.id))
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')

  const last = history.length > 0 ? history[history.length - 1] : null
  const ageSec = last ? Math.round((Date.now() - last.ts) / 1000) : null

  const STATUS_DOT: Record<ProjectHealthStatus['status'], string> = {
    healthy: 'bg-[var(--color-green)]',
    unhealthy: 'bg-[var(--color-red)]',
    unreachable: 'bg-[var(--color-yellow)]',
    error: 'bg-[var(--color-red)]',
    unknown: 'bg-[var(--color-text-muted)]',
  }

  return (
    <div className="space-y-4">
      <Section title="Details">
        <Row label="Kind" value={tool.kind} />
        <Row label="Status" value={tool.status} />
        <Row label="Health" value={health?.status ?? 'unknown'} />
        {tool.run_cmd && <Row label="Command" value={tool.run_cmd} mono />}
        {tool.depends_on.length > 0 && (
          <Row label="Depends on" value={tool.depends_on.join(', ')} />
        )}
      </Section>

      <Section title="Health history">
        {history.length === 0 ? (
          <p className="text-xs text-[var(--color-text-muted)]">No health samples yet.</p>
        ) : (
          <div className="flex items-center gap-1 flex-wrap">
            {history.map((h, i) => (
              <span
                key={i}
                className={cn('inline-block size-1.5 rounded-full', STATUS_DOT[h.status])}
                title={`${h.status} · ${new Date(h.ts).toLocaleTimeString()}`}
              />
            ))}
            {ageSec != null && (
              <span className="text-[10px] text-[var(--color-text-muted)] ml-2">
                updated {ageSec}s ago
              </span>
            )}
          </div>
        )}
      </Section>

      {tool.triggers && tool.triggers.length > 0 && (
        <Section title="Loom Triggers">
          <div className="flex flex-wrap gap-1.5">
            {tool.triggers.map((t) => (
              <span
                key={t}
                className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--color-accent-subtle)] text-[var(--color-accent)]"
              >
                {t}
              </span>
            ))}
          </div>
        </Section>
      )}

      {tool.tags.length > 0 && (
        <Section title="Tags">
          <div className="flex flex-wrap gap-1.5">
            {tool.tags.map((t) => (
              <span
                key={t}
                className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--color-surface-raised)] text-[var(--color-text-muted)]"
              >
                {t}
              </span>
            ))}
          </div>
        </Section>
      )}

      <Section title="Notes">
        {editing ? (
          <div className="space-y-2">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={3}
              placeholder="Add notes, TODOs, or context for this tool..."
              className="w-full text-xs font-sans rounded px-2 py-1.5 resize-none outline-none"
              style={{
                backgroundColor: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text-primary)',
              }}
              autoFocus
            />
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  saveNote(tool.id, draft)
                  setNote(draft.trim())
                  setEditing(false)
                }}
                className="px-2 py-0.5 rounded text-[10px] font-medium"
                style={{ backgroundColor: 'var(--color-accent)', color: '#fff' }}
              >
                Save
              </button>
              <button
                onClick={() => { setEditing(false); setDraft('') }}
                className="px-2 py-0.5 rounded text-[10px] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-2">
            {note ? (
              <>
                <StickyNote className="size-3.5 text-[var(--color-yellow)] shrink-0 mt-0.5" />
                <p className="text-xs text-[var(--color-text-secondary)] whitespace-pre-wrap flex-1 min-w-0">
                  {note}
                </p>
              </>
            ) : (
              <p className="text-xs text-[var(--color-text-muted)] italic flex-1">
                No notes yet. Click edit to add one.
              </p>
            )}
            <button
              onClick={() => { setDraft(note); setEditing(true) }}
              title="Edit note"
              className="p-0.5 rounded text-[var(--color-text-muted)] hover:text-[var(--color-accent)] hover:bg-[var(--color-accent-subtle)] transition-colors shrink-0"
            >
              <Pencil className="size-3" />
            </button>
          </div>
        )}
      </Section>
    </div>
  )
}

function formatAgo(ts: number): string {
  const secs = Math.max(0, Math.round((Date.now() - ts) / 1000))
  if (secs < 60) return `${secs}s ago`
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`
  return `${Math.floor(secs / 86400)}d ago`
}

function TimelineTab({ history }: { history: Array<{ status: ProjectHealthStatus['status']; ts: number }> }) {
  if (history.length === 0) {
    return <p className="text-xs text-[var(--color-text-muted)]">No timeline entries yet.</p>
  }

  // Only show transitions (status changes)
  const transitions = history.reduce<Array<{ status: ProjectHealthStatus['status']; ts: number }>>(
    (acc, item) => {
      if (acc.length === 0 || acc[acc.length - 1].status !== item.status) {
        acc.push(item)
      }
      return acc
    },
    []
  )

  const STATUS_DOT: Record<ProjectHealthStatus['status'], string> = {
    healthy: 'bg-[var(--color-green)]',
    unhealthy: 'bg-[var(--color-red)]',
    unreachable: 'bg-[var(--color-yellow)]',
    error: 'bg-[var(--color-red)]',
    unknown: 'bg-[var(--color-text-muted)]',
  }

  const entries = [...transitions].reverse()

  return (
    <div className="space-y-2">
      {entries.map((h, i) => (
        <div key={`${h.ts}-${i}`} className="flex items-center gap-2 text-xs">
          <span className={cn('inline-block size-2 rounded-full', STATUS_DOT[h.status])} />
          <span className="text-[var(--color-text-primary)] font-medium capitalize">
            {h.status}
          </span>
          <span className="text-[var(--color-text-muted)] ml-auto">
            {new Date(h.ts).toLocaleTimeString()} · {formatAgo(h.ts)}
          </span>
        </div>
      ))}
    </div>
  )
}

// ─── Endpoint color maps ──────────────────────────────────────────────────────

const RISK_COLOR: Record<string, string> = {
  low:    'text-[var(--color-green)]',
  medium: 'text-[var(--color-yellow)]',
  high:   'text-[var(--color-red)]',
}

const METHOD_COLOR: Record<string, string> = {
  GET:    'text-[var(--color-green)]',
  POST:   'text-[var(--color-accent)]',
  PUT:    'text-[var(--color-yellow)]',
  PATCH:  'text-[var(--color-yellow)]',
  DELETE: 'text-[var(--color-red)]',
}

const METHOD_BG: Record<string, string> = {
  GET:    'bg-[var(--color-green-subtle)]',
  POST:   'bg-[var(--color-accent-subtle)]',
  PUT:    'bg-[var(--color-yellow-subtle)]',
  PATCH:  'bg-[var(--color-yellow-subtle)]',
  DELETE: 'bg-[var(--color-red-subtle)]',
}

// ─── Test response types ──────────────────────────────────────────────────────

interface TestResponse {
  status: number
  statusText: string
  headers: Record<string, string>
  body: string
  timeMs: number
  isJson: boolean
}

// ─── EndpointsTab ─────────────────────────────────────────────────────────────

function EndpointsTab({ tool }: { tool: IToolDetail }) {
  const endpoints = [...(tool.endpoints ?? []), ...(tool.discovered_endpoints ?? [])]
  const baseUrl = tool.base_url ?? tool.upstream_url ?? ''

  // Pin state — mirrors localStorage, refreshes when user toggles
  const [pinnedKeys, setPinnedKeys] = useState<Set<string>>(() => new Set(
    endpoints
      .filter((ep) => isPinned(tool.id, ep.method, ep.path))
      .map((ep) => pinKey(tool.id, ep.method, ep.path))
  ))

  function handleTogglePin(ep: EndpointEntry) {
    const nowPinned = togglePin({
      toolId: tool.id,
      toolName: tool.name,
      method: ep.method,
      path: ep.path,
      baseUrl,
      description: ep.description,
    })
    const key = pinKey(tool.id, ep.method, ep.path)
    setPinnedKeys((prev) => {
      const next = new Set(prev)
      if (nowPinned) next.add(key)
      else next.delete(key)
      return next
    })
  }

  if (endpoints.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-8 text-center">
        <Zap className="size-5 text-[var(--color-text-muted)] opacity-30" />
        <p className="text-xs text-[var(--color-text-muted)]">No endpoints discovered.</p>
      </div>
    )
  }

  const pinned = endpoints.filter((ep) => pinnedKeys.has(pinKey(tool.id, ep.method, ep.path)))
  const unpinned = endpoints.filter((ep) => !pinnedKeys.has(pinKey(tool.id, ep.method, ep.path)))

  const [activeKey, setActiveKey] = useState<string | null>(null)
  const makeKey = (ep: EndpointEntry, idx: number) => `${ep.method}::${ep.path}::${idx}`

  return (
    <div className="space-y-3">
      {/* Pinned section */}
      {pinned.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
            <Star className="size-2.5 fill-[var(--color-yellow)] text-[var(--color-yellow)]" />
            Pinned ({pinned.length})
          </div>
          {pinned.map((ep, i) => {
            const k = `pinned-${makeKey(ep, i)}`
            return (
              <EndpointRow
                key={k}
                ep={ep}
                baseUrl={baseUrl}
                pinned
                onTogglePin={() => handleTogglePin(ep)}
                isOpen={activeKey === k}
                onToggle={() => setActiveKey((prev) => (prev === k ? null : k))}
              />
            )
          })}
          <div
            className="border-b mt-1"
            style={{ borderColor: 'var(--color-border-subtle)' }}
          />
        </div>
      )}

      {/* All endpoints */}
      {unpinned.map((ep, i) => {
        const k = `all-${makeKey(ep, i)}`
        return (
          <EndpointRow
            key={k}
            ep={ep}
            baseUrl={baseUrl}
            pinned={false}
            onTogglePin={() => handleTogglePin(ep)}
            isOpen={activeKey === k}
            onToggle={() => setActiveKey((prev) => (prev === k ? null : k))}
          />
        )
      })}
    </div>
  )
}

// ─── EndpointRow with inline tester ──────────────────────────────────────────

function EndpointRow({
  ep,
  baseUrl,
  isOpen,
  onToggle,
  pinned = false,
  onTogglePin,
}: {
  ep: EndpointEntry
  baseUrl: string
  isOpen: boolean
  onToggle: () => void
  pinned?: boolean
  onTogglePin?: () => void
}) {
  // Form state (editable copies of the endpoint)
  const [method, setMethod] = useState(ep.method)
  const [path, setPath] = useState(ep.path)
  const [query, setQuery] = useState('')
  const [body, setBody] = useState('')
  const [headers, setHeaders] = useState('')

  // Response state
  const [loading, setLoading] = useState(false)
  const [response, setResponse] = useState<TestResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Response UI state
  const [showHeaders, setShowHeaders] = useState(false)
  const [copied, setCopied] = useState(false)

  const hasBody = ['POST', 'PUT', 'PATCH'].includes(method)

  // Reset form when endpoint changes (path/method from parent)
  useEffect(() => {
    setMethod(ep.method)
    setPath(ep.path)
    setQuery('')
    setBody('')
    setHeaders('')
    setResponse(null)
    setError(null)
  }, [ep.method, ep.path])

  async function handleSend() {
    if (!baseUrl) {
      setError('No base URL available for this tool')
      return
    }
    setLoading(true)
    setResponse(null)
    setError(null)

    const url = `${baseUrl}${path}${query ? `?${query}` : ''}`
    const start = performance.now()

    try {
      const reqHeaders: Record<string, string> = { 'Content-Type': 'application/json' }
      // Parse additional headers (key: value, one per line)
      for (const line of headers.split('\n')) {
        const [k, ...v] = line.split(':')
        if (k?.trim() && v.length) reqHeaders[k.trim()] = v.join(':').trim()
      }

      const res = await fetch(url, {
        method,
        headers: reqHeaders,
        body: hasBody && body.trim() ? body.trim() : undefined,
      })

      const timeMs = Math.round(performance.now() - start)
      const text = await res.text()
      const isJson = res.headers.get('content-type')?.includes('application/json') ?? false

      const respHeaders: Record<string, string> = {}
      res.headers.forEach((v, k) => { respHeaders[k] = v })

      // Try to pretty-print JSON
      let displayBody = text
      if (isJson) {
        try { displayBody = JSON.stringify(JSON.parse(text), null, 2) } catch { /* keep raw */ }
      }

      setResponse({
        status: res.status,
        statusText: res.statusText || String(res.status),
        headers: respHeaders,
        body: displayBody,
        timeMs,
        isJson,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed')
    } finally {
      setLoading(false)
    }
  }

  async function handleCopy() {
    if (!response) return
    await navigator.clipboard.writeText(response.body)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const statusColor =
    !response ? ''
    : response.status < 300 ? 'text-[var(--color-green)]'
    : response.status < 400 ? 'text-[var(--color-yellow)]'
    : 'text-[var(--color-red)]'

  const statusBg =
    !response ? ''
    : response.status < 300 ? 'bg-[var(--color-green-subtle)]'
    : response.status < 400 ? 'bg-[var(--color-yellow-subtle)]'
    : 'bg-[var(--color-red-subtle)]'

  const formInputStyle: React.CSSProperties = {
    backgroundColor: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: '4px',
    color: 'var(--color-text-primary)',
    fontSize: '11px',
    padding: '3px 6px',
    outline: 'none',
  }

  return (
    <div
      className={cn(
        'rounded border transition-colors',
        isOpen
          ? 'border-[var(--color-accent)] bg-[var(--color-surface-raised)]'
          : 'border-[var(--color-border-subtle)] bg-[var(--color-surface-raised)] hover:border-[var(--color-border)]'
      )}
    >
      {/* Header row */}
      <div
        className="flex items-center gap-2 px-3 py-2 cursor-pointer select-none"
        onClick={onToggle}
      >
        {/* Method badge */}
        <span
          className={cn(
            'text-[10px] font-mono font-bold w-12 shrink-0 px-1 py-0.5 rounded text-center',
            METHOD_COLOR[ep.method] ?? 'text-[var(--color-text-secondary)]',
            METHOD_BG[ep.method] ?? ''
          )}
        >
          {ep.method}
        </span>

        {/* Path */}
        <span className="text-xs font-mono text-[var(--color-text-primary)] flex-1 truncate">
          {ep.path}
        </span>

        {/* Risk */}
        {ep.risk && (
          <span className={cn('text-[9px] shrink-0', RISK_COLOR[ep.risk] ?? '')}>
            {ep.risk}
          </span>
        )}

        {/* Test button */}
        <button
          onClick={(e) => { e.stopPropagation(); onToggle() }}
          className={cn(
            'shrink-0 flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-medium transition-colors',
            isOpen
              ? 'bg-[var(--color-accent)] text-white'
              : 'text-[var(--color-accent)] hover:bg-[var(--color-accent-subtle)]'
          )}
        >
          <FlaskConical className="size-2.5" />
          Test
        </button>

        {/* Pin (star) button */}
        {onTogglePin && (
          <button
            onClick={(e) => { e.stopPropagation(); onTogglePin() }}
            title={pinned ? 'Unpin endpoint' : 'Pin endpoint'}
            className="shrink-0 p-0.5 rounded transition-colors hover:bg-[var(--color-surface-raised)]"
          >
            <Star
              className={cn(
                'size-3 transition-colors',
                pinned
                  ? 'fill-[var(--color-yellow)] text-[var(--color-yellow)]'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-yellow)]'
              )}
            />
          </button>
        )}
      </div>

      {/* Description */}
      {ep.description && (
        <p className="text-[10px] text-[var(--color-text-secondary)] px-3 pb-1.5 ml-14">
          {ep.description}
        </p>
      )}

      {/* Inline test form */}
      {isOpen && (
        <div
          className="border-t px-3 py-3 space-y-2.5"
          style={{ borderColor: 'var(--color-border-subtle)' }}
        >
          {/* No base URL warning */}
          {!baseUrl && (
            <div className="flex items-center gap-1.5 text-[10px] text-[var(--color-yellow)]">
              <AlertCircle className="size-3 shrink-0" />
              Tool has no base URL — cannot fire requests
            </div>
          )}

          {/* Method + Path */}
          <div className="flex items-center gap-1.5">
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              style={{ ...formInputStyle, width: '68px', appearance: 'none', cursor: 'pointer' }}
            >
              {['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD'].map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
            <input
              value={path}
              onChange={(e) => setPath(e.target.value)}
              style={{ ...formInputStyle, flex: 1, fontFamily: 'monospace' }}
              placeholder="/path"
            />
          </div>

          {/* Query string */}
          <div className="space-y-0.5">
            <label className="text-[9px] text-[var(--color-text-muted)] uppercase tracking-wider">
              Query params
            </label>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              style={{ ...formInputStyle, width: '100%', fontFamily: 'monospace' }}
              placeholder="key=value&other=123"
            />
          </div>

          {/* Body (POST/PUT/PATCH only) */}
          {hasBody && (
            <div className="space-y-0.5">
              <label className="text-[9px] text-[var(--color-text-muted)] uppercase tracking-wider">
                Body (JSON)
              </label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={3}
                style={{ ...formInputStyle, width: '100%', resize: 'vertical', fontFamily: 'monospace' }}
                placeholder='{"key": "value"}'
              />
            </div>
          )}

          {/* Custom headers (collapsed by default) */}
          <details className="text-[10px]">
            <summary
              className="cursor-pointer text-[var(--color-text-muted)] select-none"
              style={{ listStyle: 'none' }}
            >
              + Custom headers
            </summary>
            <textarea
              value={headers}
              onChange={(e) => setHeaders(e.target.value)}
              rows={2}
              style={{ ...formInputStyle, width: '100%', resize: 'vertical', fontFamily: 'monospace', marginTop: '4px' }}
              placeholder={'Authorization: Bearer token\nX-Custom: value'}
            />
          </details>

          {/* Send button */}
          <button
            onClick={handleSend}
            disabled={loading || !baseUrl}
            className="flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium transition-opacity disabled:opacity-40"
            style={{ backgroundColor: 'var(--color-accent)', color: '#fff' }}
          >
            {loading ? (
              <Spinner className="size-3" />
            ) : (
              <Play className="size-3" />
            )}
            {loading ? 'Sending…' : 'Send'}
          </button>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-1.5 text-[10px] text-[var(--color-red)]">
              <AlertCircle className="size-3 shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          {/* Response */}
          {response && (
            <div
              className="rounded border overflow-hidden"
              style={{ borderColor: 'var(--color-border-subtle)' }}
            >
              {/* Response status bar */}
              <div
                className={cn('flex items-center gap-2 px-3 py-1.5', statusBg)}
                style={{ borderBottom: '1px solid var(--color-border-subtle)' }}
              >
                <span className={cn('text-xs font-bold font-mono', statusColor)}>
                  {response.status}
                </span>
                <span className="text-[10px] text-[var(--color-text-secondary)]">
                  {response.statusText}
                </span>
                <span className="text-[9px] text-[var(--color-text-muted)] ml-auto">
                  {response.timeMs}ms
                </span>

                {/* Toggle headers */}
                <button
                  onClick={() => setShowHeaders((v) => !v)}
                  className="text-[9px] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors"
                >
                  headers {showHeaders ? '▲' : '▼'}
                </button>

                {/* Copy button */}
                <button
                  onClick={handleCopy}
                  title="Copy response body"
                  className="text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors"
                >
                  {copied
                    ? <ClipboardCheck className="size-3 text-[var(--color-green)]" />
                    : <Clipboard className="size-3" />
                  }
                </button>
              </div>

              {/* Headers panel */}
              {showHeaders && (
                <div
                  className="px-3 py-2 space-y-0.5 text-[9px] font-mono"
                  style={{
                    backgroundColor: 'var(--color-surface)',
                    borderBottom: '1px solid var(--color-border-subtle)',
                  }}
                >
                  {Object.entries(response.headers).map(([k, v]) => (
                    <div key={k} className="flex gap-2 min-w-0">
                      <span className="text-[var(--color-text-muted)] shrink-0">{k}:</span>
                      <span className="text-[var(--color-text-secondary)] truncate">{v}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Response body */}
              <pre
                className="text-[10px] font-mono p-2 overflow-x-auto whitespace-pre-wrap break-all text-[var(--color-text-secondary)]"
                style={{
                  backgroundColor: 'var(--color-surface)',
                  maxHeight: '240px',
                  overflowY: 'auto',
                }}
              >
                {response.body || <span className="text-[var(--color-text-muted)] italic">(empty body)</span>}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function DocsTab({ toolId, tool }: { toolId: string; tool: IToolDetail }) {
  const [docs, setDocs] = useState<DocFile[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedPath, setSelectedPath] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    getToolDocs(toolId)
      .then((data) => {
        setDocs(data)
        // Auto-select first doc that has content
        const first = data.find((d) => d.content)
        if (first) setSelectedPath(first.path)
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load docs'))
      .finally(() => setLoading(false))
  }, [toolId])

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-4 text-xs text-[var(--color-text-muted)]">
        <Spinner className="size-3" />
        Loading documentation...
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 text-xs text-[var(--color-red)]">
        <AlertCircle className="size-3.5 shrink-0" />
        {error}
      </div>
    )
  }

  // Fall back to the static doc list from the tool manifest if API returned nothing
  const apiDocs = docs ?? []
  const staticDocs = [...(tool.docs ?? []), ...(tool.docs_available ?? [])]
  const hasContent = apiDocs.some((d) => d.content)

  if (!hasContent && apiDocs.length === 0 && staticDocs.length === 0) {
    return (
      <p className="text-xs text-[var(--color-text-muted)]">No documentation files found.</p>
    )
  }

  // If no content could be loaded (docs exist but content is null), show file list
  if (!hasContent) {
    return (
      <div className="space-y-1">
        <p className="text-[10px] text-[var(--color-text-muted)] mb-2">
          {apiDocs.length > 0
            ? 'Documentation files found but content unavailable.'
            : 'Documentation files registered:'}
        </p>
        {(apiDocs.length > 0 ? apiDocs : staticDocs).map((doc, i) => (
          <div
            key={i}
            className="flex items-center gap-2 py-1.5 px-2 rounded bg-[var(--color-surface-raised)]"
          >
            <FileText className="size-3 text-[var(--color-text-muted)] shrink-0" />
            <span className="text-[10px] font-mono text-[var(--color-text-secondary)] flex-1 truncate">
              {'path' in doc ? doc.path : ''}
            </span>
            {('error' in doc) && doc.error && (
              <span className="text-[10px] text-[var(--color-red)] shrink-0">error</span>
            )}
          </div>
        ))}
      </div>
    )
  }

  const selectedDoc = apiDocs.find((d) => d.path === selectedPath)

  return (
    <div className="flex flex-col gap-3 min-h-0">
      {/* File selector — only show if multiple files */}
      {apiDocs.length > 1 && (
        <div className="flex flex-wrap gap-1">
          {apiDocs.map((doc) => (
            <button
              key={doc.path}
              onClick={() => setSelectedPath(doc.path)}
              title={doc.path}
              className={cn(
                'flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono transition-colors truncate max-w-[140px]',
                selectedPath === doc.path
                  ? 'bg-[var(--color-accent-subtle)] text-[var(--color-accent)]'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-raised)]',
                !doc.content && 'opacity-40 cursor-not-allowed'
              )}
              disabled={!doc.content}
            >
              <FileText className="size-2.5 shrink-0" />
              {doc.path.split('/').pop()}
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      {selectedDoc?.content ? (
        <MarkdownView content={selectedDoc.content} />
      ) : selectedDoc?.error ? (
        <p className="text-xs text-[var(--color-red)]">{selectedDoc.error}</p>
      ) : (
        <p className="text-xs text-[var(--color-text-muted)]">Select a file above to view its content.</p>
      )}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-2">
        {title}
      </h4>
      <div className="space-y-1">{children}</div>
    </div>
  )
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start gap-2 text-xs">
      <span className="text-[var(--color-text-muted)] w-24 shrink-0">{label}</span>
      <span className={cn('text-[var(--color-text-primary)] break-all', mono && 'font-mono text-[10px]')}>
        {value}
      </span>
    </div>
  )
}

// ─── Schedules Tab ────────────────────────────────────────────────────────────

const SCHED_ACTION_ICON: Record<string, React.ReactNode> = {
  agent:  <MessageSquare className="size-2.5" />,
  http:   <Globe className="size-2.5" />,
  shell:  <Terminal className="size-2.5" />,
  prompt: <Zap className="size-2.5" />,
  trace:  <Layers className="size-2.5" />,
}

const SCHED_ACTION_COLOR: Record<string, string> = {
  agent:  'text-[var(--color-accent)] bg-[var(--color-accent-subtle)]',
  http:   'text-[var(--color-green)] bg-[var(--color-green-subtle)]',
  shell:  'text-[var(--color-yellow)] bg-[var(--color-yellow-subtle)]',
  prompt: 'text-[var(--color-accent)] bg-[var(--color-accent-subtle)]',
  trace:  'text-[var(--color-text-secondary)] bg-[var(--color-surface-raised)]',
}

function isRelevantSchedule(s: ScheduledTask, toolId: string, toolName: string): boolean {
  const sid = s.id.toLowerCase()
  const tid = toolId.toLowerCase()
  const tname = toolName.toLowerCase().replace(/\s+/g, '-')
  return (
    sid.startsWith(tid) ||
    sid.includes(tid) ||
    (tname !== tid && sid.includes(tname)) ||
    (s.url != null && s.url.includes(toolId)) ||
    (s.message != null && s.message.toLowerCase().includes(toolId)) ||
    (s.command != null && s.command.toLowerCase().includes(toolId))
  )
}

function relativeTime(iso: string | null | undefined): string {
  if (!iso) return 'never'
  const secs = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000))
  if (secs < 60) return `${secs}s ago`
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`
  return `${Math.floor(secs / 86400)}d ago`
}

// ─── Add Schedule form default state ─────────────────────────────────────────

function defaultForm(toolId: string): CreateScheduleInput {
  return {
    id: `${toolId}-schedule`,
    schedule: 'every 5 minutes',
    action: 'agent',
    message: '',
    timezone: '',
    enabled: true,
  }
}

function SchedulesTab({ toolId, toolName }: { toolId: string; toolName: string }) {
  const [schedules, setSchedules] = useState<ScheduledTask[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toggling, setToggling] = useState<Set<string>>(new Set())
  const [deleting, setDeleting] = useState<Set<string>>(new Set())
  const [showAll, setShowAll] = useState(false)

  // Add schedule form
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<CreateScheduleInput>(() => defaultForm(toolId))
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [lastCreated, setLastCreated] = useState<string | null>(null)

  const loadSchedules = () => {
    setError(null)
    listSchedules()
      .then(setSchedules)
      .catch((e) => setError(e instanceof Error ? e.message : 'Loom unreachable'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    setLoading(true)
    setForm(defaultForm(toolId))
    loadSchedules()
  }, [toolId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Update form ID when action changes to keep the suffix sensible
  function setAction(action: CreateScheduleInput['action']) {
    setForm((prev) => ({
      ...prev,
      action,
      // Reset content fields
      message: '',
      url: '',
      command: '',
      prompt: '',
      id: prev.id.replace(/-(?:agent|http|shell|prompt)$/, '') + `-${action}`,
    }))
  }

  async function handleToggle(id: string, currentEnabled: boolean) {
    setToggling((prev) => new Set(prev).add(id))
    try {
      await toggleSchedule(id, !currentEnabled)
      setSchedules((prev) =>
        prev.map((s) => (s.id === id ? { ...s, enabled: !currentEnabled } : s))
      )
    } catch (e) {
      console.error('Toggle failed:', e)
    } finally {
      setToggling((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }
  }

  async function handleDelete(id: string) {
    setDeleting((prev) => new Set(prev).add(id))
    try {
      await deleteSchedule(id)
      setSchedules((prev) => prev.filter((s) => s.id !== id))
    } catch (e) {
      console.error('Delete failed:', e)
    } finally {
      setDeleting((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setFormError(null)
    try {
      const result = await createSchedule(form)
      setLastCreated(result.id)
      setShowForm(false)
      setForm(defaultForm(toolId))
      loadSchedules()
      // Clear success flash after 3s
      setTimeout(() => setLastCreated(null), 3000)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to create schedule')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-4 text-xs text-[var(--color-text-muted)]">
        <Spinner className="size-3" />
        Loading schedules…
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 text-xs text-[var(--color-red)]">
        <AlertCircle className="size-3.5 shrink-0" />
        {error}
      </div>
    )
  }

  const relevant = schedules.filter((s) => isRelevantSchedule(s, toolId, toolName))
  const others = schedules.filter((s) => !isRelevantSchedule(s, toolId, toolName))

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '5px 8px',
    fontSize: '11px',
    backgroundColor: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: '5px',
    color: 'var(--color-text-primary)',
    outline: 'none',
    boxSizing: 'border-box',
  }

  return (
    <div className="space-y-4">
      {/* Success flash */}
      {lastCreated && (
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs"
          style={{ backgroundColor: 'var(--color-green-subtle)', color: 'var(--color-green)' }}
        >
          <Check className="size-3 shrink-0" />
          Schedule "{lastCreated}" created — takes effect after Loom restart
        </div>
      )}

      {/* Relevant schedules */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
            For {toolName}
          </h4>
          <button
            onClick={() => { setShowForm((v) => !v); setFormError(null) }}
            title="Add schedule"
            className={cn(
              'flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium transition-colors',
              showForm
                ? 'bg-[var(--color-accent)] text-white'
                : 'text-[var(--color-accent)] hover:bg-[var(--color-accent-subtle)]'
            )}
          >
            <Plus className="size-2.5" />
            {showForm ? 'Cancel' : 'Add'}
          </button>
        </div>

        {/* Inline "Add Schedule" form */}
        {showForm && (
          <form
            onSubmit={handleCreate}
            className="mb-3 rounded-lg border p-3 space-y-2.5"
            style={{
              backgroundColor: 'var(--color-surface-raised)',
              borderColor: 'var(--color-accent)',
              borderStyle: 'dashed',
            }}
          >
            <p className="text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
              New Schedule
            </p>

            {/* ID */}
            <div className="space-y-1">
              <label className="text-[10px] text-[var(--color-text-muted)]">ID</label>
              <input
                value={form.id}
                onChange={(e) => setForm((p) => ({ ...p, id: e.target.value }))}
                placeholder="my-tool-schedule"
                style={inputStyle}
                required
              />
            </div>

            {/* Action selector */}
            <div className="space-y-1">
              <label className="text-[10px] text-[var(--color-text-muted)]">Action</label>
              <div className="flex gap-1 flex-wrap">
                {(['agent', 'http', 'shell', 'prompt'] as const).map((a) => (
                  <button
                    key={a}
                    type="button"
                    onClick={() => setAction(a)}
                    className={cn(
                      'px-2 py-0.5 rounded text-[10px] font-medium transition-colors border',
                      form.action === a
                        ? 'border-[var(--color-accent)] text-[var(--color-accent)] bg-[var(--color-accent-subtle)]'
                        : 'border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-text-muted)]'
                    )}
                  >
                    {a}
                  </button>
                ))}
              </div>
            </div>

            {/* Schedule expression */}
            <div className="space-y-1">
              <label className="text-[10px] text-[var(--color-text-muted)]">
                Schedule
                <span className="ml-1 opacity-60 normal-case">
                  (e.g. every 5 minutes, daily at 9:00, cron 0 * * * *)
                </span>
              </label>
              <input
                value={form.schedule}
                onChange={(e) => setForm((p) => ({ ...p, schedule: e.target.value }))}
                placeholder="every 5 minutes"
                style={inputStyle}
                required
              />
            </div>

            {/* Content field — depends on action */}
            {form.action === 'agent' && (
              <div className="space-y-1">
                <label className="text-[10px] text-[var(--color-text-muted)]">Message</label>
                <textarea
                  value={form.message ?? ''}
                  onChange={(e) => setForm((p) => ({ ...p, message: e.target.value }))}
                  placeholder="What should Loom do on each run?"
                  rows={2}
                  style={{ ...inputStyle, resize: 'vertical' }}
                  required
                />
              </div>
            )}
            {form.action === 'prompt' && (
              <div className="space-y-1">
                <label className="text-[10px] text-[var(--color-text-muted)]">Prompt</label>
                <textarea
                  value={form.prompt ?? ''}
                  onChange={(e) => setForm((p) => ({ ...p, prompt: e.target.value }))}
                  placeholder="Prompt to run each schedule tick"
                  rows={2}
                  style={{ ...inputStyle, resize: 'vertical' }}
                  required
                />
              </div>
            )}
            {form.action === 'http' && (
              <div className="space-y-1.5">
                <div className="flex gap-1.5">
                  <div className="space-y-1 w-16 shrink-0">
                    <label className="text-[10px] text-[var(--color-text-muted)]">Method</label>
                    <select
                      value={form.method ?? 'GET'}
                      onChange={(e) => setForm((p) => ({ ...p, method: e.target.value }))}
                      style={{ ...inputStyle, appearance: 'none' }}
                    >
                      <option>GET</option>
                      <option>POST</option>
                    </select>
                  </div>
                  <div className="space-y-1 flex-1">
                    <label className="text-[10px] text-[var(--color-text-muted)]">URL</label>
                    <input
                      value={form.url ?? ''}
                      onChange={(e) => setForm((p) => ({ ...p, url: e.target.value }))}
                      placeholder="https://..."
                      style={inputStyle}
                      required
                      type="url"
                    />
                  </div>
                </div>
              </div>
            )}
            {form.action === 'shell' && (
              <div className="space-y-1">
                <label className="text-[10px] text-[var(--color-text-muted)]">Command</label>
                <input
                  value={form.command ?? ''}
                  onChange={(e) => setForm((p) => ({ ...p, command: e.target.value }))}
                  placeholder="curl -s http://..."
                  style={{ ...inputStyle, fontFamily: 'monospace' }}
                  required
                />
              </div>
            )}

            {/* Timezone */}
            <div className="space-y-1">
              <label className="text-[10px] text-[var(--color-text-muted)]">
                Timezone <span className="opacity-60">(optional)</span>
              </label>
              <input
                value={form.timezone ?? ''}
                onChange={(e) => setForm((p) => ({ ...p, timezone: e.target.value }))}
                placeholder="America/Chicago"
                style={inputStyle}
              />
            </div>

            {/* Enabled toggle */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setForm((p) => ({ ...p, enabled: !p.enabled }))}
                className={cn(
                  'relative inline-flex h-4 w-7 items-center rounded-full transition-colors',
                  form.enabled ? 'bg-[var(--color-green)]' : 'bg-[var(--color-border)]'
                )}
              >
                <span
                  className={cn(
                    'inline-block size-3 rounded-full bg-white transition-transform',
                    form.enabled ? 'translate-x-3.5' : 'translate-x-0.5'
                  )}
                />
              </button>
              <span className="text-[10px] text-[var(--color-text-muted)]">
                {form.enabled ? 'Enabled' : 'Disabled'}
              </span>
            </div>

            {/* Form error */}
            {formError && (
              <p className="text-[10px] text-[var(--color-red)]">{formError}</p>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={submitting}
              className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded text-xs font-medium transition-opacity disabled:opacity-50"
              style={{ backgroundColor: 'var(--color-accent)', color: '#fff' }}
            >
              {submitting ? (
                <>
                  <Spinner className="size-3" />
                  Creating…
                </>
              ) : (
                <>
                  <Plus className="size-3" />
                  Create Schedule
                </>
              )}
            </button>
          </form>
        )}

        {/* Matched schedule list */}
        {relevant.length === 0 && !showForm ? (
          <p className="text-xs text-[var(--color-text-muted)]">
            No schedules matched to this tool.
          </p>
        ) : (
          <div className="space-y-2">
            {relevant.map((s) => (
              <ScheduleRow
                key={s.id}
                schedule={s}
                toggling={toggling.has(s.id)}
                deleting={deleting.has(s.id)}
                onToggle={() => handleToggle(s.id, s.enabled)}
                onDelete={() => handleDelete(s.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* All schedules — collapsible */}
      {schedules.length > 0 && (
        <div>
          <button
            onClick={() => setShowAll((v) => !v)}
            className="flex items-center gap-1.5 text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-2 hover:text-[var(--color-text-secondary)] transition-colors"
          >
            {showAll ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
            All Schedules ({schedules.length})
          </button>

          {showAll && (
            <div className="space-y-2">
              {others.map((s) => (
                <ScheduleRow
                  key={s.id}
                  schedule={s}
                  toggling={toggling.has(s.id)}
                  deleting={deleting.has(s.id)}
                  onToggle={() => handleToggle(s.id, s.enabled)}
                  onDelete={() => handleDelete(s.id)}
                  dim
                />
              ))}
              {relevant.map((s) => (
                <ScheduleRow
                  key={`all-${s.id}`}
                  schedule={s}
                  toggling={toggling.has(s.id)}
                  deleting={deleting.has(s.id)}
                  onToggle={() => handleToggle(s.id, s.enabled)}
                  onDelete={() => handleDelete(s.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ScheduleRow({
  schedule,
  toggling,
  deleting,
  onToggle,
  onDelete,
  dim = false,
}: {
  schedule: ScheduledTask
  toggling: boolean
  deleting?: boolean
  onToggle: () => void
  onDelete?: () => void
  dim?: boolean
}) {
  const [confirmDelete, setConfirmDelete] = useState(false)

  const label =
    schedule.message?.slice(0, 50) ||
    schedule.prompt?.slice(0, 50) ||
    schedule.url?.replace(/^https?:\/\//, '').slice(0, 50) ||
    schedule.command?.slice(0, 50) ||
    schedule.id

  const actionColor = SCHED_ACTION_COLOR[schedule.action] ?? SCHED_ACTION_COLOR.trace
  const actionIcon = SCHED_ACTION_ICON[schedule.action] ?? <Zap className="size-2.5" />

  return (
    <div
      className={cn(
        'rounded-lg border p-3 transition-opacity',
        dim && 'opacity-60',
        deleting && 'opacity-40',
        schedule.enabled
          ? 'border-[var(--color-border)]'
          : 'border-[var(--color-border-subtle)]'
      )}
      style={{ backgroundColor: 'var(--color-surface-raised)' }}
    >
      <div className="flex items-start gap-2">
        {/* Action badge */}
        <span
          className={cn(
            'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium shrink-0 mt-0.5',
            actionColor
          )}
        >
          {actionIcon}
          {schedule.action}
        </span>

        {/* ID + label */}
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-medium text-[var(--color-text-primary)] truncate">
            {schedule.id}
          </p>
          {label !== schedule.id && (
            <p className="text-[10px] text-[var(--color-text-muted)] truncate mt-0.5">
              {label}
            </p>
          )}
        </div>

        {/* Toggle */}
        <button
          onClick={onToggle}
          disabled={toggling || deleting}
          title={schedule.enabled ? 'Disable' : 'Enable'}
          className={cn(
            'shrink-0 relative inline-flex h-4 w-7 items-center rounded-full transition-colors mt-0.5',
            (toggling || deleting) && 'opacity-50 cursor-wait',
            schedule.enabled
              ? 'bg-[var(--color-green)]'
              : 'bg-[var(--color-border)]'
          )}
        >
          <span
            className={cn(
              'inline-block size-3 rounded-full bg-white transition-transform',
              schedule.enabled ? 'translate-x-3.5' : 'translate-x-0.5'
            )}
          />
        </button>

        {/* Delete button / confirm */}
        {onDelete && (
          confirmDelete ? (
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => { onDelete(); setConfirmDelete(false) }}
                disabled={deleting}
                className="px-1.5 py-0.5 rounded text-[9px] font-medium"
                style={{ backgroundColor: 'var(--color-red)', color: '#fff' }}
              >
                {deleting ? '…' : 'Delete'}
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="px-1.5 py-0.5 rounded text-[9px]"
                style={{ color: 'var(--color-text-muted)', backgroundColor: 'var(--color-surface)' }}
              >
                ✕
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              title="Delete schedule"
              disabled={deleting}
              className="p-0.5 rounded text-[var(--color-text-muted)] hover:text-[var(--color-red)] hover:bg-[var(--color-red-subtle)] transition-colors shrink-0 mt-0.5"
            >
              <Trash2 className="size-3" />
            </button>
          )
        )}
      </div>

      {/* Schedule expression + last fired */}
      <div className="flex items-center gap-3 mt-2">
        <span className="text-[10px] font-mono text-[var(--color-text-secondary)]">
          {schedule.schedule}
          {schedule.timezone ? ` (${schedule.timezone})` : ''}
        </span>
        <span className="text-[10px] text-[var(--color-text-muted)] ml-auto">
          last: {relativeTime(schedule.last_fired)}
        </span>
      </div>
    </div>
  )
}

// ─── Logs Tab ─────────────────────────────────────────────────────────────────

const MAX_LOG_LINES = 500

function classifyLine(line: string): 'error' | 'warn' | 'debug' | 'success' | 'default' {
  const l = line.toLowerCase()
  if (/\b(error|exception|traceback|critical|fatal|fail)\b/.test(l)) return 'error'
  if (/\b(warn|warning|caution|deprecated)\b/.test(l)) return 'warn'
  if (/\b(debug)\b/.test(l)) return 'debug'
  if (/\b(success|✓|complete|started|ready|running|ok)\b/.test(l)) return 'success'
  return 'default'
}

const LINE_CLASS: Record<string, string> = {
  error:   'text-[var(--color-red)]',
  warn:    'text-[var(--color-yellow)]',
  debug:   'text-[var(--color-text-muted)]',
  success: 'text-[var(--color-green)]',
  default: 'text-[var(--color-text-secondary)]',
}

// LogsTab uses fetch+ReadableStream instead of EventSource to avoid sending
// Accept: text/event-stream — Phoenix rejects that header with 406.
// toolName must be the DISPLAY NAME (e.g. "Loom") since Lantern routes by name not id.

function LogsTab({ toolName }: { toolName: string }) {
  const [lines, setLines] = useState<string[]>([])
  const [filter, setFilter] = useState('')
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [revision, setRevision] = useState(0) // bump to reconnect

  const containerRef = useRef<HTMLDivElement>(null)
  const atBottomRef = useRef(true)
  const abortRef = useRef<AbortController | null>(null)

  // Auto-scroll: track whether user is near bottom
  function handleScroll() {
    const el = containerRef.current
    if (!el) return
    atBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 50
  }

  // Scroll to bottom when new lines arrive (only if at bottom)
  useEffect(() => {
    if (atBottomRef.current && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
    }
  }, [lines])

  // Streaming connection via fetch (no Accept header sent — avoids Phoenix 406)
  useEffect(() => {
    setLines([])
    setError(null)
    setConnected(false)

    const url = `${LANTERN_BASE}/api/projects/${encodeURIComponent(toolName)}/logs`
    const controller = new AbortController()
    abortRef.current = controller

    let active = true

    async function stream() {
      try {
        const res = await fetch(url, { signal: controller.signal })
        if (!res.ok || !res.body) {
          setError(`HTTP ${res.status} — tool may be stopped or logs unavailable`)
          return
        }
        setConnected(true)
        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buf = ''

        while (active) {
          const { done, value } = await reader.read()
          if (done) break
          buf += decoder.decode(value, { stream: true })
          const parts = buf.split('\n')
          buf = parts.pop() ?? ''
          for (const part of parts) {
            const t = part.trim()
            if (t.startsWith('data: ')) {
              const line = t.slice(6)
              if (line) {
                setLines((prev) => {
                  const next = [...prev, line]
                  return next.length > MAX_LOG_LINES ? next.slice(next.length - MAX_LOG_LINES) : next
                })
              }
            }
          }
        }
      } catch (e) {
        if ((e as Error).name !== 'AbortError') {
          setError(e instanceof Error ? e.message : 'Stream failed')
        }
      } finally {
        if (active) setConnected(false)
      }
    }

    stream()

    return () => {
      active = false
      controller.abort()
      abortRef.current = null
    }
  }, [toolName, revision])

  function handleRefresh() {
    setRevision((v) => v + 1)
  }

  function handleClear() {
    setLines([])
  }

  const filtered = filter
    ? lines.filter((l) => l.toLowerCase().includes(filter.toLowerCase()))
    : lines

  return (
    <div className="flex flex-col gap-2">
      {/* Toolbar */}
      <div className="flex items-center gap-1.5 shrink-0">
        {/* Connection status */}
        <span
          className={cn(
            'inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-full font-medium shrink-0',
            connected
              ? 'bg-[var(--color-green-subtle)] text-[var(--color-green)]'
              : 'bg-[var(--color-surface-raised)] text-[var(--color-text-muted)]'
          )}
        >
          <span
            className={cn(
              'size-1.5 rounded-full',
              connected ? 'bg-[var(--color-green)]' : 'bg-[var(--color-text-muted)]'
            )}
          />
          {connected ? 'live' : 'offline'}
        </span>

        {/* Filter */}
        <div
          className="flex items-center gap-1 flex-1 px-1.5 py-0.5 rounded"
          style={{ backgroundColor: 'var(--color-surface-raised)', border: '1px solid var(--color-border-subtle)' }}
        >
          <Search className="size-2.5 text-[var(--color-text-muted)] shrink-0" />
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter…"
            className="flex-1 bg-transparent text-[10px] text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] outline-none"
          />
          {filter && (
            <button
              onClick={() => setFilter('')}
              className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
            >
              <X className="size-2.5" />
            </button>
          )}
        </div>

        {/* Line count */}
        <span className="text-[9px] text-[var(--color-text-muted)] shrink-0">
          {filter ? `${filtered.length}/${lines.length}` : `${lines.length}`}
        </span>

        {/* Clear */}
        <button
          onClick={handleClear}
          title="Clear"
          className="p-0.5 rounded text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-raised)] transition-colors shrink-0"
        >
          <X className="size-3" />
        </button>

        {/* Refresh (reconnect) */}
        <button
          onClick={handleRefresh}
          title="Reconnect"
          className="p-0.5 rounded text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-raised)] transition-colors shrink-0"
        >
          <RefreshCw className="size-3" />
        </button>
      </div>

      {/* Error banner */}
      {error && (
        <div className="text-[10px] text-[var(--color-red)] flex items-center gap-1.5 shrink-0">
          <AlertCircle className="size-3 shrink-0" />
          {error}
        </div>
      )}

      {/* Empty state */}
      {!connected && lines.length === 0 && !error && (
        <div className="flex flex-col items-center justify-center gap-2 text-center py-12">
          <ScrollText className="size-6 text-[var(--color-text-muted)] opacity-40" />
          <p className="text-[11px] text-[var(--color-text-muted)]">
            No logs available
          </p>
          <p className="text-[10px] text-[var(--color-text-muted)] opacity-70">
            Tool may be stopped or logs not yet buffered
          </p>
          <button
            onClick={handleRefresh}
            className="flex items-center gap-1 text-[10px] px-2 py-1 rounded transition-colors mt-1"
            style={{ color: 'var(--color-accent)', backgroundColor: 'var(--color-accent-subtle)' }}
          >
            <RefreshCw className="size-2.5" />
            Retry
          </button>
        </div>
      )}

      {/* Log output */}
      {(lines.length > 0 || connected) && (
        <div
          ref={containerRef}
          onScroll={handleScroll}
          className="overflow-y-auto rounded text-[10px] font-mono leading-relaxed p-2"
          style={{
            backgroundColor: 'var(--color-surface-raised)',
            border: '1px solid var(--color-border-subtle)',
            height: '380px',
          }}
        >
          {filtered.length === 0 && filter ? (
            <p className="text-[var(--color-text-muted)] italic">No lines match "{filter}"</p>
          ) : (
            filtered.map((line, i) => {
              const kind = classifyLine(line)
              return (
                <div
                  key={i}
                  className={cn('whitespace-pre-wrap break-all', LINE_CLASS[kind])}
                >
                  {line}
                </div>
              )
            })
          )}
          {connected && filtered.length === 0 && !filter && (
            <span className="text-[var(--color-text-muted)] animate-pulse">▌</span>
          )}
        </div>
      )}
    </div>
  )
}
