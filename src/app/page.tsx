import Link from "next/link";
import { getHealthStatus } from "@/lib/health";
import { HealthSummary } from "@/components/health-summary";

export default async function HomePage() {
  const status = await getHealthStatus();

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-stone-300 bg-white p-8 shadow-sm">
        <p className="text-sm font-medium uppercase tracking-[0.25em] text-stone-500">
          Prompt 00 foundation
        </p>
        <h2 className="mt-3 text-4xl font-semibold tracking-tight text-stone-900">
          A local-first shell for your job-search operating system
        </h2>
        <p className="mt-4 max-w-3xl text-base leading-7 text-stone-600">
          This bootstrap keeps the Phase 1 surface intentionally narrow while
          establishing the Next.js, Prisma, PostgreSQL, and test foundations the
          later prompts will build on.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            className="rounded-full bg-stone-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-stone-800"
            href="/health"
          >
            Open health page
          </Link>
          <Link
            className="rounded-full border border-stone-300 px-5 py-3 text-sm font-semibold text-stone-700 transition hover:border-stone-950 hover:text-stone-950"
            href="/api/health"
          >
            View JSON health
          </Link>
        </div>
      </section>

      <HealthSummary status={status} />
    </div>
  );
}
