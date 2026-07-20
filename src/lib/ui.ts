export function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export const buttonPrimaryClassName =
  "button-primary";

export const buttonSecondaryClassName =
  "button-secondary";

export const buttonDestructiveClassName =
  "button-destructive";

export const textActionClassName =
  "text-action";

export const navLinkClassName =
  "nav-link";

export const navLinkDisabledClassName =
  "nav-link-disabled";

export const cardClassName =
  "rounded-3xl border border-stone-300 bg-white p-8 shadow-sm";

export const mutedCardClassName =
  "rounded-2xl border border-stone-200 bg-stone-50 p-4";
