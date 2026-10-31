import { addons } from "storybook/manager-api"
import { getPreferredColorScheme, themes } from "storybook/theming"

// Storybook chrome follows the OS independently of the component appearance toolbar.
const update = () =>
  addons.setConfig({ theme: themes[getPreferredColorScheme()] })
update()
window
  .matchMedia("(prefers-color-scheme: dark)")
  .addEventListener("change", update)
