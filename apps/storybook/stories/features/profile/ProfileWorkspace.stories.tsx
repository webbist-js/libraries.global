import { ContactModalProvider } from "@/components/contact/ContactModalProvider"
import { ProfileWorkspace } from "@/components/profile/ProfileWorkspace"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { useQuery } from "@tanstack/react-query"
import type { ComponentProps } from "react"
import { fn } from "storybook/test"

import {
  profileWorkspace,
  profileResponses,
  readerSession,
} from "../../fixtures/workspace/profile"

type Args = Omit<ComponentProps<typeof ProfileWorkspace>, "query">
const meta = {
  title: "Features/Profile/Workspace",
  args: {
    user: readerSession.user,
    section: "overview",
    onDirtyChange: fn(),
    onRefresh: fn(),
    onHandoff: fn((action: () => void) => action()),
  },
  parameters: {
    fixtureSession: readerSession,
    fixtureResponses: profileResponses,
    docs: { story: { inline: false } },
  },
  render: function Example(args) {
    const query = useQuery({
      queryKey: ["storybook-workspace", args.user.id],
      queryFn: async () => profileWorkspace,
      initialData: profileWorkspace,
      staleTime: Infinity,
    })

    return (
      <ContactModalProvider>
        <ProfileWorkspace {...args} query={query} />
      </ContactModalProvider>
    )
  },
} satisfies Meta<Args>

export default meta
type Story = StoryObj<typeof meta>

export const Overview: Story = {}
export const Contributions: Story = { args: { section: "contributions" } }
export const Following: Story = { args: { section: "following" } }
export const Recognition: Story = { args: { section: "recognition" } }
