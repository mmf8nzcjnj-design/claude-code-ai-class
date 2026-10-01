/** Short synthesized “spell complete” chime (no audio file needed). */

let sharedCtx: AudioContext | null = null

function getCtx(): AudioContext | null {
  const AC =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AC) return null
  if (!sharedCtx) sharedCtx = new AC()
  return sharedCtx
}

function tone(
  ctx: AudioContext,
  freq: number,
  start: number,
  dur: number,
  gain = 0.12,
  type: OscillatorType = 'sine',
) {
  const osc = ctx.createOscillator()
  const g = ctx.createGain()
  osc.type = type
  osc.frequency.value = freq
  g.gain.setValueAtTime(0.0001, start)
  g.gain.exponentialRampToValueAtTime(gain, start + 0.02)
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur)
  osc.connect(g)
  g.connect(ctx.destination)
  osc.start(start)
  osc.stop(start + dur + 0.02)
}

/** Call from a click/Send handler so later playback is allowed. */
export async function unlockSpellAudio() {
  try {
    const ctx = getCtx()
    if (!ctx) return
    if (ctx.state === 'suspended') await ctx.resume()
  } catch {
    // ignore
  }
}

/** Magical arpeggio + soft shimmer when the Headmaster finishes. */
export async function playSpellComplete() {
  try {
    const ctx = getCtx()
    if (!ctx) return
    if (ctx.state === 'suspended') await ctx.resume()

    const t0 = ctx.currentTime + 0.02
    // Rising spell notes (C5–E5–G5–C6)
    const notes = [523.25, 659.25, 783.99, 1046.5]
    notes.forEach((f, i) => {
      tone(ctx, f, t0 + i * 0.09, 0.35, 0.1, 'triangle')
      tone(ctx, f * 2, t0 + i * 0.09 + 0.02, 0.22, 0.04, 'sine')
    })
    // Soft sparkle dust
    for (let i = 0; i < 6; i += 1) {
      const f = 1200 + Math.random() * 1600
      tone(ctx, f, t0 + 0.28 + i * 0.05, 0.18, 0.025, 'sine')
    }
  } catch {
    // Autoplay / AudioContext quirks — ignore
  }
}
