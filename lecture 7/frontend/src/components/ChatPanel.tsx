/**
 * Chat drawer, bottom-right. Sol answers questions about courses and
 * faculty by calling POST /api/chat on the FastAPI backend.
 *
 * Shows a spinner while the agent thinks and lists `tools_used` under each
 * reply, exactly as the backend reports them — the panel never guesses
 * which tools ran.
 */

import { useEffect, useRef, useState } from 'react'
import { sendChat } from '../api'
import type { ChatMessage } from '../types'
import Mascot from './Mascot'

const SUGGESTIONS = [
  'Who teaches MGT 409?',
  'How many core courses are there?',
  'What are some good AI courses?',
]

const GREETING: ChatMessage = {
  role: 'assistant',
  text:
    "Hey — I'm Sol, your course guide. Ask me about any course, who teaches it, when it meets, or what to take.",
}

export default function ChatPanel() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([GREETING])
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
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
            `Couldn't reach the backend (${err instanceof Error ? err.message : 'unknown error'}). ` +
            'Is uvicorn running on port 8000?',
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
      </button>
    )
  }

  return (
    <aside className="chat-drawer" aria-label="Ask Sol about courses">
      <header className="chat-head">
        <Mascot variant="avatar" waving={false} />
        <div>
          <div className="chat-head-name">Sol</div>
          <div className="chat-head-role">Your course guide</div>
        </div>
        <button type="button" className="chat-close" onClick={() => setOpen(false)} aria-label="Close chat">
          ✕
        </button>
      </header>

      <div className="chat-log" ref={logRef} aria-live="polite">
        {messages.map((m, i) => (
          <div key={i} className={`bubble ${m.role}${m.error ? ' error' : ''}`}>
            {m.text}
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
