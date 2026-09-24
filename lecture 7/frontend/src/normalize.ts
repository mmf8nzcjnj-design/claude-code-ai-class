/**
 * Turning raw JSON rows into the shape the UI filters on.
 *
 * The source data does not have "program", "cohort", "semester", or
 * "subject" fields. Each is derived here, and every rule is deliberate —
 * accuracy of the counts shown in the UI depends on these decisions:
 *
 * - `Course Type` is a comma list mixing type and program, and its case is
 *   inconsistent ("core" and "Core", "elective" and "Elective").
 * - A course can belong to several programs, so program counts do NOT sum
 *   to the total course count.
 * - 115 courses carry no program token at all. Those are the general MBA
 *   pool, labeled 'MBA' rather than left blank.
 * - `Course Category` mixes programs (EMBA, PhD, MMS GBS) with subjects
 *   (Finance, Marketing). Only the subjects survive into `subject`.
 * - `Timings Day` is empty for 209 of 234 rows, so days come from
 *   `Daytimes`, which is populated for 170.
 */

import type {
  Course,
  CourseListing,
  CourseType,
  DayCode,
  RawCourse,
  Semester,
} from './types'

/** Program tokens that can appear inside `Course Type`. */
const PROGRAM_TOKENS: Record<string, string> = {
  emba: 'EMBA',
  phd: 'PhD',
  'mms am': 'MMS AM',
  'mms tm': 'MMS TM',
  'mms gbs': 'MMS GBS',
  'mms sr': 'MMS SR',
  mam: 'MAM',
}

/** `Course Category` values that name a program or venue, not a subject. */
const NON_SUBJECT_CATEGORIES = new Set([
  'core',
  'emba',
  'phd',
  'mms am',
  'mms tm',
  'mms gbs',
  'mms sr',
  'mam',
  'gnw',
  'gnam',
])

/** Subject spellings that mean the same thing. */
const SUBJECT_ALIASES: Record<string, string> = {
  'business and the law': 'Business & the Law',
}

const SEMESTER_BY_SESSION: Record<string, Semester> = {
  fall: 'Full term',
  'fall-1': 'First half',
  'fall-2': 'Second half',
}

export const DAY_ORDER: DayCode[] = ['M', 'T', 'W', 'Th', 'F']

export const DAY_LABELS: Record<DayCode, string> = {
  M: 'Mon',
  T: 'Tue',
  W: 'Wed',
  Th: 'Thu',
  F: 'Fri',
}

const clean = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')

/**
 * Faculty emails in the source data are mostly fine, but at least one row
 * (MGT 409) holds the same address twice run together:
 * "tauhid.zaman@yale.edubtauhid.zaman@yale.edu". A raw mailto: on that
 * string is dead, so pull out the first syntactically complete address.
 *
 * Only recovers when the field really is malformed (more than one "@").
 * Anything with a single "@" is passed through untouched — no guessing.
 */
// No trailing \b: in the MGT 409 value the junk character sits flush against
// ".edu" ("...yale.edubtauhid..."), so a word boundary there never matches.
const EMAIL_AT_START =
  /^[\w.+-]+@[\w-]+(?:\.[\w-]+)*?\.(?:edu|com|org|net|gov|io|uk|ca)/i

export function parseEmail(raw: string): { email: string; malformed: boolean } {
  const value = clean(raw)
  if (!value) return { email: '', malformed: false }
  if ((value.match(/@/g)?.length ?? 0) <= 1) return { email: value, malformed: false }

  const match = value.match(EMAIL_AT_START)
  // Recovered the leading address; if the pattern doesn't fit, keep the raw
  // text and let the caller render it as plain text instead of a link.
  return { email: match ? match[0] : value, malformed: true }
}

/**
 * Split `Daytimes` into day codes and a time range.
 * Input looks like "M  W 10:05 AM-11:25 AM" or "Th 1:00 PM-3:55 PM".
 * Days are whitespace-separated tokens before the first digit.
 */
export function parseDaytimes(raw: string): { days: DayCode[]; timeRange: string } {
  const value = clean(raw)
  if (!value) return { days: [], timeRange: '' }

  const firstDigit = value.search(/\d/)
  if (firstDigit < 0) return { days: [], timeRange: '' }

  const dayPart = value.slice(0, firstDigit)
  const timeRange = value.slice(firstDigit).trim()

  const days: DayCode[] = []
  for (const token of dayPart.split(/[\s,/]+/)) {
    const t = token.trim()
    if (!t) continue
    // Check Th before T so "Th" is never read as "T".
    const code = (['Th', 'M', 'T', 'W', 'F'] as DayCode[]).find(
      (d) => d.toLowerCase() === t.toLowerCase(),
    )
    if (code && !days.includes(code)) days.push(code)
  }

  days.sort((a, b) => DAY_ORDER.indexOf(a) - DAY_ORDER.indexOf(b))
  return { days, timeRange }
}

function parseTypeAndPrograms(raw: string): {
  courseType: CourseType | null
  programs: string[]
} {
  const tokens = clean(raw)
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)

  let courseType: CourseType | null = null
  const programs: string[] = []

  for (const token of tokens) {
    const lower = token.toLowerCase()
    if (lower === 'core') {
      courseType = 'Core'
      continue
    }
    if (lower === 'elective') {
      // Don't let an elective tag overwrite a core tag.
      if (courseType === null) courseType = 'Elective'
      continue
    }
    const program = PROGRAM_TOKENS[lower]
    if (program && !programs.includes(program)) programs.push(program)
  }

  // No program token means the general MBA pool.
  if (programs.length === 0) programs.push('MBA')

  return { courseType, programs }
}

