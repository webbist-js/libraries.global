import { readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

import * as billing from "../scripts/billing-content.mjs"
import * as rewards from "../scripts/rewards-guide-content.mjs"
import * as teamApi from "../scripts/team-api-knowledge-content.mjs"
import * as pricing from "../scripts/team-pricing-content.mjs"
import * as teamService from "../scripts/team-service-content.mjs"

const scripts = new URL("../scripts/", import.meta.url)

describe("retired paid-plan content scripts", () => {
  it("keep only plan-free helpers", () => {
    expect(Object.keys(pricing)).toEqual(["stripComponentIds"])
    expect(Object.keys(teamService)).toEqual(["canonicalTeamContent"])
    for (const module of [billing, rewards, teamApi])
      expect(Object.keys(module)).toEqual(["retired"])
  })

  it.each([
    "update-team-pricing.mjs",
    "update-billing-docs.mjs",
    "update-team-api-guides.mjs",
    "update-rewards-guides.mjs",
  ])("%s exits before touching a CMS", (name) => {
    const source = readFileSync(new URL(name, scripts), "utf8")
    expect(source).toContain("process.exit(1)")
    expect(source).not.toMatch(/\bfetch\(|import /)
  })

  it("strips component ids without mutating the original", () => {
    const original = [{ id: 1, body: [{ id: 2, text: "x" }] }]
    expect(pricing.stripComponentIds(original)).toEqual([
      { body: [{ text: "x" }] },
    ])
    expect(original[0]!.id).toBe(1)
  })

  it("canonicalizes workspace links while preserving payment return fields, locale and unrelated URLs", () => {
    const nodes = [
      {
        url: "/fr/staff/team/billing?team=old&payment=confirming#seats",
        children: [{ text: "Open /staff/team/new." }],
      },
      { url: "https://elsewhere.example/staff/team?team=old" },
      { url: "/api/staff/team/id" },
    ]
    const fixed = teamService.canonicalTeamContent(nodes)
    expect(fixed[0]).toEqual({
      url: "/fr/staff/teams/billing?payment=confirming#seats",
      children: [{ text: "Open /staff/teams/new." }],
    })
    expect(fixed.slice(1)).toEqual(nodes.slice(1))
    expect(teamService.canonicalTeamContent(fixed)).toEqual(fixed)
  })
})
