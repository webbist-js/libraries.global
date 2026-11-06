/** Shared API dashboard formatters; safe in client and server components. */
export const formatApiBytes = (n: number, locale: string) => {
  if (n > 0 && n < 1024 ** 2)
    return new Intl.NumberFormat(locale).format(Math.round(n / 1024)) + " KiB"
  const gib = n >= 1024 ** 3

  return (
    new Intl.NumberFormat(locale, {
      minimumFractionDigits: gib ? 0 : 1,
      maximumFractionDigits: gib ? 2 : 1,
    }).format(n / 1024 ** (gib ? 3 : 2)) + (gib ? " GiB" : " MiB")
  )
}
export const formatPence = (pence: number, locale: string, currency = "gbp") =>
  new Intl.NumberFormat(locale, { style: "currency", currency }).format(
    pence / 100
  )
export const formatPeriodTime = (iso: string, locale: string) =>
  new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
  }).format(new Date(iso))
