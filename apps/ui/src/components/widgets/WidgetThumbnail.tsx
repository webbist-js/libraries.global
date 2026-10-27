import type { WidgetType } from "@repo/shared-data"

/** Decorative format previews. These illustrate a layout, never pretend to be data. */
export function WidgetThumbnail({ type }: { readonly type: WidgetType }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 240 112"
      className="h-full w-full rounded-xl bg-(--t-bg-surface) text-(--t-accent-primary)"
    >
      <rect
        x="18"
        y="14"
        width="204"
        height="84"
        rx="8"
        fill="var(--t-bg-deep)"
        stroke="var(--t-border-line)"
      />
      {type === "finder" ? (
        <>
          <path d="M26 22H142V90H26Z" fill="#E9EDE3" />
          <path
            d="M30 78L128 26M40 26L134 78M26 56L142 42M82 22L67 90"
            stroke="#fff"
            strokeWidth="7"
          />
          <path
            d="M112 22Q84 54 118 90"
            fill="none"
            stroke="#C6DDE2"
            strokeWidth="8"
          />
          {[
            [52, 43],
            [92, 65],
            [119, 37],
          ].map(([x, y]) => (
            <circle
              key={x}
              cx={x}
              cy={y}
              r="5"
              fill="currentColor"
              stroke="#fff"
              strokeWidth="2"
            />
          ))}
          {[30, 52, 74].map((y) => (
            <g key={y}>
              <rect x="154" y={y} width="52" height="5" rx="2" fill="#C1BDCF" />
              <rect
                x="154"
                y={y + 9}
                width="38"
                height="3"
                rx="1.5"
                fill="#E7E3DB"
              />
            </g>
          ))}
        </>
      ) : type === "directory" ? (
        <>
          {[28, 52, 76].map((y) => (
            <g key={y}>
              <rect x="30" y={y} width="16" height="16" rx="4" fill="#EAE7FF" />
              <path
                d={`M54 ${y + 3}h76`}
                stroke="#A6A1B6"
                strokeWidth="4"
                strokeLinecap="round"
              />
              <path
                d={`M54 ${y + 12}h120`}
                stroke="#E7E3DB"
                strokeWidth="3"
                strokeLinecap="round"
              />
              <circle
                cx="202"
                cy={y + 8}
                r="5"
                fill="currentColor"
                opacity=".5"
              />
            </g>
          ))}
        </>
      ) : type === "chart" ? (
        <>
          {[48, 116, 84].map((width, i) => (
            <g key={width}>
              <rect
                x="32"
                y={29 + i * 22}
                width="38"
                height="4"
                rx="2"
                fill="#C1BDCF"
              />
              <rect
                x="80"
                y={24 + i * 22}
                width={width}
                height="13"
                rx="4"
                fill="currentColor"
                opacity={1 - i * 0.24}
              />
            </g>
          ))}
        </>
      ) : (
        <>
          <rect x="42" y="28" width="46" height="7" rx="3" fill="#C1BDCF" />
          <path
            d="M44 70V45h10v25m9 0V45h10v25m9 0V45h10v25"
            stroke="currentColor"
            strokeWidth="5"
          />
          <path
            d="M122 46h72m-72 12h60m-60 12h68"
            stroke="#D7D3DF"
            strokeWidth="4"
            strokeLinecap="round"
          />
          <rect x="42" y="81" width="64" height="3" rx="1.5" fill="#E7E3DB" />
        </>
      )}
    </svg>
  )
}
