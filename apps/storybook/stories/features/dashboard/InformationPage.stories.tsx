import { InformationPage } from "@/components/dashboard/InformationPage"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import {
  profileResponses,
  readerSession,
} from "../../fixtures/workspace/profile"

const meta = {
  title: "Features/Dashboard/InformationPage",
  component: InformationPage,
  args: {
    title: "About the library index",
    links: [
      { href: "/about", label: "About" },
      { href: "/legal/privacy", label: "Privacy" },
    ],
    children: (
      <div className="p-6">
        <h2>Libraries, open to everyone</h2>
        <p>
          Explore reliable public information about libraries and their
          collections.
        </p>
      </div>
    ),
  },
  parameters: {
    fixtureSession: readerSession,
    fixtureResponses: profileResponses,
    docs: { story: { inline: false } },
  },
} satisfies Meta<typeof InformationPage>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
