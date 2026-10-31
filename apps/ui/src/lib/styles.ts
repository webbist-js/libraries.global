import { clsx, type ClassValue } from "clsx"
import { extendTailwindMerge } from "tailwind-merge"

const mergeClasses = extendTailwindMerge<"type-role">({
  extend: {
    classGroups: {
      "type-role": [
        {
          type: [
            "h1",
            "h2",
            "h3",
            "h4",
            "small-heading",
            "label",
            "panel-title",
            "card-title",
            "page-compact",
            "page-inline",
            "feature-title",
            "display-hero",
            "display-band",
            "display-section",
            "display-compact",
            "display-closing",
            "stat",
          ],
        },
      ],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return mergeClasses(clsx(inputs))
}
