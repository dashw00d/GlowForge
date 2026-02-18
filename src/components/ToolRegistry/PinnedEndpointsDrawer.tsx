/**
 * PinnedEndpointsDrawer — collapsible panel in ToolList showing all starred endpoints
 *
 * Displays bookmarked endpoints across all tools. Each row:
 *   - Method badge + path + tool name
 *   - Quick-fire ▶ button (fires GET/DELETE inline; shows status flash)
 *   - ✕ unpin button
 */

import { useState, useEffect, useCallback } from 'react'
import { Star, X, Play, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react'
import {
  loadPins,
  removePin,
  type PinnedEndpoint,
} from '../../lib/pinnedEndpoints'
import { Spinner } from '../ui/Spinner'
import { cn } from '../../lib/utils'

const METHOD_COLOR: Record<string, string> = {
  GET:    'text-[var(--color-green)]    bg-[var(--color-green-subtle)]',
  POST:   'text-[var(--color-accent)]   bg-[var(--color-accent-subtle)]',
  PUT:    'text-[var(--color-yellow)]   bg-[var(--color-yellow-subtle)]',
  PATCH:  'text-[var(--color-yellow)]   bg-[var(--color-yellow-subtle)]',
  DELETE: 'text-[var(--color-red)]      bg-[var(--color-red-subtle)]',
}

interface FireResult {
  status: number
  timeMs: number
}

function PinRow({
  pin,
  onRemoved,
}: {
  pin: PinnedEndpoint
  onRemoved: () => void
}) {
  const [firing, setFiring] = useState(false)
  const [result, setResult] = useState<FireResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const hasBody = ['POST', 'PUT', 'PATCH'].includes(pin.method)
  const [showBody, setShowBody] = useState(false)
  const [body, setBody] = useState('')

  // Clear result flash after 4s
  useEffect(() => {
    if (!result) return
    const t = setTimeout(() => setResult(null), 4000)
    return () => clearTimeout(t)
  }, [result])

  async function handleFire() {
    if (!pin.baseUrl) {
      setError('No base URL stored for this pin')
      return
    }
    setFiring(true)
    setResult(null)
    setError(null)
    const start = performance.now()
    try {
      const res = await fetch(`${pin.baseUrl}${pin.path}`, {
        method: pin.method,
        headers: { 'Content-Type': 'application/json' },
        body: hasBody && body.trim() ? body.trim() : undefined,
      })
      setResult({ status: res.status, timeMs: Math.round(performance.now() - start) })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed')
    } finally {
      setFiring(false)
    }
  }

  function handleRemove() {
    removePin(pin.toolId, pin.method, pin.path)
    onRemoved()
  }

  const statusColor = !result ? '' :
    result.status < 300 ? 'text-[var(--color-green)]' :
    result.status < 400 ? 'text-[var(--color-yellow)]' :
    'text-[var(--color-red)]'

  return (
    <div
      className="rounded border px-2 py-1.5 space-y-1"
      style={{
        backgroundColor: 'var(--color-surface)',
        borderColor: 'var(--color-border-subtle)',
      }}
    >
      <div className="flex items-center gap-1.5 min-w-0">
        {/* Method */}
        <span
          className={cn(
            'text-[9px] font-mono font-bold px-1 py-0.5 rounded shrink-0',
            METHOD_COLOR[pin.method] ?? 'text-[var(--color-text-muted)] bg-[var(--color-surface-raised)]'
          )}
        >
          {pin.method}
        </span>

        {/* Path */}
        <span className="text-[10px] font-mono text-[var(--color-text-primary)] truncate flex-1 min-w-0">
          {pin.path}
        </span>

        {/* Result flash */}
        {result && (
          <span className={cn('text-[9px] font-mono shrink-0', statusColor)}>
            {result.status} · {result.timeMs}ms
          </span>
        )}

        {/* Fire button */}
        <button
          onClick={hasBody ? () => setShowBody((v) => !v) : handleFire}
          disabled={firing}
          title={hasBody ? (showBody ? 'Hide body' : 'Set body & fire') : 'Fire request'}
          className="shrink-0 p-0.5 rounded text-[var(--color-text-muted)] hover:text-[var(--color-accent)] hover:bg-[var(--color-accent-subtle)] transition-colors disabled:opacity-40"
        >
          {firing ? <Spinner className="size-3" /> : <Play className="size-3" />}
        </button>

        {/* Remove pin */}
        <button
          onClick={handleRemove}
          title="Unpin"
          className="shrink-0 p-0.5 rounded text-[var(--color-text-muted)] hover:text-[var(--color-red)] hover:bg-[var(--color-red-subtle)] transition-colors"
        >
          <X className="size-3" />
        </button>
      </div>

      {/* Tool name tag */}
      <div className="flex items-center gap-1">
        <span
          className="text-[9px] px-1 py-0.5 rounded"
          style={{
            backgroundColor: 'var(--color-surface-raised)',
            color: 'var(--color-text-muted)',
          }}
        >
          {pin.toolName}
        </span>
        {pin.description && (
          <span className="text-[9px] text-[var(--color-text-muted)] truncate">
            {pin.description}
          </span>
        )}
      </div>

      {/* Body input for POST/PUT/PATCH */}
      {hasBody && showBody && (
        <div className="space-y-1">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={2}
            placeholder='{"key": "value"}'
            className="w-full text-[10px] font-mono rounded px-1.5 py-1 resize-none outline-none"
            style={{
              backgroundColor: 'var(--color-surface-raised)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text-primary)',
            }}
          />
          <button
            onClick={handleFire}
            disabled={firing}
            className="w-full flex items-center justify-center gap-1 py-0.5 rounded text-[10px] font-medium transition-opacity disabled:opacity-40"
            style={{ backgroundColor: 'var(--color-accent)', color: '#fff' }}
          >
            {firing ? <Spinner className="size-2.5" /> : <Play className="size-2.5" />}
            {firing ? 'Sending…' : 'Send'}
          </button>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-center gap-1 text-[9px] text-[var(--color-red)]">
          <AlertCircle className="size-2.5 shrink-0" />
          {error}
        </div>
      )}
    </div>
  )
}

export function PinnedEndpointsDrawer() {
  const [open, setOpen] = useState(false)
  const [pins, setPins] = useState<PinnedEndpoint[]>([])

  const refresh = useCallback(() => {
    setPins(loadPins())
  }, [])

  // Load on mount and whenever drawer opens
  useEffect(() => {
    if (open) refresh()
  }, [open, refresh])

  // Also refresh when window regains focus (user may have pinned from another tab or tool)
  useEffect(() => {
    window.addEventListener('focus', refresh)
    return () => window.removeEventListener('focus', refresh)
  }, [refresh])

  // Sort: most recently pinned first
  const sorted = [...pins].sort((a, b) => b.pinnedAt - a.pinnedAt)

  if (pins.length === 0 && !open) return null

  return (
    <div
      className="border-t shrink-0"
      style={{ borderColor: 'var(--color-border-subtle)' }}
    >
      {/* Header */}
      <button
        onClick={() => { setOpen((v) => !v); if (!open) refresh() }}
        className="w-full flex items-center gap-2 px-3 py-2 text-[10px] transition-colors hover:bg-[var(--color-surface-raised)]"
        style={{ color: 'var(--color-text-muted)' }}
      >
        <Star
          className={cn(
            'size-3 shrink-0',
            pins.length > 0
              ? 'fill-[var(--color-yellow)] text-[var(--color-yellow)]'
              : 'text-[var(--color-text-muted)]'
          )}
        />
        <span className="font-semibold uppercase tracking-wider flex-1 text-left">
          Pinned
        </span>
        {pins.length > 0 && (
          <span
            className="px-1 py-0.5 rounded-full text-[9px] font-medium"
            style={{
              backgroundColor: 'var(--color-yellow-subtle)',
              color: 'var(--color-yellow)',
            }}
          >
            {pins.length}
          </span>
        )}
        {open ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
      </button>

      {/* Content */}
      {open && (
        <div className="px-2 pb-2 space-y-1.5 max-h-64 overflow-y-auto">
          {sorted.length === 0 ? (
            <p className="text-[10px] text-[var(--color-text-muted)] text-center py-3">
              No pinned endpoints yet.
              <br />
              <span className="opacity-70">Star any endpoint in the Endpoints tab.</span>
            </p>
          ) : (
            sorted.map((pin) => (
              <PinRow
                key={`${pin.toolId}::${pin.method}::${pin.path}`}
                pin={pin}
                onRemoved={refresh}
              />
            ))
          )}
        </div>
      )}
    </div>
  )
}
