import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle, CloudOff, Database, Inbox, Loader2, RefreshCw, X } from 'lucide-react'
import { useEffect } from 'react'
import { CATEGORIES, STATUS, URGENCY, label } from '../lib/constants'
import { fmtDate } from '../lib/format'

const cx = (...a) => a.filter(Boolean).join(' ')
export { cx }

export function Card({ title, subtitle, action, children, className = '', bodyClass = 'p-5', icon: Icon }) {
  return (
    <section className={cx('card', className)}>
      {(title || action) && (
        <header className="flex items-start justify-between gap-3 px-5 pt-4 pb-3 border-b border-slate-100">
          <div className="flex items-start gap-2.5 min-w-0">
            {Icon && <Icon className="w-4 h-4 mt-0.5 text-blue-600 shrink-0" aria-hidden />}
            <div className="min-w-0">
              <h3 className="text-[15px] font-semibold text-navy-800 leading-tight">{title}</h3>
              {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
            </div>
          </div>
          {action}
        </header>
      )}
      <div className={bodyClass}>{children}</div>
    </section>
  )
}

const VARIANTS = {
  primary: 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm',
  secondary: 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50',
  danger: 'bg-red-600 text-white hover:bg-red-700 shadow-sm',
  success: 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm',
  ghost: 'text-slate-600 hover:bg-slate-100',
  soft: 'bg-blue-50 text-blue-700 hover:bg-blue-100',
}
const SIZES = { sm: 'px-2.5 py-1.5 text-xs', md: 'px-3.5 py-2 text-sm', lg: 'px-5 py-3 text-base' }

export function Button({ variant = 'primary', size = 'md', icon: Icon, loading, children, className = '', ...props }) {
  return (
    <button
      className={cx('inline-flex items-center justify-center gap-2 rounded-lg font-medium transition disabled:opacity-50 disabled:cursor-not-allowed',
        VARIANTS[variant], SIZES[size], className)}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> : Icon && <Icon className="w-4 h-4" aria-hidden />}
      {children}
    </button>
  )
}

const TONES = {
  gray: 'bg-slate-100 text-slate-700 ring-slate-200', blue: 'bg-blue-50 text-blue-700 ring-blue-200',
  cyan: 'bg-cyan-50 text-cyan-700 ring-cyan-200', orange: 'bg-orange-50 text-orange-700 ring-orange-200',
  red: 'bg-red-50 text-red-700 ring-red-200', green: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  navy: 'bg-navy-50 text-navy-700 ring-navy-100', purple: 'bg-violet-50 text-violet-700 ring-violet-200',
}
export function Badge({ tone = 'gray', children, className = '', dot }) {
  return (
    <span className={cx('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset whitespace-nowrap', TONES[tone], className)}>
      {dot && <span className="w-1.5 h-1.5 rounded-full bg-current" />}
      {children}
    </span>
  )
}
export const UrgencyBadge = ({ level, overridden }) => (
  <Badge tone={URGENCY[level]?.tone || 'gray'} dot>{URGENCY[level]?.label || level}{overridden ? ' *' : ''}</Badge>
)
export const StatusBadge = ({ status }) => <Badge tone={STATUS[status]?.tone || 'gray'}>{label(STATUS, status)}</Badge>
export function CategoryBadge({ category }) {
  const c = CATEGORIES[category] || CATEGORIES.other
  const Icon = c.icon
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700 whitespace-nowrap">
      <span className="w-5 h-5 rounded-md flex items-center justify-center" style={{ background: `${c.color}1a`, color: c.color }}>
        <Icon className="w-3 h-3" aria-hidden />
      </span>
      {c.label}
    </span>
  )
}
export const SimBadge = ({ show = true }) => (show ? <Badge tone="purple">SIMULATED</Badge> : null)

export function StatCard({ label: l, value, icon: Icon, tone = 'blue', hint, onClick }) {
  const toneCls = { blue: 'text-blue-600 bg-blue-50', cyan: 'text-cyan-600 bg-cyan-50', red: 'text-red-600 bg-red-50',
    orange: 'text-orange-600 bg-orange-50', green: 'text-emerald-600 bg-emerald-50', navy: 'text-navy-700 bg-navy-50',
    purple: 'text-violet-600 bg-violet-50', gray: 'text-slate-600 bg-slate-100' }[tone]
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag onClick={onClick} className={cx('card p-4 text-left w-full', onClick && 'hover:shadow-lift transition')}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-slate-500">{l}</p>
        {Icon && <span className={cx('w-8 h-8 rounded-lg flex items-center justify-center', toneCls)}><Icon className="w-4 h-4" aria-hidden /></span>}
      </div>
      <p className="mt-2 text-2xl font-semibold text-navy-800 tabular-nums">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
    </Tag>
  )
}

