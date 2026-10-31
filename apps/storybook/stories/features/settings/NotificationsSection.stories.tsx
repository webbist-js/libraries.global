import { NotificationsSection } from "@/app/[locale]/profile/settings/_components/NotificationsSection"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import {
  profile,
  profileResponses,
  readerSession,
} from "../../fixtures/workspace/profile"

const meta = {
  title: "Features/Settings/NotificationsSection",
  component: NotificationsSection,
  args: { profile, hasTeam: true },
  parameters: {
    fixtureSession: readerSession,
    fixtureResponses: profileResponses,
    docs: { story: { inline: false, height: "900px" } },
  },
} satisfies Meta<typeof NotificationsSection>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
