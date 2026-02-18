import { useEffect, useState, useCallback } from 'react'
import { getSystemHealth } from '../../api/lantern'
import type { SystemHealth } from '../../types'
import { cn } from '../../lib/utils'

type HealthStatus = 'ok' | 'warning' | 'error' | 'unknown'

const STATUS_DOT: Record<HealthStatus, string> = {
  ok: 'bg-[var(--color-green)]',
  warning: 'bg-[var(--color-yellow)] animate-pulse',
  error: 'bg-[var(--color-red)] animate-pulse',
  unknown: 'bg-[var(--color-text-muted)]',
}

const STATUS_LABEL: Record<HealthStatus, string> = {
  ok: 'text-[var(--color-text-muted)]',
  warning: 'text-[var(--color-yellow)]',
  error: 'text-[var(--color-red)]',
  unknown: 'text-[var(--color-text-muted)]',
}

interface Indicator {
  key: keyof SystemHealth
  label: string
}

const INDICATORS: Indicator[] = [
  { key: 'daemon', label: 'Daemon' },
  { key: 'dns', label: 'DNS' },
  { key: 'caddy', label: 'Caddy' },
  { key: 'tls', label: 'TLS' },
]

export function HealthStrip() {
  const [health, setHealth] = useState<SystemHealth | null>(null)
  const [error, setError] = useState(false)

  const load = useCallback(async () => {
    try {
      const data = await getSystemHealth()
      setHealth(data)
      setError(false)
    } catch {
      setError(true)
    }
  }, [])

  useEffect(() => {
    load()
    const interval = setInterval(load, 30_000)
    return () => clearInterval(interval)
  }, [load])

  // If everything is ok and connected, render a minimal strip
  const allOk =
    health &&
    Object.values(health).every((c) => c.status === 'ok')

  // Lantern unreachable
  if (error) {
    return (
      <div
        className="flex items-center gap-2 px-4 py-1 text-[10px] shrink-0 border-b"
        style={{
          backgroundColor: 'var(--color-red-subtle)',
          borderColor: 'var(--color-border)',
          color: 'var(--color-red)',
        }}
      >
        <span className="inline-block size-1.5 rounded-full bg-[var(--color-red)] animate-pulse" />
        <span>Lantern unreachable — is the daemon running at 127.0.0.1:4777?</span>
      </div>
    )
  }

  if (!health) return null

  // All healthy → compact single-line strip
  if (allOk) {
    return (
      <div
        className="flex items-center gap-4 px-4 py-1 text-[10px] shrink-0 border-b"
        style={{
          backgroundColor: 'var(--color-surface)',
          borderColor: 'var(--color-border-subtle)',
          color: 'var(--color-text-muted)',
        }}
      >
        <span className="inline-block size-1.5 rounded-full bg-[var(--color-green)]" />
        <span>Lantern healthy</span>
        <span className="ml-auto flex items-center gap-3">
          {INDICATORS.map(({ key, label }) => (
            <Chip key={key} label={label} status={health[key].status as HealthStatus} />
          ))}
        </span>
      </div>
    )
  }

  // Has issues → expanded strip showing problems
  return (
    <div
      className="flex items-center gap-4 px-4 py-1.5 text-[10px] shrink-0 border-b flex-wrap"
      style={{
        backgroundColor: 'var(--color-surface)',
        borderColor: 'var(--color-border)',
      }}
    >
      {INDICATORS.map(({ key, label }) => {
        const component = health[key]
        const status = component.status as HealthStatus
        return (
          <div key={key} className="flex items-center gap-1.5">
            <span className={cn('inline-block size-1.5 rounded-full shrink-0', STATUS_DOT[status])} />
            <span className={cn('font-medium', STATUS_LABEL[status])}>{label}</span>
            {status !== 'ok' && (
              <span className="text-[var(--color-text-muted)]">— {component.message}</span>
            )}
          </div>
        )
      })}
    </div>
  )
}

function Chip({ label, status }: { label: string; status: HealthStatus }) {
  return (
    <span className="flex items-center gap-1">
      <span className={cn('inline-block size-1.5 rounded-full', STATUS_DOT[status])} />
      <span className={STATUS_LABEL[status]}>{label}</span>
    </span>
  )
}
