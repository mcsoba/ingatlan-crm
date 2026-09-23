import { SkeletonForm, SkeletonPageHeader } from "@/components/ui/skeleton";

export default function NewDealLoading() {
  return (
    <div className="flex flex-col gap-6">
      <SkeletonPageHeader />
      <SkeletonForm fields={3} />
    </div>
  );
}
