import librarySchema from "../src/api/library/content-types/library/schema.json"

describe("library opening times schema", () => {
  it("uses the opening times custom field on the library content type", () => {
    expect(librarySchema.attributes.openingTimes).toMatchObject({
      type: "customField",
      customField: "global::opening-times",
      pluginOptions: {
        i18n: {
          localized: false,
        },
      },
    })
  })
})
