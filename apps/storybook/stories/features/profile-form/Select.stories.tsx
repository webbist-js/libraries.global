import { Select } from "@/components/profile-form/FormParts"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import {
  profileResponses,
  readerSession,
} from "../../fixtures/workspace/profile"

const meta = {
  title: "Features/Profile form/Select",
  component: Select,
  args: {
    "aria-label": "Preferred language",
    defaultValue: "en",
    children: (
      <>
        <option value="en">English</option>
        <option value="fr">French</option>
      </>
    ),
  },
  parameters: {
    fixtureSession: readerSession,
    fixtureResponses: profileResponses,
    docs: { story: { inline: false } },
  },
} satisfies Meta<typeof Select>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
