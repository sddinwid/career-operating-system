export type NavigationItem = {
  label: string;
  href?: string;
  description?: string;
  disabled?: boolean;
  comingLater?: boolean;
  matchMode?: "exact" | "prefix";
};

export const primaryNavigation: NavigationItem[] = [
  {
    label: "Today",
    href: "/",
    description: "Current product overview and entry points.",
    matchMode: "exact"
  },
  {
    label: "Applications",
    href: "/applications",
    description: "Tracked applications and inline review workspace.",
    matchMode: "prefix"
  },
  {
    label: "Jobs",
    href: "/jobs",
    description: "Saved opportunities and job-description workflow discovery.",
    matchMode: "prefix"
  },
  {
    label: "Documents",
    href: "/documents",
    description: "Rendered document artifacts and immutable versions.",
    matchMode: "prefix"
  },
  {
    label: "Imports/Exports",
    href: "/imports",
    description: "Workbook import tooling.",
    matchMode: "prefix"
  }
];

export const diagnosticsNavigation: NavigationItem[] = [
  {
    label: "System Health",
    href: "/health",
    description: "Diagnostics and local runtime status.",
    matchMode: "prefix"
  }
];

export const deferredNavigation: NavigationItem[] = [
  { label: "Calendar", disabled: true, comingLater: true },
  { label: "Companies", disabled: true, comingLater: true },
  { label: "Contacts", disabled: true, comingLater: true },
  { label: "Interviews", disabled: true, comingLater: true },
  { label: "Career Profile", disabled: true, comingLater: true },
  { label: "Analytics", disabled: true, comingLater: true },
  { label: "Settings", disabled: true, comingLater: true }
];

export function isActiveNavigationItem(item: NavigationItem, pathname: string) {
  if (!item.href) {
    return false;
  }

  if ((item.matchMode ?? "exact") === "exact") {
    return pathname === item.href;
  }

  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}
