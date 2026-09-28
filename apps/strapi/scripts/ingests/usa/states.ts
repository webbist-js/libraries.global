/**
 * US states and the District of Columbia, keyed by USPS code, for every US
 * ingest. Each becomes a Region of the United States.
 *
 * `timezone` is null where a state spans more than one IANA zone: an ingest
 * must then leave the library's timezone empty rather than guess.
 *
 * Territories (AS, GU, MP, PR, VI) are not listed. Whether they sit under
 * the United States or as their own countries is still to be decided.
 */

export interface UsState {
  name: string
  timezone: string | null
  /** What the state calls its county-level areas. */
  countyLabel: string
}

const COUNTY = "County"
const EASTERN = "America/New_York"
const CENTRAL = "America/Chicago"
const MOUNTAIN = "America/Denver"
const PACIFIC = "America/Los_Angeles"

export const US_STATES: Record<string, UsState> = {
  AL: { name: "Alabama", timezone: CENTRAL, countyLabel: COUNTY },
  AK: { name: "Alaska", timezone: null, countyLabel: "Borough" },
  AZ: { name: "Arizona", timezone: null, countyLabel: COUNTY },
  AR: { name: "Arkansas", timezone: CENTRAL, countyLabel: COUNTY },
  CA: {
    name: "California",
    timezone: PACIFIC,
    countyLabel: COUNTY,
  },
  CO: { name: "Colorado", timezone: MOUNTAIN, countyLabel: COUNTY },
  CT: {
    name: "Connecticut",
    timezone: EASTERN,
    countyLabel: COUNTY,
  },
  DE: { name: "Delaware", timezone: EASTERN, countyLabel: COUNTY },
  DC: {
    name: "District of Columbia",
    timezone: EASTERN,
    countyLabel: COUNTY,
  },
  FL: { name: "Florida", timezone: null, countyLabel: COUNTY },
  GA: { name: "Georgia", timezone: EASTERN, countyLabel: COUNTY },
  HI: { name: "Hawaii", timezone: "Pacific/Honolulu", countyLabel: COUNTY },
  ID: { name: "Idaho", timezone: null, countyLabel: COUNTY },
  IL: { name: "Illinois", timezone: CENTRAL, countyLabel: COUNTY },
  IN: { name: "Indiana", timezone: null, countyLabel: COUNTY },
  IA: { name: "Iowa", timezone: CENTRAL, countyLabel: COUNTY },
  KS: { name: "Kansas", timezone: null, countyLabel: COUNTY },
  KY: { name: "Kentucky", timezone: null, countyLabel: COUNTY },
  LA: { name: "Louisiana", timezone: CENTRAL, countyLabel: "Parish" },
  ME: { name: "Maine", timezone: EASTERN, countyLabel: COUNTY },
  MD: { name: "Maryland", timezone: EASTERN, countyLabel: COUNTY },
  MA: {
    name: "Massachusetts",
    timezone: EASTERN,
    countyLabel: COUNTY,
  },
  MI: { name: "Michigan", timezone: null, countyLabel: COUNTY },
  MN: { name: "Minnesota", timezone: CENTRAL, countyLabel: COUNTY },
  MS: { name: "Mississippi", timezone: CENTRAL, countyLabel: COUNTY },
  MO: { name: "Missouri", timezone: CENTRAL, countyLabel: COUNTY },
  MT: { name: "Montana", timezone: MOUNTAIN, countyLabel: COUNTY },
  NE: { name: "Nebraska", timezone: null, countyLabel: COUNTY },
  NV: { name: "Nevada", timezone: null, countyLabel: COUNTY },
  NH: {
    name: "New Hampshire",
    timezone: EASTERN,
    countyLabel: COUNTY,
  },
  NJ: {
    name: "New Jersey",
    timezone: EASTERN,
    countyLabel: COUNTY,
  },
  NM: { name: "New Mexico", timezone: MOUNTAIN, countyLabel: COUNTY },
  NY: { name: "New York", timezone: EASTERN, countyLabel: COUNTY },
  NC: {
    name: "North Carolina",
    timezone: EASTERN,
    countyLabel: COUNTY,
  },
  ND: { name: "North Dakota", timezone: null, countyLabel: COUNTY },
  OH: { name: "Ohio", timezone: EASTERN, countyLabel: COUNTY },
  OK: { name: "Oklahoma", timezone: CENTRAL, countyLabel: COUNTY },
  OR: { name: "Oregon", timezone: null, countyLabel: COUNTY },
  PA: {
    name: "Pennsylvania",
    timezone: EASTERN,
    countyLabel: COUNTY,
  },
  RI: {
    name: "Rhode Island",
    timezone: EASTERN,
    countyLabel: COUNTY,
  },
  SC: {
    name: "South Carolina",
    timezone: EASTERN,
    countyLabel: COUNTY,
  },
  SD: { name: "South Dakota", timezone: null, countyLabel: COUNTY },
  TN: { name: "Tennessee", timezone: null, countyLabel: COUNTY },
  TX: { name: "Texas", timezone: null, countyLabel: COUNTY },
  UT: { name: "Utah", timezone: MOUNTAIN, countyLabel: COUNTY },
  VT: { name: "Vermont", timezone: EASTERN, countyLabel: COUNTY },
  VA: { name: "Virginia", timezone: EASTERN, countyLabel: COUNTY },
  WA: {
    name: "Washington",
    timezone: PACIFIC,
    countyLabel: COUNTY,
  },
  WV: {
    name: "West Virginia",
    timezone: EASTERN,
    countyLabel: COUNTY,
  },
  WI: { name: "Wisconsin", timezone: CENTRAL, countyLabel: COUNTY },
  WY: { name: "Wyoming", timezone: MOUNTAIN, countyLabel: COUNTY },
}
