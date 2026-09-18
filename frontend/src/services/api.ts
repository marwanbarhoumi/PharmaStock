import axios from 'axios'

import type { ApiSuccess, AuthResponse, AuthUser } from '@/types/auth'

const TOKEN_KEY = 'pharmastock_access_token'
const USER_KEY = 'pharmastock_auth_user'

const apiBaseUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:5000/api'

export const apiClient = axios.create({
  baseURL: apiBaseUrl,
  headers: {
    'Content-Type': 'application/json',
  },
})

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY)
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

let onUnauthorized: (() => void) | null = null

export function setUnauthorizedHandler(handler: (() => void) | null) {
  onUnauthorized = handler
}

apiClient.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      onUnauthorized?.()
    }
    return Promise.reject(error)
  },
)

export function persistAuth(data: AuthResponse) {
  localStorage.setItem(TOKEN_KEY, data.accessToken)
  localStorage.setItem(USER_KEY, JSON.stringify(data.user))
}

export function clearPersistedAuth() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}

export function getPersistedToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function getPersistedUser(): AuthUser | null {
  const raw = localStorage.getItem(USER_KEY)
  if (!raw) {
    return null
  }

  try {
    return JSON.parse(raw) as AuthUser
  } catch {
    return null
  }
}

export async function registerRequest(payload: {
  firstName: string
  lastName: string
  email: string
  password: string
  phone?: string
}): Promise<AuthResponse> {
  const response = await apiClient.post<ApiSuccess<AuthResponse>>(
    '/auth/register',
    payload,
  )
  return response.data.data
}

export async function loginRequest(payload: {
  email: string
  password: string
}): Promise<AuthResponse> {
  const response = await apiClient.post<ApiSuccess<AuthResponse>>(
    '/auth/login',
    payload,
  )
  return response.data.data
}

export async function meRequest(): Promise<AuthUser> {
  const response = await apiClient.get<ApiSuccess<AuthUser>>('/auth/me')
  return response.data.data
}

export interface HealthResponse {
  success: boolean
  message: string
  database?: string
}

export async function getHealth(): Promise<HealthResponse> {
  const response = await apiClient.get<HealthResponse>('/health')
  return response.data
}
