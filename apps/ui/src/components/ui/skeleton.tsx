import { cn } from "@/lib/styles"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      aria-hidden="true"
      data-slot="skeleton"
      className={cn(
        "bg-accent animate-pulse rounded-md motion-reduce:animate-none",
        className
      )}
      {...props}
    />
  )
}

export { Skeleton }
