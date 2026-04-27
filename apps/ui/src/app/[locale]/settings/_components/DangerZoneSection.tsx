"use client"

import { toast } from "sonner"

import { authClient } from "@/lib/auth-client"
import { T } from "@/lib/design-tokens"
import type { BetterAuthUser } from "@/lib/auth-server"

export function DangerZoneSection({ sessionUser }: { sessionUser: BetterAuthUser }) {
  const signOut = async () => {
    await authClient.signOut()
    globalThis.location.href = "/"
  }

  return (
    <div>
      <h2 style={{ margin: "0 0 6px", fontSize: "16px", fontWeight: 600, color: T.accent.danger }}>Danger zone</h2>
      <p style={{ margin: "0 0 24px", fontSize: "13px", color: T.ink.faint }}>
        Irreversible actions. We&apos;ll always ask you to confirm before anything is removed.
      </p>

      <div
        style={{
          border: `1px solid rgba(255,100,100,0.2)`,
          borderRadius: "12px",
          overflow: "hidden",
        }}
      >
        {[
          {
            id: "export",
            label: "Export my data",
            desc: "Download a JSON archive of your profile, contributions, and activity history.",
            action: "Request export",
            // TODO: implement data export endpoint
            handler: () => toast.info("Data export — coming soon"),
            destructive: false,
          },
          {
            id: "deactivate",
            label: "Deactivate account",
            desc: "Hide your profile and pause notifications. Reversible.",
            action: "Deactivate",
            // TODO: implement deactivate — set profileVisibility to private + sign out
            handler: () => toast.info("Deactivation — coming soon"),
            destructive: true,
          },
          {
            id: "delete",
            label: "Delete account",
            desc: "Permanently remove your account and anonymise your contributions. This cannot be undone.",
            action: "Delete account",
            // TODO: implement full account deletion via BA + Strapi cascade
            handler: () => toast.info("Account deletion — coming soon. Please contact support."),
            destructive: true,
          },
        ].map((item, i, arr) => (
          <div
            key={item.id}
            style={{
              padding: "16px 20px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "16px",
              borderBottom: i < arr.length - 1 ? `1px solid rgba(255,100,100,0.12)` : "none",
            }}
          >
            <div>
              <p style={{ margin: 0, fontSize: "13px", color: item.destructive ? "rgba(255,140,140,0.9)" : T.ink.base }}>{item.label}</p>
              <p style={{ margin: "2px 0 0", fontSize: "12px", color: T.ink.faint }}>{item.desc}</p>
            </div>
            <button
              type="button"
              onClick={item.handler}
              style={{
                padding: "6px 14px",
                borderRadius: "6px",
                border: `1px solid ${item.destructive ? "rgba(255,100,100,0.3)" : T.border.line}`,
                background: item.destructive ? "rgba(255,100,100,0.06)" : "transparent",
                color: item.destructive ? "rgba(255,140,140,0.8)" : T.ink.dim,
                fontSize: "12px",
                fontFamily: T.font.sans,
                cursor: "pointer",
                flexShrink: 0,
                whiteSpace: "nowrap",
              }}
            >
              {item.action}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
