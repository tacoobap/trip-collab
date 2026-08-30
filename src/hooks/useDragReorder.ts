import { useCallback, useEffect, useRef, useState } from 'react'

/** How close to the container edge a drag must get before the list auto-scrolls. */
const EDGE_ZONE = 56
const EDGE_SPEED = 12

type DragState = {
  pointerId: number
  activeIndex: number
  startY: number
  startScrollTop: number
  /** offsetTop of each row when the drag began. */
  tops: number[]
  heights: number[]
  /** Vertical distance one row occupies, including the flex gap. */
  slot: number
}

interface Options {
  /** Item ids in their current visual order. */
  ids: string[]
  /** Called with the full reordered id list when a drag actually moves something. */
  onCommit: (orderedIds: string[]) => void
  disabled?: boolean
}

function move<T>(list: T[], from: number, to: number): T[] {
  const next = [...list]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}

/**
 * Pointer-driven list reordering. Rows stay in place in the DOM and are moved
 * with transforms, so nothing remounts mid-drag; the new order is committed
 * once on release.
 *
 * Uses pointer events rather than HTML5 drag-and-drop, which never fires on
 * touch. The handle needs `touch-action: none` (applied via `handleProps`) or
 * the browser scrolls the sheet instead of starting the drag.
 *
 * Attach `scrollRef` to the scrolling ancestor to get edge auto-scroll on a
 * list taller than its container.
 */
