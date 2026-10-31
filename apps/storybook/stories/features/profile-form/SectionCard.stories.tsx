import { SectionCard } from "@/components/profile-form/FormParts"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import {
  profileResponses,
  readerSession,
} from "../../fixtures/workspace/profile"

const meta = {
  title: "Features/Profile form/SectionCard",
  component: SectionCard,
  args: {
    id: "example-profile-section",
    title: "About you",
    requirement: "optional",
    lead: "Introduce yourself to the library community.",
    children: <p>Share the details you want people to see.</p>,
  },
  parameters: {
    fixtureSession: readerSession,
    fixtureResponses: profileResponses,
    docs: { story: { inline: false } },
  },
} satisfies Meta<typeof SectionCard>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