export function PageHeader({ title, subtitle, actions, children }) {
  return (
    <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 mb-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-navy-800">{title}</h1>
        {subtitle && <p className="text-sm text-slate-500 mt-1 max-w-3xl">{subtitle}</p>}
        {children}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}

export function Field({ label: l, hint, error, children, htmlFor, required }) {
  return (
    <div>
      {l && <label htmlFor={htmlFor} className="label">{l}{required && <span className="text-red-600"> *</span>}</label>}
      {children}
      {hint && !error && <p className="text-xs text-slate-500 mt-1">{hint}</p>}
      {error && <p className="text-xs text-red-600 mt-1" role="alert">{error}</p>}
    </div>
  )
}
export const Input = (p) => <input {...p} className={cx('input', p.className)} />
export const Textarea = (p) => <textarea {...p} className={cx('input', p.className)} />
export const Select = ({ children, ...p }) => <select {...p} className={cx('input pr-8', p.className)}>{children}</select>

export function Check({ checked, onChange, label: l, description, id }) {
  return (
    <label htmlFor={id} className="flex items-start gap-2.5 cursor-pointer select-none">
      <input id={id} type="checkbox" checked={!!checked} onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
      <span>
        <span className="text-sm text-slate-700">{l}</span>
        {description && <span className="block text-xs text-slate-500">{description}</span>}
      </span>
    </label>
  )
}

export function Loading({ label: l = 'Loading…', className = '' }) {
  return (
    <div className={cx('flex items-center justify-center gap-2 py-12 text-sm text-slate-500', className)} role="status">
      <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> {l}
    </div>
  )
}

export function EmptyState({ icon: Icon = Inbox, title, message, action }) {
  return (
    <div className="flex flex-col items-center text-center py-10 px-4">
      <span className="w-11 h-11 rounded-full bg-slate-100 flex items-center justify-center mb-3"><Icon className="w-5 h-5 text-slate-400" aria-hidden /></span>
      <p className="text-sm font-medium text-slate-700">{title}</p>
      {message && <p className="text-xs text-slate-500 mt-1 max-w-sm">{message}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function ErrorState({ error, onRetry }) {
  const offline = error?.isNetwork
  return (
    <div className="card p-6 flex flex-col items-center text-center" role="alert">
      {offline ? <CloudOff className="w-6 h-6 text-orange-500" /> : <AlertTriangle className="w-6 h-6 text-red-500" />}
      <p className="mt-2 text-sm font-medium text-slate-800">{offline ? 'No connection and no cached copy yet' : 'Something went wrong'}</p>
      <p className="text-xs text-slate-500 mt-1 max-w-md">{error?.message || String(error)}</p>
      {onRetry && <Button variant="secondary" size="sm" icon={RefreshCw} className="mt-4" onClick={() => onRetry()}>Try again</Button>}
    </div>
  )
}

export function CachedBanner({ fromCache, savedAt }) {
  if (!fromCache) return null
  return (
    <div className="mb-4 flex items-center gap-2 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-sm text-orange-800" role="status">
      <Database className="w-4 h-4 shrink-0" aria-hidden />
      Showing data cached on this device from {fmtDate(savedAt)}. It may be out of date.
    </div>
  )
}

export function Alert({ tone = 'blue', icon: Icon, title, children, className = '' }) {
  const t = { blue: 'border-blue-200 bg-blue-50 text-blue-900', orange: 'border-orange-200 bg-orange-50 text-orange-900',
    red: 'border-red-200 bg-red-50 text-red-900', green: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    gray: 'border-slate-200 bg-slate-50 text-slate-800' }[tone]
  return (
    <div className={cx('rounded-lg border px-4 py-3 text-sm flex gap-3', t, className)} role={tone === 'red' ? 'alert' : 'status'}>
      {Icon && <Icon className="w-4 h-4 mt-0.5 shrink-0" aria-hidden />}
      <div className="min-w-0">{title && <p className="font-semibold">{title}</p>}<div className={title ? 'mt-0.5' : ''}>{children}</div></div>
    </div>
  )
}

export function Modal({ open, onClose, title, children, footer, wide }) {
  useEffect(() => {
    if (!open) return
    const h = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [open, onClose])
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[1000] flex items-end sm:items-center justify-center bg-slate-900/30 p-0 sm:p-4"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={onClose}>
          <motion.div role="dialog" aria-modal="true" aria-label={title}
            className={cx('bg-white w-full rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[92vh] flex flex-col', wide ? 'sm:max-w-3xl' : 'sm:max-w-lg')}
            initial={{ y: 24, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 24, opacity: 0 }}
            onMouseDown={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h2 className="text-base font-semibold text-navy-800">{title}</h2>
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100" aria-label="Close"><X className="w-4 h-4" /></button>
            </div>
            <div className="px-5 py-4 overflow-y-auto scrollbar-thin">{children}</div>
            {footer && <div className="px-5 py-3 border-t border-slate-100 flex justify-end gap-2">{footer}</div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export function Tabs({ tabs, value, onChange }) {
  return (
    <div className="flex gap-1 border-b border-slate-200 mb-5 overflow-x-auto scrollbar-thin" role="tablist">
      {tabs.map((t) => (
        <button key={t.value} role="tab" aria-selected={value === t.value} onClick={() => onChange(t.value)}
          className={cx('px-3.5 py-2 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition',
            value === t.value ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-800')}>
          {t.label}{t.count !== undefined && <span className="ml-1.5 text-xs text-slate-400">{t.count}</span>}
        </button>
      ))}
    </div>
  )
}

export function Toast({ message, tone = 'green', onClose }) {
  useEffect(() => { if (message) { const t = setTimeout(onClose, 4500); return () => clearTimeout(t) } }, [message, onClose])
  return (
    <AnimatePresence>
      {message && (
        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0 }}
          className={cx('fixed bottom-5 right-5 z-[1100] max-w-sm rounded-lg px-4 py-3 text-sm shadow-lift border',
            tone === 'red' ? 'bg-red-50 border-red-200 text-red-800' : 'bg-white border-emerald-200 text-emerald-800')} role="status">
          {message}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export function KeyValue({ items }) {
  return (
    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
      {items.filter(Boolean).map(([k, v]) => (
        <div key={k}><dt className="text-xs text-slate-500">{k}</dt><dd className="text-slate-800 mt-0.5 break-words">{v ?? '—'}</dd></div>
      ))}
    </dl>
  )
}

export function ProgressBar({ value, tone = 'blue' }) {
  const color = { blue: 'bg-blue-600', red: 'bg-red-500', orange: 'bg-orange-500', green: 'bg-emerald-500', cyan: 'bg-cyan-500' }[tone]
  return (
    <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
      <div className={cx('h-full rounded-full', color)} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  )
}
