import {
  EVENT_PROVIDER_KEYS,
  FEED_STATUSES,
  FEED_TEST_CODES,
  PAUSED_REASONS,
} from "@repo/shared-data"
import { describe, expect, it } from "vitest"

import credentialEvent from "../../src/plugins/events/server/content-types/credential-event/schema.json"
import credential from "../../src/plugins/events/server/content-types/event-credential/schema.json"
import syncCommand from "../../src/plugins/events/server/content-types/sync-command/schema.json"

const a = credential.attributes as Record<string, any>

describe("event-credential schema", () => {
  it("takes its enums from the shared registry", () => {
    expect([...a.provider.enum].sort()).toEqual([...EVENT_PROVIDER_KEYS].sort())
    expect(a.status.enum).toEqual([...FEED_STATUSES])
    expect(a.pausedReason.enum).toEqual([...PAUSED_REASONS])
    expect(a.lastTestResult.enum).toEqual([...FEED_TEST_CODES])
    expect(a.pendingTestResult.enum).toEqual([...FEED_TEST_CODES])
    expect(a.lastErrorCode.enum).toEqual([...FEED_TEST_CODES])
  })

  it("keeps values and the connector private", () => {
    for (const k of [
      "credentialsEncrypted",
      "pendingCredentialsEncrypted",
      "connectedBy",
    ])
      expect(a[k].private).toBe(true)
  })

  it("has no isActive flag any more", () => {
    expect(a.isActive).toBeUndefined()
  })

  it("is hidden from the Content Manager, and so is the audit log", () => {
    expect(credential.pluginOptions["content-manager"].visible).toBe(false)
    expect(credentialEvent.pluginOptions["content-manager"].visible).toBe(false)
    expect(credentialEvent.collectionName).toBe("ev_credential_events")
  })

  it("lets a sync command name one feed", () => {
    expect((syncCommand.attributes as any).credentialDocumentId.type).toBe(
      "string"
    )
  })
})
