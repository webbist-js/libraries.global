// @vitest-environment happy-dom
import { afterEach, expect, it } from "vitest"

import {
  aboutViewport,
  setAboutViewport,
} from "@/components/about/about-viewport"

const box = (top: number, bottom: number) => ({
  top,
  bottom,
  height: bottom - top,
  left: 0,
  right: 1200,
  width: 1200,
  x: 0,
  y: top,
  toJSON: () => ({}),
})
afterEach(() => {
  document.body.innerHTML = ""
})

it("uses the desktop dashboard canvas below the actual toolbar", () => {
  document.body.innerHTML =
    '<div class="dashboard-page"><div class="dashboard-page-body" style="overflow-y:auto"><div class="record-toolbar"></div><section></section></div></div>'
  const canvas = document.querySelector<HTMLElement>(".dashboard-page-body")!
  const section = document.querySelector("section")!
  canvas.getBoundingClientRect = () => box(0, 700)
  document.querySelector(".record-toolbar")!.getBoundingClientRect = () =>
    box(0, 61)
  const viewport = setAboutViewport(section)
  expect(viewport.root).toBe(canvas)
  expect(viewport.top).toBe(61)
  expect(viewport.height).toBe(639)
  expect(section.style.getPropertyValue("--about-stage-height")).toBe("639px")
})

it("uses the mobile page scroll owner and excludes the bottom navigation", () => {
  document.body.innerHTML =
    '<div class="dashboard-page"><div class="dashboard-page-body" style="overflow-y:visible"><div class="record-toolbar"></div><section></section></div></div>'
  const page = document.querySelector<HTMLElement>(".dashboard-page")!
  page.getBoundingClientRect = () => box(56, 700)
  document.querySelector(".record-toolbar")!.getBoundingClientRect = () =>
    box(56, 121)
  const viewport = aboutViewport(document.querySelector("section")!)
  expect(viewport.root).toBe(page)
  expect(viewport.top).toBe(121)
  expect(viewport.bottom).toBe(700)
  expect(viewport.stickyTop).toBe(65)
})

it("uses the full content viewport when About has no toolbar", () => {
  document.body.innerHTML =
    '<div class="dashboard-page"><div class="dashboard-page-body" style="overflow-y:auto"><section></section></div></div>'
  document.querySelector(".dashboard-page-body")!.getBoundingClientRect = () =>
    box(0, 700)
  const viewport = setAboutViewport(document.querySelector("section")!)
  expect(viewport.top).toBe(0)
  expect(viewport.height).toBe(700)
})
