import { SelectField } from "@/components/ds/SelectField"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import {
  profileResponses,
  readerSession,
} from "../../fixtures/workspace/profile"

const meta = {
  title: "Features/Profile form/Select",
  component: SelectField,
  args: {
    label: "Preferred language",
    defaultValue: "en",
    options: [
      { value: "en", label: "English" },
      { value: "fr", label: "French" },
    ],
  },
  parameters: {
    fixtureSession: readerSession,
    fixtureResponses: profileResponses,
    docs: { story: { inline: false } },
  },
} satisfies Meta<typeof SelectField>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
