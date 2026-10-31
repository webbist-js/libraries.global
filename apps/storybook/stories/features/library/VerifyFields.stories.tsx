import { VerifyFields } from "@/components/library/VerifyFields"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { useId } from "react"
import { useArgs } from "storybook/preview-api"
import { fn } from "storybook/test"

import { InteractiveArgs } from "../../../.storybook/InteractiveArgs"
import { verifyLibrary } from "../../fixtures/geography/library"

const meta = {
  title: "Features/Library/VerifyFields",
  component: VerifyFields,
  args: {
    record: verifyLibrary,
    available: ["hours", "status", "address", "contact"],
    sections: ["hours", "status"],
    onSections: fn(),
    source: "",
    onSource: fn(),
    inPerson: false,
    onInPerson: fn(),
    problem: null,
    problemField: null,
    idPrefix: "verify-example",
  },
  render: function Render(supplied) {
    const id = useId()
    const [, syncControls] = useArgs()

    return (
      <InteractiveArgs args={supplied} onUpdate={syncControls}>
        {(args, updateArgs) => (
          <VerifyFields
            {...args}
            idPrefix={`${args.idPrefix}-${id}`}
            onSections={(sections) => {
              args.onSections(sections)
              updateArgs({ sections })
            }}
            onSource={(source) => {
              args.onSource(source)
              updateArgs({ source })
            }}
            onInPerson={(inPerson) => {
              args.onInPerson(inPerson)
              updateArgs({ inPerson })
            }}
          />
        )}
      </InteractiveArgs>
    )
  },
} satisfies Meta<typeof VerifyFields>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const SourceRequired: Story = {
  args: {
    problem: "Add a source, or confirm you checked in person.",
    problemField: "source",
  },
}
export const NoSections: Story = {
  args: {
    sections: [],
    problem: "Choose at least one part of the record.",
    problemField: "sections",
  },
}
