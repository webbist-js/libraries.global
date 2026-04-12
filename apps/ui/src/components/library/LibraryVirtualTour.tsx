"use client"

export function LibraryVirtualTour({ url }: { readonly url: string }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
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
