import type { CourseListing } from '../types'
import { formatCredits, formatDays } from '../normalize'
import Creature from './Creature'

/** Core vs Elective drives the card's accent, so type is readable at a glance. */
function accentFor(listing: CourseListing): string {
  if (listing.courseTypes.includes('Core')) return 'var(--cat-2)'
  if (listing.courseTypes.includes('Elective')) return 'var(--cat-1)'
  return 'var(--cat-4)'
}

/** "2 credits" or "2.5–3 credits" when sections differ. */
function creditLabel(credits: number[]): string {
  if (credits.length === 0) return 'Credits TBA'
  if (credits.length === 1) {
    return `${formatCredits(credits[0])} credit${credits[0] === 1 ? '' : 's'}`
  }
  return `${formatCredits(credits[0])}–${formatCredits(credits[credits.length - 1])} credits`
}

/** Meeting pattern when unambiguous, otherwise how many sections there are. */
function meetingLabel(listing: CourseListing): string {
  const scheduled = listing.sections.filter((s) => s.days.length > 0)
  if (scheduled.length === 0) return 'Time TBA'

  const patterns = new Set(scheduled.map((s) => `${formatDays(s.days)} · ${s.timeRange}`))
  if (patterns.size === 1) return [...patterns][0]
  return `${patterns.size} meeting times`
}

interface Props {
  listing: CourseListing
  onOpen: (listing: CourseListing) => void
}

export default function CourseCard({ listing, onOpen }: Props) {
  const sectionCount = listing.sections.length

  return (
    <button
      type="button"
      className="card"
      style={{ ['--card-accent' as string]: accentFor(listing) }}
      onClick={() => onOpen(listing)}
      aria-label={`${listing.number} ${listing.title}. View details.`}
    >
      <div className="card-head">
        <Creature seed={listing.key} className="card-creature" size={46} />
        <div className="card-head-text">
          <span className="card-number">{listing.number || 'No number'}</span>
          <h3 className="card-title">{listing.title || 'Untitled course'}</h3>
        </div>
      </div>

      {/* Faculty can differ by section — list all, don't pick one. */}
      <span className="card-faculty">
        {listing.faculty.length > 0 ? listing.faculty.join(' · ') : 'Faculty not listed'}
      </span>

      {listing.blurb && <p className="card-blurb">{listing.blurb}</p>}

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

      <div className="card-meta">
        <span>{creditLabel(listing.credits)}</span>
        {listing.semesters.length > 0 && <span>{listing.semesters.join(' / ')}</span>}
        <span>{meetingLabel(listing)}</span>
        {sectionCount > 1 && <span className="card-sections">{sectionCount} sections</span>}
      </div>
    </button>
  )
}
