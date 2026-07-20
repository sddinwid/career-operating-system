"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode } from "react";
import {
  deferredNavigation,
  diagnosticsNavigation,
  isActiveNavigationItem,
  primaryNavigation
} from "@/lib/navigation";
import { cx, navLinkClassName, navLinkDisabledClassName } from "@/lib/ui";

type AppShellProps = {
  children: ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-stone-100 text-stone-900">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col lg:flex-row">
        <aside className="border-b border-stone-300 bg-stone-950 px-6 py-8 text-stone-100 lg:min-h-screen lg:w-80 lg:border-b-0 lg:border-r">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.3em] text-stone-400">
              Career OS
            </p>
            <h1 className="text-2xl font-semibold">Local Career Workspace</h1>
            <p className="text-sm leading-6 text-stone-300">
              A local-first operating system for tracking applications, activity,
              documents, and daily job-search momentum.
            </p>
          </div>
          <nav aria-label="Primary" className="mt-8">
            <ul className="grid gap-2">
              {primaryNavigation.map((item) => (
                <li key={item.label}>
                  <Link
                    aria-current={isActiveNavigationItem(item, pathname) ? "page" : undefined}
                    className={navLinkClassName}
                    href={item.href ?? "/"}
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <div className="mt-8">
            <p className="text-xs uppercase tracking-[0.3em] text-stone-400">Deferred</p>
            <ul className="mt-3 grid gap-2">
              {deferredNavigation.map((item) => (
                <li key={item.label}>
                  <span className={navLinkDisabledClassName}>
                    <span>{item.label}</span>
                    <span className="text-xs uppercase tracking-[0.2em] text-stone-500">
                      Coming later
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div className="mt-8">
            <p className="text-xs uppercase tracking-[0.3em] text-stone-400">Diagnostics</p>
            <ul className="mt-3 grid gap-2">
              {diagnosticsNavigation.map((item) => (
                <li key={item.label}>
                  <Link
                    aria-current={isActiveNavigationItem(item, pathname) ? "page" : undefined}
                    className={cx(navLinkClassName, "text-stone-200")}
                    href={item.href ?? "/health"}
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </aside>
        <main className="flex-1 px-6 py-8 lg:px-10 lg:py-10">{children}</main>
      </div>
    </div>
  );
}
