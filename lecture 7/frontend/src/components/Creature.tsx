/**
 * A cute creature mascot, one per course.
 *
 * These are original designs, not Pokémon — those are trademarked
 * characters. The look is the same family of idea: a round little
 * elemental buddy with big eyes.
 *
 * Every creature is generated from a seed (the course key), so a given
 * course always gets the same one, and 162 listings get visible variety
 * without 162 hand-drawn files: body silhouette × crown × eyes × tail ×
 * palette × belly pattern. Idle animation phase is seeded too, so a grid
 * of them bobs out of sync instead of pulsing in lockstep.
 */

/** FNV-1a — small, fast, and stable across reloads. */
function hash(text: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/**
 * Derive an independent value per trait from one seed hash.
 *
 * Two approaches that look fine but aren't: bit-shifting a single hash
 * (traits correlate) and appending a salt string to the seed (every seed
 * then ends with identical bytes, which collapses FNV's low-bit entropy —
 * that measured *worse*). This is an xorshift-multiply avalanche, so each
 * trait index is effectively independent.
 */
function mix(seedHash: number, trait: number): number {
  let x = seedHash ^ Math.imul(trait + 1, 0x9e3779b1)
  x ^= x >>> 16
  x = Math.imul(x, 0x85ebca6b)
  x ^= x >>> 13
  x = Math.imul(x, 0xc2b2ae35)
  x ^= x >>> 16
  return x >>> 0
}

/** Palettes built from the validated categorical hues plus a light belly. */
const PALETTES = [
  { body: '#0891b2', dark: '#066a83', belly: '#cdf3fb', crown: '#22d3ee' },
  { body: '#db2777', dark: '#a61d5c', belly: '#fbd5e6', crown: '#f472b6' },
  { body: '#16a34a', dark: '#107a37', belly: '#cdf2da', crown: '#4ade80' },
  { body: '#7c3aed', dark: '#5b28b3', belly: '#e3d6fb', crown: '#a78bfa' },
  { body: '#d97706', dark: '#a25a05', belly: '#fbe8cd', crown: '#fbbf24' },
  { body: '#2563eb', dark: '#1a4ab0', belly: '#d3e0fb', crown: '#60a5fa' },
]

const BODIES = ['round', 'egg', 'blob', 'pear'] as const
const CROWNS = ['ears', 'horn', 'fin', 'leaf', 'antenna', 'none'] as const
const EYES = ['wide', 'happy', 'sparkle', 'sleepy'] as const
const TAILS = ['curl', 'spark', 'puff', 'none'] as const

interface Props {
  /** Stable identity — the course key. Same seed, same creature. */
  seed: string
  size?: number
  className?: string
}

export default function Creature({ seed, size = 46, className }: Props) {
  const h = hash(seed)
  const palette = PALETTES[mix(h, 0) % PALETTES.length]
  const body = BODIES[mix(h, 1) % BODIES.length]
  const crown = CROWNS[mix(h, 2) % CROWNS.length]
  const eyes = EYES[mix(h, 3) % EYES.length]
  const tail = TAILS[mix(h, 4) % TAILS.length]
  const hasBelly = mix(h, 5) % 2 === 1
  const hasBlush = mix(h, 6) % 2 === 1
  // Spread idle phase across ~2s so a grid never bobs in unison.
  const delay = `-${(mix(h, 7) % 20) / 10}s`

  const bodyPath = {
    round: 'M32 58c-13 0-21-8-21-20s9-21 21-21 21 9 21 21-8 20-21 20z',
    egg: 'M32 58c-12 0-20-7-20-18 0-14 8-23 20-23s20 9 20 23c0 11-8 18-20 18z',
    blob: 'M32 58c-14 0-22-7-22-17 0-9 4-13 6-19 3-6 8-8 16-8s13 2 16 8c2 6 6 10 6 19 0 10-8 17-22 17z',
    pear: 'M32 58c-14 0-22-6-22-15 0-8 5-11 7-18 2-6 6-11 15-11s13 5 15 11c2 7 7 10 7 18 0 9-8 15-22 15z',
  }[body]

  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-hidden="true"
      focusable="false"
    >
      <g className="cr-bob" style={{ animationDelay: delay }}>
        {/* tail, behind the body */}
        {tail === 'curl' && (
          <path
            className="cr-tail"
            style={{ animationDelay: delay }}
            d="M50 46c7 1 9-4 6-8-2-3-6-2-6 2"
            fill="none"
            stroke={palette.dark}
            strokeWidth="4"
            strokeLinecap="round"
          />
        )}
        {tail === 'spark' && (
          <path
            className="cr-tail"
            style={{ animationDelay: delay }}
            d="M50 48l10-6-6-1 6-6-9 2 2-6-8 9z"
            fill={palette.crown}
          />
        )}
        {tail === 'puff' && (
          <circle
            className="cr-tail"
            style={{ animationDelay: delay }}
            cx="53"
            cy="44"
            r="7"
            fill={palette.dark}
          />
        )}

        {/* crown: ears, horn, fin, leaf, or antenna */}
        {crown === 'ears' && (
          <>
            <path d="M16 20 13 5l12 8z" fill={palette.body} />
            <path d="M48 20 51 5 39 13z" fill={palette.body} />
            <path d="M17 18 15 9l6 4z" fill={palette.belly} opacity="0.7" />
            <path d="M47 18l2-9-6 4z" fill={palette.belly} opacity="0.7" />
          </>
        )}
        {crown === 'horn' && (
          <path d="M32 14 27 2l12 4z" fill={palette.crown} />
        )}
        {crown === 'fin' && (
          <path d="M32 13c-2-8 2-12 6-13-1 6 1 9 3 12z" fill={palette.crown} />
        )}
        {crown === 'leaf' && (
          <>
            <path d="M32 14c0-8 5-12 11-12-1 8-5 12-11 12z" fill="#4ade80" />
            <path d="M32 14v-4" stroke={palette.dark} strokeWidth="2" strokeLinecap="round" />
          </>
        )}
        {crown === 'antenna' && (
          <>
            <path d="M32 14V6" stroke={palette.dark} strokeWidth="2.4" strokeLinecap="round" />
            <circle className="cr-glow" style={{ animationDelay: delay }} cx="32" cy="4" r="3.4" fill={palette.crown} />
          </>
        )}

        {/* body */}
        <path d={bodyPath} fill={palette.body} />

        {/* belly patch */}
        {hasBelly && <ellipse cx="32" cy="43" rx="12" ry="10" fill={palette.belly} opacity="0.85" />}

        {/* feet */}
        <ellipse cx="24" cy="57" rx="6" ry="3.4" fill={palette.dark} />
        <ellipse cx="40" cy="57" rx="6" ry="3.4" fill={palette.dark} />

        {/* blush */}
        {hasBlush && (
          <>
            <ellipse cx="19" cy="38" rx="3.6" ry="2.4" fill="#f472b6" opacity="0.55" />
            <ellipse cx="45" cy="38" rx="3.6" ry="2.4" fill="#f472b6" opacity="0.55" />
          </>
        )}

        {/* eyes */}
        {eyes === 'wide' && (
          <>
            <circle className="cr-eye" style={{ animationDelay: delay }} cx="25" cy="33" r="4.2" fill="#14202e" />
            <circle className="cr-eye" style={{ animationDelay: delay }} cx="39" cy="33" r="4.2" fill="#14202e" />
            <circle cx="26.4" cy="31.6" r="1.5" fill="#fff" />
            <circle cx="40.4" cy="31.6" r="1.5" fill="#fff" />
          </>
        )}
        {eyes === 'happy' && (
          <>
            <path d="M21 34q4-5 8 0" stroke="#14202e" strokeWidth="2.6" fill="none" strokeLinecap="round" />
            <path d="M35 34q4-5 8 0" stroke="#14202e" strokeWidth="2.6" fill="none" strokeLinecap="round" />
          </>
        )}
        {eyes === 'sparkle' && (
          <>
            <circle className="cr-eye" style={{ animationDelay: delay }} cx="25" cy="33" r="4.4" fill="#14202e" />
            <circle className="cr-eye" style={{ animationDelay: delay }} cx="39" cy="33" r="4.4" fill="#14202e" />
            <path d="M25 29.5l1 2.2 2.2 1-2.2 1-1 2.2-1-2.2-2.2-1 2.2-1z" fill="#fff" />
            <path d="M39 29.5l1 2.2 2.2 1-2.2 1-1 2.2-1-2.2-2.2-1 2.2-1z" fill="#fff" />
          </>
        )}
        {eyes === 'sleepy' && (
          <>
            <path d="M21 33q4 4 8 0" stroke="#14202e" strokeWidth="2.6" fill="none" strokeLinecap="round" />
            <path d="M35 33q4 4 8 0" stroke="#14202e" strokeWidth="2.6" fill="none" strokeLinecap="round" />
          </>
        )}

        {/* mouth */}
        <path d="M29 41q3 3 6 0" stroke="#14202e" strokeWidth="2" fill="none" strokeLinecap="round" />
      </g>
    </svg>
  )
}
