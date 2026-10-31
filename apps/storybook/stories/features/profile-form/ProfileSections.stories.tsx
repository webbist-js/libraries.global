import {
  IdentitySection,
  AffiliationSection,
  InterestsSection,
  LinksSection,
  VisibilitySection,
} from "@/components/profile-form/ProfileSections"
import { useProfileForm } from "@/components/profile-form/useProfileForm"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { profile } from "../../fixtures/workspace/profile"

type Args = {
  section: "identity" | "affiliation" | "interests" | "links" | "visibility"
  empty: boolean
}
function Example({ section, empty }: Args) {
  const form = useProfileForm({
    profile: empty ? null : profile,
    sessionName: "Maya Example",
    avatarUrl: null,
    imageUploadsEnabled: false,
  })

  return (
    <div className="max-w-3xl">
      {section === "identity" ? (
        <IdentitySection form={form} />
      ) : section === "affiliation" ? (
        <AffiliationSection form={form} />
      ) : section === "interests" ? (
        <InterestsSection form={form} />
      ) : section === "links" ? (
        <LinksSection form={form} />
      ) : (
        <VisibilitySection form={form} />
      )}
    </div>
  )
}
const meta = {
  title: "Features/Profile form/Sections",
  args: { section: "identity", empty: false },
  render: (args) => <Example key={String(args.empty)} {...args} />,
  parameters: {
    docs: { story: { inline: false, height: "900px" } },
    fixtureResponses: {
      "GET /api/profile/interests": { body: { data: [] } },
      "GET /api/profile/check-username": { body: { available: true } },
    },
  },
} satisfies Meta<Args>

export default meta
type Story = StoryObj<typeof meta>

export const Identity: Story = {}
export const NewProfile: Story = { args: { empty: true } }
export const Affiliation: Story = { args: { section: "affiliation" } }
export const Interests: Story = { args: { section: "interests" } }
export const Links: Story = { args: { section: "links" } }
export const Visibility: Story = { args: { section: "visibility" } }
