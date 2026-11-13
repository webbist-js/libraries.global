import { createTranslator } from "next-intl"

import { createHomepageDefaults } from "@/components/home/homepage.content"

import messages from "../../locales/en"

export const HOMEPAGE_DEFAULTS = createHomepageDefaults(
  createTranslator({ locale: "en", messages, namespace: "homepageFallback" })
)
