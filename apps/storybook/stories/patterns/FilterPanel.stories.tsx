import {
  FilterGroup,
  FilterHelper,
  FilterOption,
  FilterPanelHeader,
  FilterSidebar,
  FilterShowButton,
  FilterToggleButton,
  FilterDrawer,
  useFilterSidebar,
} from "@/components/ds/FilterPanel"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { useState } from "react"
import { expect } from "storybook/test"

function Filters() {
  const [selected, setSelected] = useState<string[]>([])
  const sidebar = useFilterSidebar("storybook-library-filters")
  const [open, setOpen] = useState(false)
  const options = [
    "Public",
    "Academic",
    "National",
    "Archive",
    "Special",
    "Mobile",
    "Community",
    "School",
    "Other",
  ]
  const toggle = (label: string) =>
    setSelected((current) =>
      current.includes(label)
        ? current.filter((item) => item !== label)
        : [...current, label]
    )
  const body = (
    <>
      <FilterPanelHeader onReset={() => setSelected([])} sidebar={sidebar} />
      <FilterGroup
        title="Library type"
        helper="Choose all types that interest you."
      >
        {options.map((label, i) => (
          <FilterOption
            key={label}
            type="checkbox"
            name="type"
            label={label}
            checked={selected.includes(label)}
            count={120 - i * 11}
            onChange={() => toggle(label)}
          />
        ))}
      </FilterGroup>
    </>
  )

  return (
    <div className="max-w-sm">
      <FilterShowButton sidebar={sidebar} />
      <FilterToggleButton
        expanded={open}
        onClick={() => setOpen(true)}
        activeCount={selected.length}
      />
      <FilterSidebar sidebar={sidebar}>{body}</FilterSidebar>
      <FilterDrawer
        open={open}
        onClose={() => setOpen(false)}
        showLabel="Show results"
      >
        {body}
      </FilterDrawer>
    </div>
  )
}
const meta = {
  title: "Patterns/Filters",
  component: FilterGroup,
  args: { title: "Library type" },
  render: () => <Filters />,
} satisfies Meta<typeof FilterGroup>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const SelectAndReset: Story = {
  play: async ({ canvas, userEvent }) => {
    const field = canvas.getByRole("checkbox", { name: /Public/ })
    await userEvent.click(field)
    await expect(field).toBeChecked()
    await userEvent.click(canvas.getByRole("button", { name: "Reset" }))
    await expect(field).not.toBeChecked()
  },
}

export const Helper: Story = {
  render: () => (
    <FilterHelper>
      Choose more than one type to broaden your results.
    </FilterHelper>
  ),
}
