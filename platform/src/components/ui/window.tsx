import * as React from "react"
import { MinusIcon, XIcon } from "lucide-react"

import { cn } from "@/lib/utils"

type WindowPosition = { x: number; y: number }

type WindowSize = { width: number; height: number }

type WindowInsets = { top?: number; right?: number; bottom?: number; left?: number }

type ResizeEdge = "n" | "e" | "s" | "w" | "ne" | "se" | "sw" | "nw"

// Invisible strips along the inside of the frame; the corner squares are
// clipped to the rounded corners, so they follow the curve.
const RESIZE_HANDLES: Record<ResizeEdge, string> = {
  n: "inset-x-4 top-0 h-[5px] cursor-ns-resize",
  s: "inset-x-4 bottom-0 h-[5px] cursor-ns-resize",
  e: "inset-y-4 right-0 w-[5px] cursor-ew-resize",
  w: "inset-y-4 left-0 w-[5px] cursor-ew-resize",
  nw: "top-0 left-0 size-4 cursor-nwse-resize",
  ne: "top-0 right-0 size-4 cursor-nesw-resize",
  se: "right-0 bottom-0 size-4 cursor-nwse-resize",
  sw: "bottom-0 left-0 size-4 cursor-nesw-resize",
}

const RESIZE_CURSORS: Record<ResizeEdge, string> = {
  n: "ns-resize",
  s: "ns-resize",
  e: "ew-resize",
  w: "ew-resize",
  nw: "nwse-resize",
  se: "nwse-resize",
  ne: "nesw-resize",
  sw: "nesw-resize",
}

const OPPOSITE = { n: "s", s: "n", e: "w", w: "e" } as const

type WindowContextValue = {
  onClose?: () => void
  onMinimize?: () => void
  onZoom?: () => void
  maximized: boolean
  minimizable: boolean
  /** False when asked for, or when a maximum size keeps the window from filling its parent. */
  zoomable: boolean
}

// Lets the traffic lights anywhere inside a window reach its handlers.
const WindowContext = React.createContext<WindowContextValue | null>(null)

// Where a draggable window can be grabbed: the title bar, the toolbar, the
// strip above the sidebar, or anything marked with data-window-drag-region.
const DRAG_REGION =
  '[data-slot="window-titlebar"], [data-slot="toolbar"], [data-slot="mac-sidebar-header"], [data-window-drag-region]'

// Controls inside a drag region keep working instead of moving the window.
const NO_DRAG =
  'button, input, textarea, select, a, [role="button"], [role="tab"], [role="switch"], [role="slider"], [role="menuitem"], [contenteditable="true"], [data-window-no-drag]'

const reducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches

type Point = [x: number, y: number]

// The matrix3d() that maps a width x height box onto the quadrilateral
// `quad` (top-left, top-right, bottom-right, bottom-left), with a
// transform-origin of 0 0. This is the square-to-quad projective mapping.
function quadToMatrix(width: number, height: number, quad: [Point, Point, Point, Point]) {
  const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = quad
  const dx1 = x1 - x2
  const dx2 = x3 - x2
  const dx3 = x0 - x1 + x2 - x3
  const dy1 = y1 - y2
  const dy2 = y3 - y2
  const dy3 = y0 - y1 + y2 - y3
  const det = dx1 * dy2 - dx2 * dy1 || 1e-9
  const g = (dx3 * dy2 - dx2 * dy3) / det
  const h = (dx1 * dy3 - dx3 * dy1) / det
  const a = x1 - x0 + g * x1
  const b = x3 - x0 + h * x3
  const d = y1 - y0 + g * y1
  const e = y3 - y0 + h * y3
  return `matrix3d(${a / width}, ${d / width}, 0, ${g / width}, ${b / height}, ${e / height}, 0, ${h / height}, 0, 0, 1, 0, ${x0}, ${y0}, 0, 1)`
}

const clamp = (value: number) => Math.min(1, Math.max(0, value))
const smooth = (t: number) => t * t * (3 - 2 * t)
const lerp = (from: number, to: number, t: number) => from + (to - from) * t

