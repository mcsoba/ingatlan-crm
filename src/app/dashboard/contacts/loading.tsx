import { Skeleton, SkeletonTable, SkeletonPageHeader } from "@/components/ui/skeleton";

export default function ContactsLoading() {
  return (
    <div className="flex flex-col gap-6">
      <SkeletonPageHeader />
      <div className="flex gap-2">
        <Skeleton className="h-9 flex-1 rounded-lg" />
        <Skeleton className="h-9 w-32 rounded-lg" />
        <Skeleton className="h-9 w-32 rounded-lg" />
      </div>
      <SkeletonTable rows={8} />
    </div>
  );
}
