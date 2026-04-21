import { TransactionsTable } from "@/components/transactions/transactions-table";

export default function TransactionsPage() {
  return (
    <div className="flex min-h-[calc(100vh-80px)] w-full flex-col bg-[#111722] font-sans">
      <div className="flex-1 p-4 md:p-7 hide-scrollbar">
        <div className="mb-5 flex items-center justify-end">
          <button className="flex items-center gap-2 rounded border border-hyperliquid-border/50 bg-hyperliquid-row px-3.5 py-2 text-[0.82rem] font-medium text-white shadow-sm transition-colors hover:bg-hyperliquid-row-hover">
            Export CSV
          </button>
        </div>

        <TransactionsTable />
      </div>
    </div>
  );
}
