import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import Markdown from 'react-markdown'
import { fetchHealth, fetchRoster, getPasscode, setPasscode, streamChat } from './api'
import { BOOK_PROPS, Labubu } from './components/Labubu'
import { playSpellComplete, unlockSpellAudio } from './spellSound'
import type { AgentStatus, AgentStep, ChatResult, Delegation, SpecialistMeta, TokenTotals } from './types'
import './App.css'

const SAMPLE =
  'For each Horcrux, when and how is it found or destroyed across the books?'

function latestDelegation(delegations: Delegation[], bookNumber: number): Delegation | null {
  for (let i = delegations.length - 1; i >= 0; i -= 1) {
    if (delegations[i].book_number === bookNumber) return delegations[i]
  }
  return null
}

export default function App() {
  const [bossName, setBossName] = useState('Headmaster Labubledore')
  const [specialists, setSpecialists] = useState<SpecialistMeta[]>([])
  const [message, setMessage] = useState(SAMPLE)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [healthOk, setHealthOk] = useState<boolean | null>(null)
  const [keySet, setKeySet] = useState<boolean | null>(null)
  const [passcodeRequired, setPasscodeRequired] = useState(false)
  const [bossStatus, setBossStatus] = useState<AgentStatus>('idle')
  const [bookStatus, setBookStatus] = useState<Record<number, AgentStatus>>({})
  const [delegations, setDelegations] = useState<Delegation[]>([])
  const [answer, setAnswer] = useState('')
  const [log, setLog] = useState<string[]>([])
  const [opsOpen, setOpsOpen] = useState(true)
  const [pinnedBook, setPinnedBook] = useState<number | null>(null)
  const [steps, setSteps] = useState<AgentStep[]>([])
  const [tokens, setTokens] = useState<TokenTotals | null>(null)

  useEffect(() => {
    fetchRoster()
      .then((r) => {
        setBossName(r.boss)
        setSpecialists(r.specialists)
      })
      .catch(() => {
        setSpecialists(
          [1, 2, 3, 4, 5, 6, 7].map((n) => ({
            book_number: n,
            title: `Book ${n}`,
            short: `Book ${n}`,
            specialty: '',
            accent: '#888',
            house_hint: '',
          })),
        )
      })
    fetchHealth()
      .then((h) => {
        setHealthOk(!!h.ok)
        setKeySet(!!h.portkey_key_set)
        setPasscodeRequired(!!h.passcode_required)
        if (h.boss) setBossName(h.boss)
      })
      .catch(() => setHealthOk(false))
  }, [])

  const rosterReady = useMemo(() => specialists.length > 0, [specialists])
  const opsCount = delegations.length + log.length

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!message.trim() || busy) return
    if (passcodeRequired && !getPasscode()) {
      const code = window.prompt('Enter the class passcode to chat with the Headmaster:')
      if (!code) return
      setPasscode(code.trim())
    }
    // Clear previous run immediately so the old answer / ops don't linger.
    setError(null)
    setAnswer('')
    setDelegations([])
    setLog([])
    setBossStatus('thinking')
    setBookStatus({})
    setPinnedBook(null)
    setSteps([])
    setTokens(null)
    setOpsOpen(true)
    setBusy(true)
    void unlockSpellAudio()

    try {
      const result: ChatResult = await streamChat(message.trim(), (ev) => {
        const d = ev.data || {}
        if (ev.type === 'step') {
          const step = d as unknown as AgentStep
          setSteps((S) => [...S, step])
          setTokens(step.totals)
        }
        if (ev.type === 'boss_thinking') {
          setBossStatus('thinking')
          setLog((L) => [...L, `${bossName} is thinking…`])
        }
        if (ev.type === 'specialist_started') {
          const n = Number(d.book_number)
          setBookStatus((s) => ({ ...s, [n]: 'thinking' }))
          setDelegations((prev) => {
            const next = [...prev]
            next.push({
              agent: String(d.agent || `Book ${n}`),
              book_number: n,
              book_title: String(d.book_title || ''),
              question: String(d.question || ''),
              reply: '',
              status: 'running',
            })
            return next
          })
          setLog((L) => [...L, `Calling Book ${n} Labubu…`])
        }
        if (ev.type === 'specialist_done') {
          const n = Number(d.book_number)
          const st = d.status === 'error' ? 'error' : 'done'
          setBookStatus((s) => ({ ...s, [n]: st as AgentStatus }))
          setDelegations((prev) => {
            const idx = typeof d.index === 'number' ? d.index : prev.findIndex((x) => x.book_number === n && !x.reply)
            if (idx < 0) return prev
            const copy = [...prev]
            copy[idx] = {
              ...copy[idx],
              reply: String(d.reply || ''),
              status: (d.status as Delegation['status']) || 'done',
            }
            return copy
          })
          setLog((L) => [...L, `Book ${n} Labubu finished.`])
        }
        if (ev.type === 'final' || ev.type === 'error') {
          setBossStatus(ev.type === 'error' ? 'error' : 'done')
        }
      })
      setAnswer(result.answer)
      setDelegations(result.delegations)
      setBossStatus('done')
      const doneMap: Record<number, AgentStatus> = {}
      for (const d of result.delegations) {
        doneMap[d.book_number] = d.status === 'error' ? 'error' : 'done'
      }
      setBookStatus(doneMap)
      void playSpellComplete()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setBossStatus('error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="app">
      <header className="hero">
        <p className="eyebrow">MGT 409 · Lecture 10 demo</p>
        <h1>{bossName}</h1>
        <p className="tagline">
          Chat with the Headmaster Labubu. He dispatches one specialist Labubu per Harry Potter book —
          with live thinking lights and a structured delegation report.
        </p>
        <div className="status-row">
          <span className={healthOk ? 'pill ok' : 'pill bad'}>
            API {healthOk === null ? '…' : healthOk ? 'up' : 'down'}
          </span>
          {tokens && (
            <span className="pill ok">
              Tokens {tokens.total_tokens.toLocaleString()}
            </span>
          )}
          <span className={keySet ? 'pill ok' : 'pill warn'}>
            Portkey {keySet === null ? '…' : keySet ? 'key set' : 'key missing'}
          </span>
        </div>
      </header>

      <section className="cast" aria-label="Agent cast">
        <Labubu
          variant="boss"
          label={bossName}
          sublabel="Boss · click books for ask/reply"
          accent="#ff4da6"
          status={bossStatus}
          badge="★"
        />
        <div className="cast-books">
          {rosterReady &&
            specialists.map((b) => {
              const del = latestDelegation(delegations, b.book_number)
              return (
                <Labubu
                  key={b.book_number}
                  label={`Book ${b.book_number}`}
                  sublabel={b.short || b.title}
                  accent={b.accent}
                  status={bookStatus[b.book_number] || 'idle'}
                  badge={String(b.book_number)}
                  propEmoji={BOOK_PROPS[b.book_number]}
                  delegation={del}
                  tooltipOpen={pinnedBook === b.book_number}
                  onSelect={() => {
                    if (!del) return
                    setPinnedBook((cur) => (cur === b.book_number ? null : b.book_number))
                  }}
                />
              )
            })}
        </div>
      </section>

      <main className="workspace">
        <form className="chat" onSubmit={onSubmit}>
          <label htmlFor="q">Ask the Headmaster</label>
          <textarea
            id="q"
            rows={3}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            disabled={busy}
            placeholder="Ask a cross-book question…"
          />
          <div className="chat-actions">
            <button type="submit" disabled={busy || !message.trim()}>
              {busy ? 'Consulting the castle…' : 'Send to Labubledore'}
            </button>
            <button
              type="button"
              className="ghost"
              disabled={busy}
              onClick={() => setMessage(SAMPLE)}
            >
              Load Horcrux sample
            </button>
          </div>
        </form>

        {!busy && (error || answer) && (
          <section className="answer panel answer-pop" aria-live="polite">
            <h2>Final answer</h2>
            {error && <p className="error">{error}</p>}
            {!error && answer && (
              <div className="answer-body markdown" key={answer.slice(0, 48)}>
                <Markdown>{answer}</Markdown>
              </div>
            )}
          </section>
        )}

        <section className="panel ops-card">
          <button
            type="button"
            className="ops-toggle"
            aria-expanded={opsOpen}
            onClick={() => setOpsOpen((o) => !o)}
          >
            <span>
              Live ops
              <span className="ops-count">{opsCount ? `${steps.length} steps · ${delegations.length} calls · ${log.length} log` : 'idle'}</span>
            </span>
            <span className="ops-chevron" aria-hidden>
              {opsOpen ? '▾' : '▸'}
            </span>
          </button>

          {opsOpen && (
            <div className="ops-body">
              <div className="ops-section steps-section">
                <h3>
                  Agent steps
                  {tokens && (
                    <span className="token-tally">
                      {tokens.input_tokens.toLocaleString()} in · {tokens.output_tokens.toLocaleString()} out ·{' '}
                      {tokens.requests} model calls
                    </span>
                  )}
                </h3>
                <ol className="steps" ref={(el) => el?.scrollTo({ top: el.scrollHeight })}>
                  {steps.length === 0 && <li className="muted">Every model call, tool call and result will stream here…</li>}
                  {steps.map((s) => (
                    <li key={s.seq} className={`step ${s.kind}`}>
                      <span className="step-t">{s.t.toFixed(1)}s</span>
                      <span className="step-agent">{s.agent}</span>
                      <span className="step-kind">{s.kind.replace('_', ' ')}</span>
                      <span className="step-summary">{s.summary}</span>
                      <span className="step-tokens">
                        {s.input_tokens || s.output_tokens
                          ? `+${s.input_tokens.toLocaleString()} / +${s.output_tokens.toLocaleString()}`
                          : ''}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
              <div className="ops-section">
                <h3>Live log</h3>
                <ul className="log">
                  {log.length === 0 && <li className="muted">Waiting for a question…</li>}
                  {log.map((line, i) => (
                    <li key={`${i}-${line}`}>{line}</li>
                  ))}
                </ul>
              </div>
              <div className="ops-section">
                <h3>Delegations</h3>
                {delegations.length === 0 && <p className="muted">No specialists called yet.</p>}
                {delegations.map((d, i) => (
                  <article key={`${d.book_number}-${i}`} className={`delegation ${d.status}`}>
                    <header>
                      <strong>{d.agent}</strong>
                      <span>{d.status}</span>
                    </header>
                    <p>
                      <em>Asked:</em> {d.question}
                    </p>
                    {d.reply && (
                      <p>
                        <em>Replied:</em> {d.reply}
                      </p>
                    )}
                  </article>
                ))}
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
