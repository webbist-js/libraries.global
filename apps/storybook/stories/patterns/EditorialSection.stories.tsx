import { EditorialSection } from "@/components/ds/EditorialSection"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Patterns/EditorialSection",
  component: EditorialSection,
  args: {
    section: {
      eyebrow: "Library stories",
      title: "A reading room for everyone",
      image: {
        url: "/library-placeholder.svg",
        alternativeText: "Illustrated library",
      },
      imagePosition: "right",
      body: [
        {
          type: "paragraph",
          children: [
            {
              type: "text",
              text: "A synthetic example of a community library’s story.",
            },
          ],
        },
      ],
    },
  },
} satisfies Meta<typeof EditorialSection>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const ImageLeft: Story = {
  args: { section: { ...meta.args.section, imagePosition: "left" } },
}
export const WithoutImage: Story = {
  args: { section: { ...meta.args.section, image: null } },
}
