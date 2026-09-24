import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import AuthScreen from './components/AuthScreen.tsx'
import { fetchMe, getToken, handleUnauthorized, signOut, type User } from './api'

/** Gate: the catalog only renders once someone is signed in. */
function Root() {
  const [user, setUser] = useState<User | null>(null)
  // A stored token means "maybe signed in" until /api/auth/me confirms it.
  const [checking, setChecking] = useState(() => getToken() !== null)

  useEffect(() => {
    handleUnauthorized(() => setUser(null))
    if (!getToken()) return
    fetchMe()
      .then(setUser)
      .catch(() => signOut())
      .finally(() => setChecking(false))
  }, [])

  if (checking) {
    return (
      <main className="auth-shell">
        <span className="thinking">
          <span className="spinner" aria-hidden="true" />
          Checking your sign-in…
        </span>
      </main>
    )
  }
  if (!user) return <AuthScreen onSignedIn={setUser} />
  return (
    <App
      user={user}
      onSignOut={() => {
        signOut()
        setUser(null)
      }}
    />
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
