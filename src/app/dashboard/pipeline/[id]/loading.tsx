import { Skeleton, SkeletonPageHeader } from "@/components/ui/skeleton";

export default function DealDetailLoading() {
  return (
    <div className="flex flex-col gap-4">
      <SkeletonPageHeader />
      <Skeleton className="h-9 w-full max-w-lg rounded-lg" />
      <div className="grid gap-3 sm:grid-cols-2">
        <Skeleton className="h-16 rounded-xl" />
        <Skeleton className="h-16 rounded-xl" />
      </div>
      <Skeleton className="h-40 rounded-xl" />
      <Skeleton className="h-32 rounded-xl" />
      <Skeleton className="h-48 rounded-xl" />
    </div>
  );
}
