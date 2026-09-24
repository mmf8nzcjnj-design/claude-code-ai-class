/**
 * Sol — the standing mascot and personal guide.
 *
 * Drawn entirely as SVG shapes and animated with CSS (see the mascot block
 * in index.css): a slow breath, an occasional wave, a periodic blink, and a
 * swaying Labubu charm clipped to his belt. No raster art and no generated
 * images, per project convention.
 *
 * He wears a Labubu tee and keeps a Labubu on his belt.
 * `variant="avatar"` renders just the head, for the chat header and launcher.
 */

interface MascotProps {
  variant?: 'full' | 'avatar'
  className?: string
  /** Waving is the default; set false for a still figure. */
  waving?: boolean
}

const SKIN = '#7a4a2e'
const SKIN_DARK = '#6b4028'

/**
 * A small Labubu: tall notched ears, pale face patch, wide eyes, toothy
 * grin. Drawn in a local 0 0 44 56 box so it can be dropped anywhere with
 * a transform.
 */
function Labubu({
  fur = '#e8778d',
  face = '#fbe9c9',
  withBody = false,
}: {
  fur?: string
  face?: string
  withBody?: boolean
}) {
  return (
    <>
      {/* ears */}
      <path d="M9 20 5 2l13 11z" fill={fur} />
      <path d="M35 20 39 2 26 13z" fill={fur} />
      <path d="M10 18 8 7l7 6z" fill={face} opacity="0.55" />
      <path d="M34 18l2-11-7 6z" fill={face} opacity="0.55" />
      {/* head */}
      <ellipse cx="22" cy="28" rx="15" ry="13.5" fill={fur} />
      {/* face patch */}
      <ellipse cx="22" cy="31" rx="10" ry="9" fill={face} />
      {/* eyes */}
      <circle cx="17" cy="27" r="3" fill="#2a1b12" />
      <circle cx="27" cy="27" r="3" fill="#2a1b12" />
      <circle cx="18" cy="26" r="1" fill="#fff" opacity="0.95" />
      <circle cx="28" cy="26" r="1" fill="#fff" opacity="0.95" />
      {/* toothy grin */}
      <path
        d="M16 34h12l-1.5 3-1.5-2-1.5 2-1.5-2-1.5 2-1.5-2-1.5 2z"
        fill="#fff"
        stroke="#2a1b12"
        strokeWidth="0.7"
        strokeLinejoin="round"
      />
      {withBody && (
        <>
          <path d="M14 40h16v11a4 4 0 0 1-4 4h-8a4 4 0 0 1-4-4z" fill={fur} />
          <circle cx="18.5" cy="45" r="1.4" fill={face} opacity="0.8" />
          <circle cx="25.5" cy="45" r="1.4" fill={face} opacity="0.8" />
        </>
      )}
    </>
  )
}

