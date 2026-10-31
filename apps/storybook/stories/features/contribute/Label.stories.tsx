import { Label } from "@/components/contribute/wizard-ui"
import { Input } from "@/components/ui/input"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { useId } from "react"

import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/Contribute/Label",
  component: Label,
  args: {
    htmlFor: "storybook-source-url",
    children: "Source URL",
    hint: "Use the library’s official website.",
  },
  render: function Example(args) {
    const id = useId()

    return (
      <div className="grid gap-2">
        <Label {...args} htmlFor={id} />
        <Input id={id} type="url" placeholder="https://example.org/library" />
      </div>
    )
  },
  parameters: {
    serverFixtures: publicServerFixtures,
    fixtureResponses: publicResponses,
  },
} satisfies Meta<typeof Label>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
