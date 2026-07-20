import Link from "next/link";
import { getHealthStatus } from "@/lib/health";
import { HealthSummary } from "@/components/health-summary";
import {
  buttonPrimaryClassName,
  buttonSecondaryClassName,
  cardClassName,
  textActionClassName
} from "@/lib/ui";

const primaryActions = [
  {
    title: "Applications",
    description:
      "Review, search, edit, archive, and manage your job applications.",
    href: "/applications",
    action: "Open applications",
  },
  {
    title: "Browse Jobs",
    description:
      "Rediscover saved opportunities, parsed jobs, and downstream workflow state.",
    href: "/jobs",
    action: "Browse jobs",
  },
  {
    title: "Browse Documents",
    description: "Open immutable DOCX and PDF artifacts generated from approved resumes.",
    href: "/documents",
    action: "Browse documents",
  }
] as const;

export default async function HomePage() {
  const status = await getHealthStatus();

  return (
    <div className="space-y-8">
      <section className={cardClassName}>
        <p className="text-sm font-medium uppercase tracking-[0.25em] text-stone-500">
          Career Operating System
        </p>

        <h1 className="mt-3 text-4xl font-semibold tracking-tight text-stone-900">
          Browse active workflows across applications, jobs, and rendered documents
        </h1>

        <p className="mt-4 max-w-3xl text-base leading-7 text-stone-600">
          Track opportunities, rediscover saved job descriptions, inspect parsing and
          requirement-review progress, follow the deterministic resume workflow, and open
          immutable rendered artifacts without relying on record-specific URLs.
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link className={buttonPrimaryClassName} href="/applications">
            Open applications
          </Link>

          <Link className={buttonSecondaryClassName} href="/jobs">
            Browse jobs
          </Link>

          <Link className={buttonSecondaryClassName} href="/documents">
            Browse documents
          </Link>
        </div>

        <div className="mt-4 flex flex-wrap gap-4 text-sm">
          <Link className={textActionClassName} href="/applications/new">
            New application
          </Link>
          <Link className={textActionClassName} href="/jobs/new">
            New job
          </Link>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {primaryActions.map((item) => (
          <article
            key={item.href}
            className="flex flex-col rounded-2xl border border-stone-300 bg-white p-6 shadow-sm"
          >
            <h2 className="text-xl font-semibold text-stone-900">
              {item.title}
            </h2>

            <p className="mt-2 flex-1 text-sm leading-6 text-stone-600">
              {item.description}
            </p>

            <Link className="mt-5 text-action" href={item.href}>
              {item.action}
            </Link>
          </article>
        ))}
      </section>

      <details className="rounded-2xl border border-stone-300 bg-white p-6 shadow-sm">
        <summary className="cursor-pointer text-sm font-semibold text-stone-900">
          Diagnostics
        </summary>

        <div className="mt-5 space-y-4">
          <HealthSummary status={status} />

          <div className="flex flex-wrap gap-3">
            <Link className={textActionClassName} href="/health">
              Open health page
            </Link>

            <Link className={textActionClassName} href="/api/health">
              View JSON health
            </Link>
          </div>
        </div>
      </details>
    </div>
  );
}
