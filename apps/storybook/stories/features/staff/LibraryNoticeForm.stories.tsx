import { LibraryNoticeForm } from "@/components/staff/LibraryNoticeForm"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import {
  readerSession,
  profileResponses,
} from "../../fixtures/workspace/profile"

const meta = {
  title: "Features/Staff/LibraryNoticeForm",
  component: LibraryNoticeForm,
  args: {
    libraryDocumentId: "example-library",
    mobile: false,
    today: "2026-11-14",
  },
  parameters: {
    fixtureSession: readerSession,
    fixtureResponses: profileResponses,
    docs: { story: { inline: false } },
  },
} satisfies Meta<typeof LibraryNoticeForm>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
