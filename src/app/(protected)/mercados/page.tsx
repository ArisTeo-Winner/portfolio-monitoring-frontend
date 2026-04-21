import { redirect } from "next/navigation";

import { MarketsPage } from "@/components/market/markets-page";
import { isMercadosNavEnabled } from "@/lib/navigation/nav-features";

export default function MercadosPage() {
  if (!isMercadosNavEnabled()) {
    redirect("/dashboard");
  }

  return <MarketsPage />;
}