// The keyframes that shrink a window into `target` (e.g. its Dock tile).
// "genie" pulls the edge nearest the target into it first, narrowing the
// window into a funnel, then lets the far edge follow; "scale" simply
// scales it down. Played in reverse to restore.
function minimizeAnimation(
  element: HTMLElement,
  target: Element | null | undefined,
  effect: "genie" | "scale"
) {
  const rect = element.getBoundingClientRect()
  const width = element.offsetWidth
  const height = element.offsetHeight
  // Screen pixels per layout pixel, for windows inside a scaled container.
  const scale = rect.width / width || 1
  const goal =
    target?.getBoundingClientRect() ??
    new DOMRect(rect.left + rect.width / 2 - 24, window.innerHeight - 56, 48, 48)

  // The target in the window's own, unscaled coordinates, and the window
  // shrunk to fit inside it.
  const x = (goal.left + goal.width / 2 - rect.left) / scale
  const y = (goal.top + goal.height / 2 - rect.top) / scale
  const fit = Math.max(0.01, Math.min(goal.width / rect.width, goal.height / rect.height))
  const endWidth = width * fit
  const endHeight = height * fit

  if (effect === "scale") {
    const origin = `${x}px ${y}px`
    return {
      keyframes: [
        { transformOrigin: origin, transform: "scale(1)", opacity: 1 },
        { transformOrigin: origin, transform: `scale(${fit})`, opacity: 0 },
      ],
      options: { duration: 360, easing: "cubic-bezier(0.45, 0, 0.75, 0.6)" },
    }
  }

  // The edge nearest the target leads; the far edge lags behind it.
  const below = y > height / 2
  const nearFrom = below ? height : 0
  const farFrom = below ? 0 : height
  const nearTo = y + (below ? endHeight : -endHeight) / 2
  const farTo = y + (below ? -endHeight : endHeight) / 2
  const steps = 24
  const keyframes: Keyframe[] = Array.from({ length: steps + 1 }, (_, step) => {
    const progress = step / steps
    const near = smooth(clamp(progress / 0.5))
    // The far edge narrows and swings toward the target before it travels.
    const narrow = smooth(clamp((progress - 0.1) / 0.6))
    const far = smooth(clamp((progress - 0.25) / 0.75))
    const farHalf = lerp(width / 2, endWidth / 2, narrow)
    const farCenter = lerp(width / 2, x, narrow)
    // Keeping the near edge at least 30% as wide as the far edge limits the
    // perspective, so the content is squeezed rather than tilted away.
    const nearHalf = Math.max(lerp(width / 2, endWidth / 2, near), farHalf * 0.3)
    const nearCenter = lerp(width / 2, x, near)
    const nearY = lerp(nearFrom, nearTo, near)
    const farY = lerp(farFrom, farTo, far)
    const top: [Point, Point] = below
      ? [[farCenter - farHalf, farY], [farCenter + farHalf, farY]]
      : [[nearCenter - nearHalf, nearY], [nearCenter + nearHalf, nearY]]
    const bottom: [Point, Point] = below
      ? [[nearCenter + nearHalf, nearY], [nearCenter - nearHalf, nearY]]
      : [[farCenter + farHalf, farY], [farCenter - farHalf, farY]]
    return {
      offset: progress,
      transformOrigin: "0 0",
      transform: quadToMatrix(width, height, [...top, ...bottom]),
      opacity: progress < 0.8 ? 1 : 1 - (progress - 0.8) / 0.2,
    }
  })

  return {
    keyframes,
    options: { duration: 560, easing: "cubic-bezier(0.4, 0, 0.9, 0.8)" },
  }
}

