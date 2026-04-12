import { setPluginConfig } from "@_sh/strapi-plugin-ckeditor"
import type { StrapiApp } from "@strapi/strapi/admin"
import type { ComponentType } from "react"

// eslint-disable-next-line import-x/order
import { cs } from "./cs"
import "@repo/design-system/styles.css"

// eslint-disable-next-line import-x/order
import { defaultCkEditorConfig, simpleCkEditorConfig } from "./ckeditor/configs"
import { OPENING_TIMES_FIELD_NAME } from "../customFields/openingTimes/shared"

export default {
  config: {
    locales: ["en", "cs"],
    translations: {
      cs,
    },
  },
  async bootstrap(_app: StrapiApp) {
    const adminPanelConfigEnv = process.env.ADMIN_PANEL_CONFIG_API_AUTH_TOKEN
    if (adminPanelConfigEnv) {
      /**
       * Fetch admin panel config at runtime (e.g., theme settings)
       * and apply them to the admin panel.
       *
       * This can be used to inject CSS into the admin panel based on runtime env variables.
       * This is an example of usage, feel free to modify per your needs.
       */
      const configRequest = await fetch("/api/admin-panel-config", {
        headers: {
          Authorization: `Bearer ${process.env.ADMIN_PANEL_CONFIG_API_AUTH_TOKEN}`,
        },
      })
      if (configRequest.ok) {
        const configData = await configRequest.json()

        // Set the variable to the window object so it can be accessed globally
        // @ts-expect-error untyped global
        globalThis.ADMIN_PANEL_CONFIG = configData

        // Set data-theme attribute on document element so that we can potentially include CSS themes
        document.documentElement.dataset.theme =
          configData.APP_BRAND.toLowerCase()

        const colors =
          configData.APP_BRAND === "BRAND_A"
            ? { primary: "#123123", accent: "#234234" }
            : { primary: "#321321", accent: "#432432" }

        document.documentElement.style.setProperty(
          "--color-primary-default",
          colors.primary
        )
        document.documentElement.style.setProperty(
          "--color-accent-dark",
          colors.accent
        )
      } else {
        console.error(await configRequest.text())
      }
    }
  },
  register(app: StrapiApp) {
    setPluginConfig({ presets: [defaultCkEditorConfig, simpleCkEditorConfig] })

    const getTranslation = (id: string) => `${OPENING_TIMES_FIELD_NAME}.${id}`

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
