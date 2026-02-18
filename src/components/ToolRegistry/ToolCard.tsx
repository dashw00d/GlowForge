import { Play, Square, RotateCcw, ChevronRight } from 'lucide-react'
import { cn } from '../../lib/utils'
import { StatusDot } from '../ui/StatusDot'
import { activateTool, deactivateTool, restartTool } from '../../api/lantern'
import type { ToolSummary } from '../../types'

interface Props {
  tool: ToolSummary
  selected: boolean
  onSelect: () => void
  onRefresh: () => void
}

export function ToolCard({ tool, selected, onSelect, onRefresh }: Props) {
  async function handleStart(e: React.MouseEvent) {
    e.stopPropagation()
    await activateTool(tool.id).catch(console.error)
    onRefresh()
  }

  async function handleStop(e: React.MouseEvent) {
    e.stopPropagation()
    await deactivateTool(tool.id).catch(console.error)
    onRefresh()
  }

  async function handleRestart(e: React.MouseEvent) {
    e.stopPropagation()
    await restartTool(tool.id).catch(console.error)
    onRefresh()
  }

  const isRunning = tool.status === 'running'

  return (
    <button
      onClick={onSelect}
      className={cn(
        'w-full text-left px-3 py-2.5 flex items-center gap-2.5 transition-colors',
        'hover:bg-[var(--color-surface-raised)] border-b border-[var(--color-border-subtle)]',
        selected && 'bg-[var(--color-accent-subtle)] border-l-2 border-l-[var(--color-accent)]'
      )}
    >
      <StatusDot status={tool.status} />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium text-[var(--color-text-primary)] truncate">
            {tool.name}
          </span>
          {tool.tags.length > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--color-surface-raised)] text-[var(--color-text-muted)] shrink-0">
              {tool.tags[0]}
            </span>
          )}
        </div>
        {tool.description && (
          <p className="text-xs text-[var(--color-text-secondary)] truncate mt-0.5">
            {tool.description}
          </p>
        )}
      </div>

      <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 hover:!opacity-100">
        {isRunning ? (
          <>
            <ActionBtn onClick={handleRestart} title="Restart">
              <RotateCcw className="size-3" />
            </ActionBtn>
            <ActionBtn onClick={handleStop} title="Stop">
              <Square className="size-3" />
            </ActionBtn>
          </>
        ) : (
          <ActionBtn onClick={handleStart} title="Start">
            <Play className="size-3" />
          </ActionBtn>
        )}
      </div>

      <ChevronRight className="size-3 text-[var(--color-text-muted)] shrink-0" />
    </button>
  )
}

function ActionBtn({
  children,
  onClick,
  title,
}: {
  children: React.ReactNode
  onClick: (e: React.MouseEvent) => void
  title: string
}) {
  return (
    <span
      onClick={onClick}
      title={title}
      className={cn(
        'inline-flex items-center justify-center size-5 rounded',
        'hover:bg-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]',
        'transition-colors cursor-pointer'
      )}
    >
      {children}
    </span>
  )
}
