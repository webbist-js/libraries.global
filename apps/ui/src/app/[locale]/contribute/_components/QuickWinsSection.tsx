import { T } from "@/lib/design-tokens"
import type { QuickWin } from "@/lib/types/profile"

import { QuickWinsCarousel } from "./QuickWinsCarousel"

export function QuickWinsSection({ wins }: { readonly wins: QuickWin[] }) {
  return (
    <section style={{ padding: "48px 0 0" }}>
      <div className="mx-auto w-full max-w-[1296px] px-6 md:px-10">
        {/* Section heading */}
        <div style={{ marginBottom: "28px" }}>
          <h2
            style={{
              fontFamily: T.font.serif,
              fontSize: "clamp(1.6rem, 3vw, 2.4rem)",
              fontWeight: 600,
              lineHeight: 1.1,
              letterSpacing: "-0.02em",
              color: T.ink.base,
              margin: 0,
            }}
          >
            Quick{" "}
            <em
              style={{
                fontStyle: "italic",
                fontWeight: 400,
                color: T.accent.aurora,
              }}
            >
              wins
            </em>
            .
          </h2>
        </div>

        {/* Carousel (client) */}
        <QuickWinsCarousel wins={wins} />
      </div>
    </section>
  )
}
