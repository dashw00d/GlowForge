import { useState, useRef, forwardRef, useImperativeHandle } from 'react'
import { Send, Loader2 } from 'lucide-react'
import { cn } from '../../lib/utils'

export interface ChatInputHandle {
  focus(): void
}

interface Props {
  onSubmit: (prompt: string) => Promise<void>
  disabled?: boolean
}

export const ChatInput = forwardRef<ChatInputHandle, Props>(
  function ChatInput({ onSubmit, disabled }, ref) {
    const [value, setValue] = useState('')
    const [sending, setSending] = useState(false)
    const textareaRef = useRef<HTMLTextAreaElement>(null)

    useImperativeHandle(ref, () => ({
      focus() {
        textareaRef.current?.focus()
        // Move cursor to end
        const el = textareaRef.current
        if (el) {
          const len = el.value.length
          el.setSelectionRange(len, len)
        }
      },
    }))

    async function handleSubmit() {
      const prompt = value.trim()
      if (!prompt || sending || disabled) return
      setSending(true)
      setValue('')
      try {
        await onSubmit(prompt)
      } finally {
        setSending(false)
        textareaRef.current?.focus()
      }
    }

    function handleKeyDown(e: React.KeyboardEvent) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSubmit()
      }
    }

    return (
      <div
        className="border-t px-4 py-3 shrink-0"
        style={{ borderColor: 'var(--color-border)' }}
      >
        <div
          className={cn(
            'flex items-end gap-2 rounded-lg border px-3 py-2 transition-colors',
          )}
          style={{
            borderColor: 'var(--color-border)',
            backgroundColor: 'var(--color-surface-raised)',
          }}
          onFocus={(e) => {
            // highlight border when focused
            const el = e.currentTarget as HTMLDivElement
            el.style.borderColor = 'var(--color-accent)'
          }}
          onBlur={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget)) {
              const el = e.currentTarget as HTMLDivElement
              el.style.borderColor = 'var(--color-border)'
            }
          }}
        >
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask Loom anything… (Enter to send · Shift+Enter for newline)"
            rows={1}
            className={cn(
              'flex-1 bg-transparent resize-none text-sm leading-5',
              'outline-none min-h-[20px] max-h-[160px]',
            )}
            style={{
              color: 'var(--color-text-primary)',
              overflowY: value.split('\n').length > 4 ? 'auto' : 'hidden',
            }}
            disabled={sending || disabled}
          />
          <button
            onClick={handleSubmit}
            disabled={!value.trim() || sending || disabled}
            className="shrink-0 flex items-center justify-center size-7 rounded-md transition-colors"
            style={{
              backgroundColor: value.trim() && !sending && !disabled
                ? 'var(--color-accent)'
                : 'transparent',
              color: value.trim() && !sending && !disabled
                ? 'white'
                : 'var(--color-text-muted)',
              cursor: value.trim() && !sending && !disabled ? 'pointer' : 'not-allowed',
            }}
          >
            {sending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Send className="size-3.5" />
            )}
          </button>
        </div>
        <div className="flex items-center justify-between mt-1 mx-1">
          <p className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
            Loom will plan, dispatch tools, and return results.
          </p>
          <p className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
            <kbd
              className="px-1 py-0.5 rounded text-[9px] font-mono border"
              style={{
                borderColor: 'var(--color-border)',
                backgroundColor: 'var(--color-surface-raised)',
                color: 'var(--color-text-muted)',
              }}
            >
              /
            </kbd>
            {' '}or{' '}
            <kbd
              className="px-1 py-0.5 rounded text-[9px] font-mono border"
              style={{
                borderColor: 'var(--color-border)',
                backgroundColor: 'var(--color-surface-raised)',
                color: 'var(--color-text-muted)',
              }}
            >
              ⌘K
            </kbd>
            {' '}to focus
          </p>
        </div>
      </div>
    )
  }
)
