"use client"

function openCookieSettings() {
  window.dispatchEvent(new Event("open-cookie-settings"))
}

export function CookieSettingsButton({
  locale = "en",
  className,
  onOpen,
}: {
  readonly locale?: string
  readonly className?: string
  readonly onOpen?: () => void
}) {
  return (
    <button
      type="button"
      className={className}
      onClick={() => {
        if (onOpen) {
          onOpen()
          requestAnimationFrame(openCookieSettings)
        } else openCookieSettings()
      }}
    >
      {locale === "fr"
        ? "Choix des cookies"
        : locale === "cs"
          ? "Nastavení cookies"
          : "Cookie choices"}
    </button>
  )
}
