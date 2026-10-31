import { KnowledgeSidebarFooter } from "@/components/articles/EditorialSidebar"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect } from "storybook/test"

const meta = {
  title: "Features/Knowledge/Sidebar actions",
  component: KnowledgeSidebarFooter,
  args: { slug: "finding-a-library", contentLocale: "fr" },
  argTypes: {
    contentLocale: { control: "select", options: ["en", "fr", "cs"] },
  },
  decorators: [
    (Story) => (
      <div style={{ width: 300, maxWidth: "100%" }}>
        <Story />
      </div>
    ),
  ],
  parameters: {
    docs: {
      description: {
        component:
          "The actual Knowledge footer. The content locale stays in report links even when the interface language differs.",
      },
    },
  },
} satisfies Meta<typeof KnowledgeSidebarFooter>

export default meta
type Story = StoryObj<typeof meta>

export const Article: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("link")).toHaveAttribute(
      "href",
      "/contribute/knowledge/finding-a-library?mode=report&locale=fr&sourceLocale=fr"
    )
  },
}
export const MissingGuide: Story = {
  args: { slug: undefined },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("link")).toHaveAttribute(
      "href",
      "/contribute/knowledge"
    )
  },
}
export const FrenchInterface: Story = {
  globals: { locale: "fr" },
  args: { contentLocale: "en" },
}
