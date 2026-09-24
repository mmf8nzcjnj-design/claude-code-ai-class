/**
 * Compact filter bar: search + five facet dropdowns + sort, all in one
 * row. Selections appear as removable pills underneath, so the bar never
 * grows past two rows no matter how much you filter.
 *
 * Facet counts are computed against the *other* active filters, so a
 * value's number is what you would actually get by ticking it.
 */

import type { CourseListing, CourseType, Semester } from '../types'
import { formatCredits } from '../normalize'
import FacetDropdown from './FacetDropdown'

export type SortKey = 'number' | 'title' | 'faculty' | 'credits-desc' | 'credits-asc'

export interface FilterState {
  search: string
  types: CourseType[]
  programs: string[]
  semesters: Semester[]
  credits: number[]
  subjects: string[]
  sort: SortKey
}

export const EMPTY_FILTERS: FilterState = {
  search: '',
  types: [],
  programs: [],
  semesters: [],
  credits: [],
  subjects: [],
  sort: 'number',
}

/** Fixed hue order — never cycled, never reassigned when counts change. */
const FACET_COLOR = {
  type: 'var(--cat-1)',
  program: 'var(--cat-4)',
  semester: 'var(--cat-6)',
  credits: 'var(--cat-5)',
  subject: 'var(--cat-3)',
} as const

export interface FacetOptions {
  types: CourseType[]
  programs: string[]
  semesters: Semester[]
  credits: number[]
  subjects: string[]
}

export interface FacetCounts {
  types: Map<CourseType, number>
  programs: Map<string, number>
  semesters: Map<Semester, number>
  credits: Map<number, number>
  subjects: Map<string, number>
}

interface FilterBarProps {
  filters: FilterState
  options: FacetOptions
  counts: FacetCounts
  activeCount: number
  onChange: (next: FilterState) => void
  onClear: () => void
}

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value]
}

/** One removable pill per active selection. */
interface Pill {
  key: string
  label: string
  color: string
  remove: () => void
}

