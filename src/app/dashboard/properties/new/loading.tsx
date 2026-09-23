import { SkeletonForm, SkeletonPageHeader } from "@/components/ui/skeleton";

export default function NewPropertyLoading() {
  return (
    <div className="flex flex-col gap-6">
      <SkeletonPageHeader />
      <SkeletonForm fields={4} />
    </div>
  );
}
