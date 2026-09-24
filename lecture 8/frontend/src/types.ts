/** Raw row exactly as it appears in data/yale_som_classes.json. */
export interface RawCourse {
  'Bid Or Permission'?: string
  'Course Category'?: string
  'Course Description'?: string
  'Course ID'?: string
  'Course Number'?: string
  'Course Session'?: string
  'Course Session End Date'?: string
  'Course Session Start date'?: string
  'Course Title'?: string
  'Course Type'?: string
  Daytimes?: string
  'Faculty 1'?: string
  'Faculty 1 Email'?: string
  'Old Syllabus'?: string
  Room?: string
  Section?: string
  Syllabus?: string
  TermCode?: string
  Units?: string
  Visible?: string
  'Timings StartTime'?: string
  'Timings EndTime'?: string
  'Timings Day'?: string
  faculty_bio?: string
}

export type Semester = 'Full term' | 'First half' | 'Second half'
export type CourseType = 'Core' | 'Elective'
export type DayCode = 'M' | 'T' | 'W' | 'Th' | 'F'

/**
 * A course after normalization. Every derived field is documented with
 * where it comes from, because several facets the UI filters on are not
 * fields in the source JSON.
 */
export interface Course {
  /** Stable key. Course ID + section, since IDs repeat across sections. */
  key: string
  id: string
  number: string
  title: string
  faculty: string
  facultyEmail: string
  facultyBio: string
  description: string
  section: string
  room: string
  /** Raw `Daytimes` string, e.g. "M  W 10:05 AM-11:25 AM". */
  daytimes: string
  /** Parsed from `Daytimes`. Empty when the course has no meeting pattern. */
  days: DayCode[]
  /** Parsed from `Daytimes`, e.g. "10:05 AM-11:25 AM". */
  timeRange: string
  /** Numeric `Units`. null when absent or unparseable. */
  credits: number | null
  /** Derived from `Course Type` tokens (case-normalized). null when neither. */
  courseType: CourseType | null
  /**
   * Derived from `Course Type` tokens. A course can belong to several
   * programs. Courses with no program token are general MBA, labeled 'MBA'.
   */
  programs: string[]
  /** Derived from `Course Session`. */
  semester: Semester | null
  /**
   * `Course Category` with program-style values removed, so this is a real
   * subject area. null when the category was a program or blank.
   */
  subject: string | null
  /** Raw `Course Category`, kept for the detail view. */
  rawCategory: string
  /** Best available syllabus link (`Syllabus`, else `Old Syllabus`). */
  syllabus: string
  bidOrPermission: string
}

/**
 * One unique course listing — a course number + title, with every section
 * that offers it.
 *
 * Grouping is by number AND title, never number alone: MGT 600 is 27 rows
 * covering 25 different Global Network Week destinations (Bocconi, HEC
 * Paris, Oxford, …), so a number-only key would collapse 25 real courses
 * into one. 234 rows become 162 listings.
 *
 * The aggregate fields are unions across sections, so filtering a listing
 * matches if ANY of its sections matches.
 */
export interface CourseListing {
  key: string
  number: string
  title: string
  /** Every section, in the order they appear in the data. */
  sections: Course[]
  /** Distinct instructors across sections. */
  faculty: string[]
  /** Distinct credit values; usually one, occasionally two (MGT 404). */
  credits: number[]
  semesters: Semester[]
  courseTypes: CourseType[]
  programs: string[]
  subject: string | null
  /** One-line summary for the card. */
  blurb: string
  /** Fullest description found across sections. */
  description: string
  facultyBio: string
  syllabus: string
  /** True when at least one section has a meeting pattern. */
  scheduled: boolean
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  text: string
  toolsUsed?: string[]
  /** Set when the request failed, so the UI can style it as an error. */
  error?: boolean
}
