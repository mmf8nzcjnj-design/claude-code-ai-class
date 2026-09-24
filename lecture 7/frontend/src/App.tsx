import { useEffect, useMemo, useState } from 'react'
import { fetchCourses } from './api'
import { countBy, groupListings, normalizeCourses } from './normalize'
import type { CourseListing, CourseType, Semester } from './types'
import Mascot from './components/Mascot'
import CourseCard from './components/CourseCard'
import CourseDetail from './components/CourseDetail'
import ChatPanel from './components/ChatPanel'
import FilterBar, {
  EMPTY_FILTERS,
  matches,
  type FacetCounts,
  type FacetOptions,
  type FilterState,
} from './components/FilterBar'

const TYPE_ORDER: CourseType[] = ['Core', 'Elective']
const SEMESTER_ORDER: Semester[] = ['Full term', 'First half', 'Second half']

function compareNumbers(a: string, b: string) {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
}

/** Highest credit value on a listing, for sorting. */
function topCredits(l: CourseListing): number | null {
  return l.credits.length ? l.credits[l.credits.length - 1] : null
}

function sortListings(list: CourseListing[], sort: FilterState['sort']): CourseListing[] {
  const out = [...list]
  switch (sort) {
    case 'title':
      return out.sort((a, b) => a.title.localeCompare(b.title))
    case 'faculty':
      return out.sort((a, b) => (a.faculty[0] ?? '').localeCompare(b.faculty[0] ?? ''))
    case 'credits-desc':
      // Listings with no credit value sort last either way.
      return out.sort((a, b) => (topCredits(b) ?? -Infinity) - (topCredits(a) ?? -Infinity))
    case 'credits-asc':
      return out.sort((a, b) => (topCredits(a) ?? Infinity) - (topCredits(b) ?? Infinity))
    default:
      return out.sort(
        (a, b) => compareNumbers(a.number, b.number) || a.title.localeCompare(b.title),
      )
  }
}

