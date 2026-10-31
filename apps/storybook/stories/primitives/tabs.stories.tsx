import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Primitives/tabs",
  component: Tabs,
  args: { defaultValue: "overview" },
  render: (args) => (
    <Tabs {...args}>
      <TabsList aria-label="Library details">
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="access">Accessibility</TabsTrigger>
      </TabsList>
      <TabsContent value="overview">
        A community library with public reading rooms.
      </TabsContent>
      <TabsContent value="access">
        Step-free access to the main reading room.
      </TabsContent>
    </Tabs>
  ),
} satisfies Meta<typeof Tabs>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
