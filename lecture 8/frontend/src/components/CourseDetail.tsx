/**
 * Course detail sheet for one unique listing.
 *
 * Every field renders only if the data has it — no placeholder times,
 * rooms, or faculty are ever invented. Multi-section courses list each
 * section separately, since day, time, room, and instructor vary.
 */

import { useEffect, useRef } from 'react'
import type { CourseListing } from '../types'
import { formatCredits, formatDays } from '../normalize'
import Creature from './Creature'

interface Props {
  listing: CourseListing
  onClose: () => void
}

function Spec({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="spec-label">{label}</div>
      <div className="spec-value">{value}</div>
    </div>
  )
}

export default function CourseDetail({ listing, onClose }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onClose])

  const credits =
    listing.credits.length === 0
      ? '—'
      : listing.credits.map((c) => formatCredits(c)).join(' / ')

  // One email per instructor, de-duplicated across sections.
  const contacts = [
    ...new Map(
      listing.sections
        .filter((s) => s.facultyEmail)
        .map((s) => [s.facultyEmail, { name: s.faculty, email: s.facultyEmail }]),
    ).values(),
  ]

  return (
    <div
      className="overlay"
      role="dialog"
      aria-modal="true"
      aria-label={`${listing.number} ${listing.title}`}
      onClick={onClose}
    >
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <button ref={closeRef} type="button" className="sheet-close" onClick={onClose} aria-label="Close">
          ✕
        </button>

        <div className="sheet-head">
          <Creature seed={listing.key} size={64} className="sheet-creature" />
          <div>
            <span className="sheet-number">{listing.number || 'No number'}</span>
            <h2>{listing.title || 'Untitled course'}</h2>
          </div>
        </div>

        <div className="tag-row">
          {listing.courseTypes.map((t) => (
            <span
              key={t}
              className="tag"
              style={{ ['--tag-color' as string]: t === 'Core' ? 'var(--cat-2)' : 'var(--cat-1)' }}
            >
              {t}
            </span>
          ))}
          {listing.programs.map((p) => (
            <span key={p} className="tag" style={{ ['--tag-color' as string]: 'var(--cat-4)' }}>
              {p}
            </span>
          ))}
          {listing.subject && (
            <span className="tag" style={{ ['--tag-color' as string]: 'var(--cat-3)' }}>
              {listing.subject}
            </span>
          )}
        </div>

        <div className="spec-grid">
          <Spec
            label={listing.faculty.length > 1 ? 'Faculty' : 'Instructor'}
            value={listing.faculty.join(', ') || '—'}
          />
          <Spec label="Credits" value={credits} />
          <Spec label="Semester" value={listing.semesters.join(' / ') || '—'} />
          <Spec label="Sections" value={String(listing.sections.length)} />
        </div>

        {/* Sections differ in day, time, room, and sometimes instructor. */}
        <div className="sheet-section">
          <h3>{listing.sections.length > 1 ? 'Sections' : 'Meeting'}</h3>
          <ul className="section-list">
            {listing.sections.map((s) => {
              const days = formatDays(s.days)
              return (
                <li key={s.key}>
                  <span className="sec-id">{s.section ? `§${s.section}` : '§—'}</span>
                  <span className="sec-when">
                    {days ? `${days} · ${s.timeRange}` : 'Time TBA'}
                  </span>
                  <span className="sec-where">{s.room || 'Room TBA'}</span>
                  {listing.faculty.length > 1 && <span className="sec-who">{s.faculty || '—'}</span>}
                  {listing.semesters.length > 1 && s.semester && (
                    <span className="sec-term">{s.semester}</span>
                  )}
                </li>
              )
            })}
          </ul>
        </div>

        {listing.description && (
          <div className="sheet-section">
            <h3>Description</h3>
            <p>{listing.description}</p>
          </div>
        )}

        {listing.facultyBio && (
          <div className="sheet-section">
            <h3>About {listing.faculty[0] || 'the instructor'}</h3>
            <p>{listing.facultyBio}</p>
          </div>
        )}

        {contacts.length > 0 && (
          <div className="sheet-section">
            <h3>Contact</h3>
            <p>
              {contacts.map((c) => (
                <a key={c.email} className="sheet-link" href={`mailto:${c.email}`} style={{ marginTop: 0, marginRight: '1rem' }}>
                  {c.email}
                </a>
              ))}
            </p>
          </div>
        )}

        {listing.syllabus && (
          <a className="sheet-link" href={listing.syllabus} target="_blank" rel="noreferrer">
            Open syllabus ↗
          </a>
        )}
      </div>
    </div>
  )
}
