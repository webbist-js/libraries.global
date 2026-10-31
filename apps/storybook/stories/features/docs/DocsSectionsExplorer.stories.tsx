import { DocsSectionsExplorer } from "@/components/docs/DocsSectionsExplorer"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, within } from "storybook/test"

import { knowledgeRows } from "../../fixtures/public/knowledge"
import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/Docs/DocsSectionsExplorer",
  component: DocsSectionsExplorer,
  args: { sections: knowledgeRows },
  parameters: {
    serverFixtures: publicServerFixtures,
    fixtureResponses: publicResponses,
  },
} satisfies Meta<typeof DocsSectionsExplorer>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Empty: Story = { args: { sections: [] } }

/** A section's reading list includes every guide, beyond the overview preview. */
export const FocusedSection: Story = {
  args: {
    sections: [
      {
        ...knowledgeRows[0]!,
        rows: Array.from({ length: 7 }, (_, index) => ({
          ...knowledgeRows[0]!.rows[0]!,
          documentId: `example-guide-${index}`,
          title: `Example guide ${index + 1}`,
          href: `/knowledge/contributing/example-guide-${index}`,
        })),
      },
    ],
    focused: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      canvas.getAllByRole("link", { name: /Example guide/ })
    ).toHaveLength(7)
    await expect(canvas.queryByText("All sections")).not.toBeInTheDocument()
  },
}
