import {
  UtilityPage,
  UtilityPanel,
  UtilityHeading,
  UtilityLink,
} from "@/components/utility/UtilityPage"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Patterns/Utility page",
  component: UtilityPage,
  args: {
    children: (
      <UtilityPanel>
        <UtilityHeading
          title="We could not find that page"
          description="The address may have changed. Browse the library index to continue."
          tone="info"
        />
        <UtilityLink href="/libraries">Browse libraries</UtilityLink>
      </UtilityPanel>
    ),
  },
} satisfies Meta<typeof UtilityPage>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
