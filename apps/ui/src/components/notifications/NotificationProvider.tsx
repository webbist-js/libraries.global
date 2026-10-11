"use client"

import { useQuery, useQueryClient } from "@tanstack/react-query"
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from "react"

import { authClient } from "@/lib/auth-client"

export type InboxItem = {
  documentId: string
  title: string
  body: string
  kind: string
  href?: string
  readAt?: string | null
  createdAt: string
}
type Inbox = { data: InboxItem[]; unread: number; soundOn: boolean }
const Context = createContext({
  items: [] as InboxItem[],
  unread: 0,
  loading: true,
  error: false,
  refresh: async () => {},
  previewSound: () => {},
})

/** A single observer and audio owner, shared by desktop, mobile and the inbox. */
export function NotificationProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const { data: session } = authClient.useSession()
  const userId = session?.user?.id
  const client = useQueryClient()
  const key = ["notification-inbox", userId]
  const query = useQuery<Inbox>({
    queryKey: key,
    enabled: Boolean(userId),
    queryFn: async ({ signal }) => {
      const res = await fetch("/api/notifications", {
        cache: "no-store",
        signal,
      })
      if (!res.ok) throw new Error("Inbox unavailable")

      return res.json()
    },
    refetchInterval: 30000,
    refetchIntervalInBackground: false,
    staleTime: 15000,
  })
  const audio = useRef<AudioContext | null>(null)
  const previous = useRef<{ userId?: string; latest?: string } | null>(null)
  const soundOn = query.data?.soundOn === true
  const play = useCallback(
    (preview = false) => {
      if (!soundOn || document.visibilityState === "hidden") return
      if (preview && !audio.current) audio.current = new AudioContext()
      const context = audio.current
      if (!context) return
      context
        .resume()
        .then(() => {
          // Two soft sine notes, with a short fade in and out. No sound on initial load.
          for (const [offset, frequency] of [
            [0, 523],
            [0.09, 659],
          ]) {
            const oscillator = context.createOscillator()
            const gain = context.createGain()
            const start = context.currentTime + offset!
            oscillator.frequency.value = frequency!
            gain.gain.setValueAtTime(0.0001, start)
            gain.gain.exponentialRampToValueAtTime(0.018, start + 0.015)
            gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.16)
            oscillator.connect(gain)
            gain.connect(context.destination)
            oscillator.start(start)
            oscillator.stop(start + 0.17)
            oscillator.addEventListener("ended", () => {
              oscillator.disconnect()
              gain.disconnect()
            })
          }
        })
        .catch(() => {})
    },
    [soundOn]
  )
  useEffect(() => {
    if (!soundOn) return
    const unlock = () => {
      if (!audio.current) audio.current = new AudioContext()
      audio.current.resume().catch(() => {})
    }
    document.addEventListener("pointerdown", unlock, { once: true })
    document.addEventListener("keydown", unlock, { once: true })

    return () => {
      document.removeEventListener("pointerdown", unlock)
      document.removeEventListener("keydown", unlock)
      audio.current?.close().catch(() => {})
      audio.current = null
    }
  }, [soundOn, userId])
  useEffect(() => {
    const latest = query.data?.data[0]
    if (!query.data || !userId) return
    const before = previous.current
    previous.current = { userId, latest: latest?.createdAt ?? "" }
    if (
      !latest ||
      latest.readAt ||
      before?.userId !== userId ||
      latest.createdAt <= (before.latest ?? "")
    )
      return
    // Other open tabs should not play the same notification again.
    try {
      const storageKey = `notifications.chime:${userId}`
      if (localStorage.getItem(storageKey) === latest.documentId) return
      if (!soundOn || !audio.current || document.visibilityState === "hidden")
        return
      localStorage.setItem(storageKey, latest.documentId)
    } catch {
      /* Storage can be disabled; the inbox still works. */
    }
    play()
  }, [query.data, userId, play, soundOn])
  const refresh = useCallback(async () => {
    await client.invalidateQueries({ queryKey: ["notification-inbox", userId] })
  }, [client, userId])
  const value = useMemo(
    () => ({
      items: query.data?.data ?? [],
      unread: query.data?.unread ?? 0,
      loading: Boolean(userId) && query.isPending,
      error: query.isError,
      refresh,
      previewSound: () => play(true),
    }),
    [query.data, query.isPending, query.isError, userId, refresh, play]
  )

  return <Context.Provider value={value}>{children}</Context.Provider>
}

export const useNotifications = () => useContext(Context)
