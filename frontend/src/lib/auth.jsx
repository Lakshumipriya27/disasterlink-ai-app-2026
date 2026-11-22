import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { api, setAuthToken, setUnauthorizedHandler } from './api'
import { metaDel, metaGet, metaSet } from './db'

const AuthCtx = createContext(null)
export const STAFF = ['admin', 'coordinator']
export const OPERATIONS = ['admin', 'coordinator', 'volunteer']

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [ready, setReady] = useState(false)

  const logoutLocal = useCallback(async () => {
    setAuthToken(null); setUser(null)
    await metaDel('auth').catch(() => {})
  }, [])

  useEffect(() => {
    setUnauthorizedHandler(() => logoutLocal())
    ;(async () => {
      // Token is kept in IndexedDB (localStorage is reserved for UI preferences).
      const saved = await metaGet('auth').catch(() => null)
      if (saved?.token) {
        setAuthToken(saved.token)
        setUser(saved.user)
        try {
          const me = await api('/api/auth/me')
          setUser(me)
          await metaSet('auth', { token: saved.token, user: me })
        } catch (e) {
          if (e.status === 401 || e.status === 403) await logoutLocal() // keep session while offline / server down
        }
      }
      setReady(true)
    })()
  }, [logoutLocal])

  const login = async (username, password) => {
    const res = await api('/api/auth/login', { method: 'POST', body: { username, password }, auth: false })
    setAuthToken(res.access_token)
    setUser(res.user)
    await metaSet('auth', { token: res.access_token, user: res.user })
    return res.user
  }

  const logout = async () => {
    try { await api('/api/auth/logout', { method: 'POST' }) } catch { /* offline logout still clears locally */ }
    await logoutLocal()
  }

  const role = user?.role || null
  const value = {
    user, ready, login, logout, role,
    isStaff: STAFF.includes(role), isOps: OPERATIONS.includes(role), isAdmin: role === 'admin',
  }
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>
}

export const useAuth = () => useContext(AuthCtx)
