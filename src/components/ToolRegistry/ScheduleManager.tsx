import { useEffect, useState, useCallback } from 'react'
import { Calendar, ChevronDown, ChevronUp, RefreshCw, Zap, Terminal, Globe, MessageSquare, Layers } from 'lucide-react'
import { listSchedules, toggleSchedule } from '../../api/loom'
import { cn } from '../../lib/utils'
import type { ScheduledTask } from '../../types'

const ACTION_ICON: Record<ScheduledTask['action'], React.ReactNode> = {
  agent: <MessageSquare className="size-2.5" />,
  http: <Globe className="size-2.5" />,
  shell: <Terminal className="size-2.5" />,
  prompt: <Zap className="size-2.5" />,
  trace: <Layers className="size-2.5" />,
}

const ACTION_COLOR: Record<ScheduledTask['action'], string> = {
  agent: 'text-[var(--color-accent)] bg-[var(--color-accent-subtle)]',
  http: 'text-[var(--color-green)] bg-[var(--color-green-subtle)]',
  shell: 'text-[var(--color-yellow)] bg-[var(--color-yellow-subtle)]',
  prompt: 'text-[var(--color-accent)] bg-[var(--color-accent-subtle)]',
  trace: 'text-[var(--color-text-secondary)] bg-[var(--color-surface-raised)]',
}

export function ScheduleManager() {
  const [open, setOpen] = useState(false)
  const [schedules, setSchedules] = useState<ScheduledTask[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [toggling, setToggling] = useState<Set<string>>(new Set())

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await listSchedules()
      setSchedules(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Loom unreachable')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (open) load()
  }, [open, load])

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

  const enabledCount = schedules.filter((s) => s.enabled).length

  return (
    <div
      className="border-t shrink-0"
      style={{ borderColor: 'var(--color-border)' }}
    >
      {/* Toggle row */}
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'w-full flex items-center gap-2 px-3 py-2 text-xs transition-colors',
          open
            ? 'text-[var(--color-text-primary)]'
            : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'
        )}
        style={open ? { backgroundColor: 'var(--color-surface-raised)' } : undefined}
      >
        <Calendar className="size-3 shrink-0" />
        <span className="font-medium flex-1 text-left">Schedules</span>

        {schedules.length > 0 && !open && (
          <span
            className="px-1.5 py-0.5 rounded-full text-[10px]"
            style={{
              backgroundColor: 'var(--color-surface-raised)',
              color: enabledCount > 0 ? 'var(--color-green)' : 'var(--color-text-muted)',
            }}
          >
            {enabledCount}/{schedules.length}
          </span>
        )}

        {open ? (
          <ChevronUp className="size-3 shrink-0" />
        ) : (
          <ChevronDown className="size-3 shrink-0" />
        )}
      </button>

      {/* Expanded content */}
      {open && (
        <div
          className="border-t"
          style={{ borderColor: 'var(--color-border-subtle)' }}
        >
          {/* Toolbar */}
          <div className="flex items-center justify-between px-3 py-1">
            <span className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
              {enabledCount} active
            </span>
            <button
              onClick={load}
              disabled={loading}
              className="flex items-center gap-1 text-[10px] transition-colors"
              style={{ color: 'var(--color-text-muted)' }}
            >
              <RefreshCw className={cn('size-2.5', loading && 'animate-spin')} />
              refresh
            </button>
          </div>

          {/* Error state */}
          {error && (
            <p className="px-3 py-2 text-xs" style={{ color: 'var(--color-red)' }}>
              {error}
            </p>
          )}

          {/* Empty state */}
          {!loading && !error && schedules.length === 0 && (
            <p
              className="px-3 py-3 text-xs text-center"
              style={{ color: 'var(--color-text-muted)' }}
            >
              No schedules configured.
            </p>
          )}

          {/* Schedule rows */}
          <div className="max-h-48 overflow-y-auto">
            {schedules.map((task) => (
              <ScheduleRow
                key={task.id}
                task={task}
                toggling={toggling.has(task.id)}
                onToggle={() => handleToggle(task.id, task.enabled)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function ScheduleRow({
  task,
  toggling,
  onToggle,
}: {
  task: ScheduledTask
  toggling: boolean
  onToggle: () => void
}) {
  // Derive a human label: prefer message/prompt/url/command, fall back to id
  const label =
    task.message?.slice(0, 40) ||
    task.prompt?.slice(0, 40) ||
    task.url?.replace(/^https?:\/\//, '').slice(0, 40) ||
    task.command?.slice(0, 40) ||
    task.id

  return (
    <div
      className={cn(
        'flex items-center gap-2 px-3 py-2 border-b last:border-0 transition-colors',
        !task.enabled && 'opacity-50'
      )}
      style={{ borderColor: 'var(--color-border-subtle)' }}
    >
      {/* Action badge */}
      <span
        className={cn(
          'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium shrink-0',
          ACTION_COLOR[task.action]
        )}
      >
        {ACTION_ICON[task.action]}
        {task.action}
      </span>

      {/* Label + schedule */}
      <div className="flex-1 min-w-0">
        <p
          className="text-[10px] truncate leading-snug"
          style={{ color: 'var(--color-text-primary)' }}
        >
          {label}
        </p>
        <p
          className="text-[10px] truncate font-mono"
          style={{ color: 'var(--color-text-muted)' }}
        >
          {task.schedule}
          {task.timezone ? ` (${task.timezone})` : ''}
        </p>
      </div>

      {/* Toggle */}
      <button
        onClick={onToggle}
        disabled={toggling}
        title={task.enabled ? 'Disable schedule' : 'Enable schedule'}
        className={cn(
          'shrink-0 relative inline-flex h-4 w-7 items-center rounded-full transition-colors',
          toggling && 'opacity-50 cursor-wait',
          task.enabled
            ? 'bg-[var(--color-green)]'
            : 'bg-[var(--color-border)]'
        )}
      >
        <span
          className={cn(
            'inline-block size-3 rounded-full bg-white transition-transform',
            task.enabled ? 'translate-x-3.5' : 'translate-x-0.5'
          )}
        />
      </button>
    </div>
  )
}
