import { useState, useEffect, useRef } from 'react'
import { Bot, AlertCircle } from 'lucide-react'
import { sendPrompt } from '../../api/loom'
import { ChatInput } from './ChatInput'
import type { ChatInputHandle } from './ChatInput'
import { TraceCard } from './TraceCard'
import { HistoryDrawer } from './HistoryDrawer'
import type { TraceHistoryEntry } from '../../types'

interface Message {
  id: string
  prompt: string
  traceId: string
}

export function ChatPanel() {
  const [messages, setMessages] = useState<Message[]>([])
  const [error, setError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const chatInputRef = useRef<ChatInputHandle>(null)
  const loadedIds = new Set(messages.map((m) => m.traceId))

  // Global keyboard shortcut: '/' or Cmd+K focuses the chat input
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName
      const isEditable =
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        (e.target as HTMLElement).isContentEditable

      if (e.key === '/' && !isEditable) {
        e.preventDefault()
        chatInputRef.current?.focus()
        return
      }

      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        chatInputRef.current?.focus()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handlePrompt(prompt: string) {
    setError(null)
    try {
      const { trace_id } = await sendPrompt(prompt)
      setMessages((prev) => [
        ...prev,
        { id: trace_id, prompt, traceId: trace_id },
      ])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to send prompt')
    }
  }

  function handleLoadHistory(entry: TraceHistoryEntry) {
    if (loadedIds.has(entry.trace_id)) return
    setMessages((prev) => [
      ...prev,
      {
        id: entry.trace_id,
        prompt: entry.user_prompt || `(trace ${entry.trace_id.slice(0, 8)})`,
        traceId: entry.trace_id,
      },
    ])
    // Scroll to bottom after a tick
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div
        className="px-4 py-2.5 border-b shrink-0 flex items-center gap-2"
        style={{ borderColor: 'var(--color-border)' }}
      >
        <Bot className="size-4 text-[var(--color-accent)]" />
        <h2 className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">
          Loom Chat
        </h2>
        <span className="ml-auto flex items-center gap-1 text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
          <kbd
            onClick={() => chatInputRef.current?.focus()}
            className="cursor-pointer px-1.5 py-0.5 rounded font-mono border transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
            style={{
              borderColor: 'var(--color-border)',
              backgroundColor: 'var(--color-surface-raised)',
            }}
            title="Press / or ⌘K to focus chat"
          >
            /
          </kbd>
        </span>
      </div>

      {/* History drawer — collapsible, sits just below header */}
      <HistoryDrawer onLoad={handleLoadHistory} loadedIds={loadedIds} />

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center py-12">
            <Bot className="size-10 text-[var(--color-text-muted)] mb-4" />
            <h3 className="text-sm font-medium text-[var(--color-text-secondary)]">
              What should Loom do?
            </h3>
            <p className="text-xs text-[var(--color-text-muted)] mt-2 max-w-xs">
              Describe a task in plain English. Loom will route it to the right tools, plan steps, and execute.
            </p>
            <div className="mt-6 space-y-2 text-xs">
              {[
                "Scrape the top 10 AI newsletters and summarize today's news",
                'Pull my recent git commits and write a LinkedIn post',
                'Search Twitter for mentions of "LangGraph" and analyze sentiment',
              ].map((example) => (
                <button
                  key={example}
                  onClick={() => handlePrompt(example)}
                  className="block w-full text-left px-3 py-2 rounded-lg border transition-colors"
                  style={{
                    borderColor: 'var(--color-border)',
                    color: 'var(--color-text-muted)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'var(--color-accent)'
                    e.currentTarget.style.color = 'var(--color-accent)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--color-border)'
                    e.currentTarget.style.color = 'var(--color-text-muted)'
                  }}
                >
                  &ldquo;{example}&rdquo;
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <TraceCard key={msg.id} traceId={msg.traceId} prompt={msg.prompt} />
        ))}

        {error && (
          <div
            className="flex items-center gap-2 text-xs rounded-lg px-3 py-2 border"
            style={{
              color: 'var(--color-red)',
              backgroundColor: 'var(--color-red-subtle)',
              borderColor: 'var(--color-red-subtle)',
            }}
          >
            <AlertCircle className="size-3.5 shrink-0" />
            <span>Loom unreachable: {error}</span>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      <ChatInput ref={chatInputRef} onSubmit={handlePrompt} />
    </div>
  )
}
