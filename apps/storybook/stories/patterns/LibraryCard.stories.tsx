import { LibraryCard } from "@/components/ds/LibraryCard"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect } from "storybook/test"

const meta = {
  title: "Patterns/LibraryCard",
  component: LibraryCard,
  args: {
    documentId: "storybook-library",
    name: "Northbridge Community Library",
    shortName: "Northbridge",
    libraryType: "Public",
    city: "Northbridge",
    countryName: "Example country",
    foundedYear: "1902",
    href: "/index/example-library",
    heroImageUrl: "/library-placeholder.svg",
    variant: "compact",
    index: 0,
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 480 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof LibraryCard>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Featured: Story = {
  args: { variant: "featured" },
  play: async ({ canvas }) => {
    await expect(
      canvas.getByRole("link").getBoundingClientRect().height
    ).toBeGreaterThan(400)
  },
}
export const MissingImage: Story = { args: { heroImageUrl: null } }
export const LongName: Story = {
  args: {
    name: "The Northbridge and District Community Reading Room and Reference Library",
  },
}