export function useDragReorder({ ids, onCommit, disabled }: Options) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const [targetIndex, setTargetIndex] = useState<number | null>(null)
  const [offsetY, setOffsetY] = useState(0)

  const dragRef = useRef<DragState | null>(null)
  const rowsRef = useRef(new Map<string, HTMLElement>())
  // Owned by this hook rather than passed in, so the auto-scroll loop can write
  // scrollTop without mutating a hook argument.
  const scrollRef = useRef<HTMLElement | null>(null)
  const pointerYRef = useRef(0)
  const rafRef = useRef<number | null>(null)
  // Read inside pointer handlers, so they always see the current order without
  // being torn down and rebuilt on every list change.
  const idsRef = useRef(ids)
  useEffect(() => {
    idsRef.current = ids
  }, [ids])

  const registerRow = useCallback((id: string, node: HTMLElement | null) => {
    if (node) rowsRef.current.set(id, node)
    else rowsRef.current.delete(id)
  }, [])

  const stopAutoScroll = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
  }, [])

  useEffect(() => stopAutoScroll, [stopAutoScroll])

  /** Recompute where the dragged row would land, given the live pointer position. */
  const updateTarget = useCallback(() => {
    const drag = dragRef.current
    if (!drag) return
    const scroller = scrollRef.current
    const scrolled = scroller ? scroller.scrollTop - drag.startScrollTop : 0
    const delta = pointerYRef.current - drag.startY + scrolled
    setOffsetY(delta)

    const centers = drag.tops.map((top, i) => top + drag.heights[i] / 2)
    const draggedCenter = centers[drag.activeIndex] + delta

    let next = drag.activeIndex
    while (next > 0 && draggedCenter < centers[next - 1]) next--
    while (next < centers.length - 1 && draggedCenter > centers[next + 1]) next++
    setTargetIndex(next)
  }, [])

  const endDrag = useCallback(() => {
    const drag = dragRef.current
    dragRef.current = null
    stopAutoScroll()
    setActiveIndex(null)
    setTargetIndex(null)
    setOffsetY(0)
    return drag
  }, [stopAutoScroll])

  const handlePointerDown = useCallback(
    (index: number) => (e: React.PointerEvent<HTMLElement>) => {
      if (disabled || e.button !== 0) return
      const nodes = idsRef.current.map((id) => rowsRef.current.get(id))
      if (nodes.some((n) => !n)) return

      const rows = nodes as HTMLElement[]
      const tops = rows.map((n) => n.offsetTop)
      const heights = rows.map((n) => n.offsetHeight)
      // Row pitch includes the flex gap; fall back to the row height alone.
      const slot = rows.length > 1 ? tops[1] - tops[0] : heights[index] || 0

      try {
        e.currentTarget.setPointerCapture(e.pointerId)
      } catch {
        // Without capture the drag still tracks while the pointer stays over
        // the handle, and the window listeners still end it cleanly.
      }
      pointerYRef.current = e.clientY
      dragRef.current = {
        pointerId: e.pointerId,
        activeIndex: index,
        startY: e.clientY,
        startScrollTop: scrollRef.current?.scrollTop ?? 0,
        tops,
        heights,
        slot: slot || heights[index] || 0,
      }
      setActiveIndex(index)
      setTargetIndex(index)
      setOffsetY(0)

      // Scoped to this drag, so the loop and its lifetime stay together.
      const step = () => {
        const scroller = scrollRef.current
        if (!scroller || !dragRef.current) {
          stopAutoScroll()
          return
        }
        const box = scroller.getBoundingClientRect()
        const y = pointerYRef.current
        let dy = 0
        if (y < box.top + EDGE_ZONE) dy = -EDGE_SPEED
        else if (y > box.bottom - EDGE_ZONE) dy = EDGE_SPEED

        if (dy !== 0) {
          const before = scroller.scrollTop
          scroller.scrollTop = before + dy
          if (scroller.scrollTop !== before) updateTarget()
        }
        rafRef.current = requestAnimationFrame(step)
      }

      if (scrollRef.current) {
        stopAutoScroll()
        rafRef.current = requestAnimationFrame(step)
      }
    },
    [disabled, stopAutoScroll, updateTarget]
  )

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      const drag = dragRef.current
      if (!drag || drag.pointerId !== e.pointerId) return
      e.preventDefault()
      pointerYRef.current = e.clientY
      updateTarget()
    },
    [updateTarget]
  )

  const commitDrag = useCallback(() => {
    const drag = dragRef.current
    if (!drag) return
    const to = targetIndex
    const from = drag.activeIndex
    endDrag()
    if (to !== null && to !== from) {
      onCommit(move(idsRef.current, from, to))
    }
  }, [endDrag, onCommit, targetIndex])

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      const drag = dragRef.current
      if (!drag || drag.pointerId !== e.pointerId) return
      commitDrag()
    },
    [commitDrag]
  )

  /** A cancelled pointer means the gesture was abandoned, not completed — put
   *  the row back rather than committing a move the user didn't finish. */
  const handlePointerCancel = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      const drag = dragRef.current
      if (!drag || drag.pointerId !== e.pointerId) return
      endDrag()
    },
    [endDrag]
  )

  // Safety net: if capture is lost the element's own handler never fires and
  // the row would stay stuck mid-drag. Both are no-ops once it has run.
  useEffect(() => {
    if (activeIndex === null) return
    const onUp = () => commitDrag()
    const onCancel = () => endDrag()
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onCancel)
    return () => {
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onCancel)
    }
  }, [activeIndex, commitDrag, endDrag])

  /** Arrow keys on a focused handle move the row, so this works without a pointer. */
  const handleKeyDown = useCallback(
    (index: number) => (e: React.KeyboardEvent<HTMLElement>) => {
      if (disabled) return
      const delta = e.key === 'ArrowUp' ? -1 : e.key === 'ArrowDown' ? 1 : 0
      if (delta === 0) return
      const to = index + delta
      if (to < 0 || to >= idsRef.current.length) return
      e.preventDefault()
      onCommit(move(idsRef.current, index, to))
    },
    [disabled, onCommit]
  )

  /**
   * Transform for a row: the dragged one follows the pointer, the rows it has
   * passed shift by one slot to open the gap.
   */
  const getRowOffset = useCallback(
    (index: number): number => {
      if (activeIndex === null || targetIndex === null) return 0
      const drag = dragRef.current
      if (!drag) return 0
      if (index === activeIndex) return offsetY
      if (targetIndex > activeIndex && index > activeIndex && index <= targetIndex) {
        return -drag.slot
      }
      if (targetIndex < activeIndex && index >= targetIndex && index < activeIndex) {
        return drag.slot
      }
      return 0
    },
    [activeIndex, targetIndex, offsetY]
  )

  const handleProps = useCallback(
    (index: number) => ({
      onPointerDown: handlePointerDown(index),
      onPointerMove: handlePointerMove,
      onPointerUp: handlePointerUp,
      onPointerCancel: handlePointerCancel,
      onKeyDown: handleKeyDown(index),
      style: { touchAction: 'none' as const },
    }),
    [handlePointerDown, handlePointerMove, handlePointerUp, handlePointerCancel, handleKeyDown]
  )

  return {
    /** Index currently being dragged, or null. */
    activeIndex,
    /** Attach to the scrolling ancestor to enable edge auto-scroll. */
    scrollRef,
    registerRow,
    getRowOffset,
    handleProps,
    isDragging: activeIndex !== null,
  }
}
