/** Joins complete static utility recipes and optional states without constructing class names. */
export const cn = (...classes: Array<string | false | null | undefined>): string => classes.filter(Boolean).join(" ");
