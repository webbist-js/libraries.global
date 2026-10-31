import { LibraryHoursTable } from "@/components/library/LibraryHoursTable"
import {
  LibrarySectionCard,
  LIB_ICONS,
} from "@/components/library/LibrarySectionCard"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { useId } from "react"

import { splitHours } from "../fixtures/opening-times"

const meta = {
  title: "Features/Library/SectionCard",
  component: LibrarySectionCard,
  render: function Example(args) {
    const id = useId()

    return <LibrarySectionCard {...args} id={`${args.id ?? "example"}-${id}`} />
  },
  args: {
    id: "visiting",
    title: "Plan a visit",
    iconPath: LIB_ICONS.clock,
    intro: "Check opening times before travelling.",
    showIcon: true,
    tone: "indigo",
    children: <p className="m-0 p-5">Monday to Friday, 09:00–18:00.</p>,
  },
} satisfies Meta<typeof LibrarySectionCard>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Compact: Story = { args: { compact: true } }
export const MissingDetails: Story = {
  args: {
    dashed: true,
    children: <p className="m-0 p-5">No opening times recorded.</p>,
  },
}

export const OpeningTimes: Story = {
  args: {
    title: "Opening hours",
    intro: "Check staffed and self-service times before travelling.",
    children: (
      <div className="p-5">
        <LibraryHoursTable
          openingTimes={splitHours}
          timezone="Europe/London"
          compact
        />
      </div>
    ),
  },
}