export default function Mascot({
  variant = 'full',
  className,
  waving = true,
}: MascotProps) {
  if (variant === 'avatar') {
    return (
      <svg
        className={className}
        viewBox="0 0 64 64"
        role="img"
        aria-label="Sol, your course guide"
      >
        <circle cx="32" cy="32" r="31" fill="#0d1424" />
        {/* tee collar */}
        <path d="M10 60c2-14 10-21 22-21s20 7 22 21z" fill="#22d3ee" />
        <path d="M26 39h12l-6 7z" fill="#0d1424" opacity="0.35" />
        {/* head */}
        <ellipse cx="32" cy="27" rx="15" ry="16" fill={SKIN} />
        <ellipse cx="27" cy="18" rx="6" ry="4.5" fill="#8d5837" opacity="0.75" />
        {/* ears */}
        <ellipse cx="16.5" cy="28" rx="2.6" ry="3.6" fill={SKIN_DARK} />
        <ellipse cx="47.5" cy="28" rx="2.6" ry="3.6" fill={SKIN_DARK} />
        {/* brows */}
        <path d="M23 22.5q3-1.6 6 0" stroke="#4a2c1a" strokeWidth="1.5" fill="none" strokeLinecap="round" />
        <path d="M35 22.5q3-1.6 6 0" stroke="#4a2c1a" strokeWidth="1.5" fill="none" strokeLinecap="round" />
        {/* eyes */}
        <circle className="m-eye" cx="26" cy="27" r="2.3" fill="#1b1008" />
        <circle className="m-eye" cx="38" cy="27" r="2.3" fill="#1b1008" />
        {/* smile */}
        <path d="M26 34.5q6 4.5 12 0" stroke="#412514" strokeWidth="1.7" fill="none" strokeLinecap="round" />
      </svg>
    )
  }

  return (
    <svg
      className={className}
      viewBox="0 0 150 300"
      role="img"
      aria-label="Sol, your course guide, waving, wearing a Labubu tee with a Labubu on his belt"
    >
      <defs>
        <linearGradient id="sol-tee" x1="0" y1="0" x2="0.9" y2="1">
          <stop offset="0%" stopColor="#22d3ee" />
          <stop offset="60%" stopColor="#4f7ce8" />
          <stop offset="100%" stopColor="#7c3aed" />
        </linearGradient>
        <linearGradient id="sol-pants" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1e2740" />
          <stop offset="100%" stopColor="#141b2e" />
        </linearGradient>
        <radialGradient id="sol-glow">
          <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* neon pool of light at his feet */}
      <ellipse className="m-glow" cx="75" cy="284" rx="46" ry="9" fill="url(#sol-glow)" />

      <g className="m-body">
        {/* legs — a clear gap between them so they read as two */}
        <rect x="57" y="184" width="15" height="76" rx="4" fill="url(#sol-pants)" />
        <rect x="78" y="184" width="15" height="76" rx="4" fill="url(#sol-pants)" />
        {/* shoes, also separated */}
        <path d="M53 258h19a3 3 0 0 1 3 3v8H53z" fill="#e8eef8" />
        <path d="M78 258h19a3 3 0 0 1 3 3v8H78z" fill="#e8eef8" />
        <path d="M53 266h22v3H53zM78 266h22v3H78z" fill="#22d3ee" opacity="0.65" />

        {/* belt */}
        <rect x="52" y="172" width="46" height="9" rx="2" fill="#0f1729" />
        <rect x="70" y="173" width="10" height="7" rx="1.5" fill="#d97706" />

        {/* t-shirt torso */}
        <path d="M48 112q27-11 54 0v54q0 7-7 7H55q-7 0-7-7z" fill="url(#sol-tee)" />
        {/* short sleeves, tucked against the shoulders */}
        <path d="M48 113q-9 3-11 12l1 8 13-4z" fill="url(#sol-tee)" />
        <path d="M102 113q9 3 11 12l-1 8-13-4z" fill="url(#sol-tee)" />
        {/* collar */}
        <path d="M67 110h16l-8 8z" fill="#0d1424" opacity="0.32" />

        {/* Labubu print across the chest */}
        <g transform="translate(58 124) scale(0.76)">
          <Labubu fur="#fbe9c9" face="#f7d9a8" />
        </g>

        {/* Labubu clipped to his belt, swaying — drawn over the hip */}
        <g className="m-charm">
          <circle cx="96" cy="175" r="2.6" fill="none" stroke="#c3cde3" strokeWidth="1.3" />
          <path d="M96 178v7" stroke="#c3cde3" strokeWidth="1.5" strokeLinecap="round" />
          <g transform="translate(85 184) scale(0.48)">
            <Labubu fur="#f472b6" face="#fbe9c9" withBody />
          </g>
        </g>

        {/* left arm — bare forearm below the sleeve */}
        <rect x="37" y="132" width="11" height="36" rx="5.5" fill={SKIN} />
        <circle cx="42.5" cy="170" r="6" fill={SKIN} />

        {/* right arm, raised in a wave */}
        <g className={waving ? 'm-arm-wave' : undefined}>
          <rect x="102" y="132" width="11" height="32" rx="5.5" fill={SKIN} />
          <circle cx="107.5" cy="165" r="6.5" fill={SKIN} />
          <path
            d="M104 160v-8M107.5 159v-10M111 160v-8"
            stroke={SKIN}
            strokeWidth="3"
            strokeLinecap="round"
          />
        </g>

        {/* neck */}
        <rect x="69" y="88" width="12" height="24" fill={SKIN_DARK} />

        {/* head */}
        <ellipse cx="75" cy="64" rx="25" ry="27" fill={SKIN} />
        <ellipse cx="66" cy="48" rx="10" ry="7" fill="#8d5837" opacity="0.8" />
        {/* ears */}
        <ellipse cx="49" cy="66" rx="4.2" ry="6" fill={SKIN_DARK} />
        <ellipse cx="101" cy="66" rx="4.2" ry="6" fill={SKIN_DARK} />
        {/* brows */}
        <path d="M60 54q5-2.6 10 0" stroke="#4a2c1a" strokeWidth="2.4" fill="none" strokeLinecap="round" />
        <path d="M80 54q5-2.6 10 0" stroke="#4a2c1a" strokeWidth="2.4" fill="none" strokeLinecap="round" />
        {/* eyes */}
        <circle className="m-eye" cx="65" cy="63" r="3.4" fill="#1b1008" />
        <circle className="m-eye" cx="85" cy="63" r="3.4" fill="#1b1008" />
        <circle cx="66.2" cy="61.8" r="1.1" fill="#eef2fb" opacity="0.9" />
        <circle cx="86.2" cy="61.8" r="1.1" fill="#eef2fb" opacity="0.9" />
        {/* nose + smile */}
        <path d="M75 68v5" stroke="#5c3520" strokeWidth="2" strokeLinecap="round" />
        <path d="M65 77q10 7 20 0" stroke="#412514" strokeWidth="2.6" fill="none" strokeLinecap="round" />
      </g>
    </svg>
  )
}
