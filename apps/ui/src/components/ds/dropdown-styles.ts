/** Shared panel and option styling for site dropdowns. */
export const DROPDOWN_PANEL =
  "z-[70] max-w-[calc(100vw-32px)] overflow-x-hidden overflow-y-auto rounded-[20px] border border-(--t-border-hi) bg-(--t-bg-deep) p-2 text-(--t-ink-base) shadow-[0_16px_40px_rgba(23,22,43,.12)] motion-reduce:animate-none"

export const DROPDOWN_OPTION =
  "min-h-[44px] cursor-pointer rounded-[12px] py-2.5 pr-9 pl-3 text-[15px] font-medium text-(--t-ink-base) focus:bg-(--t-bg-muted-2) focus:text-(--t-ink-base) data-[state=checked]:bg-(--t-accent-chip) data-[state=checked]:text-(--t-accent-primary-hover)"

export const DROPDOWN_SELECT_POSITION =
  "data-[side=bottom]:translate-y-0 data-[side=left]:translate-x-0 data-[side=right]:translate-x-0 data-[side=top]:translate-y-0"
