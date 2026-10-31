import { OrganisationPicker } from "@/components/event-feeds/OrganisationPicker"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Features/Event feeds/OrganisationPicker",
  component: OrganisationPicker,
  parameters: { docs: { story: { inline: false, height: "760px" } } },
  args: {
    documentId: "example-feed",
    libraryDocumentId: "example-library",
    librarySlug: "northbridge",
    organizations: [
      { id: "example-organisation", name: "Example Library Service" },
    ],
  },
} satisfies Meta<typeof OrganisationPicker>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
