// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from "vitest"

import {
  rememberTeamApiChoice,
  teamApiChoiceSelected,
} from "../team-purchase-intent"

afterEach(() => {
  sessionStorage.clear()
  vi.unstubAllGlobals()
})
it("binds the optional choice to one Team, expires it and supports skipping", () => {
  rememberTeamApiChoice("team-a", true)
  expect(teamApiChoiceSelected("team-a")).toBe(true)
  expect(teamApiChoiceSelected("team-b")).toBe(false)
  expect(
    teamApiChoiceSelected("team-a", Date.now() + 24 * 60 * 60 * 1000 + 1)
  ).toBe(false)
  rememberTeamApiChoice("team-a", true)
  rememberTeamApiChoice("team-a", false)
  expect(teamApiChoiceSelected("team-a")).toBe(false)
})
it("does not block checkout when storage is unavailable or damaged", () => {
  sessionStorage.setItem("lg.team-api-next.v1:team-a", "not json")
  expect(teamApiChoiceSelected("team-a")).toBe(false)
  vi.stubGlobal("sessionStorage", {
    setItem: () => {
      throw new Error("blocked")
    },
    getItem: () => {
      throw new Error("blocked")
    },
    removeItem: () => {
      throw new Error("blocked")
    },
    clear: () => {},
  })
  expect(() => rememberTeamApiChoice("team-a", true)).not.toThrow()
  expect(teamApiChoiceSelected("team-a")).toBe(false)
})
