import { useEffect, useRef, useState } from 'react'
import {
  X,
  FolderPlus,
  CheckCircle,
  ChevronDown,
  Loader2,
  Terminal,
  Globe,
  Wrench,
} from 'lucide-react'
import {
  scaffoldTool,
  createProject,
  refreshProjectDiscovery,
  listTemplates,
} from '../../api/lantern'
import type { LanternTemplate } from '../../api/lantern'
import { cn } from '../../lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

type Kind = 'tool' | 'service' | 'website'
type Step = 'form' | 'creating' | 'done' | 'error'

interface Props {
  onClose: () => void
  onCreated: (name: string) => void
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64)
}

const KIND_ICONS: Record<Kind, React.ReactNode> = {
  tool:    <Wrench className="size-3.5" />,
  service: <Terminal className="size-3.5" />,
  website: <Globe className="size-3.5" />,
}

const KIND_DESC: Record<Kind, string> = {
  tool:    'Script, CLI, or utility',
  service: 'Long-running API or daemon',
  website: 'Web app with a UI',
}

// ─── Component ────────────────────────────────────────────────────────────────

export function NewToolModal({ onClose, onCreated }: Props) {
  // Form state
  const [name, setName] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [description, setDescription] = useState('')
  const [kind, setKind] = useState<Kind>('tool')
  const [template, setTemplate] = useState('')
  const [tagsRaw, setTagsRaw] = useState('')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [customPath, setCustomPath] = useState('')

  // Template options
  const [templates, setTemplates] = useState<LanternTemplate[]>([])

  // Flow state
  const [step, setStep] = useState<Step>('form')
  const [progress, setProgress] = useState<string[]>([])
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [createdPath, setCreatedPath] = useState('')

  const nameRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    nameRef.current?.focus()
    listTemplates().then(setTemplates).catch(() => {})
  }, [])

  // Derived slug
  const slug = slugify(name)
  const resolvedPath = customPath.trim() || `~/tools/${slug}`

  // ── Validation ─────────────────────────────────────────────────────────────

  const nameValid = slug.length >= 2
  const canSubmit = nameValid && step === 'form'

  // ── Submit ─────────────────────────────────────────────────────────────────

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return

    setStep('creating')
    setProgress([])
    setErrorMsg(null)

    const tags = tagsRaw
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)

    try {
      // Step 1: scaffold files
      addProgress('📁 Creating directory and lantern.yaml…')
      const scaffold = await scaffoldTool({
        name: slug,
        displayName: displayName || slug,
        description,
        kind,
        template,
        customPath: customPath.trim() || undefined,
        tags,
      })
      setCreatedPath(scaffold.path)
      addProgress(`✓ Created ${scaffold.path}`)

      // Step 2: register with Lantern
      addProgress('🔗 Registering with Lantern…')
      await createProject({
        name: slug,
        description,
        kind,
        type: template ? undefined : 'proxy',
        path: scaffold.path,
        tags,
      })
      addProgress(`✓ Registered "${slug}" with Lantern`)

      // Step 3: refresh discovery
      addProgress('🔍 Running discovery scan…')
      try {
        await refreshProjectDiscovery(slug)
        addProgress(`✓ Discovery complete`)
      } catch {
        addProgress(`⚠ Discovery skipped (can refresh manually)`)
      }

      setStep('done')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unknown error')
      setStep('error')
    }
  }

  function addProgress(msg: string) {
    setProgress((prev) => [...prev, msg])
  }

  function handleOpenInRegistry() {
    onCreated(slug)
    onClose()
  }

  // ── Keyboard ───────────────────────────────────────────────────────────────

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="relative flex flex-col rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden"
        style={{
          backgroundColor: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          maxHeight: '90vh',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center gap-2.5 px-5 py-4 border-b shrink-0"
          style={{ borderColor: 'var(--color-border)' }}
        >
          <FolderPlus className="size-4" style={{ color: 'var(--color-accent)' }} />
          <h2 className="text-sm font-semibold flex-1" style={{ color: 'var(--color-text-primary)' }}>
            New Tool
          </h2>
          <button
            onClick={onClose}
            className="transition-colors"
            style={{ color: 'var(--color-text-muted)' }}
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1">
          {step === 'form' && (
            <form onSubmit={handleCreate} className="px-5 py-4 space-y-4">
              {/* Name */}
              <Field label="Name" required hint={slug ? `id: ${slug}` : undefined}>
                <input
                  ref={nameRef}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="my-cool-tool"
                  className="input"
                  style={inputStyle}
                  required
                />
              </Field>

              {/* Display name */}
              <Field label="Display name" hint="Optional — defaults to name">
                <input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="My Cool Tool"
                  className="input"
                  style={inputStyle}
                />
              </Field>

              {/* Description */}
              <Field label="Description">
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What does this tool do?"
                  rows={2}
                  style={{ ...inputStyle, resize: 'vertical' }}
                />
              </Field>

              {/* Kind */}
              <Field label="Kind">
                <div className="flex gap-2">
                  {(['tool', 'service', 'website'] as Kind[]).map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setKind(k)}
                      className={cn(
                        'flex-1 flex flex-col items-center gap-1 py-2 px-1 rounded-lg border text-xs transition-colors',
                        kind === k
                          ? 'border-[var(--color-accent)] text-[var(--color-accent)] bg-[var(--color-accent-subtle)]'
                          : 'border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-border-subtle)]'
                      )}
                    >
                      {KIND_ICONS[k]}
                      <span className="capitalize font-medium">{k}</span>
                      <span className="text-[9px] text-center leading-snug opacity-70">
                        {KIND_DESC[k]}
                      </span>
                    </button>
                  ))}
                </div>
              </Field>

              {/* Template */}
              <Field label="Template" hint="Sets run command and type in lantern.yaml">
                <div className="relative">
                  <select
                    value={template}
                    onChange={(e) => setTemplate(e.target.value)}
                    style={{ ...inputStyle, appearance: 'none' }}
                  >
                    <option value="">None (bare)</option>
                    {templates.map((t) => (
                      <option key={t.name} value={t.name}>
                        {t.name} — {t.description}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 size-3.5"
                    style={{ color: 'var(--color-text-muted)' }}
                  />
                </div>
              </Field>

              {/* Tags */}
              <Field label="Tags" hint="Comma-separated">
                <input
                  value={tagsRaw}
                  onChange={(e) => setTagsRaw(e.target.value)}
                  placeholder="api, python, data"
                  style={inputStyle}
                />
              </Field>

              {/* Advanced toggle */}
              <button
                type="button"
                onClick={() => setShowAdvanced((v) => !v)}
                className="text-xs flex items-center gap-1 transition-colors"
                style={{ color: 'var(--color-text-muted)' }}
              >
                <ChevronDown
                  className={cn('size-3 transition-transform', showAdvanced && 'rotate-180')}
                />
                Advanced
              </button>

              {showAdvanced && (
                <Field
                  label="Custom path"
                  hint={`Default: ~/tools/${slug || 'name'}`}
                >
                  <input
                    value={customPath}
                    onChange={(e) => setCustomPath(e.target.value)}
                    placeholder={`~/tools/${slug || 'name'}`}
                    style={inputStyle}
                  />
                </Field>
              )}

              {/* Path preview */}
              {slug && (
                <p className="text-[10px] font-mono px-2 py-1.5 rounded" style={{ backgroundColor: 'var(--color-surface-raised)', color: 'var(--color-text-muted)' }}>
                  {resolvedPath}
                </p>
              )}
            </form>
          )}

          {/* Creating */}
          {(step === 'creating' || step === 'done' || step === 'error') && (
            <div className="px-5 py-4 space-y-3">
              <div className="space-y-1.5">
                {progress.map((msg, i) => (
                  <p key={i} className="text-xs font-mono" style={{ color: 'var(--color-text-secondary)' }}>
                    {msg}
                  </p>
                ))}
                {step === 'creating' && (
                  <div className="flex items-center gap-2 pt-1">
                    <Loader2 className="size-3 animate-spin" style={{ color: 'var(--color-accent)' }} />
                    <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Working…</span>
                  </div>
                )}
              </div>

              {step === 'done' && (
                <div
                  className="flex items-start gap-2 p-3 rounded-lg"
                  style={{ backgroundColor: 'var(--color-green-subtle)' }}
                >
                  <CheckCircle className="size-4 shrink-0 mt-0.5" style={{ color: 'var(--color-green)' }} />
                  <div>
                    <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                      Tool created!
                    </p>
                    <p className="text-[10px] font-mono mt-0.5 break-all" style={{ color: 'var(--color-text-muted)' }}>
                      {createdPath}
                    </p>
                  </div>
                </div>
              )}

              {step === 'error' && (
                <div
                  className="p-3 rounded-lg"
                  style={{ backgroundColor: 'var(--color-red-subtle)', border: '1px solid var(--color-red)' }}
                >
                  <p className="text-xs font-semibold" style={{ color: 'var(--color-red)' }}>
                    Creation failed
                  </p>
                  <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
                    {errorMsg}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-end gap-2 px-5 py-3 border-t shrink-0"
          style={{ borderColor: 'var(--color-border)' }}
        >
          {step === 'form' && (
            <>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-1.5 rounded-md text-xs transition-colors"
                style={{ color: 'var(--color-text-muted)', backgroundColor: 'var(--color-surface-raised)' }}
              >
                Cancel
              </button>
              <button
                type="submit"
                form="" // triggers the form inside the scrollable body
                onClick={(e) => {
                  e.preventDefault()
                  if (canSubmit) {
                    const form = document.querySelector('form')
                    form?.requestSubmit()
                  }
                }}
                disabled={!canSubmit}
                className={cn(
                  'px-4 py-1.5 rounded-md text-xs font-medium transition-opacity flex items-center gap-1.5',
                  !canSubmit && 'opacity-40 cursor-not-allowed'
                )}
                style={{
                  backgroundColor: 'var(--color-accent)',
                  color: '#fff',
                }}
              >
                <FolderPlus className="size-3" />
                Create Tool
              </button>
            </>
          )}

          {step === 'creating' && (
            <button
              disabled
              className="px-4 py-1.5 rounded-md text-xs opacity-50 flex items-center gap-1.5"
              style={{ backgroundColor: 'var(--color-surface-raised)', color: 'var(--color-text-muted)' }}
            >
              <Loader2 className="size-3 animate-spin" />
              Creating…
            </button>
          )}

          {step === 'done' && (
            <>
              <button
                onClick={onClose}
                className="px-4 py-1.5 rounded-md text-xs transition-colors"
                style={{ color: 'var(--color-text-muted)', backgroundColor: 'var(--color-surface-raised)' }}
              >
                Close
              </button>
              <button
                onClick={handleOpenInRegistry}
                className="px-4 py-1.5 rounded-md text-xs font-medium"
                style={{ backgroundColor: 'var(--color-green)', color: '#fff' }}
              >
                Open in Registry →
              </button>
            </>
          )}

          {step === 'error' && (
            <>
              <button
                onClick={onClose}
                className="px-4 py-1.5 rounded-md text-xs"
                style={{ color: 'var(--color-text-muted)', backgroundColor: 'var(--color-surface-raised)' }}
              >
                Close
              </button>
              <button
                onClick={() => { setStep('form'); setErrorMsg(null) }}
                className="px-4 py-1.5 rounded-md text-xs font-medium"
                style={{ backgroundColor: 'var(--color-accent)', color: '#fff' }}
              >
                Try Again
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Field wrapper ────────────────────────────────────────────────────────────

function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string
  hint?: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-baseline gap-2">
        <label className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
          {label}
          {required && <span style={{ color: 'var(--color-red)' }}> *</span>}
        </label>
        {hint && (
          <span className="text-[10px] font-mono" style={{ color: 'var(--color-text-muted)' }}>
            {hint}
          </span>
        )}
      </div>
      {children}
    </div>
  )
}

// ─── Shared styles ────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '6px 10px',
  fontSize: '12px',
  backgroundColor: 'var(--color-surface-raised)',
  border: '1px solid var(--color-border)',
  borderRadius: '6px',
  color: 'var(--color-text-primary)',
  outline: 'none',
  boxSizing: 'border-box',
}
