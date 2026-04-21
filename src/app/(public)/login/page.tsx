import { Suspense } from "react";
import { DemoDashboard } from "@/components/public/demo-dashboard";

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#05070a]" />}>
      <DemoDashboard initialAuthMode="login" openOnLoad />
    </Suspense>
  );
}
