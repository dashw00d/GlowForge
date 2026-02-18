/**
 * toolNotes.ts — localStorage persistence for per-tool notes/annotations
 *
 * Notes are simple strings keyed by toolId. Useful for recording context,
 * TODOs, or comparison notes between similar tools.
 */

const STORAGE_KEY = 'glowforge-tool-notes'

export function loadNotes(): Record<string, string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    return JSON.parse(raw) as Record<string, string>
  } catch {
    return {}
  }
}

export function loadNote(toolId: string): string {
  return loadNotes()[toolId] ?? ''
}

export function saveNote(toolId: string, note: string): void {
  const notes = loadNotes()
  if (note.trim()) {
    notes[toolId] = note.trim()
  } else {
    delete notes[toolId] // clean up empty notes
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notes))
  } catch {
    // localStorage full or unavailable
  }
}

export function deleteNote(toolId: string): void {
  saveNote(toolId, '') // clears it
}
