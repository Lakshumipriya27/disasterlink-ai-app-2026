import { AlertTriangle, CloudOff, Loader2, RefreshCw, Wifi } from 'lucide-react'
import { useSync } from '../lib/sync.jsx'
import { timeAgo } from '../lib/format'
import { cx } from './ui'

export function ConnectivityPill({ showSync = true, compact = false }) {
  const s = useSync()
  const map = {
    online: { icon: Wifi, text: 'Online', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
    offline: { icon: CloudOff, text: 'Offline', cls: 'bg-slate-100 text-slate-700 ring-slate-300' },
    syncing: { icon: Loader2, text: 'Synchronizing', cls: 'bg-blue-50 text-blue-700 ring-blue-200', spin: true },
    failed: { icon: AlertTriangle, text: s.backend === false && s.online ? 'Server unreachable' : 'Sync failed', cls: 'bg-orange-50 text-orange-700 ring-orange-200' },
  }[s.status]
  const Icon = map.icon
  return (
    <div className="flex items-center gap-2">
      <span className={cx('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset whitespace-nowrap', map.cls)}
        role="status" aria-live="polite" title={s.lastError || (s.lastSync ? `Last sync ${timeAgo(s.lastSync)}` : '')}>
        <Icon className={cx('w-3.5 h-3.5', map.spin && 'animate-spin')} aria-hidden />
        {map.text}
        {s.pendingCount > 0 && <span className="ml-0.5 rounded-full bg-white/80 px-1.5 text-[10px]">{s.pendingCount} pending</span>}
      </span>
      {showSync && !compact && (
        <button onClick={() => s.syncNow()} disabled={s.syncing || !s.online}
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-40 whitespace-nowrap"
          aria-label="Sync now">
          <RefreshCw className={cx('w-3.5 h-3.5', s.syncing && 'animate-spin')} aria-hidden /> Sync now
        </button>
      )}
    </div>
  )
}
