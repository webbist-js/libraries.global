import { CookieConsent } from "@/components/providers/CookieConsent"
import { ANALYTICS_CONSENT_KEY } from "@/lib/analytics-consent"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Features/Providers/CookieConsent",
  component: CookieConsent,
  beforeEach: () => {
    const previous = localStorage.getItem(ANALYTICS_CONSENT_KEY)
    localStorage.removeItem(ANALYTICS_CONSENT_KEY)

    return () => {
      if (previous === null) localStorage.removeItem(ANALYTICS_CONSENT_KEY)
      else localStorage.setItem(ANALYTICS_CONSENT_KEY, previous)
    }
  },
  args: { locale: "en" },
  parameters: { docs: { story: { inline: false, height: "720px" } } },
} satisfies Meta<typeof CookieConsent>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
