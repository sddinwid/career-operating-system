"use client";

export default function ApplicationsError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <section className="rounded-3xl border border-red-200 bg-red-50 p-8 text-red-900 shadow-sm">
      <h2 className="text-2xl font-semibold">Applications are unavailable</h2>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-red-800">
        {error.message || "Something went wrong while loading applications."}
      </p>
      <button
        className="mt-6 rounded-full bg-red-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-red-800"
        onClick={reset}
        type="button"
      >
        Try again
      </button>
    </section>
  );
}
