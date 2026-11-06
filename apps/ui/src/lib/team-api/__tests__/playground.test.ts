import { describe, expect, it } from "vitest"

import {
  playgroundJob,
  playgroundRequest,
  playgroundScope,
} from "../playground"

const base = { query: "", entityRef: "", limit: 10, locale: "en" }

describe("playground resource requests", () => {
  it("builds the real versioned routes for services, analysis and proposals", () => {
    expect(
      playgroundRequest({
        ...base,
        operation: "serviceLibraries",
        serviceRef: "network00000000000000001",
      }).path
    ).toBe(
      "/api/v1/services/network00000000000000001/libraries?locale=en&limit=10"
    )
    const reach = playgroundRequest({
      ...base,
      operation: "reach",
      reachMode: "service",
      serviceRef: "network00000000000000001",
      areaCode: "E06000023",
      minutes: 15,
    })
    expect(reach.method).toBe("POST")
    expect(JSON.parse(reach.body!)).toEqual({
      mode: "service",
      ref: "network00000000000000001",
      travelMode: "walking",
      minutes: 15,
      areaCode: "E06000023",
    })
    expect(
      JSON.parse(
        playgroundRequest({
          ...base,
          operation: "summary",
          summaryOperation: "place.profile",
          country: "united-kingdom",
        }).body!
      )
    ).toEqual({
      operation: "place.profile",
      place: { country: "united-kingdom" },
      locale: "en",
    })
    expect(
      playgroundRequest({ ...base, operation: "jobResult", jobId: "reach:abc" })
        .path
    ).toBe("/api/v1/analysis/jobs/reach%3Aabc/result")
    expect(playgroundScope("proposal")).toBe("submissions:write")
    expect(playgroundScope("job")).toBe("analysis:run")
  })
  it("reads a job and bounds its polling interval", () => {
    expect(
      playgroundJob({ job: { id: "reach:x", state: "pending", retryAfter: 1 } })
    ).toEqual({
      id: "reach:x",
      state: "pending",
      retryAfter: 3,
    })
    expect(playgroundJob({ data: [] })).toBeNull()
  })
})
