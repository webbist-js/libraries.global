import { ContributeMenuPanel } from "@/components/global/GlobalContributeMenu"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { useArgs } from "storybook/preview-api"
import { fn } from "storybook/test"

import { InteractiveArgs } from "../../../.storybook/InteractiveArgs"
import { navigationMenu, visitorMenu } from "../../fixtures/public/navigation"
import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/Global/ContributeMenuPanel",
  component: ContributeMenuPanel,
  args: { menu: navigationMenu, onNavigate: fn() },
  render: function Render(args) {
    const [, updateArgs] = useArgs()

    return (
      <InteractiveArgs args={args} onUpdate={updateArgs}>
        {(live, update) => (
          <ContributeMenuPanel
            {...live}
            menu={{
              ...live.menu,
              library: {
                ...live.menu.library,
                select: (id) => {
                  live.menu.library.select(id)
                  update({
                    menu: {
                      ...live.menu,
                      library: { ...live.menu.library, selectedId: id },
                    },
                  })
                },
              },
            }}
          />
        )}
      </InteractiveArgs>
    )
  },
  parameters: {
    serverFixtures: publicServerFixtures,
    fixtureResponses: publicResponses,
    docs: {
      story: { inline: false, iframeHeight: 800 },
      description: {
        component:
          "This example uses its own iframe to keep fixture transport and panel state independent. Open Canvas for interactive Controls.",
      },
    },
  },
} satisfies Meta<typeof ContributeMenuPanel>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Visitor: Story = { args: { menu: visitorMenu } }
