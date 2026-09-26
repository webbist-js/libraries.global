"use client"

import { useMutation } from "@tanstack/react-query"

import { useCreateSubmission } from "@/hooks/useSubmissions"
import { authClient } from "@/lib/auth-client"

export function useUserMutations() {
  const signInMutation = useMutation({
    mutationFn: async (values: { email: string; password: string }) => {
      const result = await authClient.signIn.email({
        email: values.email,
        password: values.password,
        callbackURL: "/",
      })

      return unwrapBetterAuth(result)
    },
  })

  const registerMutation = useMutation({
    mutationFn: async (values: { email: string; password: string }) => {
      const result = await authClient.signUp.email({
        email: values.email,
        password: values.password,
        name: values.email,
        // Where the email-verification link lands; post-signin routes new
        // users to onboarding.
        callbackURL: "/auth/post-signin",
      })

      return unwrapBetterAuth(result)
    },
  })

  const changePasswordMutation = useMutation({
    mutationFn: async (values: {
      currentPassword: string
      password: string
    }) => {
      const result = await authClient.changePassword({
        currentPassword: values.currentPassword,
        newPassword: values.password,
        revokeOtherSessions: false,
      })

      return unwrapBetterAuth(result)
    },
  })

  const forgotPasswordMutation = useMutation({
    mutationFn: async (values: { email: string }) => {
      const result = await authClient.requestPasswordReset({
        email: values.email,
        redirectTo: "/auth/reset-password",
      })

      return unwrapBetterAuth(result)
    },
  })

  const resetPasswordMutation = useMutation({
    mutationFn: async (values: { password: string; token: string }) => {
      const result = await authClient.resetPassword({
        newPassword: values.password,
        token: values.token,
      })

      return unwrapBetterAuth(result)
    },
  })

  const claimLibraryMutation = useCreateSubmission()

  return {
    signInMutation,
    registerMutation,
    changePasswordMutation,
    forgotPasswordMutation,
    resetPasswordMutation,
    claimLibraryMutation,
  }
}

/**
 * Throws if the Better Auth result contains an error, otherwise returns data.
 */
function unwrapBetterAuth<T>(result: {
  data: T | null
  error: unknown | null
}): T | null {
  if (result.error) {
    throw result.error
  }

  return result.data
}
