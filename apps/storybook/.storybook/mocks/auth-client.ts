import { fn } from "storybook/test"

import { useFixtureSession } from "../FixtureSession"

const blocked = async () => ({
  data: null,
  error: {
    code: "STORYBOOK_FIXTURE",
    message:
      "Authentication is simulated in Storybook. Select a session fixture to preview signed-in UI.",
  },
})

export const authClient = {
  useSession: useFixtureSession,
  signIn: {
    email: fn(blocked),
    magicLink: fn(blocked),
    passkey: fn(blocked),
    social: fn(blocked),
  },
  signOut: fn(async () => ({ data: { success: true }, error: null })),
  sendVerificationEmail: fn(blocked),
  passkey: {
    listUserPasskeys: fn(async () => ({ data: [], error: null })),
    addPasskey: fn(blocked),
    deletePasskey: fn(blocked),
  },
}
