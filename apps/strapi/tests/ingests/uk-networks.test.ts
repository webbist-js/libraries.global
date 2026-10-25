import { expect, it } from "vitest"

import { libraryOnNetwork } from "../../scripts/ingests/uk/libraryon-networks"

it("keeps nation identity separate from source authority and geography", () => {
  expect(
    libraryOnNetwork("gb:eng:cambridgeshire:cherry-hinton-library")
  ).toMatchObject({
    sourceKey: "libraryon:england:cambridgeshire",
    countryCode: "GB-ENG",
  })
  expect(libraryOnNetwork("gb:wls:cardiff:central-library")).toMatchObject({
    countryCode: "GB-WLS",
  })
  expect(
    libraryOnNetwork("gb:sct:glasgow-city:pollokshaws-library")
  ).toMatchObject({ countryCode: "GB-SCT" })
  expect(libraryOnNetwork("gb:nir:county-down:bangor-library")).toEqual(
    libraryOnNetwork("gb:nir:greater-belfast:central-library")
  )
  expect(libraryOnNetwork("gb:nir:county-down:bangor-library")).toMatchObject({
    name: "Libraries NI",
    countryCode: "GB-NIR",
  })
  expect(libraryOnNetwork("")).toBeNull()
  expect(libraryOnNetwork("gb:unk:unknown:library")).toBeNull()
})