export default function App() {
  const [listings, setListings] = useState<CourseListing[] | null>(null)
  const [sectionCount, setSectionCount] = useState(0)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS)
  const [selected, setSelected] = useState<CourseListing | null>(null)

  useEffect(() => {
    let live = true
    fetchCourses()
      .then((res) => {
        if (!live) return
        const courses = normalizeCourses(res.courses)
        setSectionCount(courses.length)
        setListings(groupListings(courses))
      })
      .catch((err: unknown) => {
        if (live) setLoadError(err instanceof Error ? err.message : 'Unknown error')
      })
    return () => {
      live = false
    }
  }, [])

  const all = listings ?? []

  /** Facet values, derived from every listing so chips never disappear. */
  const options = useMemo<FacetOptions>(() => {
    const typeCounts = countBy(all, (l) => l.courseTypes)
    const programCounts = countBy(all, (l) => l.programs)
    const semesterCounts = countBy(all, (l) => l.semesters)
    const creditCounts = countBy(all, (l) => l.credits)
    const subjectCounts = countBy(all, (l) => l.subject)

    return {
      types: TYPE_ORDER.filter((t) => typeCounts.has(t)),
      // Program order is fixed by overall size, so it never reshuffles.
      programs: [...programCounts.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k),
      semesters: SEMESTER_ORDER.filter((s) => semesterCounts.has(s)),
      credits: [...creditCounts.keys()].sort((a, b) => a - b),
      subjects: [...subjectCounts.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .map(([k]) => k),
    }
  }, [all])

  /**
   * Each facet's counts ignore that facet's own selections, so a value's
   * number is what you'd get by ticking it given everything else.
   */
  const counts = useMemo<FacetCounts>(
    () => ({
      types: countBy(all.filter((l) => matches(l, filters, 'types')), (l) => l.courseTypes),
      programs: countBy(all.filter((l) => matches(l, filters, 'programs')), (l) => l.programs),
      semesters: countBy(all.filter((l) => matches(l, filters, 'semesters')), (l) => l.semesters),
      credits: countBy(all.filter((l) => matches(l, filters, 'credits')), (l) => l.credits),
      subjects: countBy(all.filter((l) => matches(l, filters, 'subjects')), (l) => l.subject),
    }),
    [all, filters],
  )

  const visible = useMemo(
    () => sortListings(all.filter((l) => matches(l, filters)), filters.sort),
    [all, filters],
  )

  const activeCount =
    filters.types.length +
    filters.programs.length +
    filters.semesters.length +
    filters.credits.length +
    filters.subjects.length +
    (filters.search.trim() ? 1 : 0)

  const facultyShown = useMemo(
    () => new Set(visible.flatMap((l) => l.faculty)).size,
    [visible],
  )
  const sectionsShown = useMemo(
    () => visible.reduce((n, l) => n + l.sections.length, 0),
    [visible],
  )
  const scheduledShown = useMemo(() => visible.filter((l) => l.scheduled).length, [visible])

  /** What Sol says, driven by real state — never a canned number. */
  const guide = (() => {
    if (loadError) return "I can't reach the backend right now."
    if (!listings) return 'Pulling the fall catalog…'
    if (visible.length === 0) return 'Nothing matched. Try clearing a filter.'
    if (activeCount === 0)
      return (
        <>
          <strong>{all.length} courses</strong> this fall. Filter above, or ask me anything.
        </>
      )
    return (
      <>
        Narrowed to <strong>{visible.length}</strong> of {all.length}. Click a card for details.
      </>
    )
  })()

  return (
    <div className="shell">
      <header className="masthead">
        <div>
          <p className="masthead-eyebrow">Yale School of Management · Fall</p>
          <h1>
            Course <span className="glow">Explorer</span>
          </h1>
          <p className="sub">
            Browse the full fall catalog, filter by program, type, semester, and credits — or
            ask Sol about any course or professor.
          </p>
        </div>
        <div className="mascot-zone">
          <div className="mascot-bubble">{guide}</div>
          <Mascot className="mascot-figure" />
        </div>
      </header>

      {loadError && (
        <div className="banner">
          <strong>Backend unreachable.</strong> {loadError}. Start it with{' '}
          <code>uvicorn main:app --port 8000</code> from the <code>backend/</code> folder, then
          reload.
        </div>
      )}

      <section className="tiles" aria-label="Catalog summary">
        <div className="tile" style={{ ['--tile-accent' as string]: 'var(--cat-1)' }}>
          <div className="tile-value">{listings ? visible.length : '—'}</div>
          <div className="tile-label">Courses</div>
          <div className="tile-note">{listings ? `of ${all.length} unique` : 'loading…'}</div>
        </div>
        <div className="tile" style={{ ['--tile-accent' as string]: 'var(--cat-6)' }}>
          <div className="tile-value">{listings ? sectionsShown : '—'}</div>
          <div className="tile-label">Sections</div>
          <div className="tile-note">
            {listings ? `${sectionCount} in the catalog` : 'loading…'}
          </div>
        </div>
        <div className="tile" style={{ ['--tile-accent' as string]: 'var(--cat-4)' }}>
          <div className="tile-value">{listings ? facultyShown : '—'}</div>
          <div className="tile-label">Faculty</div>
          <div className="tile-note">named instructors</div>
        </div>
        <div className="tile" style={{ ['--tile-accent' as string]: 'var(--cat-3)' }}>
          <div className="tile-value">{listings ? scheduledShown : '—'}</div>
          <div className="tile-label">Scheduled</div>
          <div className="tile-note">
            {listings ? `${visible.length - scheduledShown} still TBA` : 'loading…'}
          </div>
        </div>
      </section>

      <FilterBar
        filters={filters}
        options={options}
        counts={counts}
        activeCount={activeCount}
        onChange={setFilters}
        onClear={() => setFilters(EMPTY_FILTERS)}
      />

      <div className="results-bar">
        <span className="results-count">
          <strong>{listings ? visible.length : 0}</strong> course
          {visible.length === 1 ? '' : 's'}
          {activeCount > 0 && listings
            ? ` matching ${activeCount} filter${activeCount === 1 ? '' : 's'}`
            : ''}
        </span>
      </div>

      <div className="grid">
        {!listings && !loadError &&
          Array.from({ length: 6 }, (_, i) => <div key={i} className="skeleton" />)}

        {listings && visible.length === 0 && (
          <div className="empty">
            <h3>No courses match</h3>
            <p>Loosen a filter or clear the search to see more of the catalog.</p>
          </div>
        )}

        {visible.map((listing) => (
          <CourseCard key={listing.key} listing={listing} onOpen={setSelected} />
        ))}
      </div>

      {selected && <CourseDetail listing={selected} onClose={() => setSelected(null)} />}
      <ChatPanel />
    </div>
  )
}
