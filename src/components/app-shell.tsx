import Link from "next/link";
import { ReactNode } from "react";
import { primaryNavigation } from "@/lib/navigation";

type AppShellProps = {
  children: ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="min-h-screen bg-stone-100 text-stone-900">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col lg:flex-row">
        <aside className="border-b border-stone-300 bg-stone-950 px-6 py-8 text-stone-100 lg:min-h-screen lg:w-72 lg:border-b-0 lg:border-r">
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
                    className="flex rounded-lg px-3 py-2 text-sm font-medium text-stone-200 transition hover:bg-stone-800 hover:text-white"
                    href={item.href}
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </aside>
        <main className="flex-1 px-6 py-8 lg:px-10 lg:py-10">{children}</main>
      </div>
    </div>
  );
}
