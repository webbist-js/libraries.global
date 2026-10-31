import {
  Step,
  Field,
  CharCount,
  FieldMessage,
  Tag,
  CheckChip,
  Segments,
  Disclosure,
} from "@/components/drives/builder-ui"
import { Input } from "@/components/ui/input"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { useId, useState } from "react"

import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

function BuilderFields() {
  const id = useId(),
    [title, setTitle] = useState("Opening hours for all"),
    [checked, setChecked] = useState(true),
    [focus, setFocus] = useState("hours"),
    [open, setOpen] = useState(false)

  return (
    <div className="grid gap-5">
      <Field
        id={`${id}-title`}
        label="Drive title"
        hint="Keep the title concise."
        count={<CharCount id={`${id}-count`} length={title.length} max={120} />}
      >
        <Input
          id={`${id}-title`}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
        {!title.trim() && (
          <FieldMessage
            field="title"
            message="Add a title that describes the goal."
          />
        )}
        <Tag>Required</Tag>
      </Field>
      <CheckChip checked={checked} onChange={() => setChecked(!checked)}>
        Opening hours
      </CheckChip>
      <Segments
        name={`${id}-focus`}
        legend="Focus"
        options={[
          { value: "hours", label: "Opening hours" },
          { value: "photos", label: "Photographs" },
        ]}
        value={focus}
        onChange={setFocus}
      />
      <Disclosure
        id={`${id}-details`}
        open={open}
        onToggle={() => setOpen(!open)}
        title="More details"
      >
        <p>Add source and scope information.</p>
      </Disclosure>
    </div>
  )
}
const meta = {
  title: "Features/Drives/Step",
  component: Step,
  args: {
    n: 1,
    title: "Choose a focus",
    hint: "One clear goal makes a drive easier to join.",
    done: false,
    children: <BuilderFields />,
  },
  parameters: {
    serverFixtures: publicServerFixtures,
    fixtureResponses: publicResponses,
  },
} satisfies Meta<typeof Step>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