// A macOS window frame. Put a MacSidebar, a Toolbar (or WindowTitlebar) and
// WindowContent straight inside it; the window lays them out:
//
//   <Window>
//     <MacSidebar />       left, full height (optional)
//     <Toolbar />          top of the main column (optional)
//     <WindowContent />    fills the rest of the main column
//   </Window>
//
// Anything else inside goes in the main column too, below the bar. The
// WindowContent fills the height; what comes before it (a header) sits above
// it, what comes after it (a status bar, a player) below. Without a
// WindowContent the first item after the bar fills the height. A direct
// child marked data-window-drag-region counts as a title bar.
// The main column's background is --window-background (the window color by
// default), e.g. className="[--window-background:var(--mac-content)]".
// `inactive` renders the unfocused
// look: grey traffic lights, dimmed titles and a grey accent color.
// `draggable` lets people move the window by its title bar or toolbar; the
// offset is applied with the CSS `translate` property.
// `onClose`, `onMinimize` and `onZoom` wire up the traffic lights. Setting
// `minimized` animates the window into `minimizeTo` (e.g. a Dock tile) and
// back; `maximized` grows it to fill its parent. A window with a `maxSize`
// can't grow past it, so it doesn't maximize: `maximized` and double-clicking
// the title bar do nothing, and the green traffic light is disabled.
// `minimizable={false}` and `zoomable={false}` turn those off for any window,
// as macOS does for a window that only closes.
// `resizable` lets people resize it by its edges and corners, between
// `minSize` and `maxSize`; double-clicking an edge stretches it to the
// parent's edge (with Option, the opposite edge too).
function Window({
  className,
  style,
  ref,
  children,
  inactive = false,
  draggable = false,
  bounds,
  position,
  defaultPosition,
  onPositionChange,
  resizable = false,
  size,
  defaultSize,
  onSizeChange,
  minSize,
  maxSize,
  onClose,
  onMinimize,
  onZoom,
  minimized: minimizedProp = false,
  minimizeTo,
  minimizeEffect = "genie",
  maximized: maximizedProp = false,
  minimizable = true,
  zoomable: zoomableProp = true,
  maximizeInsets,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  onDoubleClick,
  ...props
}: Omit<React.ComponentProps<"div">, "draggable"> & {
  inactive?: boolean
  draggable?: boolean
  bounds?: "parent"
  position?: WindowPosition
  defaultPosition?: WindowPosition
  onPositionChange?: (position: WindowPosition) => void
  resizable?: boolean
  size?: WindowSize
  defaultSize?: WindowSize
  onSizeChange?: (size: WindowSize) => void
  minSize?: Partial<WindowSize>
  maxSize?: Partial<WindowSize>
  onClose?: () => void
  onMinimize?: () => void
  onZoom?: () => void
  minimized?: boolean
  minimizeTo?: React.RefObject<Element | null>
  minimizeEffect?: "genie" | "scale"
  maximized?: boolean
  maximizeInsets?: WindowInsets
  minimizable?: boolean
  zoomable?: boolean
}) {
  const minimized = minimizedProp && minimizable
  const zoomable = zoomableProp && maxSize?.width === undefined && maxSize?.height === undefined
  const maximized = maximizedProp && zoomable
  const [uncontrolledPosition, setUncontrolledPosition] =
    React.useState<WindowPosition>(defaultPosition ?? { x: 0, y: 0 })
  const current = position ?? uncontrolledPosition
  const [dragging, setDragging] = React.useState(false)
  const element = React.useRef<HTMLDivElement | null>(null)

  // Until it is resized, the window keeps the size its classes give it.
  const [uncontrolledSize, setUncontrolledSize] = React.useState(defaultSize)
  const currentSize = size ?? uncontrolledSize
  const [resizing, setResizing] = React.useState<ResizeEdge | null>(null)

  function move(next: WindowPosition) {
    if (position === undefined) setUncontrolledPosition(next)
    onPositionChange?.(next)
  }

  // Where the top-left corner should land once the new size is laid out.
  // A window centered by its classes moves as it grows, so the offset that
  // keeps the opposite edges in place is only known after layout.
  const anchor = React.useRef<WindowPosition | null>(null)
  function setFrame(next: WindowSize, corner: WindowPosition) {
    anchor.current = corner
    if (size === undefined) setUncontrolledSize(next)
    onSizeChange?.(next)
  }
  React.useLayoutEffect(() => {
    const node = element.current
    const corner = anchor.current
    if (!node || !corner) return
    anchor.current = null
    const next = { x: corner.x - node.offsetLeft, y: corner.y - node.offsetTop }
    if (next.x !== current.x || next.y !== current.y) move(next)
  })

  // `hidden` lags behind `minimized` so the window stays visible while it
  // animates into the Dock.
  const [hidden, setHidden] = React.useState(minimized)
  // Restoring, or minimizing without motion, shows or hides the window at once.
  const [renderedMinimized, setRenderedMinimized] = React.useState(minimized)
  if (renderedMinimized !== minimized) {
    setRenderedMinimized(minimized)
    if (!minimized || reducedMotion()) setHidden(minimized)
  }
  const previousMinimized = React.useRef(minimized)
  React.useLayoutEffect(() => {
    const node = element.current
    if (!node || previousMinimized.current === minimized) return
    previousMinimized.current = minimized
    if (reducedMotion()) return
    const { keyframes, options } = minimizeAnimation(node, minimizeTo?.current, minimizeEffect)
    if (minimized) {
      const animation = node.animate(keyframes, { ...options, fill: "forwards" })
      animation.finished
        .then(() => {
          setHidden(true)
          animation.cancel()
        })
        .catch(() => {})
    } else {
      // Reversed, the ease-in of minimizing becomes an ease-out.
      node.animate(keyframes, {
        ...options,
        direction: "reverse",
        fill: "backwards",
      })
    }
  }, [minimized, minimizeTo, minimizeEffect])

  // Zooming in and out morphs the window from its old frame to the new one.
  const lastRect = React.useRef<DOMRect | null>(null)
  const previousMaximized = React.useRef(maximized)
  React.useLayoutEffect(() => {
    const node = element.current
    const before = lastRect.current
    if (!node || previousMaximized.current === maximized) return
    previousMaximized.current = maximized
    if (!before || reducedMotion()) return
    const after = node.getBoundingClientRect()
    const scale = after.width / node.offsetWidth || 1
    node.animate(
      [
        {
          transformOrigin: "0 0",
          transform: `translate(${(before.left - after.left) / scale}px, ${(before.top - after.top) / scale}px) scale(${before.width / after.width}, ${before.height / after.height})`,
        },
        { transformOrigin: "0 0", transform: "none" },
      ],
      { duration: 380, easing: "cubic-bezier(0.25, 0.8, 0.3, 1)" }
    )
  }, [maximized])
  React.useLayoutEffect(() => {
    if (element.current) lastRect.current = element.current.getBoundingClientRect()
  })

  const context = React.useMemo(
    () => ({ onClose, onMinimize, onZoom, maximized, minimizable, zoomable }),
    [onClose, onMinimize, onZoom, maximized, minimizable, zoomable]
  )
  const drag = React.useRef<{
    pointer: WindowPosition
    start: WindowPosition
    scale: number
    min: WindowPosition
    max: WindowPosition
  } | null>(null)

  const resize = React.useRef<{
    edge: ResizeEdge
    pointer: WindowPosition
    start: WindowSize
    corner: WindowPosition
    scale: number
    min: WindowSize
    max: WindowSize
  } | null>(null)

  // The window's top-left corner in its parent's layout, including the
  // drag offset, and the screen-to-layout scale.
  function measure(node: HTMLElement) {
    const rect = node.getBoundingClientRect()
    return {
      rect,
      scale: rect.width / node.offsetWidth || 1,
      start: { width: node.offsetWidth, height: node.offsetHeight },
      corner: { x: node.offsetLeft + current.x, y: node.offsetTop + current.y },
    }
  }

  function startResize(event: React.PointerEvent<HTMLDivElement>, edge: ResizeEdge) {
    const node = event.currentTarget
    const { rect, scale, start, corner } = measure(node)
    // A window that starts outside its limits doesn't jump to them.
    const min = {
      width: Math.min(minSize?.width ?? 240, start.width),
      height: Math.min(minSize?.height ?? 140, start.height),
    }
    const max = {
      width: Math.max(maxSize?.width ?? Number.POSITIVE_INFINITY, start.width),
      height: Math.max(maxSize?.height ?? Number.POSITIVE_INFINITY, start.height),
    }
    const parent = bounds === "parent" ? node.parentElement : null
    if (parent) {
      const area = parent.getBoundingClientRect()
      const roomX = edge.includes("e") ? area.right - rect.right : edge.includes("w") ? rect.left - area.left : 0
      const roomY = edge.includes("s") ? area.bottom - rect.bottom : edge.includes("n") ? rect.top - area.top : 0
      max.width = Math.min(max.width, start.width + Math.max(0, roomX / scale))
      max.height = Math.min(max.height, start.height + Math.max(0, roomY / scale))
    }

    resize.current = { edge, pointer: { x: event.clientX, y: event.clientY }, start, corner, scale, min, max }
    node.setPointerCapture(event.pointerId)
    setResizing(edge)
    event.preventDefault()
  }

  function handleResize(event: React.PointerEvent<HTMLDivElement>) {
    const { edge, pointer, start, corner, scale, min, max } = resize.current!
    const dx = (event.clientX - pointer.x) / scale
    const dy = (event.clientY - pointer.y) / scale
    const fit = (value: number, axis: keyof WindowSize) =>
      Math.round(Math.min(max[axis], Math.max(min[axis], value)))
    const width = fit(edge.includes("e") ? start.width + dx : edge.includes("w") ? start.width - dx : start.width, "width")
    const height = fit(edge.includes("s") ? start.height + dy : edge.includes("n") ? start.height - dy : start.height, "height")
    // The edges opposite the one being dragged stay put.
    setFrame(
      { width, height },
      {
        x: edge.includes("w") ? corner.x + start.width - width : corner.x,
        y: edge.includes("n") ? corner.y + start.height - height : corner.y,
      }
    )
  }

  // Double-clicking an edge stretches it to the parent's edge, inside the
  // maximize insets; with Option the opposite edge follows.
  function fillToEdge(node: HTMLElement, edge: ResizeEdge, both: boolean) {
    const parent = node.parentElement
    if (!parent) return
    const { rect, scale, start, corner } = measure(node)
    const area = parent.getBoundingClientRect()
    const room = {
      n: (rect.top - area.top) / scale - insets.top,
      s: (area.bottom - rect.bottom) / scale - insets.bottom,
      w: (rect.left - area.left) / scale - insets.left,
      e: (area.right - rect.right) / scale - insets.right,
    }
    const grows = (side: keyof typeof OPPOSITE) =>
      edge.includes(side) || (both && edge.includes(OPPOSITE[side]))
    const reach = (side: keyof typeof OPPOSITE) => (grows(side) ? Math.max(0, room[side]) : 0)
    const width = Math.min(maxSize?.width ?? Number.POSITIVE_INFINITY, start.width + reach("w") + reach("e"))
    const height = Math.min(maxSize?.height ?? Number.POSITIVE_INFINITY, start.height + reach("n") + reach("s"))
    setFrame(
      { width: Math.max(width, start.width), height: Math.max(height, start.height) },
      {
        x: grows("w") && !grows("e") ? corner.x + start.width - Math.max(width, start.width) : corner.x - reach("w"),
        y: grows("n") && !grows("s") ? corner.y + start.height - Math.max(height, start.height) : corner.y - reach("n"),
      }
    )
  }

  // The handle a pointer event targets, if it belongs to this window.
  function resizeEdge(event: React.SyntheticEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement
    return target.parentElement === event.currentTarget
      ? (target.dataset.resizeEdge as ResizeEdge | undefined)
      : undefined
  }

  // Pointer capture retargets the double-click to the window itself, so the
  // edge it started on is remembered.
  const pressedEdge = React.useRef<ResizeEdge | undefined>(undefined)
  // The same goes for the title bar of a draggable window.
  const pressedDragRegion = React.useRef(false)

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    onPointerDown?.(event)
    pressedDragRegion.current = false
    if (maximized || event.defaultPrevented || event.button !== 0) return

    const edge = resizable ? resizeEdge(event) : undefined
    pressedEdge.current = edge
    if (edge) return startResize(event, edge)
    if (!draggable) return

    const element = event.currentTarget
    const target = event.target as HTMLElement
    const region = target.closest(DRAG_REGION)
    if (
      !region ||
      region.closest('[data-slot="window"]') !== element ||
      target.closest(NO_DRAG)
    ) {
      return
    }

    // Pointer movement is in screen pixels; divide by any CSS scale applied
    // to the window (e.g. a scaled-down preview) to get layout pixels.
    const rect = element.getBoundingClientRect()
    const scale = rect.width / element.offsetWidth || 1
    const limit = Number.POSITIVE_INFINITY
    let min = { x: -limit, y: -limit }
    let max = { x: limit, y: limit }
    const parent = bounds === "parent" ? element.parentElement : null
    if (parent) {
      const area = parent.getBoundingClientRect()
      min = {
        x: current.x + (area.left - rect.left) / scale,
        y: current.y + (area.top - rect.top) / scale,
      }
      max = {
        x: current.x + (area.right - rect.right) / scale,
        y: current.y + (area.bottom - rect.bottom) / scale,
      }
    }

    pressedDragRegion.current = true
    drag.current = {
      pointer: { x: event.clientX, y: event.clientY },
      start: current,
      scale,
      min,
      max,
    }
    element.setPointerCapture(event.pointerId)
    setDragging(true)
    // Keeps the drag from selecting text.
    event.preventDefault()
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    onPointerMove?.(event)
    if (resize.current) return handleResize(event)
    const state = drag.current
    if (!state) return
    // A window larger than its bounds slides between its two edges.
    const within = (value: number, a: number, b: number) =>
      Math.min(Math.max(a, b), Math.max(Math.min(a, b), value))
    const next = {
      x: within(state.start.x + (event.clientX - state.pointer.x) / state.scale, state.min.x, state.max.x),
      y: within(state.start.y + (event.clientY - state.pointer.y) / state.scale, state.min.y, state.max.y),
    }
    move(next)
  }

  function endDrag(event: React.PointerEvent<HTMLDivElement>) {
    if (!drag.current && !resize.current) return
    drag.current = null
    resize.current = null
    anchor.current = null
    setDragging(false)
    setResizing(null)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  const insets = { top: 0, right: 0, bottom: 0, left: 0, ...maximizeInsets }

  // With a fixed width (or height) only the other two edges resize, along
  // their full length.
  const fixedWidth = minSize?.width !== undefined && minSize.width === maxSize?.width
  const fixedHeight = minSize?.height !== undefined && minSize.height === maxSize?.height
  const handles = (Object.keys(RESIZE_HANDLES) as ResizeEdge[]).filter(
    (edge) => !(fixedWidth && /[ew]/.test(edge)) && !(fixedHeight && /[ns]/.test(edge))
  )

  return (
    <WindowContext.Provider value={context}>
      <div
        ref={(node) => {
          element.current = node
          if (typeof ref === "function") return ref(node)
          if (ref) ref.current = node
        }}
        data-slot="window"
        data-inactive={inactive || undefined}
        data-draggable={draggable || undefined}
        data-dragging={dragging || undefined}
        data-resizable={resizable || undefined}
        data-resizing={resizing ?? undefined}
        data-maximized={maximized || undefined}
        data-minimized={hidden || undefined}
        aria-hidden={hidden || undefined}
        inert={hidden || undefined}
        className={cn(
          "group/window relative isolate overflow-hidden rounded-mac-window bg-(--window-background,var(--mac-window)) text-mac-body text-mac-label shadow-mac-window data-[inactive]:shadow-mac-window-inactive",
          // Layout: an optional sidebar column, then the main column. In
          // the main column the bar (title bar, toolbar) goes on top, the
          // fill item takes the free height, the rest is as tall as it needs:
          // items before the fill sit above it, items after it below. The
          // fill item is WindowContent, or without one the first item that
          // isn't a bar.
          "grid grid-cols-[[main-start]_minmax(0,1fr)_[main-end]] grid-rows-[auto_auto_auto_minmax(0,1fr)_auto_auto]",
          "has-[>[data-slot=mac-sidebar]]:grid-cols-[[sidebar-start]_auto_[main-start]_minmax(0,1fr)_[main-end]]",
          "*:data-[slot=mac-sidebar]:[grid-column:sidebar-start] *:data-[slot=mac-sidebar]:[grid-row:1/-1]",
          "*:not-data-[slot=mac-sidebar]:not-data-[slot=window-resize-handle]:[grid-column:main]",
          "*:data-[slot=toolbar]:row-start-1 *:data-[slot=window-titlebar]:row-start-1 *:data-window-drag-region:row-start-1",
          "*:data-[slot=window-content]:row-start-4",
          "[&:not(:has(>[data-slot=window-content]))>:nth-child(1_of_:not([data-slot=mac-sidebar],[data-slot=toolbar],[data-slot=window-titlebar],[data-window-drag-region],[data-slot=window-resize-handle]))]:row-start-4",
          "[&>[data-slot=window-content]~:not([data-slot=window-resize-handle])]:row-start-5 [&>[data-slot=window-content]~:not([data-slot=window-resize-handle])~:not([data-slot=window-resize-handle])]:row-start-6",
          "[&:not(:has(>[data-slot=window-content]))>:nth-child(1_of_:not([data-slot=mac-sidebar],[data-slot=toolbar],[data-slot=window-titlebar],[data-window-drag-region],[data-slot=window-resize-handle]))~:not([data-slot=window-resize-handle])]:row-start-5",
          // The main column's background, a layer behind it. With a sidebar
          // the window itself is clear, so the sidebar's material shows
          // what's behind it, and the title bar's top-left corner meets the
          // sidebar, so it isn't rounded.
          "before:absolute before:inset-0 before:-z-10 before:rounded-[inherit] before:[grid-column:main] before:bg-(--window-background,var(--mac-window))",
          "has-[>[data-slot=mac-sidebar]]:bg-transparent has-[>[data-slot=mac-sidebar]]:before:rounded-l-none has-[>[data-slot=mac-sidebar]]:*:data-[slot=window-titlebar]:rounded-tl-none",
          // The thin light rim drawn on top of everything inside the frame.
          "after:pointer-events-none after:absolute after:inset-0 after:z-50 after:rounded-[inherit] after:shadow-[inset_0_0_0_1px_var(--mac-window-rim)]",
          // Touch drags on the drag regions move the window instead of scrolling.
          "data-[draggable]:[&_:is([data-slot=window-titlebar],[data-slot=toolbar],[data-slot=mac-sidebar-header],[data-window-drag-region])]:touch-none data-[dragging]:select-none",
          // While resizing, the content can't take the pointer or change the
          // cursor, and an iframe can't swallow the moves of a drag.
          "data-[resizing]:select-none data-[resizing]:*:pointer-events-none data-[dragging]:[&_iframe]:pointer-events-none",
          "data-[minimized]:invisible",
          className
        )}
        style={
          maximized
            ? {
                ...style,
                // Override any positioning from classes, e.g. centering.
                position: "absolute",
                top: insets.top,
                left: insets.left,
                right: "auto",
                bottom: "auto",
                margin: 0,
                translate: "none",
                width: `calc(100% - ${insets.left + insets.right}px)`,
                height: `calc(100% - ${insets.top + insets.bottom}px)`,
              }
            : {
                ...style,
                ...currentSize,
                translate:
                  current.x || current.y
                    ? `${current.x}px ${current.y}px`
                    : undefined,
                cursor: resizing ? RESIZE_CURSORS[resizing] : style?.cursor,
              }
        }
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={(event) => {
          onPointerUp?.(event)
          endDrag(event)
        }}
        onPointerCancel={(event) => {
          onPointerCancel?.(event)
          endDrag(event)
        }}
        onDoubleClick={(event) => {
          onDoubleClick?.(event)
          const edge =
            resizeEdge(event) ??
            (event.target === event.currentTarget ? pressedEdge.current : undefined)
          if (resizable && edge && !event.defaultPrevented) {
            return fillToEdge(event.currentTarget, edge, event.altKey)
          }
          // Double-clicking the title bar zooms the window, as on macOS.
          const target = event.target as HTMLElement
          if (
            onZoom &&
            zoomable &&
            !event.defaultPrevented &&
            (pressedDragRegion.current ||
              (target.closest(DRAG_REGION)?.closest('[data-slot="window"]') === event.currentTarget &&
                !target.closest(NO_DRAG)))
          ) {
            onZoom()
          }
        }}
        {...props}
      >
        {children}
        {resizable && !maximized && !hidden
          ? handles.map((edge) => (
              <div
                key={edge}
                aria-hidden="true"
                data-slot="window-resize-handle"
                data-resize-edge={edge}
                className={cn(
                  "absolute z-50 touch-none",
                  RESIZE_HANDLES[edge],
                  fixedWidth && "inset-x-0",
                  fixedHeight && "inset-y-0"
                )}
              />
            ))
          : null}
      </div>
    </WindowContext.Provider>
  )
}

