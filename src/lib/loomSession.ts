/**
 * loomSession.ts — localStorage persistence for Loom Chat sessions
 *
 * Follows the toolNotes.ts pattern: plain functions, try/catch, no React.
 */

const STORAGE_KEY = 'glowforge-loom-session'
const MAX_AGE_MS = 24 * 60 * 60 * 1000

interface StoredMessage {
  id: string
  prompt: string
  traceId: string
}

interface StoredSession {
  messages: StoredMessage[]
  cancelledIds: string[]
  savedAt: number
}

export function loadSession(): { messages: StoredMessage[]; cancelledIds: string[] } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { messages: [], cancelledIds: [] }
    const parsed = JSON.parse(raw) as StoredSession
    if (Date.now() - parsed.savedAt > MAX_AGE_MS) {
      localStorage.removeItem(STORAGE_KEY)
      return { messages: [], cancelledIds: [] }
    }
    return {
      messages: parsed.messages ?? [],
      cancelledIds: parsed.cancelledIds ?? [],
    }
  } catch {
    return { messages: [], cancelledIds: [] }
  }
}

export function saveSession(messages: StoredMessage[], cancelledIds: string[]): void {
  try {
    const session: StoredSession = {
      messages,
      cancelledIds,
      savedAt: Date.now(),
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
  } catch {
    // localStorage full or unavailable
  }
}

export function clearSession(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}
