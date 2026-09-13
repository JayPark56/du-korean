import { Skeleton } from "@/components/ui";

export default function Loading() {
  return (
    <div aria-busy="true">
      <Skeleton className="mb-3 h-9 w-48" />
      <Skeleton className="mb-8 h-5 w-full max-w-md" />
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-2xl border border-stone-200/80 bg-white p-6">
            <Skeleton className="mb-2 h-6 w-32" />
            <Skeleton className="mb-6 h-4 w-48" />
            <Skeleton className="mb-3 h-4 w-full" />
            <Skeleton className="mb-3 h-4 w-5/6" />
            <Skeleton className="h-20 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
