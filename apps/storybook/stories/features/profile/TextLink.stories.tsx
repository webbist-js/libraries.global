import { TextLink } from "@/app/[locale]/profile/[username]/_components/ProfileSectionUI"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import {
  profileResponses,
  readerSession,
} from "../../fixtures/workspace/profile"

const meta = {
  title: "Features/Profile/TextLink",
  component: TextLink,
  args: { href: "/libraries", children: "Explore libraries" },
  parameters: {
    fixtureSession: readerSession,
    fixtureResponses: profileResponses,
    docs: { story: { inline: false, height: "800px" } },
  },
} satisfies Meta<typeof TextLink>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
