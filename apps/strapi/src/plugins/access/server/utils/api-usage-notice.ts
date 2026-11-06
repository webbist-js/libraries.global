/** Allowance labels for API usage warnings, by ledger dimension. */
export const API_NOTICE_DIMENSIONS: Readonly<Record<string, string>> = {
  requests: "successful requests",
  bytes: "response data",
  credits: "analysis credits",
  cap: "overage cap",
}

export const API_NOTICE_THRESHOLDS = [50, 80, 100] as const

/** Title and body for one 50/80/100% allowance or overage-cap warning. */
export function apiUsageNotice(
  dimension: string,
  threshold: number
): { title: string; body: string } {
  const label = API_NOTICE_DIMENSIONS[dimension]
  if (
    !label ||
    !(API_NOTICE_THRESHOLDS as readonly number[]).includes(threshold)
  )
    throw new RangeError("Unknown API notice")
  if (dimension === "cap")
    return {
      title: `Your API overage has reached ${threshold}% of its cap`,
      body:
        threshold === 100
          ? "Further paid API usage is stopped until the next billing period or a higher cap. Accrued charges remain on your next invoice."
          : "Check usage and your overage cap at /developers/usage.",
    }

  return {
    title: `Your API account has used ${threshold}% of its ${label}`,
    body:
      threshold === 100
        ? "Requests that need this allowance are refused until the next paid period, unless overage is turned on with room under its cap."
        : "Check usage, reset time and overage settings at /developers/usage.",
  }
}