// A plain title bar with the window controls and a centered title,
// for windows without a toolbar.
function WindowTitlebar({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="window-titlebar"
      className={cn(
        "relative flex h-8 shrink-0 items-center rounded-t-[inherit] border-b border-mac-separator px-[11px] select-none mac-material-titlebar",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

function WindowTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="window-title"
      className={cn(
        "pointer-events-none absolute inset-x-24 truncate text-center text-mac-body font-semibold text-mac-label group-data-[inactive]/window:text-mac-label-tertiary",
        className
      )}
      {...props}
    />
  )
}

function WindowContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="window-content"
      className={cn("min-h-0 min-w-0 flex-1 overflow-auto", className)}
      {...props}
    />
  )
}

function WindowControlButton({
  className,
  ...props
}: React.ComponentProps<"button">) {
  return (
    <button
      type="button"
      className={cn(
        "flex size-3.5 items-center justify-center rounded-full shadow-(--mac-traffic-edge) outline-none focus-visible:outline-3 focus-visible:outline-solid focus-visible:outline-mac-accent/50 disabled:[background:var(--mac-traffic-inactive)] group-data-[inactive]/window:[background:var(--mac-traffic-inactive)] group-data-[inactive]/window:shadow-none [&_svg]:size-2.5 [&_svg]:text-black/55 [&_svg]:opacity-0 group-hover/controls:not-disabled:[&_svg]:opacity-100",
        className
      )}
      {...props}
    />
  )
}

