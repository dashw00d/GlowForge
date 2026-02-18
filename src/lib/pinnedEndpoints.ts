/**
 * pinnedEndpoints.ts — localStorage persistence for bookmarked endpoints
 *
 * Pins are keyed by toolId + method + path (case-sensitive).
 * The baseUrl is stored so the drawer can fire requests without Lantern API.
 */

const STORAGE_KEY = 'glowforge-pinned-endpoints'

export interface PinnedEndpoint {
  toolId: string
  toolName: string
  method: string
  path: string
  baseUrl: string
  description?: string
  pinnedAt: number // timestamp ms
}

/** Stable identifier for a pin — used for equality checks */
export function pinKey(toolId: string, method: string, path: string): string {
  return `${toolId}::${method}::${path}`
}

export function loadPins(): PinnedEndpoint[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as PinnedEndpoint[]) : []
  } catch {
    return []
  }
}

export function savePins(pins: PinnedEndpoint[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pins))
  } catch {
    // localStorage full or unavailable
  }
}

export function isPinned(toolId: string, method: string, path: string): boolean {
  const key = pinKey(toolId, method, path)
  return loadPins().some((p) => pinKey(p.toolId, p.method, p.path) === key)
}

/**
 * Toggle a pin. Returns true if the endpoint is now pinned, false if removed.
 */
export function togglePin(pin: Omit<PinnedEndpoint, 'pinnedAt'>): boolean {
  const pins = loadPins()
  const key = pinKey(pin.toolId, pin.method, pin.path)
  const idx = pins.findIndex((p) => pinKey(p.toolId, p.method, p.path) === key)

  if (idx >= 0) {
    // Already pinned — remove it
    pins.splice(idx, 1)
    savePins(pins)
    return false
  } else {
    // Not pinned — add it
    pins.push({ ...pin, pinnedAt: Date.now() })
    savePins(pins)
    return true
  }
}

export function removePin(toolId: string, method: string, path: string): void {
  const pins = loadPins()
  const key = pinKey(toolId, method, path)
  const filtered = pins.filter((p) => pinKey(p.toolId, p.method, p.path) !== key)
  savePins(filtered)
}
