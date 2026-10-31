import { useState, type ReactNode } from "react"

/** React owns live state; Storybook's render function synchronizes Controls. */
export function InteractiveArgs<Args extends object>({
  args: supplied,
  onUpdate,
  children,
}: {
  args: Args
  onUpdate: (patch: Partial<Args>) => void
  children: (args: Args, update: (patch: Partial<Args>) => void) => ReactNode
}) {
  const [state, setState] = useState({ supplied, value: supplied })
  if (state.supplied !== supplied) setState({ supplied, value: supplied })
  const update = (patch: Partial<Args>) => {
    setState((current) => ({
      ...current,
      value: { ...current.value, ...patch },
    }))
    onUpdate(patch)
  }

  return children(state.value, update)
}
