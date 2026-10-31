import { Drawer } from "@/components/ds/Drawer"
import { DrawerPresence } from "@/components/ds/DrawerPresence"
import { Button } from "@/components/ui/button"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { useState } from "react"

function Example() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button variant="surface" onClick={() => setOpen(true)}>
        Open workspace
      </Button>
      <DrawerPresence open={open}>
        {(onAfterClose) => (
          <Drawer
            open={open}
            title="Library workspace"
            titleId="workspace-title"
            onClose={() => setOpen(false)}
            onAfterClose={onAfterClose}
          >
            <p className="p-5">
              Mounted on demand, removed after focus restoration.
            </p>
          </Drawer>
        )}
      </DrawerPresence>
    </>
  )
}
const meta = {
  title: "Patterns/Drawer presence",
  component: DrawerPresence,
  args: { open: false, children: () => null },
  render: () => <Example />,
} satisfies Meta<typeof DrawerPresence>

export default meta
export const Default: StoryObj<typeof meta> = {}
