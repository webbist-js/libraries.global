import {
  Alert,
  Badge,
  Box,
  Button,
  Divider,
  Field,
  Flex,
  SingleSelect,
  SingleSelectOption,
  Typography,
} from "@strapi/design-system"
import { useField } from "@strapi/strapi/admin"
import * as React from "react"

import {
  cloneTimeframe,
  compareTimes,
  createDefaultTimeframe,
  findOverlappingTimeframeIndexes,
  normalizeOpeningTimesValue,
  OPENING_TIMES_DAY_LABELS,
  OPENING_TIMES_DAY_ORDER,
  OPENING_TIMES_STAFFING_LABELS,
  OPENING_TIMES_STAFFING_OPTIONS,
  sortTimeframes,
  START_TIME_OPTIONS,
  END_TIME_OPTIONS,
  type OpeningTimesDay,
  type OpeningTimesDayKey,
  type OpeningTimesValue,
  type OpeningTimeframe,
} from "../../../customFields/openingTimes/shared"

interface OpeningTimesInputProps {
  name: string
  value?: OpeningTimesValue | null
  disabled?: boolean
  required?: boolean
  label?: React.ReactNode
  hint?: React.ReactNode
  error?: string
}

type ClipboardState =
  | { type: "day"; day: OpeningTimesDay }
  | { type: "timeframe"; timeframe: OpeningTimeframe }
  | null

const WEEKDAY_KEYS: OpeningTimesDayKey[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
]
const WEEKEND_KEYS: OpeningTimesDayKey[] = ["saturday", "sunday"]

const DAY_ABBR: Record<OpeningTimesDayKey, string> = {
  monday: "Mo",
  tuesday: "Tu",
  wednesday: "We",
  thursday: "Th",
  friday: "Fr",
  saturday: "Sa",
  sunday: "Su",
}

const cloneDay = (
  day: OpeningTimesDay,
  targetDay?: OpeningTimesDayKey
): OpeningTimesDay => ({
  day: targetDay ?? day.day,
  enabled: day.enabled,
  timeframes: day.timeframes.map(cloneTimeframe),
})

const formatDaySummary = (day: OpeningTimesDay): string | null => {
  if (day.timeframes.length === 0) return null

  return day.timeframes.map((tf) => `${tf.startTime}–${tf.endTime}`).join(" · ")
}

const getOverlapWarning = (timeframes: OpeningTimeframe[]) => {
  const indexes = findOverlappingTimeframeIndexes(timeframes)

  return { hasOverlaps: indexes.size > 0, indexes }
}

// Segmented control border-radius per position
const segmentRadius = (index: number, total: number): string => {
  if (total === 1) return "4px"
  if (index === 0) return "4px 0 0 4px"
  if (index === total - 1) return "0 4px 4px 0"

  return "0"
}

const OpeningTimesInput = React.forwardRef<
  HTMLDivElement,
  OpeningTimesInputProps
