"use client"

export function LibraryVirtualTour({ url }: { readonly url: string }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-(--t-border-line) bg-(--t-bg-surface)">
      <iframe
        src={url}
        title="Virtual tour"
        allow="fullscreen; gyroscope; accelerometer"
        className="h-[70vh] min-h-[480px] w-full border-0"
      />
    </div>
  )
}

export default LibraryVirtualTour
