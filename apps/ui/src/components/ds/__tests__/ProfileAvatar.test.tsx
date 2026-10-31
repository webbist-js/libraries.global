// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, expect, it } from "vitest"

import { ProfileAvatar } from "../ProfileAvatar"

afterEach(cleanup)
it("falls back after an image fails and tries a new image without losing the chosen palette", () => {
  const palette = { bg: "purple", fg: "white" }
  const view = render(
    <ProfileAvatar
      src="/first.png"
      initials="AB"
      palette={palette}
      label="Alex"
    />
  )
  const frame = screen.getByRole("img", { name: "Alex" })
  fireEvent.error(frame.querySelector("img")!)
  expect(frame.textContent).toBe("AB")
  expect(frame.style.background).toBe("purple")
  view.rerender(
    <ProfileAvatar
      src="/second.png"
      initials="AB"
      palette={palette}
      label="Alex"
    />
  )
  expect(frame.querySelector("img")?.getAttribute("src")).toBe("/second.png")
})
it("avoids repeating adjacent identity and supplies a neutral empty fallback", () => {
  const { container } = render(<ProfileAvatar initials=" " />)
  expect(container.firstElementChild?.getAttribute("aria-hidden")).toBe("true")
  expect(container.textContent).toBe("?")
})
