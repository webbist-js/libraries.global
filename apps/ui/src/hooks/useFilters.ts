// apps/ui/src/hooks/useFilters.ts
interface FilterStateBase {
  page: number
}

export function useFilters<T extends FilterStateBase>(
  filters: T,
  onChange: (next: T) => void
) {
  function toggleArrayItem(key: keyof T, value: string, checked: boolean) {
    const current = (filters[key] as string[]) ?? []
    const next = checked
      ? [...new Set([...current, value])]
      : current.filter((v) => v !== value)
    onChange({ ...filters, [key]: next, page: 0 })
  }

  function toggleArrayItems(key: keyof T, values: string[], checked: boolean) {
    const current = (filters[key] as string[]) ?? []
    const next = checked
      ? [...new Set([...current, ...values])]
      : current.filter((v) => !values.includes(v))
    onChange({ ...filters, [key]: next, page: 0 })
  }

  function resetFields(partial: Partial<T>) {
    onChange({ ...filters, ...partial, page: 0 })
  }

  return { toggleArrayItem, toggleArrayItems, resetFields }
}
