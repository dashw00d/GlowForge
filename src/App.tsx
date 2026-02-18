import { useCallback, useState } from 'react'
import { ToolList } from './components/ToolRegistry/ToolList'
import { ToolDetail } from './components/ToolRegistry/ToolDetail'
import { BuildDetail } from './components/ToolRegistry/BuildDetail'
import { ChatPanel } from './components/LoomChat/ChatPanel'
import { HealthStrip } from './components/ui/HealthStrip'
import { isActiveBuild } from './api/build'
import type { BuildManifest } from './types'

export default function App() {
  const [selectedToolId, setSelectedToolId] = useState<string | null>(null)
  const [buildManifests, setBuildManifests] = useState<Map<string, BuildManifest>>(new Map())
  // Bump to force ToolList to reload immediately (e.g. after tool deletion)
  const [toolRefreshKey, setToolRefreshKey] = useState(0)

  // Stable callback passed to ToolList — updates parent's copy of build manifests
  const handleBuildManifestUpdate = useCallback((manifests: Map<string, BuildManifest>) => {
    setBuildManifests(new Map(manifests))
  }, [])

  // Decide which detail panel to show for the selected tool
  const selectedManifest = selectedToolId ? buildManifests.get(selectedToolId) : undefined
  const showBuildDetail = selectedToolId != null &&
    selectedManifest != null &&
    isActiveBuild(selectedManifest)

  // When build goes ready, clear its manifest so ToolDetail takes over
  const handleBuildReady = useCallback(() => {
    if (!selectedToolId) return
    setBuildManifests((prev) => {
      const next = new Map(prev)
      next.delete(selectedToolId)
      return next
    })
  }, [selectedToolId])

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
            onBuildManifestUpdate={handleBuildManifestUpdate}
            refreshKey={toolRefreshKey}
          />
        </aside>

        {/* Detail panel — BuildDetail or ToolDetail depending on build state */}
        {selectedToolId && (
          <aside
            className="flex flex-col shrink-0 border-r"
            style={{
              width: '320px',
              borderColor: 'var(--color-border)',
              backgroundColor: 'var(--color-surface)',
            }}
          >
            {showBuildDetail ? (
              <BuildDetail
                toolId={selectedToolId}
                onClose={() => setSelectedToolId(null)}
                onReady={handleBuildReady}
                onRetry={() => {
                  // Clear manifest — user re-prompts Loom to retry
                  setBuildManifests((prev) => {
                    const next = new Map(prev)
                    if (selectedToolId) next.delete(selectedToolId)
                    return next
                  })
                }}
              />
            ) : (
              <ToolDetail
                toolId={selectedToolId}
                onClose={() => setSelectedToolId(null)}
                onDeleted={() => {
                  // Clear selection and any build manifest for this tool
                  const deletedId = selectedToolId
                  setSelectedToolId(null)
                  if (deletedId) {
                    setBuildManifests((prev) => {
                      const next = new Map(prev)
                      next.delete(deletedId)
                      return next
                    })
                  }
                  setToolRefreshKey((k) => k + 1)
                }}
              />
            )}
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
