import { useEffect, useState } from 'react'
import { X, ExternalLink, Zap, FileText, Activity, Play, Square, AlertCircle, Calendar, MessageSquare, Globe, Terminal, Layers, ChevronDown, ChevronUp } from 'lucide-react'
import { getTool, getProjectHealth, activateTool, deactivateTool, getToolDocs } from '../../api/lantern'
import type { DocFile } from '../../api/lantern'
import { listSchedules, toggleSchedule } from '../../api/loom'
import { Spinner } from '../ui/Spinner'
import { StatusDot } from '../ui/StatusDot'
import { MarkdownView } from '../ui/MarkdownView'
import { cn } from '../../lib/utils'
import type { ToolDetail as IToolDetail, ProjectHealthStatus, ScheduledTask } from '../../types'

interface Props {
  toolId: string
  onClose: () => void
}

type Tab = 'overview' | 'endpoints' | 'docs' | 'schedules'

export function ToolDetail({ toolId, onClose }: Props) {
  const [tool, setTool] = useState<IToolDetail | null>(null)
  const [health, setHealth] = useState<ProjectHealthStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('overview')
  const [toggling, setToggling] = useState(false)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      getTool(toolId),
      getProjectHealth().then((all) => all[toolId] ?? null),
    ])
      .then(([t, h]) => {
        setTool(t)
        setHealth(h)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [toolId])

  async function handleToggle() {
    if (!tool) return
    setToggling(true)
    try {
      if (tool.status === 'running') {
        await deactivateTool(toolId)
      } else {
        await activateTool(toolId)
      }
      const [t, h] = await Promise.all([
        getTool(toolId),
        getProjectHealth().then((all) => all[toolId] ?? null),
      ])
      setTool(t)
      setHealth(h)
    } finally {
      setToggling(false)
    }
  }

  const isRunning = tool?.status === 'running'

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
          <button
            onClick={onClose}
            className="p-1 rounded text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-raised)] transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      {tool && (
        <>
          <div className="flex border-b border-[var(--color-border)] shrink-0 overflow-x-auto">
            {(['overview', 'endpoints', 'docs', 'schedules'] as Tab[]).map((t) => (
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
                {t}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {tab === 'overview' && <OverviewTab tool={tool} health={health} />}
            {tab === 'endpoints' && <EndpointsTab tool={tool} />}
            {tab === 'docs' && <DocsTab toolId={toolId} tool={tool} />}
            {tab === 'schedules' && <SchedulesTab toolId={toolId} toolName={tool.name} />}
          </div>
        </>
      )}
    </div>
  )
}

function OverviewTab({ tool, health }: { tool: IToolDetail; health: ProjectHealthStatus | null }) {
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
    </div>
  )
}

function EndpointsTab({ tool }: { tool: IToolDetail }) {
  const endpoints = [...(tool.endpoints ?? []), ...(tool.discovered_endpoints ?? [])]
  if (endpoints.length === 0) {
    return <p className="text-xs text-[var(--color-text-muted)]">No endpoints discovered.</p>
  }

  const RISK_COLOR: Record<string, string> = {
    low: 'text-[var(--color-green)]',
    medium: 'text-[var(--color-yellow)]',
    high: 'text-[var(--color-red)]',
  }
  const METHOD_COLOR: Record<string, string> = {
    GET: 'text-[var(--color-green)]',
    POST: 'text-[var(--color-accent)]',
    PUT: 'text-[var(--color-yellow)]',
    PATCH: 'text-[var(--color-yellow)]',
    DELETE: 'text-[var(--color-red)]',
  }

  return (
    <div className="space-y-1.5">
      {endpoints.map((ep, i) => (
        <div
          key={i}
          className="rounded bg-[var(--color-surface-raised)] px-3 py-2 border border-[var(--color-border-subtle)]"
        >
          <div className="flex items-center gap-2">
            <span
              className={cn(
                'text-[10px] font-mono font-bold w-12 shrink-0',
                METHOD_COLOR[ep.method] ?? 'text-[var(--color-text-secondary)]'
              )}
            >
              {ep.method}
            </span>
            <span className="text-xs font-mono text-[var(--color-text-primary)]">{ep.path}</span>
            {ep.risk && (
              <span className={cn('text-[10px] ml-auto', RISK_COLOR[ep.risk] ?? '')}>
                {ep.risk}
              </span>
            )}
          </div>
          {ep.description && (
            <p className="text-xs text-[var(--color-text-secondary)] mt-1 ml-14">{ep.description}</p>
          )}
        </div>
      ))}
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

function SchedulesTab({ toolId, toolName }: { toolId: string; toolName: string }) {
  const [schedules, setSchedules] = useState<ScheduledTask[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toggling, setToggling] = useState<Set<string>>(new Set())
  const [showAll, setShowAll] = useState(false)

  useEffect(() => {
    setLoading(true)
    setError(null)
    listSchedules()
      .then(setSchedules)
      .catch((e) => setError(e instanceof Error ? e.message : 'Loom unreachable'))
      .finally(() => setLoading(false))
  }, [toolId])

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

  return (
    <div className="space-y-4">
      {/* Relevant schedules */}
      <Section title={`For ${toolName}`}>
        {relevant.length === 0 ? (
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
                onToggle={() => handleToggle(s.id, s.enabled)}
              />
            ))}
          </div>
        )}
      </Section>

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
                  onToggle={() => handleToggle(s.id, s.enabled)}
                  dim
                />
              ))}
              {relevant.map((s) => (
                <ScheduleRow
                  key={`all-${s.id}`}
                  schedule={s}
                  toggling={toggling.has(s.id)}
                  onToggle={() => handleToggle(s.id, s.enabled)}
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
  onToggle,
  dim = false,
}: {
  schedule: ScheduledTask
  toggling: boolean
  onToggle: () => void
  dim?: boolean
}) {
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
          disabled={toggling}
          title={schedule.enabled ? 'Disable' : 'Enable'}
          className={cn(
            'shrink-0 relative inline-flex h-4 w-7 items-center rounded-full transition-colors mt-0.5',
            toggling && 'opacity-50 cursor-wait',
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
