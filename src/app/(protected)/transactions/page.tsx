import { TransactionsTable } from "@/components/transactions/transactions-table";

export default function TransactionsPage() {
  return (
    <div className="flex min-h-[calc(100vh-80px)] w-full flex-col bg-[#09090b] font-sans">
      <div className="flex-1 px-0 py-3 md:px-0 md:py-6 hide-scrollbar">
        <div className="mb-3 flex items-center justify-end md:mb-5">
          <button className="flex h-8 items-center gap-1.5 rounded-[0.65rem] border border-[#232931] bg-[#14191f] px-3 text-[0.72rem] font-medium text-white shadow-none transition hover:border-[#2f3742] hover:bg-[#181d24] md:h-auto md:gap-2 md:rounded-[0.95rem] md:px-4 md:py-2.5 md:text-[0.82rem] md:shadow-[0_16px_34px_rgba(0,0,0,0.16)]">
            Export CSV
          </button>
        </div>

        <TransactionsTable />
      </div>
    </div>
  );
}
