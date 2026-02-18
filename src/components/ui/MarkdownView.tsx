import { useMemo } from 'react'
import { marked } from 'marked'
import { cn } from '../../lib/utils'

interface Props {
  content: string
  className?: string
}

// Configure marked for clean output
marked.setOptions({ gfm: true, breaks: false })

export function MarkdownView({ content, className }: Props) {
  const html = useMemo(() => {
    try {
      return marked.parse(content) as string
    } catch {
      return `<pre>${content}</pre>`
    }
  }, [content])

  return (
    <div
      className={cn('markdown-body', className)}
      // Content is from local filesystem docs — local dev tool, no XSS risk
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
