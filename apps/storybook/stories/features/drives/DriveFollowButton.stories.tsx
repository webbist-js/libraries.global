import { DriveFollowButton } from "@/components/drives/DriveFollowButton"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { drive } from "../../fixtures/public/drives"
import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"
import { contributorSession } from "../../fixtures/public/session"

const meta = {
  title: "Features/Drives/DriveFollowButton",
  component: DriveFollowButton,
  args: {
    driveDocumentId: drive.documentId,
    driveSlug: drive.slug,
    driveTitle: drive.title,
  },
  parameters: {
    fixtureSession: contributorSession,
    serverFixtures: publicServerFixtures,
    fixtureResponses: publicResponses,
  },
} satisfies Meta<typeof DriveFollowButton>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
