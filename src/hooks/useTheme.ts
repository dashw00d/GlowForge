import { useEffect, useState } from 'react'

export type Theme = 'dark' | 'light'

const STORAGE_KEY = 'glowforge-theme'
const LIGHT_CLASS = 'light'

function getInitialTheme(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'dark' || stored === 'light') return stored
  } catch {
    // localStorage unavailable (SSR, sandboxed)
  }
  // Default: dark (the primary design target)
  return 'dark'
}

function applyTheme(theme: Theme): void {
  const root = document.documentElement
  if (theme === 'light') {
    root.classList.add(LIGHT_CLASS)
  } else {
    root.classList.remove(LIGHT_CLASS)
  }
}

// Apply theme immediately (before React hydrates) to avoid flash
applyTheme(getInitialTheme())

export function useTheme(): { theme: Theme; toggleTheme: () => void; setTheme: (t: Theme) => void } {
  const [theme, setThemeState] = useState<Theme>(getInitialTheme)

  useEffect(() => {
    applyTheme(theme)
    try {
      localStorage.setItem(STORAGE_KEY, theme)
    } catch {
      // ignore
    }
  }, [theme])

  function setTheme(t: Theme) {
    setThemeState(t)
  }

  function toggleTheme() {
    setThemeState((t) => (t === 'dark' ? 'light' : 'dark'))
  }

  return { theme, toggleTheme, setTheme }
}
