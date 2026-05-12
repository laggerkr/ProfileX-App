import type { ReactNode } from "react";

export function StatCard({ label, value, icon }: { label: string; value: string | number; icon: ReactNode }) {
  return (
    <div className="rounded-lg border border-line bg-white p-4 shadow-soft dark:border-white/10 dark:bg-[#17191c]">
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-500 dark:text-gray-400">{label}</span>
        <span className="text-gray-500 dark:text-gray-300">{icon}</span>
      </div>
      <div className="mt-3 text-3xl font-semibold">{value}</div>
    </div>
  );
}
