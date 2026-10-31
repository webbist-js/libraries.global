export type FontWeight = keyof typeof fontWeightVariants
export type Variant = keyof typeof variantStyles
export type TextColor = keyof typeof textColorVariants
export type TypographyTag = "h1" | "h2" | "h3" | "h4" | "h5" | "h6" | "p"
export type ElementTag = "ol" | "ul" | "blockquote"

export const textColorVariants = {
  base: "text-(--t-ink-base)",
  black: "text-black",
  white: "text-white",
}

export const fontWeightVariants = {
  black: "font-black",
  extraBold: "font-extrabold",
  bold: "font-bold",
  semiBold: "font-semibold",
  medium: "font-medium",
  normal: "font-normal",
  light: "font-light",
  extraLight: "font-extraLight",
  thin: "font-thin",
}

export const variantStyles = {
  heading1: "type-h1",
  heading2: "type-h2",
  heading3: "type-h3",
  heading4: "type-h4",
  heading5: "type-small-heading",
  heading6: "type-small-heading",
  small: "text-sm leading-normal",
  medium: "text-base leading-relaxed",
  large: "text-lg leading-relaxed",
}

export const defaultStyles: Record<TypographyTag | ElementTag, Variant> = {
  h1: "heading1",
  h2: "heading2",
  h3: "heading3",
  h4: "heading4",
  h5: "heading5",
  h6: "heading6",
  p: "medium",
  blockquote: "medium",
  ol: "medium",
  ul: "medium",
}
