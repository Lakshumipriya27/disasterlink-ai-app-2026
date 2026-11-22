export function timeAgo(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  const s = Math.round((Date.now() - d.getTime()) / 1000)
  if (s < 45) return 'just now'
  if (s < 3600) return `${Math.round(s / 60)} min ago`
  if (s < 86400) return `${Math.round(s / 3600)} h ago`
  return `${Math.round(s / 86400)} d ago`
}
export const fmtDate = (iso) => (iso ? new Date(iso).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : '—')
export const fmtNum = (n) => (n === null || n === undefined ? '—' : Number(n).toLocaleString())
export const pct = (x) => (x === null || x === undefined ? '—' : `${Math.round(x * 100)}%`)
export const bytes = (b) => (b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.round(b / 1024)} KB`)
