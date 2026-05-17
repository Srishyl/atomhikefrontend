import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { Bell, CircleDot, User } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { getActiveCycle } from "../../api/cycles";

const PAGE_TITLES = {
  "/employee/dashboard": "Dashboard",
  "/employee/goals":     "My Goals",
  "/employee/checkin":   "Check-ins",
  "/manager/dashboard":     "Dashboard",
  "/manager/team-goals":    "Team Goals",
  "/manager/approvals":     "Goal Approvals",
  "/manager/checkin-review":"Check-in Review",
  "/admin/dashboard":    "Dashboard",
  "/admin/users":        "User Management",
  "/admin/cycles":       "Cycles & Windows",
  "/admin/thrust-areas": "Thrust Areas",
  "/admin/reports":      "Reports",
  "/admin/audit":        "Audit Trail",
};

export default function Topbar() {
  const { user } = useAuth();
  const location = useLocation();
  const [cycle, setCycle] = useState(null);
  const path = location.pathname;
  const title = PAGE_TITLES[path] || "AtomQuest PMS";

  useEffect(() => {
    getActiveCycle().then(r => setCycle(r.data)).catch(() => {});
  }, []);


  return (
    <header className="fixed top-0 left-64 right-0 z-20 h-16 bg-white border-b border-surface-border flex items-center px-8 gap-4">
      {/* Breadcrumb / Title */}
      <h1 className="font-sans font-semibold text-[14px] text-ink-primary flex-1">{title}</h1>

      {/* Cycle Status */}
      {cycle && (
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-status-success-light border border-[#bbf7d0]">
          <CircleDot className="w-3.5 h-3.5 text-status-success" />
          <span className="font-sans text-[12px] font-medium text-green-800">{cycle.name}</span>
        </div>
      )}

      {/* Bell */}
      <button className="relative p-2 text-ink-secondary hover:text-primary hover:bg-surface-bg rounded-md transition-colors ml-2">
        <Bell className="w-[18px] h-[18px]" />
      </button>

      <div className="w-[1px] h-6 bg-surface-border mx-2"></div>

      {/* Avatar & Role */}
      <div className="flex items-center gap-3">
        <div className="text-right hidden sm:block">
          <p className="font-sans text-[13px] font-semibold text-ink-primary leading-tight">{user?.name}</p>
          <span className="inline-block mt-1 px-2 py-0.5 rounded bg-primary-tint text-primary font-sans text-[10px] font-bold uppercase tracking-wide">
            {user?.role || "Employee"}
          </span>
        </div>
        <div className="w-9 h-9 rounded-full bg-accent flex items-center justify-center shrink-0">
          <User className="w-4 h-4 text-white" />
        </div>
      </div>
    </header>
  );
}
