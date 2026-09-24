/**
 * Sign-in / create-account screen shown in front of the catalog.
 * One form, two modes; the backend does the real validation and its
 * messages ("Wrong email or password.") are shown as-is.
 */

import { useState } from 'react'
import { signIn, signUp, type User } from '../api'
import Mascot from './Mascot'

type Mode = 'signin' | 'signup'

export default function AuthScreen({ onSignedIn }: { onSignedIn: (user: User) => void }) {
  const [mode, setMode] = useState<Mode>('signin')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const signup = mode === 'signup'

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      const user = signup
        ? await signUp(name.trim(), email.trim(), password)
        : await signIn(email.trim(), password)
      onSignedIn(user)
    } catch (err) {
      setError(
        err instanceof TypeError
          ? "Can't reach the server. Is the backend running?"
          : err instanceof Error
            ? err.message
            : 'Something went wrong.',
      )
    } finally {
      setBusy(false)
    }
  }

  function switchMode(next: Mode) {
    setMode(next)
    setError(null)
  }

  return (
    <main className="auth-shell">
      <section className="auth-card" aria-labelledby="auth-title">
        <div className="auth-brand">
          <Mascot variant="avatar" waving={false} />
          <div>
            <p className="masthead-eyebrow">Yale School of Management · Fall</p>
            <h1 id="auth-title">
              Course <span className="glow">Explorer</span>
            </h1>
          </div>
        </div>
        <p className="auth-sub">
          {signup
            ? 'Create an account so Sol can keep your chats for next time.'
            : 'Sign in to browse the catalog and pick up your chats with Sol.'}
        </p>

        <div className="auth-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={!signup}
            className={`auth-tab${!signup ? ' active' : ''}`}
            onClick={() => switchMode('signin')}
          >
            Sign in
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={signup}
            className={`auth-tab${signup ? ' active' : ''}`}
            onClick={() => switchMode('signup')}
          >
            Create account
          </button>
        </div>

        <form className="auth-form" onSubmit={submit}>
          {signup && (
            <label className="auth-field">
              <span>Name</span>
              <input
                className="chat-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
                required
                maxLength={100}
              />
            </label>
          )}
          <label className="auth-field">
            <span>Email</span>
            <input
              className="chat-input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </label>
          <label className="auth-field">
            <span>Password</span>
            <input
              className="chat-input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={signup ? 'new-password' : 'current-password'}
              minLength={8}
              required
            />
            {signup && <small>At least 8 characters.</small>}
          </label>

          {error && (
            <p className="auth-error" role="alert">
              {error}
            </p>
          )}

          <button type="submit" className="chat-send auth-submit" disabled={busy}>
            {busy ? <span className="spinner" aria-hidden="true" /> : null}
            {signup ? 'Create account' : 'Sign in'}
          </button>
        </form>
      </section>
    </main>
  )
}
