import { Skeleton } from "@/components/ui";

export default function Loading() {
  return (
    <div aria-busy="true">
      <Skeleton className="mb-3 h-9 w-64" />
      <Skeleton className="mb-8 h-5 w-full max-w-lg" />
      <div className="space-y-6">
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-2xl border border-stone-200/80 bg-white p-7">
            <Skeleton className="mb-3 h-6 w-48" />
            <Skeleton className="mb-6 h-4 w-80 max-w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
