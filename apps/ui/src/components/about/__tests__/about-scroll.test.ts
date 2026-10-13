import { describe, expect, it } from "vitest"

import {
  activeAboutChapter,
  computeChapterProgress,
  formatAboutChapter,
} from "@/components/about/about-scroll"

describe("About scroll timeline", () => {
  const centres = [250, 640, 1690, 1880, 3050, 4490, 6200] as const

  it("aligns seven chapter poses to their measured positions", () => {
    centres.forEach((scrollY, chapter) => {
      expect(computeChapterProgress(scrollY, centres)).toBe(chapter)
    })
  })

  it("interpolates within each interval despite uneven section heights", () => {
    expect(computeChapterProgress(445, centres)).toBe(0.5)
    expect(computeChapterProgress(1165, centres)).toBe(1.5)
    expect(computeChapterProgress(1737.5, centres)).toBe(2.25)
    expect(computeChapterProgress(1785, centres)).toBe(2.5)
    expect(computeChapterProgress(5772.5, centres)).toBe(5.75)
  })

  it("retraces fractional poses when the visitor scrolls backwards", () => {
    const forward = [250, 445, 640, 1165, 1690, 1785, 1880]
    const poses = [0, 0.5, 1, 1.5, 2, 2.5, 3]

    expect(
      forward.map((scrollY) => computeChapterProgress(scrollY, centres))
    ).toEqual(poses)
    expect(
      [...forward]
        .reverse()
        .map((scrollY) => computeChapterProgress(scrollY, centres))
    ).toEqual([...poses].reverse())
  })

  it("holds the opening and closing poses beyond the story boundaries", () => {
    expect(computeChapterProgress(-800, centres)).toBe(0)
    expect(computeChapterProgress(0, centres)).toBe(0)
    expect(computeChapterProgress(250, centres)).toBe(0)
    expect(computeChapterProgress(6200, centres)).toBe(6)
    expect(computeChapterProgress(9000, centres)).toBe(6)
  })

  it.each([{ track: [] }, { track: [250] }])(
    "keeps incomplete measurements at the opening pose: $track",
    ({ track }) => {
      for (const scrollY of [-100, 0, 250, 1000]) {
        expect(computeChapterProgress(scrollY, track)).toBe(0)
      }
    }
  )

  it("selects the nearest chapter and clamps the seven-chapter controls", () => {
    expect(activeAboutChapter(-1)).toBe(0)
    expect(activeAboutChapter(0.49)).toBe(0)
    expect(activeAboutChapter(0.5)).toBe(1)
    expect(activeAboutChapter(4.49)).toBe(4)
    expect(activeAboutChapter(4.5)).toBe(5)
    expect(activeAboutChapter(6.9)).toBe(6)
  })

  it("formats zero-based chapter indices as folio numbers", () => {
    expect(
      Array.from({ length: 7 }, (_, chapter) => formatAboutChapter(chapter))
    ).toEqual(["01", "02", "03", "04", "05", "06", "07"])
    expect(formatAboutChapter(-1)).toBe("01")
    expect(formatAboutChapter(7)).toBe("07")
  })
})