export default function FilterBar({
  filters,
  options,
  counts,
  activeCount,
  onChange,
  onClear,
}: FilterBarProps) {
  const set = <K extends keyof FilterState>(key: K, value: FilterState[K]) =>
    onChange({ ...filters, [key]: value })

  const pills: Pill[] = [
    ...filters.types.map((v) => ({
      key: `type-${v}`,
      label: v,
      color: FACET_COLOR.type,
      remove: () => set('types', toggle(filters.types, v)),
    })),
    ...filters.programs.map((v) => ({
      key: `prog-${v}`,
      label: v,
      color: FACET_COLOR.program,
      remove: () => set('programs', toggle(filters.programs, v)),
    })),
    ...filters.semesters.map((v) => ({
      key: `sem-${v}`,
      label: v,
      color: FACET_COLOR.semester,
      remove: () => set('semesters', toggle(filters.semesters, v)),
    })),
    ...filters.credits.map((v) => ({
      key: `cred-${v}`,
      label: `${formatCredits(v)} credit${v === 1 ? '' : 's'}`,
      color: FACET_COLOR.credits,
      remove: () => set('credits', toggle(filters.credits, v)),
    })),
    ...filters.subjects.map((v) => ({
      key: `subj-${v}`,
      label: v,
      color: FACET_COLOR.subject,
      remove: () => set('subjects', toggle(filters.subjects, v)),
    })),
  ]

  return (
    <section className="filters" aria-label="Filter courses">
      <div className="filters-row">
        <div className="search-wrap">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
            <path d="m16.5 16.5 4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <input
            className="search-input"
            type="search"
            placeholder="Search course, faculty, or description…"
            value={filters.search}
            onChange={(e) => set('search', e.target.value)}
            aria-label="Search courses"
          />
        </div>

        <FacetDropdown
          name="Type"
          color={FACET_COLOR.type}
          values={options.types}
          selected={filters.types}
          counts={counts.types}
          labelOf={(v) => v}
          onToggle={(v) => set('types', toggle(filters.types, v))}
          onClear={() => set('types', [])}
        />
        <FacetDropdown
          name="Program"
          color={FACET_COLOR.program}
          values={options.programs}
          selected={filters.programs}
          counts={counts.programs}
          labelOf={(v) => v}
          onToggle={(v) => set('programs', toggle(filters.programs, v))}
          onClear={() => set('programs', [])}
          note="A course can serve several programs — matches any you pick."
        />
        <FacetDropdown
          name="Semester"
          color={FACET_COLOR.semester}
          values={options.semesters}
          selected={filters.semesters}
          counts={counts.semesters}
          labelOf={(v) => v}
          onToggle={(v) => set('semesters', toggle(filters.semesters, v))}
          onClear={() => set('semesters', [])}
        />
        <FacetDropdown
          name="Credits"
          color={FACET_COLOR.credits}
          values={options.credits}
          selected={filters.credits}
          counts={counts.credits}
          labelOf={(v) => formatCredits(v)}
          onToggle={(v) => set('credits', toggle(filters.credits, v))}
          onClear={() => set('credits', [])}
        />
        <FacetDropdown
          name="Subject"
          color={FACET_COLOR.subject}
          values={options.subjects}
          selected={filters.subjects}
          counts={counts.subjects}
          labelOf={(v) => v}
          onToggle={(v) => set('subjects', toggle(filters.subjects, v))}
          onClear={() => set('subjects', [])}
          note="Only set for courses with a subject category."
        />

        <label className="sr-only" htmlFor="sort">
          Sort courses
        </label>
        <select
          id="sort"
          className="sort-select"
          value={filters.sort}
          onChange={(e) => set('sort', e.target.value as SortKey)}
        >
          <option value="number">Course number</option>
          <option value="title">Title (A–Z)</option>
          <option value="faculty">Faculty (A–Z)</option>
          <option value="credits-desc">Credits (high–low)</option>
          <option value="credits-asc">Credits (low–high)</option>
        </select>
      </div>

      {(pills.length > 0 || filters.search.trim()) && (
        <div className="pills">
          {filters.search.trim() && (
            <button
              type="button"
              className="pill"
              style={{ ['--pill-color' as string]: 'var(--neon-cyan)' }}
              onClick={() => set('search', '')}
            >
              “{filters.search.trim()}” <span aria-hidden="true">✕</span>
            </button>
          )}
          {pills.map((p) => (
            <button
              key={p.key}
              type="button"
              className="pill"
              style={{ ['--pill-color' as string]: p.color }}
              onClick={p.remove}
            >
              {p.label} <span aria-hidden="true">✕</span>
            </button>
          ))}
          <button type="button" className="pill-clear" onClick={onClear} disabled={activeCount === 0}>
            Clear all
          </button>
        </div>
      )}
    </section>
  )
}

/**
 * Does one listing pass the filters? Exported so the dropdown counts and
 * the rendered list can never disagree.
 *
 * A listing matches when ANY of its sections would — so filtering
 * "Second half" keeps a course that runs one section in each half.
 */
export function matches(
  listing: CourseListing,
  f: FilterState,
  skip?: keyof FilterState,
): boolean {
  if (skip !== 'search' && f.search.trim()) {
    const needle = f.search.trim().toLowerCase()
    const haystack = [
      listing.number,
      listing.title,
      listing.faculty.join(' '),
      listing.description,
      listing.subject ?? '',
      listing.facultyBio,
    ]
      .join(' ')
      .toLowerCase()
    if (!haystack.includes(needle)) return false
  }
  if (skip !== 'types' && f.types.length && !listing.courseTypes.some((t) => f.types.includes(t)))
    return false
  if (skip !== 'programs' && f.programs.length && !listing.programs.some((p) => f.programs.includes(p)))
    return false
  if (
    skip !== 'semesters' &&
    f.semesters.length &&
    !listing.semesters.some((s) => f.semesters.includes(s))
  )
    return false
  if (skip !== 'credits' && f.credits.length && !listing.credits.some((c) => f.credits.includes(c)))
    return false
  if (skip !== 'subjects' && f.subjects.length && (!listing.subject || !f.subjects.includes(listing.subject)))
    return false
  return true
}
