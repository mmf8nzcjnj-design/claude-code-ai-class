/**
 * Calls to the FastAPI backend. CORS is open in main.py, so direct fetch works.
 *
 * The sign-in token lives in localStorage and rides along as a bearer
 * header. Any 401 clears it and tells the app to show the sign-in screen.
 */

import type { RawCourse } from './types'

const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://127.0.0.1:8000'
const TOKEN_KEY = 'som-explorer-token'

export interface CoursesResponse {
  count: number
  courses: RawCourse[]
}

export interface ChatResponse {
  reply: string
  tools_used: string[]
}

export interface User {
  id: number
  email: string
  name: string
}

export interface SavedMessage {
  id: number
  role: 'user' | 'assistant'
  text: string
  tools_used: string[]
  error: boolean
  created_at: string
}

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token)
  else localStorage.removeItem(TOKEN_KEY)
}

let onUnauthorized: () => void = () => {}

/** App registers this so an expired token drops back to the sign-in screen. */
export function handleUnauthorized(fn: () => void) {
  onUnauthorized = fn
}

/** FastAPI errors are `{detail: string}` or `{detail: [{msg}]}` for validation. */
async function errorMessage(res: Response): Promise<string> {
  try {
    const body = await res.json()
    if (typeof body.detail === 'string') return body.detail
    if (Array.isArray(body.detail) && body.detail[0]?.msg)
      return String(body.detail[0].msg).replace(/^Value error, /, '')
  } catch {
    /* not JSON */
  }
  return `${res.status} ${res.statusText}`
}

async function request<T>(path: string, init: RequestInit = {}, auth = true): Promise<T> {
  const headers = new Headers(init.headers)
  if (init.body) headers.set('Content-Type', 'application/json')
  const token = getToken()
  if (auth && token) headers.set('Authorization', `Bearer ${token}`)

  const res = await fetch(`${API_BASE}${path}`, { ...init, headers })
  if (!res.ok) {
    const message = await errorMessage(res)
    if (res.status === 401 && auth) {
      setToken(null)
      onUnauthorized()
    }
    throw new ApiError(res.status, message)
  }
  return (res.status === 204 ? undefined : await res.json()) as T
}

/**
 * Fetch the whole catalog once. Filtering happens client-side so the
 * facet counts stay live as you toggle chips; the backend's `?q=` filter
 * exists but would make those counts impossible to compute.
 */
export function fetchCourses(): Promise<CoursesResponse> {
  return request<CoursesResponse>('/api/courses', {}, false)
}

export function fetchHealth(): Promise<{ ok: boolean; database: string }> {
  return request('/api/health', {}, false)
}

async function authenticate(path: string, body: object): Promise<User> {
  const res = await request<{ token: string; user: User }>(
    path,
    { method: 'POST', body: JSON.stringify(body) },
    false,
  )
  setToken(res.token)
  return res.user
}

export function signIn(email: string, password: string): Promise<User> {
  return authenticate('/api/auth/login', { email, password })
}

export function signUp(name: string, email: string, password: string): Promise<User> {
  return authenticate('/api/auth/signup', { name, email, password })
}

export function fetchMe(): Promise<User> {
  return request<User>('/api/auth/me')
}

export function signOut() {
  setToken(null)
}

export function fetchChatHistory(): Promise<SavedMessage[]> {
  return request<SavedMessage[]>('/api/chats')
}

export function clearChatHistory(): Promise<void> {
  return request<void>('/api/chats', { method: 'DELETE' })
}

export function sendChat(message: string): Promise<ChatResponse> {
  return request<ChatResponse>('/api/chat', {
    method: 'POST',
    body: JSON.stringify({ message }),
  })
}

export { API_BASE }
