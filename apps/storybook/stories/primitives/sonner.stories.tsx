import { Button } from "@/components/ui/button"
import { Toaster } from "@/components/ui/sonner"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { toast } from "sonner"

const meta = {
  title: "Primitives/sonner",
  component: Toaster,
  args: { position: "bottom-right" },
  render: (args) => (
    <>
      <Button
        variant="surface"
        onClick={() => toast.success("Example changes saved")}
      >
        Show notification
      </Button>
      <Toaster {...args} />
    </>
  ),
} satisfies Meta<typeof Toaster>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
