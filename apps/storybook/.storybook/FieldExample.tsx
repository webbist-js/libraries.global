import { Form, FormControl, FormField, FormItem } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import type { ReactNode } from "react"
import { useForm } from "react-hook-form"

/** A real react-hook-form context for the production form controls. */
export function FormExample({
  children,
  values = { example: "" },
}: {
  children: ReactNode
  values?: Record<string, unknown>
}) {
  const form = useForm({ defaultValues: values })

  return (
    <Form {...form}>
      <form
        className="grid max-w-xl gap-4"
        onSubmit={(event) => event.preventDefault()}
      >
        {children}
      </form>
    </Form>
  )
}
export function FieldExample({ children }: { children: ReactNode }) {
  const form = useForm({ defaultValues: { example: "" } })

  return (
    <Form {...form}>
      <FormField
        control={form.control}
        name="example"
        render={({ field }) => (
          <FormItem>
            {children}
            <FormControl>
              <Input {...field} aria-label="Example field" />
            </FormControl>
          </FormItem>
        )}
      />
    </Form>
  )
}
