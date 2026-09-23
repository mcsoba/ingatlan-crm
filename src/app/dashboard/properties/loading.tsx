import { Skeleton, SkeletonCards, SkeletonPageHeader } from "@/components/ui/skeleton";

export default function PropertiesLoading() {
  return (
    <div className="flex flex-col gap-6">
      <SkeletonPageHeader />
      <div className="flex gap-2">
        <Skeleton className="h-9 flex-1 rounded-lg" />
        <Skeleton className="h-9 w-24 rounded-lg" />
        <Skeleton className="h-9 w-24 rounded-lg" />
      </div>
      <SkeletonCards count={6} />
    </div>
  );
}
