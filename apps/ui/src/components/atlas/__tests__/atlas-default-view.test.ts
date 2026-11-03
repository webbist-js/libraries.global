import { expect, it } from "vitest"

import { atlasStartView } from "../atlas-default-view"

it("opens on the visitor's region from their time zone, a step wider on phones", () => {
  expect(atlasStartView("Europe/London", false)).toMatchObject({
    lng: 10,
    zoom: 3.7,
  })
  expect(atlasStartView("America/Chicago", false).lng).toBe(-97)
  expect(atlasStartView("America/Sao_Paulo", false).lat).toBe(-18)
  expect(atlasStartView("America/Argentina/Buenos_Aires", false).lat).toBe(-18)
  expect(atlasStartView("Australia/Sydney", false).lng).toBe(140)
  expect(atlasStartView("Pacific/Auckland", false).lng).toBe(140)
  expect(atlasStartView("Atlantic/Reykjavik", false).lng).toBe(10)
  expect(atlasStartView("Etc/UTC", false)).toEqual({
    lat: 35,
    lng: 10,
    zoom: 2.3,
  })
  expect(atlasStartView(undefined, false).zoom).toBe(2.3)
  expect(atlasStartView("Europe/Paris", true).zoom).toBeCloseTo(2.9)
})
