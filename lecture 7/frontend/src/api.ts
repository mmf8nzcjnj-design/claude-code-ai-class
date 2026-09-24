/** Calls to the FastAPI backend. CORS is open in main.py, so direct fetch works. */

import type { RawCourse } from './types'

const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://127.0.0.1:8000'

export interface CoursesResponse {
  count: number
  courses: RawCourse[]
}

export interface ChatResponse {
  reply: string
  tools_used: string[]
}

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`)
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  return (await res.json()) as T
}

/**
 * Fetch the whole catalog once. Filtering happens client-side so the
 * facet counts stay live as you toggle chips; the backend's `?q=` filter
 * exists but would make those counts impossible to compute.
 */
export function fetchCourses(): Promise<CoursesResponse> {
  return getJson<CoursesResponse>('/api/courses')
}

export function fetchHealth(): Promise<{ ok: boolean; courses_file: string }> {
  return getJson('/api/health')
}

export async function sendChat(message: string): Promise<ChatResponse> {
  const res = await fetch(`${API_BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
  })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  return (await res.json()) as ChatResponse
}

export { API_BASE }
