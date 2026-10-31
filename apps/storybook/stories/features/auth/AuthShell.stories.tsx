import { AuthLeftPanel } from "@/app/[locale]/auth/_components/AuthLeftPanel"
import { AuthShell } from "@/app/[locale]/auth/_components/AuthShell"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Features/Auth/AuthShell",
  component: AuthShell,
  args: {
    locale: "en",
    aside: <AuthLeftPanel mode="signin" />,
    footnote: "Your details stay private.",
    children: <p>Sign in to continue to your library workspace.</p>,
  },
  parameters: { docs: { story: { inline: false, height: "760px" } } },
} satisfies Meta<typeof AuthShell>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
