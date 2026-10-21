"use client"

export function SkipToContent({ children }: { children: React.ReactNode }) {
  return (
    <a
      href="#main"
      className="skip-link"
      onClick={(event) => {
        const target = document.getElementById("main")
        if (!target) return
        event.preventDefault()
        target.focus({ preventScroll: true })
        target.scrollIntoView({ block: "start" })
      }}
    >
      {children}
    </a>
  )
}
