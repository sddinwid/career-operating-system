export default function ApplicationsLoading() {
  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-stone-300 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-3">
            <div className="h-8 w-56 animate-pulse rounded bg-stone-200" />
            <div className="h-4 w-40 animate-pulse rounded bg-stone-200" />
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="h-12 w-72 animate-pulse rounded-2xl bg-stone-200" />
            <div className="h-12 w-28 animate-pulse rounded-full bg-stone-200" />
            <div className="h-12 w-40 animate-pulse rounded-full bg-stone-200" />
          </div>
        </div>
        <div className="mt-6 h-[32rem] animate-pulse rounded-2xl bg-stone-200" />
      </div>
    </div>
  );
}
