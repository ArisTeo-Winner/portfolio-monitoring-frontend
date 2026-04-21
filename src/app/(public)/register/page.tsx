import { Suspense } from "react";
import { DemoDashboard } from "@/components/public/demo-dashboard";

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#05070a]" />}>
      <DemoDashboard initialAuthMode="register" openOnLoad />
    </Suspense>
  );
}
