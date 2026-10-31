import { DataAccountSection } from "@/app/[locale]/profile/settings/_components/DataAccountSection"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import {
  profileResponses,
  readerSession,
} from "../../fixtures/workspace/profile"

const meta = {
  title: "Features/Settings/DataAccountSection",
  component: DataAccountSection,
  args: { sessionUser: readerSession.user },
  parameters: {
    fixtureSession: readerSession,
    fixtureResponses: profileResponses,
    docs: { story: { inline: false, height: "900px" } },
  },
} satisfies Meta<typeof DataAccountSection>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
