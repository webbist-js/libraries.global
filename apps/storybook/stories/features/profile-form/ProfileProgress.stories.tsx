import { ProfileProgress } from "@/components/profile-form/ProfileProgress"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import {
  profileResponses,
  readerSession,
} from "../../fixtures/workspace/profile"

const meta = {
  title: "Features/Profile form/ProfileProgress",
  component: ProfileProgress,
  args: {
    title: "Your profile",
    steps: [
      {
        id: "identity",
        label: "Identity",
        required: true,
        done: true,
        detail: "Your name is filled in.",
      },
      {
        id: "interests",
        label: "Interests",
        required: false,
        done: false,
        detail: "Choose a few topics.",
      },
    ],
    children: <button type="button">Save profile</button>,
  },
  parameters: {
    fixtureSession: readerSession,
    fixtureResponses: profileResponses,
    docs: { story: { inline: false } },
  },
} satisfies Meta<typeof ProfileProgress>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
