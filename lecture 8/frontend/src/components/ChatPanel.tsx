/**
 * Chat drawer, bottom-right. Sol answers questions about courses and
 * faculty by calling POST /api/chat on the FastAPI backend.
 *
 * The backend saves every message to the chats table for the signed-in
 * user, so the drawer reloads that history on mount and a returning
 * student picks up where they left off.
 *
 * Shows a spinner while the agent thinks and lists `tools_used` under each
 * reply, exactly as the backend reports them — the panel never guesses
 * which tools ran.
 */

import { useEffect, useRef, useState } from 'react'
import { clearChatHistory, fetchChatHistory, sendChat, type User } from '../api'
import type { ChatMessage } from '../types'
import Mascot from './Mascot'
import ReplyText from './ReplyText'

const SUGGESTIONS = [
  'Who teaches MGT 409?',
  'How many core courses are there?',
  'What are some good AI courses?',
]

function greeting(name: string): ChatMessage {
  const first = name.split(/\s+/)[0]
  return {
    role: 'assistant',
    text: `Hey ${first} — I'm Sol, your course guide. Ask me about any course, who teaches it, when it meets, or what to take.`,
  }
}

export default function ChatPanel({ user }: { user: User }) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>(() => [greeting(user.name)])
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [historyState, setHistoryState] = useState<'loading' | 'ready' | 'failed'>('loading')

  // Restore this student's saved conversation.
  useEffect(() => {
    let live = true
    fetchChatHistory()
      .then((saved) => {
        if (!live) return
        setMessages([
          greeting(user.name),
          ...saved.map((m) => ({
            role: m.role,
            text: m.text,
            toolsUsed: m.tools_used,
            error: m.error,
          })),
        ])
        setHistoryState('ready')
      })
      .catch(() => live && setHistoryState('failed'))
    return () => {
      live = false
    }
  }, [user])

  const savedCount = messages.length - 1

  async function clearHistory() {
    if (busy || !window.confirm('Delete your saved chat with Sol?')) return
    try {
      await clearChatHistory()
      setMessages([greeting(user.name)])
    } catch {
      /* 401 already signs out; anything else leaves the log as-is */
    }
  }
  const logRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Keep the newest message in view.
  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, busy])

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  async function ask(text: string) {
    const message = text.trim()
    if (!message || busy) return

    setMessages((m) => [...m, { role: 'user', text: message }])
    setDraft('')
    setBusy(true)

    try {
      const res = await sendChat(message)
      setMessages((m) => [
        ...m,
        { role: 'assistant', text: res.reply, toolsUsed: res.tools_used },
      ])
    } catch (err) {
      setMessages((m) => [
        ...m,
        {
          role: 'assistant',
          text:
            err instanceof TypeError
              ? "Couldn't reach the backend. Is uvicorn running on port 8000?"
              : `Sol couldn't answer (${err instanceof Error ? err.message : 'unknown error'}). Try again.`,
          error: true,
        },
      ])
    } finally {
      setBusy(false)
      inputRef.current?.focus()
    }
  }

  if (!open) {
    return (
      <button type="button" className="chat-launch" onClick={() => setOpen(true)}>
        <Mascot variant="avatar" waving={false} />
        Ask Sol
        {savedCount > 0 && <span className="chat-launch-count">{savedCount}</span>}
      </button>
    )
  }

  return (
    <aside className="chat-drawer" aria-label="Ask Sol about courses">
      <header className="chat-head">
        <Mascot variant="avatar" waving={false} />
        <div>
          <div className="chat-head-name">Sol</div>
          <div className="chat-head-role">
            {historyState === 'loading'
              ? 'Loading your saved chat…'
              : historyState === 'failed'
                ? "Couldn't load saved chat"
                : savedCount > 0
                  ? `${savedCount} saved message${savedCount === 1 ? '' : 's'}`
                  : 'Your course guide'}
          </div>
        </div>
        {savedCount > 0 && (
          <button type="button" className="chat-clear" onClick={clearHistory} disabled={busy}>
            Clear
          </button>
        )}
        <button type="button" className="chat-close" onClick={() => setOpen(false)} aria-label="Close chat">
          ✕
        </button>
      </header>

      <div className="chat-log" ref={logRef} aria-live="polite">
        {messages.map((m, i) => (
          <div key={i} className={`bubble ${m.role}${m.error ? ' error' : ''}`}>
            {m.role === 'assistant' ? <ReplyText text={m.text} /> : m.text}
            {m.toolsUsed && m.toolsUsed.length > 0 && (
              <div className="tools-used">
                <span className="tools-used-label">Tools used</span>
                {m.toolsUsed.map((t) => (
                  <span key={t} className="tool-pill">
                    {t}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
        {busy && (
          <div className="bubble assistant">
            <span className="thinking">
              <span className="spinner" aria-hidden="true" />
              Sol is thinking…
            </span>
          </div>
        )}
      </div>

      {messages.length <= 1 && (
        <div className="chat-suggestions">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              className="suggestion"
              onClick={() => ask(s)}
              disabled={busy}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <form
        className="chat-form"
        onSubmit={(e) => {
          e.preventDefault()
          ask(draft)
        }}
      >
        <input
          ref={inputRef}
          className="chat-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Ask about a course or professor…"
          aria-label="Your question"
          disabled={busy}
        />
        <button type="submit" className="chat-send" disabled={busy || !draft.trim()}>
          Send
        </button>
      </form>
    </aside>
  )
}
