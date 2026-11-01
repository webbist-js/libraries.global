// @vitest-environment happy-dom
import {
  DesignSystemProvider,
  darkTheme,
  lightTheme,
} from "@strapi/design-system"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"

vi.mock("@strapi/strapi/admin", () => ({ useFetchClient: () => ({}) }))
import { PhotosPanel } from "../../src/plugins/content-moderation/admin/src/components/SubmissionPanels"

afterEach(cleanup)
it.each([lightTheme, darkTheme])(
  "keeps the original upload URL and offers an original-image link on failure",
  (theme) => {
    const url = "https://media.example.org/library.jpg?signature=abc"
    render(
      <DesignSystemProvider theme={theme}>
        <PhotosPanel images={[{ strapiId: 1, url, isHero: true }]} />
      </DesignSystemProvider>
    )
    const img = screen.getByRole("img", { name: "Submitted photo 1 (hero)" })
    expect(img.getAttribute("src")).toBe(url)
    fireEvent.error(img)
    expect(screen.getByText("Preview unavailable")).toBeTruthy()
    expect(
      screen
        .getByRole("link", { name: /Open original image/ })
        .getAttribute("href")
    ).toBe(url)
    expect(screen.queryByRole("img")).toBeNull()
  }
)
