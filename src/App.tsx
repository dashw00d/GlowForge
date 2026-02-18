import { useState } from 'react'
import { ToolList } from './components/ToolRegistry/ToolList'
import { ToolDetail } from './components/ToolRegistry/ToolDetail'
import { ChatPanel } from './components/LoomChat/ChatPanel'
import { HealthStrip } from './components/ui/HealthStrip'

export default function App() {
  const [selectedToolId, setSelectedToolId] = useState<string | null>(null)

  return (
    <div
      className="flex flex-col h-screen w-screen overflow-hidden"
      style={{ backgroundColor: 'var(--color-background)', color: 'var(--color-text-primary)' }}
    >
      {/* Global health strip — spans full width */}
      <HealthStrip />

      {/* Three-column body */}
      <div className="flex flex-1 min-h-0">
        {/* Left panel — Tool Registry */}
        <aside
          className="flex flex-col shrink-0 border-r"
          style={{
            width: selectedToolId ? '220px' : '280px',
            borderColor: 'var(--color-border)',
            backgroundColor: 'var(--color-surface)',
            transition: 'width 200ms ease',
          }}
        >
          <ToolList
            selectedId={selectedToolId}
            onSelect={(id) => setSelectedToolId((prev) => (prev === id ? null : id))}
          />
        </aside>

        {/* Tool Detail slide-in */}
        {selectedToolId && (
          <aside
            className="flex flex-col shrink-0 border-r"
            style={{
              width: '320px',
              borderColor: 'var(--color-border)',
              backgroundColor: 'var(--color-surface)',
            }}
          >
            <ToolDetail
              toolId={selectedToolId}
              onClose={() => setSelectedToolId(null)}
            />
          </aside>
        )}

        {/* Center — Loom Chat */}
        <main
          className="flex-1 flex flex-col min-w-0"
          style={{ backgroundColor: 'var(--color-background)' }}
        >
          <ChatPanel />
        </main>
      </div>
    </div>
  )
}