// The red, yellow and green "traffic light" buttons. Without handlers of
// their own they call the onClose, onMinimize and onZoom of their Window.
function WindowControls({
  className,
  onClose,
  onMinimize,
  onZoom,
  ...props
}: Omit<React.ComponentProps<"div">, "children"> & {
  onClose?: () => void
  onMinimize?: () => void
  onZoom?: () => void
}) {
  const context = React.useContext(WindowContext)
  onClose ??= context?.onClose
  onMinimize ??= context?.onMinimize
  onZoom ??= context?.onZoom

  return (
    <div
      data-slot="window-controls"
      className={cn("group/controls flex items-center gap-[9px]", className)}
      {...props}
    >
      <WindowControlButton
        aria-label="Close"
        onClick={onClose}
        className="[background:var(--mac-traffic-close)]"
      >
        <XIcon strokeWidth={3} />
      </WindowControlButton>
      <WindowControlButton
        aria-label="Minimize"
        disabled={context?.minimizable === false}
        onClick={onMinimize}
        className="[background:var(--mac-traffic-minimize)]"
      >
        <MinusIcon strokeWidth={3} />
      </WindowControlButton>
      <WindowControlButton
        aria-label="Zoom"
        disabled={context?.zoomable === false}
        onClick={onZoom}
        className="[background:var(--mac-traffic-zoom)]"
      >
        <svg viewBox="0 0 8 8" fill="currentColor" aria-hidden="true">
          <path d="M1.5 6.5V3.2L4.8 6.5H1.5ZM6.5 1.5V4.8L3.2 1.5H6.5Z" />
        </svg>
      </WindowControlButton>
    </div>
  )
}

export type { WindowInsets, WindowPosition, WindowSize }
export {
  Window,
  WindowContent,
  WindowControls,
  WindowTitle,
  WindowTitlebar,
}
