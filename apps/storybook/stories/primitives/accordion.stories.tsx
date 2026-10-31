import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Primitives/accordion",
  component: Accordion,
  args: { type: "single", collapsible: true },
  render: (args) => (
    <Accordion {...args}>
      <AccordionItem value="sources">
        <AccordionTrigger>What counts as a source?</AccordionTrigger>
        <AccordionContent>
          Use the library’s own published information where possible.
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="review">
        <AccordionTrigger>Who reviews changes?</AccordionTrigger>
        <AccordionContent>A moderator checks the evidence.</AccordionContent>
      </AccordionItem>
    </Accordion>
  ),
} satisfies Meta<typeof Accordion>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