function parseSubject(rawCategory: string): string | null {
  const value = clean(rawCategory)
  if (!value) return null
  const lower = value.toLowerCase()
  if (NON_SUBJECT_CATEGORIES.has(lower)) return null
  return SUBJECT_ALIASES[lower] ?? value
}

function parseCredits(raw: string): number | null {
  const value = clean(raw)
  if (!value) return null
  const n = Number.parseFloat(value)
  return Number.isFinite(n) ? n : null
}

export function normalizeCourse(row: RawCourse, index: number): Course {
  const { days, timeRange } = parseDaytimes(row.Daytimes ?? '')
  const { courseType, programs } = parseTypeAndPrograms(row['Course Type'] ?? '')
  const id = clean(row['Course ID'])
  const section = clean(row.Section)

  return {
    key: `${id || 'row'}-${section || index}`,
    id,
    number: clean(row['Course Number']),
    title: clean(row['Course Title']),
    faculty: clean(row['Faculty 1']),
    facultyEmail: parseEmail(row['Faculty 1 Email'] ?? '').email,
    facultyBio: clean(row.faculty_bio),
    description: clean(row['Course Description']),
    section,
    room: clean(row.Room),
    daytimes: clean(row.Daytimes),
    days,
    timeRange,
    credits: parseCredits(row.Units ?? ''),
    courseType,
    programs,
    semester: SEMESTER_BY_SESSION[clean(row['Course Session']).toLowerCase()] ?? null,
    subject: parseSubject(row['Course Category'] ?? ''),
    rawCategory: clean(row['Course Category']),
    syllabus: clean(row.Syllabus) || clean(row['Old Syllabus']),
    bidOrPermission: clean(row['Bid Or Permission']),
  }
}

export function normalizeCourses(rows: RawCourse[]): Course[] {
  return rows.map(normalizeCourse)
}

/** First sentence of a description, capped — the card's one-liner. */
export function summarize(description: string, max = 132): string {
  const text = clean(description).replace(/\s+/g, ' ')
  if (!text) return ''

  // Split on sentence end, but don't be fooled by "e.g." or initials.
  const stop = text.search(/[.!?](?:\s|$)/)
  let out = stop > 0 ? text.slice(0, stop + 1) : text

  if (out.length > max) {
    const cut = out.slice(0, max)
    const lastSpace = cut.lastIndexOf(' ')
    out = `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[,;:\s]+$/, '')}…`
  }
  return out
}

/** Unique values, in first-seen order. */
function uniq<T>(values: T[]): T[] {
  return [...new Set(values)]
}

/**
 * Collapse sections into unique course listings.
 *
 * Key is number + title. Number alone is wrong: MGT 600's 27 rows are 25
 * different Global Network Week destinations. Aggregates are unions, so a
 * listing matches a filter when any of its sections does.
 */
export function groupListings(courses: Course[]): CourseListing[] {
  const groups = new Map<string, Course[]>()
  for (const course of courses) {
    const key = `${course.number}|||${course.title}`
    const bucket = groups.get(key)
    if (bucket) bucket.push(course)
    else groups.set(key, [course])
  }

  const listings: CourseListing[] = []
  for (const [key, sections] of groups) {
    // 14 of the 28 multi-section groups have differing descriptions;
    // keep the fullest one rather than whichever happened to be first.
    const description = sections
      .map((s) => s.description)
      .reduce((longest, d) => (d.length > longest.length ? d : longest), '')
    const facultyBio = sections
      .map((s) => s.facultyBio)
      .reduce((longest, b) => (b.length > longest.length ? b : longest), '')

    listings.push({
      key,
      number: sections[0].number,
      title: sections[0].title,
      sections,
      faculty: uniq(sections.map((s) => s.faculty).filter(Boolean)),
      credits: uniq(
        sections.map((s) => s.credits).filter((c): c is number => c !== null),
      ).sort((a, b) => a - b),
      semesters: uniq(sections.map((s) => s.semester).filter((s): s is Semester => s !== null)),
      courseTypes: uniq(
        sections.map((s) => s.courseType).filter((t): t is CourseType => t !== null),
      ),
      programs: uniq(sections.flatMap((s) => s.programs)),
      subject: sections.map((s) => s.subject).find((s) => s !== null) ?? null,
      blurb: summarize(description),
      description,
      facultyBio,
      syllabus: sections.map((s) => s.syllabus).find(Boolean) ?? '',
      scheduled: sections.some((s) => s.days.length > 0),
    })
  }
  return listings
}

/** Count how many listings carry each value, for the dropdown counts. */
export function countBy<T extends string | number, I>(
  items: I[],
  pick: (item: I) => T[] | T | null,
): Map<T, number> {
  const counts = new Map<T, number>()
  for (const course of items) {
    const value = pick(course)
    if (value === null) continue
    const values = Array.isArray(value) ? value : [value]
    for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1)
  }
  return counts
}

export function formatCredits(credits: number | null): string {
  if (credits === null) return '—'
  return Number.isInteger(credits) ? String(credits) : credits.toFixed(1)
}

/** "1 credit" / "1.5 credits" / "Credits TBA" — used on the cards. */
export function formatCreditsLabel(credits: number | null): string {
  if (credits === null) return 'Credits TBA'
  return `${formatCredits(credits)} credit${credits === 1 ? '' : 's'}`
}

export function formatDays(days: DayCode[]): string {
  if (days.length === 0) return ''
  if (days.length === 5) return 'Mon–Fri'
  return days.map((d) => DAY_LABELS[d]).join(' · ')
}
