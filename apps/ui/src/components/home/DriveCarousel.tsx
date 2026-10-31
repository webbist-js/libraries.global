"use client"

import { ArrowLeft, ArrowRight } from "lucide-react"
import { useTranslations } from "next-intl"
import {
  Children,
  isValidElement,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
  type ReactNode,
} from "react"

import styles from "@/components/home/DriveCarousel.module.css"

/** A fixed index-card stack with directional content fades.
 * Content stays server-rendered; only navigation is client-side. */
export function DriveCarousel({
  children,
  label,
}: {
  readonly children: ReactNode
  readonly label: string
}) {
  const t = useTranslations("homepageContribute")
  const cards = Children.toArray(children)
  const count = cards.length
  const [current, setCurrent] = useState(0)
  const [destination, setDestination] = useState<number | null>(null)
  const region = useRef<HTMLDivElement>(null)
  const front = useRef<HTMLDivElement>(null)
  const animations = useRef<Animation[]>([])
  const entering = useRef<-1 | 1 | null>(null)
  const drag = useRef<{ id: number; x: number; y: number; dx: number } | null>(
    null
  )
  const suppressClick = useRef(false)
  const busy = useRef(false)

  useEffect(() => () => animations.current.forEach((item) => item.cancel()), [])

  function fadeContent(
    card: HTMLDivElement,
    direction: -1 | 1,
    enter: boolean
  ) {
    const easing =
      getComputedStyle(card).getPropertyValue("--motion-ease-out").trim() ||
      "ease-out"
    const content = Array.from(card.firstElementChild?.children ?? [])
    animations.current = content.map((element) =>
      element.animate(
        enter
          ? [
              { transform: `translateX(${direction * 12}px)`, opacity: 0 },
              { transform: "translateX(0)", opacity: 1 },
            ]
          : [
              { transform: "translateX(0)", opacity: 1 },
              { transform: `translateX(${-direction * 12}px)`, opacity: 0 },
            ],
        { duration: enter ? 160 : 100, easing, fill: "both" }
      )
    )

    return Promise.all(animations.current.map((item) => item.finished))
  }

  useLayoutEffect(() => {
    const direction = entering.current
    const card = front.current
    if (direction === null || !card) return
    entering.current = null
    // Hold the outgoing content hidden until React has committed the next card.
    animations.current.forEach((item) => item.cancel())
    fadeContent(card, direction, true).then(
      () => {
        animations.current.forEach((item) => item.cancel())
        animations.current = []
        setDestination(null)
        busy.current = false
      },
      () => {}
    )
  }, [current])

  function clearDrag() {
    front.current?.removeAttribute("data-dragging")
    drag.current = null
  }

  function move(direction: -1 | 1) {
    if (count < 2 || busy.current) return
    busy.current = true
    const next = (current + direction + count) % count
    const card = front.current
    if (card?.contains(document.activeElement)) {
      region.current?.focus({ preventScroll: true })
    }
    const complete = () => {
      setCurrent(next)
      clearDrag()
    }
    if (
      !card?.animate ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      complete()
      setDestination(null)
      busy.current = false

      return
    }
    setDestination(next)
    fadeContent(card, direction, false).then(
      () => {
        entering.current = direction
        complete()
      },
      () => {}
    )
  }

  function pointerDown(event: PointerEvent<HTMLDivElement>) {
    suppressClick.current = false
    if (busy.current || count < 2 || !event.isPrimary || event.button !== 0)
      return
    drag.current = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      dx: 0,
    }
  }

  function pointerMove(event: PointerEvent<HTMLDivElement>) {
    const start = drag.current
    const card = front.current
    if (!start || !card || start.id !== event.pointerId || busy.current) return
    const dx = event.clientX - start.x
    const dy = event.clientY - start.y
    if (
      !suppressClick.current &&
      Math.abs(dy) > Math.abs(dx) &&
      Math.abs(dy) > 8
    ) {
      clearDrag()

      return
    }
    if (Math.abs(dx) < 8 && !suppressClick.current) return
    suppressClick.current = true
    card.setPointerCapture(event.pointerId)
    card.dataset.dragging = "true"
    start.dx = dx
  }

  function pointerUp(event: PointerEvent<HTMLDivElement>) {
    const start = drag.current
    if (!start || start.id !== event.pointerId) return
    if (front.current?.hasPointerCapture(event.pointerId))
      front.current.releasePointerCapture(event.pointerId)
    const threshold = Math.min(88, (front.current?.offsetWidth ?? 400) * 0.18)
    if (Math.abs(start.dx) >= threshold) move(start.dx < 0 ? 1 : -1)
    else clearDrag()
  }

  return (
    <div
      ref={region}
      role="region"
      aria-roledescription="carousel"
      aria-label={label}
      tabIndex={0}
      className={styles.carousel}
      onKeyDown={(event) => {
        if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return
        event.preventDefault()
        move(event.key === "ArrowRight" ? 1 : -1)
      }}
    >
      <div className={styles.viewport}>
        <div className={styles.deck}>
          {cards.map((card, index) => {
            const active = index === current
            const depth = (index - current + count) % count

            return (
              <div
                key={isValidElement(card) ? card.key : card?.toString()}
                ref={active ? front : undefined}
                role="group"
                aria-roledescription="slide"
                aria-label={`${index + 1} / ${count}`}
                aria-hidden={!active}
                inert={!active}
                className={styles.card}
                data-front={active}
                data-hidden={!active && depth > 2}
                style={
                  {
                    "--depth": Math.min(depth, 2),
                    zIndex: active ? count + 1 : count - depth,
                  } as CSSProperties
                }
                onPointerDown={active ? pointerDown : undefined}
                onPointerMove={active ? pointerMove : undefined}
                onPointerUp={active ? pointerUp : undefined}
                onPointerCancel={active ? clearDrag : undefined}
                onClickCapture={(event) => {
                  if (!suppressClick.current) return
                  event.preventDefault()
                  event.stopPropagation()
                  suppressClick.current = false
                }}
              >
                {card}
              </div>
            )
          })}
        </div>
      </div>
      {count > 1 ? (
        <div className="home-carousel-controls">
          <span aria-live="polite" aria-atomic="true">
            {t("position", { current: current + 1, total: count })}
          </span>
          <div>
            <button
              type="button"
              className={styles.control}
              aria-label="Previous drive"
              onClick={() => move(-1)}
              disabled={destination !== null}
            >
              <ArrowLeft aria-hidden="true" size={19} />
            </button>
            <button
              type="button"
              className={styles.control}
              aria-label="Next drive"
              onClick={() => move(1)}
              disabled={destination !== null}
            >
              <ArrowRight aria-hidden="true" size={19} />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
