import { Suspense } from "react";
import { DemoDashboard } from "@/components/public/demo-dashboard";

export default function HomePage() {
  return (
    <Suspense fallback={null}>
      <DemoDashboard />
    </Suspense>
  );
}
