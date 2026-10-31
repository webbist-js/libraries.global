import { resolveCapabilities, toSessionCapabilities } from "@repo/access"

import {
  readerSession,
  type FixtureSession,
} from "../../../.storybook/FixtureSession"

export const contributorSession = {
  ...readerSession,
  user: {
    ...readerSession.user,
    ...toSessionCapabilities(
      resolveCapabilities({ signedIn: true, grants: [], claims: [] })
    ),
    staffLibraries: readerSession.user.staffLibraries,
  },
} satisfies NonNullable<FixtureSession>
export const editorSession = {
  ...readerSession,
  user: {
    ...readerSession.user,
    ...toSessionCapabilities(
      resolveCapabilities({
        signedIn: true,
        grants: [
          { role: "wiki_editor", queue: "knowledge", locale: "en" },
          { role: "journal_editor", queue: "journal", locale: "en" },
        ],
        claims: [],
      })
    ),
    staffLibraries: readerSession.user.staffLibraries,
  },
} satisfies NonNullable<FixtureSession>
