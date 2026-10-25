import { expect, it } from "vitest"

import { parseContextQuery } from "../atlas-context"

it("accepts bounded tile, search and point requests without arbitrary asset URLs", () => {
  expect(
    parseContextQuery(
      new URLSearchParams(
        "kind=tile&release=population-gb-test&z=14&x=16383&y=0"
      )
    ).get("x")
  ).toBe("16383")
  expect(
    parseContextQuery(
      new URLSearchParams(
        "kind=search&release=deprivation-gb-eng-test&q=City+of+London&offset=30"
      )
    ).get("q")
  ).toBe("City of London")
  expect(
    parseContextQuery(
      new URLSearchParams(
        "kind=point&release=population-gb-test&lng=-2.9&lat=53.4"
      )
    ).get("lat")
  ).toBe("53.4")
})
it.each([
  "kind=tile&release=population-gb-test&z=15&x=0&y=0",
  "kind=tile&release=population-gb-test&z=1&x=2&y=0",
  "kind=tile&release=population-gb-test&z=1&x=-1&y=0",
  "kind=tile&release=population-gb-test&z=1&x=0&x=1&y=0",
  "kind=point&release=population-gb-test&lat=NaN&lng=1",
  "kind=point&release=population-gb-test&lat=89&lng=1",
  "kind=search&release=../../private&offset=0",
  "kind=geometry&release=https://example.com",
  "kind=catalogue&file=/etc/passwd",
  "kind=search&release=deprivation-gb-eng-test&offset=40001",
])("rejects invalid or excessive context input: %s", (query) => {
  expect(() => parseContextQuery(new URLSearchParams(query))).toThrow(
    RangeError
  )
})