>(
  (
    { name, disabled = false, required = false, label, hint, error },
    forwardedRef
  ) => {
    const field = useField<OpeningTimesValue>(name)
    const [clipboard, setClipboard] = React.useState<ClipboardState>(null)

    const openingTimes = React.useMemo(
      () => normalizeOpeningTimesValue(field.value),
      [field.value]
    )

    const updateValue = React.useCallback(
      (nextValue: OpeningTimesValue) => field.onChange(name, nextValue),
      [field, name]
    )

    const updateDay = React.useCallback(
      (
        dayKey: OpeningTimesDayKey,
        updater: (day: OpeningTimesDay) => OpeningTimesDay
      ) => {
        updateValue({
          ...openingTimes,
          days: openingTimes.days.map((day) =>
            day.day === dayKey ? updater(day) : day
          ),
        })
      },
      [openingTimes, updateValue]
    )

    const toggleDay = React.useCallback(
      (dayKey: OpeningTimesDayKey) =>
        updateDay(dayKey, (day) => ({ ...day, enabled: !day.enabled })),
      [updateDay]
    )

    const updateTimeframe = React.useCallback(
      (
        dayKey: OpeningTimesDayKey,
        timeframeId: string,
        updater: (tf: OpeningTimeframe) => OpeningTimeframe
      ) => {
        updateDay(dayKey, (day) => ({
          ...day,
          timeframes: sortTimeframes(
            day.timeframes.map((tf) =>
              tf.id === timeframeId ? updater(tf) : tf
            )
          ),
        }))
      },
      [updateDay]
    )

    const addTimeframe = React.useCallback(
      (dayKey: OpeningTimesDayKey) => {
        updateDay(dayKey, (day) => ({
          ...day,
          timeframes: sortTimeframes([
            ...day.timeframes,
            createDefaultTimeframe(),
          ]),
        }))
      },
      [updateDay]
    )

    const duplicateTimeframe = React.useCallback(
      (dayKey: OpeningTimesDayKey, timeframeId: string) => {
        updateDay(dayKey, (day) => {
          const src = day.timeframes.find((tf) => tf.id === timeframeId)
          if (!src) return day

          return {
            ...day,
            timeframes: sortTimeframes([
              ...day.timeframes,
              cloneTimeframe(src),
            ]),
          }
        })
      },
      [updateDay]
    )

    const removeTimeframe = React.useCallback(
      (dayKey: OpeningTimesDayKey, timeframeId: string) => {
        updateDay(dayKey, (day) => ({
          ...day,
          timeframes: day.timeframes.filter((tf) => tf.id !== timeframeId),
        }))
      },
      [updateDay]
    )

    const pasteTimeframeIntoDay = React.useCallback(
      (dayKey: OpeningTimesDayKey) => {
        if (clipboard?.type !== "timeframe") return
        updateDay(dayKey, (day) => ({
          ...day,
          timeframes: sortTimeframes([
            ...day.timeframes,
            cloneTimeframe(clipboard.timeframe),
          ]),
        }))
      },
      [clipboard, updateDay]
    )

    const pasteTimeframeAfter = React.useCallback(
      (dayKey: OpeningTimesDayKey, timeframeId: string) => {
        if (clipboard?.type !== "timeframe") return
        updateDay(dayKey, (day) => {
          const i = day.timeframes.findIndex((tf) => tf.id === timeframeId)
          if (i === -1) return day
          const next = [...day.timeframes]
          next.splice(i + 1, 0, cloneTimeframe(clipboard.timeframe))

          return { ...day, timeframes: sortTimeframes(next) }
        })
      },
      [clipboard, updateDay]
    )

    const pasteDayToKeys = React.useCallback(
      (keys: OpeningTimesDayKey[]) => {
        if (clipboard?.type !== "day") return
        const src = clipboard.day
        updateValue({
          ...openingTimes,
          days: openingTimes.days.map((day) =>
            keys.includes(day.day) ? cloneDay(src, day.day) : day
          ),
        })
      },
      [clipboard, openingTimes, updateValue]
    )

    const activeDays = openingTimes.days.filter((d) => d.enabled)
    const topLevelError = field.error ?? error
    const total = OPENING_TIMES_DAY_ORDER.length

    return (
      <Field.Root
        ref={forwardedRef}
        error={topLevelError}
        hint={hint}
        name={name}
        required={required}
        style={{ width: "100%" }}
      >
        <Flex direction="column" gap={2} style={{ width: "100%" }}>
          <Field.Label>{label ?? "Opening times"}</Field.Label>

          <Box
            background="neutral0"
            borderColor="neutral200"
            hasRadius
            padding={4}
            shadow="filterShadow"
            style={{ width: "100%" }}
          >
            <Flex direction="column" gap={4} style={{ width: "100%" }}>
              {/* ── Day selector row ── */}
              <Flex
                alignItems="center"
                justifyContent="space-between"
                gap={3}
                style={{ width: "100%" }}
              >
                {/* Segmented control */}
                <Flex style={{ display: "inline-flex" }}>
                  {OPENING_TIMES_DAY_ORDER.map((dayKey, index) => {
                    const day = openingTimes.days.find((d) => d.day === dayKey)
                    const isActive = day?.enabled ?? false

                    return (
                      <Box
                        key={dayKey}
                        tag="button"
                        type="button"
                        disabled={disabled}
                        onClick={() => !disabled && toggleDay(dayKey)}
                        style={{
                          cursor: disabled ? "not-allowed" : "pointer",
                          width: "52px",
                          height: "36px",
                          border: "1px solid",
                          borderColor: isActive ? "#4945ff" : "#dcdce4",
                          // collapse adjacent borders
                          marginLeft: index === 0 ? 0 : "-1px",
                          borderRadius: segmentRadius(index, total),
                          background: isActive ? "#4945ff" : "#f6f6f9",
                          color: isActive ? "#ffffff" : "#666687",
                          fontWeight: isActive ? 600 : 500,
                          fontSize: "13px",
                          // keep active on top so its border shows
                          position: "relative",
                          zIndex: isActive ? 1 : 0,
                          outline: "none",
                          transition:
                            "background 0.12s, color 0.12s, border-color 0.12s",
                        }}
                      >
                        {DAY_ABBR[dayKey]}
                      </Box>
                    )
                  })}
                </Flex>

                {/* Clipboard status */}
                <Badge>
                  {clipboard == null
                    ? "Clipboard empty"
                    : clipboard.type === "day"
                      ? `Copied: ${OPENING_TIMES_DAY_LABELS[clipboard.day.day]}`
                      : `Copied: ${clipboard.timeframe.startTime}–${clipboard.timeframe.endTime}`}
                </Badge>
              </Flex>

              {/* ── Bulk paste (only when day in clipboard) ── */}
              {clipboard?.type === "day" ? (
                <Box
                  background="primary100"
                  borderColor="primary200"
                  hasRadius
                  padding={3}
                  style={{ width: "100%" }}
                >
                  <Flex
                    alignItems="center"
                    gap={3}
                    wrap="wrap"
                    style={{ width: "100%" }}
                  >
                    <Typography textColor="primary600" variant="pi">
                      Paste{" "}
                      <strong>
                        {OPENING_TIMES_DAY_LABELS[clipboard.day.day]}
                      </strong>{" "}
                      to:
                    </Typography>
                    <Flex gap={2}>
                      <Button
                        disabled={disabled}
                        onClick={() => pasteDayToKeys(WEEKDAY_KEYS)}
                        size="S"
                        type="button"
                        variant="secondary"
                      >
                        Mon–Fri
                      </Button>
                      <Button
                        disabled={disabled}
                        onClick={() => pasteDayToKeys(WEEKEND_KEYS)}
                        size="S"
                        type="button"
                        variant="secondary"
                      >
                        Sat–Sun
                      </Button>
                      <Button
                        disabled={disabled}
                        onClick={() =>
                          pasteDayToKeys([...OPENING_TIMES_DAY_ORDER])
                        }
                        size="S"
                        type="button"
                        variant="secondary"
                      >
                        All days
                      </Button>
                    </Flex>
                  </Flex>
                </Box>
              ) : null}

              <Divider />

              {/* ── No days selected ── */}
              {activeDays.length === 0 ? (
                <Typography textColor="neutral500" variant="pi">
                  Select days above to configure opening times.
                </Typography>
              ) : (
                <Flex direction="column" gap={3} style={{ width: "100%" }}>
                  {activeDays.map((day) => {
                    const overlapWarning = getOverlapWarning(day.timeframes)
                    const summary = formatDaySummary(day)

                    return (
                      <Box
                        key={day.day}
                        background="neutral0"
                        borderColor="neutral200"
                        hasRadius
                        padding={4}
                        style={{ width: "100%" }}
                      >
                        <Flex
                          direction="column"
                          gap={3}
                          style={{ width: "100%" }}
                        >
                          {/* Day header */}
                          <Flex
                            alignItems="center"
                            justifyContent="space-between"
                            style={{ width: "100%" }}
                          >
                            <Flex alignItems="baseline" gap={2}>
                              <Typography fontWeight="bold">
                                {OPENING_TIMES_DAY_LABELS[day.day]}
                              </Typography>
                              {summary ? (
                                <Typography textColor="neutral500" variant="pi">
                                  {summary}
                                </Typography>
                              ) : null}
                            </Flex>

                            <Flex gap={1}>
                              <Button
                                disabled={disabled}
                                onClick={() =>
                                  setClipboard({
                                    type: "day",
                                    day: cloneDay(day),
                                  })
                                }
                                size="S"
                                type="button"
                                variant="secondary"
                              >
                                Copy day
                              </Button>
                              {clipboard?.type === "day" ? (
                                <Button
                                  disabled={disabled}
                                  onClick={() =>
                                    updateDay(day.day, () =>
                                      cloneDay(clipboard.day, day.day)
                                    )
                                  }
                                  size="S"
                                  type="button"
                                  variant="secondary"
                                >
                                  Paste day
                                </Button>
                              ) : null}
                            </Flex>
                          </Flex>

                          {/* Overlap alert */}
                          {overlapWarning.hasOverlaps ? (
                            <Alert
                              closeLabel="Close"
                              title="Overlapping timeframes"
                              variant="warning"
                              style={{ width: "100%" }}
                            >
                              Some timeframes for{" "}
                              {OPENING_TIMES_DAY_LABELS[day.day]} overlap —
                              adjust so each period ends before the next starts.
                            </Alert>
                          ) : null}

                          {/* Timeframe list */}
                          {day.timeframes.length > 0 ? (
                            <Flex
                              direction="column"
                              gap={2}
                              style={{ width: "100%" }}
                            >
                              {day.timeframes.map((timeframe, index) => {
                                const prevTimeframe =
                                  index > 0 ? day.timeframes[index - 1] : null

                                const startOptions = START_TIME_OPTIONS.filter(
                                  (o) => {
                                    // must be before this timeframe's own end
                                    if (compareTimes(o, timeframe.endTime) >= 0)
                                      return false
                                    // must be strictly after the previous timeframe's end
                                    if (
                                      prevTimeframe &&
                                      compareTimes(o, prevTimeframe.endTime) <=
                                        0
                                    )
                                      return false

                                    return true
                                  }
                                )
                                const endOptions = END_TIME_OPTIONS.filter(
                                  (o) =>
                                    compareTimes(timeframe.startTime, o) < 0
                                )
                                const hasOverlap =
                                  overlapWarning.indexes.has(index)

                                return (
                                  <Box
                                    key={timeframe.id}
                                    background="neutral100"
                                    borderColor={
                                      hasOverlap ? "warning200" : "neutral200"
                                    }
                                    hasRadius
                                    padding={3}
                                    style={{ width: "100%" }}
                                  >
                                    <Flex
                                      alignItems="flex-end"
                                      gap={2}
                                      wrap="wrap"
                                      style={{ width: "100%" }}
                                    >
                                      {/* Row index */}
                                      <Box
                                        style={{
                                          minWidth: "24px",
                                          paddingBottom: "10px",
                                        }}
                                      >
                                        <Typography
                                          textColor="neutral400"
                                          variant="pi"
                                        >
                                          {index + 1}
                                        </Typography>
                                      </Box>

                                      {/* Start */}
                                      <Field.Root
                                        name={`${name}.${day.day}.${timeframe.id}.startTime`}
                                        style={{ flex: 1, minWidth: "110px" }}
                                      >
                                        <Field.Label>Start</Field.Label>
                                        <SingleSelect
                                          disabled={disabled}
                                          onChange={(value) => {
                                            if (typeof value !== "string")
                                              return
                                            updateTimeframe(
                                              day.day,
                                              timeframe.id,
                                              (tf) => ({
                                                ...tf,
                                                startTime: value,
                                              })
                                            )
                                          }}
                                          placeholder="Start"
                                          value={timeframe.startTime}
                                        >
                                          {startOptions.map((o) => (
                                            <SingleSelectOption
                                              key={o}
                                              value={o}
                                            >
                                              {o}
                                            </SingleSelectOption>
                                          ))}
                                        </SingleSelect>
                                      </Field.Root>

                                      {/* End */}
                                      <Field.Root
                                        name={`${name}.${day.day}.${timeframe.id}.endTime`}
                                        style={{ flex: 1, minWidth: "110px" }}
                                      >
                                        <Field.Label>End</Field.Label>
                                        <SingleSelect
                                          disabled={disabled}
                                          onChange={(value) => {
                                            if (typeof value !== "string")
                                              return
                                            updateTimeframe(
                                              day.day,
                                              timeframe.id,
                                              (tf) => ({
                                                ...tf,
                                                endTime: value,
                                              })
                                            )
                                          }}
                                          placeholder="End"
                                          value={timeframe.endTime}
                                        >
                                          {endOptions.map((o) => (
                                            <SingleSelectOption
                                              key={o}
                                              value={o}
                                            >
                                              {o}
                                            </SingleSelectOption>
                                          ))}
                                        </SingleSelect>
                                      </Field.Root>

                                      {/* Staffing */}
                                      <Field.Root
                                        name={`${name}.${day.day}.${timeframe.id}.staffing`}
                                        style={{ flex: 1, minWidth: "130px" }}
                                      >
                                        <Field.Label>Staffing</Field.Label>
                                        <SingleSelect
                                          disabled={disabled}
                                          onChange={(value) => {
                                            if (typeof value !== "string")
                                              return
                                            updateTimeframe(
                                              day.day,
                                              timeframe.id,
                                              (tf) => ({
                                                ...tf,
                                                staffing:
                                                  value as OpeningTimeframe["staffing"],
                                              })
                                            )
                                          }}
                                          placeholder="Staffing"
                                          value={timeframe.staffing}
                                        >
                                          {OPENING_TIMES_STAFFING_OPTIONS.map(
                                            (o) => (
                                              <SingleSelectOption
                                                key={o}
                                                value={o}
                                              >
                                                {
                                                  OPENING_TIMES_STAFFING_LABELS[
                                                    o
                                                  ]
                                                }
                                              </SingleSelectOption>
                                            )
                                          )}
                                        </SingleSelect>
                                      </Field.Root>

                                      {/* Overlap badge */}
                                      {hasOverlap ? (
                                        <Box style={{ paddingBottom: "10px" }}>
                                          <Badge
                                            backgroundColor="warning100"
                                            textColor="warning700"
                                          >
                                            Overlap
                                          </Badge>
                                        </Box>
                                      ) : null}

                                      {/* Actions */}
                                      <Flex
                                        gap={1}
                                        style={{ paddingBottom: "2px" }}
                                      >
                                        <Button
                                          disabled={disabled}
                                          onClick={() =>
                                            setClipboard({
                                              type: "timeframe",
                                              timeframe:
                                                cloneTimeframe(timeframe),
                                            })
                                          }
                                          size="S"
                                          type="button"
                                          variant="ghost"
                                        >
                                          Copy
                                        </Button>
                                        {clipboard?.type === "timeframe" ? (
                                          <Button
                                            disabled={disabled}
                                            onClick={() =>
                                              pasteTimeframeAfter(
                                                day.day,
                                                timeframe.id
                                              )
                                            }
                                            size="S"
                                            type="button"
                                            variant="secondary"
                                          >
                                            Paste
                                          </Button>
                                        ) : null}
                                        <Button
                                          disabled={disabled}
                                          onClick={() =>
                                            duplicateTimeframe(
                                              day.day,
                                              timeframe.id
                                            )
                                          }
                                          size="S"
                                          type="button"
                                          variant="tertiary"
                                        >
                                          Duplicate
                                        </Button>
                                        <Button
                                          disabled={disabled}
                                          onClick={() =>
                                            removeTimeframe(
                                              day.day,
                                              timeframe.id
                                            )
                                          }
                                          size="S"
                                          type="button"
                                          variant="danger-light"
                                        >
                                          Delete
                                        </Button>
                                      </Flex>
                                    </Flex>
                                  </Box>
                                )
                              })}
                            </Flex>
                          ) : (
                            <Typography textColor="neutral400" variant="pi">
                              No timeframes yet.
                            </Typography>
                          )}

                          {/* Add / paste actions */}
                          <Flex gap={2}>
                            <Button
                              disabled={disabled}
                              onClick={() => addTimeframe(day.day)}
                              size="S"
                              type="button"
                              variant="tertiary"
                            >
                              + Add timeframe
                            </Button>
                            {clipboard?.type === "timeframe" ? (
                              <Button
                                disabled={disabled}
                                onClick={() => pasteTimeframeIntoDay(day.day)}
                                size="S"
                                type="button"
                                variant="secondary"
                              >
                                Paste timeframe
                              </Button>
                            ) : null}
                          </Flex>
                        </Flex>
                      </Box>
                    )
                  })}
                </Flex>
              )}
            </Flex>
          </Box>

          <Field.Hint />
          <Field.Error />
        </Flex>
      </Field.Root>
    )
  }
)

export default OpeningTimesInput
