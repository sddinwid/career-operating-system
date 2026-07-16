import Link from "next/link";
import { HealthSummary } from "@/components/health-summary";
import { getHealthStatus } from "@/lib/health";

export default async function HealthPage() {
  const status = await getHealthStatus();

  return (
    <div className="space-y-8">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.25em] text-stone-500">
            System health
          </p>
          <h2 className="mt-2 text-3xl font-semibold text-stone-900">
            Local application status
          </h2>
          <p className="mt-3 max-w-2xl text-base leading-7 text-stone-600">
            Use this page to confirm the application shell and PostgreSQL-backed
            Prisma connection are both available before moving into later prompts.
          </p>
        </div>
        <Link
          className="rounded-full border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-700 transition hover:border-stone-950 hover:text-stone-950"
          href="/api/health/db"
        >
          Database route
        </Link>
      </section>

      <HealthSummary status={status} />

      <section className="rounded-2xl border border-stone-300 bg-white p-6 shadow-sm">
        <dl className="grid gap-4 md:grid-cols-2">
          <div>
            <dt className="text-sm font-medium text-stone-500">Checked at</dt>
            <dd className="mt-1 text-sm text-stone-700">{status.checkedAt}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-stone-500">
              Default time zone
            </dt>
            <dd className="mt-1 text-sm text-stone-700">America/Chicago</dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
