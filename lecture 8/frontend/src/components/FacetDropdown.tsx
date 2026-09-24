/**
 * One compact multi-select dropdown for a facet.
 *
 * Collapsed by default so the filter bar stays a single row. The trigger
 * shows the facet name plus how many values are picked; the popover holds
 * a scrollable checkbox list with live counts.
 */

import { useEffect, useLayoutEffect, useRef, useState } from 'react'

interface Props<T extends string | number> {
  name: string
  color: string
  values: T[]
  selected: T[]
  counts: Map<T, number>
  labelOf: (v: T) => string
  onToggle: (v: T) => void
  onClear: () => void
  /** Optional caveat shown at the top of the popover. */
  note?: string
}

export default function FacetDropdown<T extends string | number>({
  name,
  color,
  values,
  selected,
  counts,
  labelOf,
  onToggle,
  onClear,
  note,
}: Props<T>) {
  const [open, setOpen] = useState(false)
  const [align, setAlign] = useState<'left' | 'right'>('left')
  const wrapRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  /**
   * Dropdowns near the right edge (Subject, Credits) would open off-screen
   * with the default left alignment, so flip them to hug their trigger's
   * right edge instead. Measured after paint, before the browser shows it.
   */
  useLayoutEffect(() => {
    if (!open) {
      setAlign('left')
      return
    }
    const menu = menuRef.current
    if (!menu) return
    const rect = menu.getBoundingClientRect()
    if (rect.right > window.innerWidth - 8) setAlign('right')
  }, [open])

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (values.length === 0) return null

  return (
    <div className="dd" ref={wrapRef} style={{ ['--dd-color' as string]: color }}>
      <button
        type="button"
        className="dd-trigger"
        aria-expanded={open}
        aria-haspopup="true"
        data-active={selected.length > 0 || undefined}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="dd-dot" aria-hidden="true" />
        {name}
        {selected.length > 0 && <span className="dd-badge">{selected.length}</span>}
        <span className="dd-caret" aria-hidden="true">
          ▾
        </span>
      </button>

      {open && (
        <div className="dd-menu" role="group" aria-label={name} ref={menuRef} data-align={align}>
          {note && <p className="dd-note">{note}</p>}
          <div className="dd-list">
            {values.map((v) => {
              const count = counts.get(v) ?? 0
              const active = selected.includes(v)
              return (
                <label key={String(v)} className="dd-item" data-zero={count === 0 && !active}>
                  <input
                    type="checkbox"
                    checked={active}
                    onChange={() => onToggle(v)}
                    disabled={count === 0 && !active}
                  />
                  <span className="dd-item-label">{labelOf(v)}</span>
                  <span className="dd-item-count">{count}</span>
                </label>
              )
            })}
          </div>
          {selected.length > 0 && (
            <button type="button" className="dd-reset" onClick={onClear}>
              Clear {name.toLowerCase()}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
