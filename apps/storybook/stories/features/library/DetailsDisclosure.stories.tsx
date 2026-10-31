import { DetailsDisclosure } from "@/components/library/LibraryChangeTimeline"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, userEvent, within } from "storybook/test"

import {
  libraryResponses,
  libraryServerFixtures,
} from "../../fixtures/geography/library"

const meta = {
  title: "Features/Library/DetailsDisclosure",
  component: DetailsDisclosure,
  args: {
    label: "Two details imported",
    children: (
      <dl>
        <dt>Name</dt>
        <dd>Northbridge Community Library</dd>
        <dt>Website</dt>
        <dd>example.invalid/library</dd>
      </dl>
    ),
  },
  parameters: {
    fixtureResponses: libraryResponses,
    serverFixtures: libraryServerFixtures,
  },
} satisfies Meta<typeof DetailsDisclosure>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByText("Two details imported"))
    await expect(
      canvas.getByText("Northbridge Community Library")
    ).toBeVisible()
  },
}
