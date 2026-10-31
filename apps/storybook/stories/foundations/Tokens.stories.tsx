import { T, TYPE_TINT } from "@/lib/design-tokens"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = { title: "Foundations/Tokens" } satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

export const Surfaces: Story = {
  render: () => (
    <div className="grid gap-3 sm:grid-cols-3">
      {Object.entries(T.bg).map(([name, background]) => (
        <div
          key={name}
          className="rounded-xl border p-6"
          style={{
            background,
            color: name === "inverse" ? T.ink.inverse : T.ink.base,
          }}
        >
          <strong>{name}</strong>
          <code className="mt-3 block text-xs">{background}</code>
        </div>
      ))}
    </div>
  ),
}
export const LibraryTypes: Story = {
  render: () => (
    <div className="grid gap-3 sm:grid-cols-3">
      {Object.entries(TYPE_TINT).map(([name, tint]) => (
        <div
          key={name}
          className="rounded-xl p-6"
          style={{ background: tint.bg, color: tint.fg }}
        >
          {name}
        </div>
      ))}
    </div>
  ),
}
export const TypeScale: Story = {
  render: () => (
    <div className="grid gap-6">
      {Object.entries(T.type).map(([name, font]) => (
        <div key={name}>
          <code className="text-sm">{name}</code>
          <p className="m-0" style={{ font }}>
            Libraries for everyone
          </p>
        </div>
      ))}
    </div>
  ),
}
