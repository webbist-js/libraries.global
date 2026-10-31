import { TranslationBanner } from "@/components/library-editor/TranslationBanner"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { geographyResponses } from "../../fixtures/geography/responses"

const meta = {
  parameters: { fixtureResponses: geographyResponses },
  title: "Features/Library editor/TranslationBanner",
  component: TranslationBanner,
  args: { languageName: "French", missing: true },
} satisfies Meta<typeof TranslationBanner>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const ExistingTranslation: Story = { args: { missing: false } }
