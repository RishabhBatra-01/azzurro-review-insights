import { SkeletonTransition } from "../components/page-transition";
import { PageSkeleton } from "../components/ui";

export default function Loading() {
  return (
    <SkeletonTransition>
      <PageSkeleton variant="overview" />
    </SkeletonTransition>
  );
}
