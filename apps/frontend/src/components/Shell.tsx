import { clsx } from "clsx";
import { Activity, Bot, Fingerprint, FolderKanban, Gauge, KeyRound, ListChecks, MonitorCog, PanelLeftClose, PanelLeftOpen, Settings, ShieldCheck, UserPlus } from "lucide-react";
import { useState } from "react";
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
  const [isCollapsed, setCollapsed] = useState(() => window.localStorage.getItem("profilex.sidebarCollapsed") === "true");

  const toggleSidebar = () => {
    setCollapsed((current) => {
      const next = !current;
      window.localStorage.setItem("profilex.sidebarCollapsed", String(next));
      return next;
    });
  };

  return (
    <div className="flex min-h-screen bg-panel text-ink dark:bg-[#111315] dark:text-white">
      <aside className={clsx("border-r border-line bg-white/80 px-3 py-4 backdrop-blur-xl transition-all dark:border-white/10 dark:bg-[#17191c]", isCollapsed ? "w-16" : "w-52")}>
        <div className={clsx("mb-7 flex items-start", isCollapsed ? "justify-center" : "justify-between px-2")}>
          {!isCollapsed && (
            <div>
              <div className="text-lg font-semibold">ProfileX</div>
              <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">Browser profiles</div>
            </div>
          )}
          <button
            onClick={toggleSidebar}
            className="rounded-lg p-2 text-gray-500 transition hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/10"
            title={isCollapsed ? "Expand menu" : "Collapse menu"}
          >
            {isCollapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
          </button>
        </div>
        <nav className="space-y-1">
          {items.map(([label, Icon]) => (
            <button
              key={label}
              onClick={() => setActivePage(label)}
              title={label}
              className={clsx(
                "flex h-10 w-full items-center rounded-lg text-sm transition",
                isCollapsed ? "justify-center px-0" : "gap-3 px-3 text-left",
                activePage === label
                  ? "bg-ink text-white shadow-soft dark:bg-white dark:text-ink"
                  : "text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/10"
              )}
            >
              <Icon size={17} />
              {!isCollapsed && label}
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
