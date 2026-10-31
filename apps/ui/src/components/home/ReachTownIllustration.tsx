import {
  TOWN_BUILDINGS,
  TOWN_RIVER_PATH,
  TOWN_NODES,
  TOWN_STREETS,
  townCatchmentPath,
} from "@/components/home/reach-town"

const CATCHMENT = townCatchmentPath(15)
const MAIN_STREETS = new Set([
  "a1-b1",
  "b1-c1",
  "c1-d1",
  "d1-bottom1",
  "c0-c1",
  "c1-c2",
  "c2-library",
  "library-d3",
  "d3-bottom3",
  "b3-b4",
  "b4-northWest",
  "northWest-northEast",
  "northEast-ne1",
  "ne1-ne2",
  "d3-d4",
  "d4-southWest",
  "southWest-southEast",
  "southEast-eastLower",
  "eastLower-farSE",
])

/** A filled, street-constrained catchment over a readable fictional town basemap. */
export function ReachTownIllustration() {
  const library = TOWN_NODES.library!

  return (
    <svg
      viewBox="-75 -50 760 506.6667"
      role="img"
      aria-labelledby="home-town-title home-town-description"
      className="home-reach-illustration"
    >
      <title id="home-town-title">
        An illustrative fifteen-minute walking catchment
      </title>
      <desc id="home-town-description">
        A translucent purple catchment branches out from a library along the
        roads of a fictional town, narrowing as the walking time runs out.
        Roads, buildings and parks remain visible beneath it. The river can be
        crossed only at two bridges.
      </desc>
      <rect
        x="-75"
        y="-50"
        width="760"
        height="507"
        fill="var(--t-bg-surface)"
      />
      <g fill="#DDE9D1">
        <path d="M5 7 87 0 95 26 57 43 35 35 5 53Z" />
        <path d="M217 0 247 0 252 28 286 37 272 49 226 35Z" />
        <path d="M0 324 25 310 42 337 35 382 6 396Z" />
        <path d="M549 262 610 246 610 289 574 302Z" />
        <path d="M320 329 349 322 374 348 359 384 330 370Z" />
      </g>
      <path d={TOWN_RIVER_PATH} fill="none" stroke="#C6E0E2" strokeWidth="27" />
      <path
        d="M146 155 199 155 194 198 153 192Z"
        fill="#D3E4C5"
        stroke="#C8DBB9"
      />
      <g fill="#BED3AF" opacity=".85">
        {[
          [159, 168],
          [176, 165],
          [187, 180],
          [166, 184],
        ].map(([x, y]) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r="5" />
        ))}
      </g>
      <g fill="#DEDAD1" stroke="#D2CDC2" strokeWidth=".4">
        {TOWN_BUILDINGS.map((building) => (
          <rect
            key={building.id}
            x={building.x - building.width / 2}
            y={building.y - building.height / 2}
            width={building.width}
            height={building.height}
            rx=".6"
            transform={`rotate(${building.angle} ${building.x} ${building.y})`}
          />
        ))}
        <path d="M235 158 252 153 262 170 243 178Z" />
        <path d="M292 223 319 230 315 245 289 240Z" />
        <rect x="503" y="353" width="29" height="12" rx="1" />
      </g>
      <g fill="none" strokeLinecap="round" strokeLinejoin="round">
        {TOWN_STREETS.map((street) => (
          <g key={street.id}>
            <path
              d={`M${TOWN_NODES[street.from]!.x} ${TOWN_NODES[street.from]!.y}L${TOWN_NODES[street.to]!.x} ${TOWN_NODES[street.to]!.y}`}
              stroke={MAIN_STREETS.has(street.id) ? "#E7D9A9" : "#EAE5DC"}
              strokeWidth={MAIN_STREETS.has(street.id) ? 7 : 4.5}
            />
            <path
              d={`M${TOWN_NODES[street.from]!.x} ${TOWN_NODES[street.from]!.y}L${TOWN_NODES[street.to]!.x} ${TOWN_NODES[street.to]!.y}`}
              stroke={MAIN_STREETS.has(street.id) ? "#FFF1C4" : "#FFFFFF"}
              strokeWidth={MAIN_STREETS.has(street.id) ? 4.5 : 3}
            />
          </g>
        ))}
      </g>
      <path
        d={CATCHMENT}
        fill="#7763BD"
        fillOpacity=".23"
        stroke="#8672BC"
        strokeWidth="1.5"
        strokeLinejoin="round"
        fillRule="evenodd"
      />
      <g
        fontFamily="var(--font-figtree), sans-serif"
        fontSize="9"
        fill="#817D76"
      >
        <text x="54" y="38" letterSpacing="1">
          WESTFIELD
        </text>
        <text x="483" y="49" letterSpacing="1">
          EAST BANK
        </text>
        <text x="154" y="150" fontSize="8">
          Town park
        </text>
        <text x="74" y="204" transform="rotate(-5 74 204)">
          Market Street
        </text>
        <text x="279" y="326">
          South Road
        </text>
        <text x="488" y="384">
          Station
        </text>
      </g>
      <g transform={`translate(${library.x} ${library.y})`}>
        <circle
          r="19"
          fill="#4338CA"
          fillOpacity=".10"
          stroke="#5143C8"
          strokeWidth="1.8"
        />
        <circle r="6.5" fill="#31594F" stroke="white" strokeWidth="2" />
        <rect
          x="-41"
          y="26"
          width="82"
          height="22"
          rx="11"
          fill="white"
          stroke="#DDD8CC"
        />
        <text
          y="41"
          textAnchor="middle"
          fontFamily="var(--font-figtree), sans-serif"
          fontSize="10"
          fontWeight="600"
          fill="#17162B"
        >
          Town library
        </text>
      </g>
      <g transform="translate(-55 -32)">
        <rect width="113" height="26" rx="13" fill="white" stroke="#E5E0D5" />
        <circle cx="14" cy="13" r="4" fill="#7763BD" fillOpacity=".4" />
        <text
          x="25"
          y="17"
          fontFamily="var(--font-figtree), sans-serif"
          fontSize="10"
          fontWeight="600"
          fill="#514378"
        >
          15 minute walk
        </text>
      </g>
    </svg>
  )
}
