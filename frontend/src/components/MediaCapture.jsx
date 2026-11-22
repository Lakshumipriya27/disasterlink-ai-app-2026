import { Mic, Square, Video } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Alert, Button } from './ui'

const MAX_BYTES = 20 * 1024 * 1024

function pickMime(kind) {
  const opts = kind === 'video'
    ? ['video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4']
    : ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg', 'audio/mp4']
  if (typeof MediaRecorder === 'undefined') return null
  return opts.find((m) => MediaRecorder.isTypeSupported?.(m)) || ''
}

/**
 * Transparent, user-controlled recording. Permission is requested only when the user taps Record,
 * a red REC indicator + timer is always visible while recording, and recording stops automatically
 * at maxSeconds or the size limit. Success is reported only if a non-empty file was produced.
 */
export default function MediaCapture({ kind = 'video', maxSeconds = 30, onRecorded, disabled }) {
  const [state, setState] = useState('idle') // idle | requesting | recording | done | error
  const [error, setError] = useState('')
  const [elapsed, setElapsed] = useState(0)
  const [result, setResult] = useState(null)
  const preview = useRef(null)
  const rec = useRef(null)
  const stream = useRef(null)
  const chunks = useRef([])
  const size = useRef(0)
  const timer = useRef(null)
  const started = useRef(0)
  const supported = typeof MediaRecorder !== 'undefined' && !!navigator.mediaDevices?.getUserMedia

  const cleanup = () => {
    clearInterval(timer.current)
    stream.current?.getTracks().forEach((t) => t.stop())
    stream.current = null
  }
  useEffect(() => cleanup, [])

  const start = async () => {
    setError(''); setState('requesting')
    try {
      stream.current = await navigator.mediaDevices.getUserMedia(kind === 'video'
        ? { video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } }, audio: true }
        : { audio: true })
    } catch (e) {
      setState('error')
      setError(e.name === 'NotAllowedError' ? `${kind === 'video' ? 'Camera' : 'Microphone'} permission was denied. Your SOS is still valid without a recording.`
        : `${kind === 'video' ? 'Camera' : 'Microphone'} not available (${e.name}). Your SOS is still valid without a recording.`)
      return
    }
    if (kind === 'video' && preview.current) { preview.current.srcObject = stream.current; preview.current.play().catch(() => {}) }
    const mime = pickMime(kind)
    let r
    try { r = new MediaRecorder(stream.current, mime ? { mimeType: mime, videoBitsPerSecond: 600000, audioBitsPerSecond: 64000 } : undefined) }
    catch (e) { cleanup(); setState('error'); setError(`Recording is not supported in this browser (${e.message}).`); return }
    chunks.current = []; size.current = 0
    r.ondataavailable = (e) => {
      if (e.data && e.data.size) {
        chunks.current.push(e.data); size.current += e.data.size
        if (size.current >= MAX_BYTES && r.state === 'recording') r.stop()
      }
    }
    r.onstop = () => {
      const duration = Math.round((Date.now() - started.current) / 100) / 10
      cleanup()
      const type = r.mimeType || mime || (kind === 'video' ? 'video/webm' : 'audio/webm')
      const blob = new Blob(chunks.current, { type: type.split(';')[0] })
      if (!blob.size) { setState('error'); setError('The recording produced no data and was not saved.'); return }
      setResult({ blob, duration, url: URL.createObjectURL(blob) })
      setState('done')
      onRecorded?.(blob, duration, blob.type)
    }
    r.onerror = (e) => { cleanup(); setState('error'); setError(`Recording failed: ${e.error?.name || 'unknown error'}`) }
    rec.current = r
    r.start(1000)
    started.current = Date.now()
    setElapsed(0); setState('recording')
    timer.current = setInterval(() => {
      const s = Math.floor((Date.now() - started.current) / 1000)
      setElapsed(s)
      if (s >= maxSeconds && r.state === 'recording') r.stop()
    }, 250)
  }

  const stop = () => { if (rec.current?.state === 'recording') rec.current.stop() }
  const Icon = kind === 'video' ? Video : Mic

  if (!supported) return <Alert tone="gray">Recording is not supported in this browser. You can still send a silent SOS.</Alert>

  return (
    <div className="rounded-xl border border-slate-200 p-4 space-y-3">
      {kind === 'video' && (state === 'recording' || state === 'requesting') && (
        <video ref={preview} muted playsInline className="w-full max-h-64 rounded-lg bg-slate-900 object-cover" aria-label="Camera preview" />
      )}
      {state === 'recording' && (
        <div className="flex items-center justify-between rounded-lg bg-red-50 border border-red-200 px-3 py-2" role="status" aria-live="assertive">
          <span className="flex items-center gap-2 text-red-700 font-semibold text-sm">
            <span className="w-3 h-3 rounded-full bg-red-600 animate-pulse" /> REC {kind === 'video' ? 'camera + microphone' : 'microphone'}
          </span>
          <span className="tabular-nums text-sm text-red-700">{elapsed}s / {maxSeconds}s</span>
        </div>
      )}
      {state === 'recording' ? (
        <Button variant="danger" size="lg" icon={Square} onClick={stop} className="w-full">Stop recording</Button>
      ) : (
        <Button variant="secondary" size="lg" icon={Icon} onClick={start} loading={state === 'requesting'} disabled={disabled} className="w-full">
          {state === 'done' ? `Record new ${kind}` : `Record ${kind} (max ${maxSeconds}s)`}
        </Button>
      )}
      {state === 'done' && result && (
        <div className="space-y-2">
          {kind === 'video' ? <video src={result.url} controls className="w-full max-h-56 rounded-lg bg-slate-900" />
            : <audio src={result.url} controls className="w-full" />}
          <p className="text-xs text-emerald-700">Recorded {result.duration}s ({Math.round(result.blob.size / 1024)} KB). Saved on this device; upload status is shown below.</p>
        </div>
      )}
      {error && <Alert tone="orange">{error}</Alert>}
      <p className="text-[11px] text-slate-500">Recording starts only when you tap the button and is always shown on screen. Limit {maxSeconds}s / 20 MB.</p>
    </div>
  )
}
