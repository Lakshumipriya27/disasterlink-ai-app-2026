// Fetch wrapper with timeout, JWT auth, consistent errors and IndexedDB response caching.
import { useCallback, useEffect, useRef, useState } from 'react'
import { cacheGet, cacheSet } from './db'

export const API_BASE = import.meta.env.VITE_API_URL || ''
let authToken = null
export const setAuthToken = (t) => { authToken = t }
let onUnauthorized = () => {}
export const setUnauthorizedHandler = (fn) => { onUnauthorized = fn }

export class ApiError extends Error {
  constructor(message, status = 0, data = null) { super(message); this.status = status; this.data = data }
  get isNetwork() { return this.status === 0 }
}

export async function api(path, { method = 'GET', body, form, timeout = 15000, auth = true, signal } = {}) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeout)
  if (signal) signal.addEventListener('abort', () => ctrl.abort())
  const headers = {}
  if (auth && authToken) headers.Authorization = `Bearer ${authToken}`
  let payload
  if (form) payload = form
  else if (body !== undefined) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body) }
  let res
  try {
    res = await fetch(API_BASE + path, { method, headers, body: payload, signal: ctrl.signal })
  } catch (e) {
    throw new ApiError(navigator.onLine ? 'Cannot reach the server. Check that the backend is running.' : 'You are offline.', 0)
  } finally {
    clearTimeout(timer)
  }
  let data = null
  const ct = res.headers.get('content-type') || ''
  // A dev/preview proxy answers 500/502/503/504 with a non-JSON body when the backend is down:
  // treat that as "server unreachable" (status 0) rather than an application error.
  if (!res.ok && res.status >= 500 && !ct.includes('application/json')) {
    throw new ApiError('Cannot reach the server. Check that the backend is running.', 0)
  }
  if (ct.includes('application/json')) data = await res.json().catch(() => null)
  if (!res.ok) {
    if (res.status === 401 && auth && authToken) onUnauthorized()
    const msg = typeof data?.detail === 'string' ? data.detail : `Request failed (${res.status})`
    throw new ApiError(msg, res.status, data)
  }
  return data
}

export async function apiBlob(path) {
  const res = await fetch(API_BASE + path, { headers: authToken ? { Authorization: `Bearer ${authToken}` } : {} })
  if (!res.ok) throw new ApiError(`Download failed (${res.status})`, res.status)
  return res.blob()
}

/**
 * Data hook. With `cache: true` successful responses are stored in IndexedDB; if the network fails the
 * last saved copy is returned with fromCache=true so the UI can clearly label it as cached data.
 */
export function useApi(path, { cache = false, deps = [], skip = false } = {}) {
  const [state, setState] = useState({ data: null, loading: !skip, error: null, fromCache: false, savedAt: null })
  const mounted = useRef(true)
  useEffect(() => () => { mounted.current = false }, [])

  const load = useCallback(async (silent = false) => {
    if (skip || !path) return
    if (!silent) setState((s) => ({ ...s, loading: true, error: null }))
    try {
      const data = await api(path)
      if (cache) cacheSet(path, data).catch(() => {})
      if (mounted.current) setState({ data, loading: false, error: null, fromCache: false, savedAt: null })
    } catch (err) {
      if (cache && err.isNetwork) {
        const c = await cacheGet(path).catch(() => null)
        if (c && mounted.current) {
          setState({ data: c.data, loading: false, error: null, fromCache: true, savedAt: c.saved_at })
          return
        }
      }
      if (mounted.current) setState((s) => ({ ...s, loading: false, error: err }))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, skip, ...deps])

  useEffect(() => { load() }, [load])
  return { ...state, reload: load, setData: (fn) => setState((s) => ({ ...s, data: typeof fn === 'function' ? fn(s.data) : fn })) }
}
