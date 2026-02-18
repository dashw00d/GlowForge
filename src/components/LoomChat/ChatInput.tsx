import { useState, useRef } from 'react'
import { Send, Loader2 } from 'lucide-react'
import { cn } from '../../lib/utils'

interface Props {
  onSubmit: (prompt: string) => Promise<void>
  disabled?: boolean
}

export function ChatInput({ onSubmit, disabled }: Props) {
  const [value, setValue] = useState('')
  const [sending, setSending] = useState(false)
  const ref = useRef<HTMLTextAreaElement>(null)

  async function handleSubmit() {
    const prompt = value.trim()
    if (!prompt || sending || disabled) return
    setSending(true)
    setValue('')
    try {
      await onSubmit(prompt)
    } finally {
      setSending(false)
      ref.current?.focus()
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div className="border-t border-[var(--color-border)] px-4 py-3 shrink-0">
      <div
        className={cn(
          'flex items-end gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-raised)] px-3 py-2',
          'focus-within:border-[var(--color-accent)] transition-colors'
        )}
      >
        <textarea
          ref={ref}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask Loom anything... (Enter to send, Shift+Enter for newline)"
          rows={1}
          className={cn(
            'flex-1 bg-transparent resize-none text-sm text-[var(--color-text-primary)]',
            'placeholder-[var(--color-text-muted)] outline-none min-h-[20px] max-h-[160px]',
            'leading-5'
          )}
          style={{ overflowY: value.split('\n').length > 4 ? 'auto' : 'hidden' }}
          disabled={sending || disabled}
        />
        <button
          onClick={handleSubmit}
          disabled={!value.trim() || sending || disabled}
          className={cn(
            'shrink-0 flex items-center justify-center size-7 rounded-md transition-colors',
            value.trim() && !sending && !disabled
              ? 'bg-[var(--color-accent)] text-white hover:opacity-90'
              : 'text-[var(--color-text-muted)] cursor-not-allowed'
          )}
        >
          {sending ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Send className="size-3.5" />
          )}
        </button>
      </div>
      <p className="text-[10px] text-[var(--color-text-muted)] mt-1 ml-1">
        Loom will plan, dispatch tools, and return results.
      </p>
    </div>
  )
}
