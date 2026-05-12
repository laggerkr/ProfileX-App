import { clsx } from "clsx";
import { Activity, Bot, Fingerprint, FolderKanban, Gauge, KeyRound, ListChecks, MonitorCog, Settings, ShieldCheck, UserPlus } from "lucide-react";
import { useWorkspaceStore } from "../store/useWorkspaceStore";

const items = [
  ["Dashboard", Gauge],
  ["Profiles", MonitorCog],
  ["Proxy Manager", ShieldCheck],
  ["Fingerprints", Fingerprint],
  ["Groups", FolderKanban],
  ["Members", UserPlus],
  ["Logs", Activity],
  ["Automation API", Bot],
  ["Settings", Settings],
  ["Login Page", KeyRound],
  ["Recovery", ListChecks]
] as const;

export function Shell({ children }: { children: React.ReactNode }) {
  const activePage = useWorkspaceStore((state) => state.activePage);
  const setActivePage = useWorkspaceStore((state) => state.setActivePage);

  return (
    <div className="flex min-h-screen bg-panel text-ink dark:bg-[#111315] dark:text-white">
      <aside className="w-64 border-r border-line bg-white/80 px-3 py-4 backdrop-blur-xl dark:border-white/10 dark:bg-[#17191c]">
        <div className="mb-7 px-2">
          <div className="text-lg font-semibold">Workspace Profile Manager</div>
          <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">Browser Workspace Isolation Platform</div>
        </div>
        <nav className="space-y-1">
          {items.map(([label, Icon]) => (
            <button
              key={label}
              onClick={() => setActivePage(label)}
              className={clsx(
                "flex h-10 w-full items-center gap-3 rounded-lg px-3 text-left text-sm transition",
                activePage === label
                  ? "bg-ink text-white shadow-soft dark:bg-white dark:text-ink"
                  : "text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/10"
              )}
            >
              <Icon size={17} />
              {label}
            </button>
          ))}
        </nav>
      </aside>
      <main className="flex-1 overflow-hidden">
        <div className="flex h-14 items-center justify-between border-b border-line bg-white/70 px-6 backdrop-blur-xl dark:border-white/10 dark:bg-[#17191c]/95">
          <div>
            <div className="text-sm font-semibold">{activePage}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Company internal workspace</div>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Local API connected
          </div>
        </div>
        <div className="h-[calc(100vh-56px)] overflow-auto p-6">{children}</div>
      </main>
    </div>
  );
}
