import { ActionCallout } from "@/components/ds/ActionCallout"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { useId } from "react"

const meta = {
  title: "Patterns/ActionCallout",
  component: ActionCallout,
  render: function Example(args) {
    const id = useId()

    return (
      <ActionCallout
        {...args}
        headingId={`${args.headingId ?? "example"}-${id}`}
      />
    )
  },
  args: {
    headingId: "recognition-heading",
    icon: "mdi:account-circle-outline",
    title: "Public recognition",
    children:
      "Supporters, recognised after 100 accepted contributions, can choose an optional profile mark and a listing on the Supporters page. Each is chosen separately in Privacy settings.",
    action: {
      href: "/community/supporters",
      label: "Meet the supporters",
    },
  },
} satisfies Meta<typeof ActionCallout>

export default meta
type Story = StoryObj<typeof meta>

export const Recognition: Story = {}

export const LibraryStaff: Story = {
  args: {
    headingId: "staff-heading",
    icon: undefined,
    eyebrow: "For library staff · Free",
    title: (
      <>
        Look after your library’s record,{" "}
        <em className="text-(--t-accent-primary)">free.</em>
      </>
    ),
    children:
      "Verification gives you free staff tools for your library. API Access is separate; paying never grants staff access.",
    action: { href: "/contribute/claim", label: "Claim your library" },
  },
}
