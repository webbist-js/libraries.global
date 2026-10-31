import { buildFooterNavigation } from "@/components/global/footer-navigation"
import { FooterNavigationProvider } from "@/components/global/FooterNavigationContext"
import { GlobalFooter } from "@/components/global/GlobalFooter"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { footerData, legalDocuments } from "../fixtures/public/homepage"

const meta = {
  title: "Patterns/Site footer",
  component: GlobalFooter,
  args: { locale: "en", footer: footerData, legalDocuments },
  decorators: [
    (Story) => (
      <FooterNavigationProvider
        navigation={buildFooterNavigation(footerData, legalDocuments, {
          legal: "Legal and policies",
          plans: "Plans and pricing",
        })}
      >
        <Story />
      </FooterNavigationProvider>
    ),
  ],
} satisfies Meta<typeof GlobalFooter>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const French: Story = {
  globals: { locale: "fr" },
  args: { locale: "fr" },
}
