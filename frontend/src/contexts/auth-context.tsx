import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

import {
  clearPersistedAuth,
  getPersistedToken,
  getPersistedUser,
  loginRequest,
  meRequest,
  persistAuth,
  registerRequest,
  setUnauthorizedHandler,
} from '@/services/api'
import type { AuthUser } from '@/types/auth'

interface AuthContextValue {
  user: AuthUser | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (payload: {
    firstName: string
    lastName: string
    email: string
    password: string
    phone?: string
  }) => Promise<void>
  logout: () => void
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => getPersistedUser())
  const [token, setToken] = useState<string | null>(() => getPersistedToken())
  const [isLoading, setIsLoading] = useState(true)

  const logout = useCallback(() => {
    clearPersistedAuth()
    setUser(null)
    setToken(null)
  }, [])

  const refreshUser = useCallback(async () => {
    const currentToken = getPersistedToken()
    if (!currentToken) {
      setUser(null)
      setToken(null)
      return
    }

    const currentUser = await meRequest()
    setUser(currentUser)
    setToken(currentToken)
    localStorage.setItem('pharmastock_auth_user', JSON.stringify(currentUser))
  }, [])

  useEffect(() => {
    setUnauthorizedHandler(() => {
      logout()
    })

    const bootstrap = async () => {
      try {
        if (getPersistedToken()) {
          await refreshUser()
        }
      } catch {
        logout()
      } finally {
        setIsLoading(false)
      }
    }

    void bootstrap()

    return () => {
      setUnauthorizedHandler(null)
    }
  }, [logout, refreshUser])

  const login = useCallback(async (email: string, password: string) => {
    const result = await loginRequest({ email, password })
    persistAuth(result)
    setUser(result.user)
    setToken(result.accessToken)
  }, [])

  const register = useCallback(
    async (payload: {
      firstName: string
      lastName: string
      email: string
      password: string
      phone?: string
    }) => {
      const result = await registerRequest(payload)
      persistAuth(result)
      setUser(result.user)
      setToken(result.accessToken)
    },
    [],
  )

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      isAuthenticated: Boolean(user && token),
      isLoading,
      login,
      register,
      logout,
      refreshUser,
    }),
    [user, token, isLoading, login, register, logout, refreshUser],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
