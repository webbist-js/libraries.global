// @vitest-environment happy-dom
// apps/ui/src/app/[locale]/auth/_components/__tests__/native-submit.test.ts
//
// Before hydration a form submits natively, without its JS handler. Every
// auth form with a secret field must then POST to its own page, never GET
// its values into a query string, and its submit stays disabled until the
// form has mounted.
import { cleanup, render } from "@testing-library/react"
import * as React from "react"
import { createElement, type ReactElement } from "react"
import { renderToString } from "react-dom/server"
import { afterEach, describe, expect, it, vi } from "vitest"

// vitest.config has no JSX runtime, so .tsx compiles to React.createElement.
Object.assign(globalThis, { React })

// AppForm's dev helper imports env validation; these forms need no env.
vi.mock("@/lib/env-vars", () => ({ getEnvVar: () => {} }))
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}))
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}))
vi.mock("@iconify/react", () => ({ Icon: () => null }))
vi.mock("@/lib/navigation", async () => {
  const { createElement: h } = await import("react")

  return {
    Link: ({ href, children }: { href: string; children?: React.ReactNode }) =>
      h("a", { href }, children),
    formatHref: (href?: string | null) => href || "#",
    isAppLink: () => true,
    useRouter: () => ({ push: vi.fn() }),
  }
})
vi.mock("@/lib/auth-client", () => ({
  authClient: {
    getSession: vi.fn(),
    signIn: { magicLink: vi.fn(), social: vi.fn() },
  },
}))
vi.mock("@/hooks/useUserMutations", () => {
  const idle = () => ({ isPending: false, mutate: vi.fn() })

  return {
    useUserMutations: () => ({
      signInMutation: idle(),
      registerMutation: idle(),
      forgotPasswordMutation: idle(),
      changePasswordMutation: idle(),
      resetPasswordMutation: idle(),
    }),
  }
})

const { SignInForm } = await import("../../signin/_components/SignInForm")
const { RegisterForm } = await import("../../register/_components/RegisterForm")
const { ForgotPasswordForm } =
  await import("../../forgot-password/_components/ForgotPasswordForm")
const { ChangePasswordForm } =
  await import("../../change-password/_components/ChangePasswordForm")
const { SetPasswordForm } =
  await import("../../activate/_components/SetPasswordForm")

afterEach(() => {
  cleanup()
  document.body.innerHTML = ""
})

const FORMS: [name: string, element: () => ReactElement, action: string][] = [
  ["sign-in", () => createElement(SignInForm), "/auth/signin"],
  ["register", () => createElement(RegisterForm), "/auth/register"],
  [
    "forgot-password",
    () => createElement(ForgotPasswordForm),
    "/auth/forgot-password",
  ],
  [
    "change-password",
    () => createElement(ChangePasswordForm),
    "/auth/change-password",
  ],
  [
    "reset-password",
    () => createElement(SetPasswordForm, { token: "token" }),
    "/auth/reset-password",
  ],
  [
    "activate",
    () =>
      createElement(SetPasswordForm, {
        token: "token",
        accountActivation: true,
      }),
    "/auth/activate",
  ],
]

/** The page as the browser has it before hydration: the server's HTML. */
function serverRender(element: ReactElement) {
  const container = document.createElement("div")
  container.innerHTML = renderToString(element)
  document.body.append(container)

  return container
}

function submitButton(container: HTMLElement) {
  const buttons = container.querySelectorAll<HTMLButtonElement>(
    'button[type="submit"]'
  )
  expect(buttons).toHaveLength(1)

  return buttons[0]!
}

describe.each(FORMS)("the %s form", (_name, element, action) => {
  it(`posts natively to ${action}, never GETs into a query string`, () => {
    const container = serverRender(element())

    const forms = container.querySelectorAll("form")
    expect(forms).toHaveLength(1)
    expect(forms[0]!.getAttribute("method")).toBe("post")
    expect(forms[0]!.getAttribute("action")).toBe(action)
    expect(
      container.querySelector('input[type="password"], input[type="email"]')
    ).not.toBeNull()
  })

  it("keeps its submit disabled until mounted, then enables it", () => {
    const container = serverRender(element())
    expect(submitButton(container).disabled).toBe(true)

    render(element(), { container, hydrate: true })

    expect(submitButton(container).disabled).toBe(false)
  })
})
