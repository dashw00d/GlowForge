import { cn } from '../../lib/utils'
import type { ProjectStatus } from '../../types'

const DOT: Record<ProjectStatus, string> = {
  running: 'bg-green',
  starting: 'bg-yellow animate-pulse',
  stopping: 'bg-yellow animate-pulse',
  stopped: 'bg-[var(--color-text-muted)]',
  error: 'bg-red',
  needs_config: 'bg-yellow',
}

export function StatusDot({ status }: { status: ProjectStatus }) {
  return (
    <span
      className={cn('inline-block size-2 shrink-0 rounded-full', DOT[status] ?? 'bg-[var(--color-text-muted)]')}
      title={status}
    />
  )
}
