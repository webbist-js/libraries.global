import { setPluginConfig } from "@_sh/strapi-plugin-ckeditor"
import type { StrapiApp } from "@strapi/strapi/admin"
import type { ComponentType } from "react"

// eslint-disable-next-line import-x/order
import { cs } from "./cs"
import "@repo/design-system/styles.css"

// eslint-disable-next-line import-x/order
import { defaultCkEditorConfig, simpleCkEditorConfig } from "./ckeditor/configs"
import { LOCATION_PICKER_FIELD_NAME } from "../customFields/locationPicker/shared"
import { MOBILE_TIMETABLE_FIELD_NAME } from "../customFields/mobileTimetable/shared"
import { OPENING_TIMES_FIELD_NAME } from "../customFields/openingTimes/shared"

export default {
  config: {
    locales: ["cs", "en", "fr"],
    translations: {
      cs,
    },
  },
  register(app: StrapiApp) {
    setPluginConfig({ presets: [defaultCkEditorConfig, simpleCkEditorConfig] })

    // ── Location Picker ────────────────────────────────────────────────────
    app.customFields.register({
      name: LOCATION_PICKER_FIELD_NAME,
      type: "json",
      intlLabel: {
        id: `${LOCATION_PICKER_FIELD_NAME}.label`,
        defaultMessage: "Location",
      },
      intlDescription: {
        id: `${LOCATION_PICKER_FIELD_NAME}.description`,
        defaultMessage:
          "Search for an address or enter coordinates to pin a location on the map.",
      },
      components: {
        Input: async () => {
          const component =
            await import("./custom-fields/location-picker/Input")

          return {
            default: component.default as unknown as ComponentType,
          }
        },
      },
    })

    const getTranslation = (id: string) => `${OPENING_TIMES_FIELD_NAME}.${id}`
    app.customFields.register({
      name: MOBILE_TIMETABLE_FIELD_NAME,
      type: "json",
      intlLabel: {
        id: "mobile-timetable.label",
        defaultMessage: "Mobile timetable",
      },
      intlDescription: {
        id: "mobile-timetable.description",
        defaultMessage: "Stops, visits and the vehicle's weekly cycle.",
      },
      components: {
        Input: async () => ({
          default: (await import("./custom-fields/mobile-timetable/Input"))
            .default as unknown as ComponentType,
        }),
      },
    })

    app.customFields.register({
      name: OPENING_TIMES_FIELD_NAME,
      type: "json",
      intlLabel: {
        id: getTranslation("label"),
        defaultMessage: "Opening times",
      },
      intlDescription: {
        id: getTranslation("description"),
        defaultMessage: "Manage weekly opening hours with multiple timeframes.",
      },
      components: {
        Input: async () => {
          const component = await import("./custom-fields/opening-times/Input")

          return {
            default: component.default as unknown as ComponentType,
          }
        },
      },
    })
  },
}
