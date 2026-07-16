import { HealthStatus } from "@/lib/health";

type HealthSummaryProps = {
  status: HealthStatus;
};

export function HealthSummary({ status }: HealthSummaryProps) {
  return (
    <section className="grid gap-4 md:grid-cols-2">
      <article className="rounded-2xl border border-stone-300 bg-white p-5 shadow-sm">
        <p className="text-sm font-medium text-stone-500">Application</p>
        <h3 className="mt-2 text-xl font-semibold text-emerald-700">
          {status.application === "ok" ? "Operational" : "Unavailable"}
        </h3>
        <p className="mt-2 text-sm text-stone-600">
          The Next.js application shell is running locally.
        </p>
      </article>
      <article className="rounded-2xl border border-stone-300 bg-white p-5 shadow-sm">
        <p className="text-sm font-medium text-stone-500">Database</p>
        <h3
          className={`mt-2 text-xl font-semibold ${
            status.database === "ok" ? "text-emerald-700" : "text-red-700"
          }`}
        >
          {status.database === "ok" ? "Connected" : "Unavailable"}
        </h3>
        <p className="mt-2 text-sm text-stone-600">
          {status.database === "ok"
            ? "Prisma can reach the local PostgreSQL service."
            : status.details ?? "The database connection could not be confirmed."}
        </p>
      </article>
    </section>
  );
}
