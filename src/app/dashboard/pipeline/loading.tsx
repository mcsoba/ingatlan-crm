import { Skeleton, SkeletonBoard, SkeletonPageHeader } from "@/components/ui/skeleton";

export default function PipelineLoading() {
  return (
    <div className="flex flex-col gap-6">
      <SkeletonPageHeader />
      <Skeleton className="h-9 w-full max-w-md rounded-lg" />
      <SkeletonBoard columns={4} />
    </div>
  );
}
