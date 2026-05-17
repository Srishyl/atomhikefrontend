import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Check, X, Clock, ChevronRight } from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "../../context/AuthContext";
import { getTeamGoals, approveGoal, rejectGoal } from "../../api/goals";
import { getActiveCycle } from "../../api/cycles";
import { getTeam } from "../../api/users";
import { PageSkeleton, Spinner } from "../../components/loaders/Skeletons";
import Modal from "../../components/common/Modal";

export default function ManagerDashboard() {
  const { user } = useAuth();
  const [goals, setGoals] = useState([]);
  const [team, setTeam] = useState([]);
  const [cycle, setCycle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState({});
  const [rejectModal, setRejectModal] = useState(null);
  const [reason, setReason] = useState("");

  const load = () =>
    Promise.all([
      getTeamGoals(),
      getTeam().catch(() => ({ data: [] })),
      getActiveCycle().catch(() => ({ data: null })),
    ]).then(([gr, tr, cr]) => {
      setGoals(gr.data); setTeam(tr.data); setCycle(cr.data);
    }).finally(() => setLoading(false));

  useEffect(() => { load(); }, []);

  if (loading) return <PageSkeleton />;

  const pending = goals.filter(g => g.status === "PENDING_APPROVAL");

  const getGoalProgress = (goal) => {
    if (!goal.checkIns || goal.checkIns.length === 0) return 0;
    const sorted = [...goal.checkIns].sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));
    return Math.round(sorted[0].achievementPct || 0);
  };

  // Aggregate Team Progress
  const empMap = {};
  team.forEach(t => {
    empMap[t.id] = { name: t.name, totalGoals: 0, progressSum: 0 };
  });
  goals.forEach(g => {
    if (g.status === "LOCKED" && g.ownerId) {
      if (!empMap[g.ownerId]) {
        empMap[g.ownerId] = { name: g.owner?.name || "Unknown", totalGoals: 0, progressSum: 0 };
      }
      empMap[g.ownerId].totalGoals += 1;
      empMap[g.ownerId].progressSum += getGoalProgress(g);
    }
  });

  const teamProgressData = Object.values(empMap).map(e => ({
    name: e.name,
    progress: e.totalGoals ? Math.round(e.progressSum / e.totalGoals) : 0,
  }));

  const teamAvgProgress = teamProgressData.length
    ? Math.round(teamProgressData.reduce((a, b) => a + b.progress, 0) / teamProgressData.length)
    : 0;

  // Count check-ins submitted in the last 7 days
  const countCheckinsThisWeek = () => {
    let count = 0;
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    goals.forEach(g => {
      g.checkIns?.forEach(c => {
        if (c.submittedAt && new Date(c.submittedAt) >= oneWeekAgo) {
          count++;
        }
      });
    });
    return count;
  };
  const checkinsThisWeek = countCheckinsThisWeek();

  // Aggregate recent check-ins across the team
  const getRecentCheckins = () => {
    const list = [];
    goals.forEach(g => {
      g.checkIns?.forEach(c => {
        list.push({
          id: c.id,
          name: g.owner?.name || "Unknown",
          goal: g.title,
          note: c.comments?.[0]?.content || c.progressStatus?.replace("_", " ") || "Logged a check-in",
          time: new Date(c.submittedAt),
          achievementPct: c.achievementPct
        });
      });
    });
    list.sort((a, b) => b.time - a.time);
    return list.slice(0, 3).map(item => {
      const diffMs = new Date() - item.time;
      const diffMins = Math.floor(diffMs / 60000);
      const diffHrs = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHrs / 24);
      let timeStr = "recently";
      if (diffDays > 0) timeStr = `${diffDays}d ago`;
      else if (diffHrs > 0) timeStr = `${diffHrs}h ago`;
      else if (diffMins > 0) timeStr = `${diffMins}m ago`;
      else timeStr = "just now";

      return {
        id: item.id,
        name: item.name,
        goal: item.goal,
        note: `${item.note} (${item.achievementPct}% achievement)`,
        time: timeStr
      };
    });
  };
  const recentCheckIns = getRecentCheckins();

  const handleApprove = async (id) => {
    setSaving(s => ({ ...s, [id]: "approving" }));
    try {
      await approveGoal(id);
      toast.success("Goal approved!");
      load();
    } catch (err) { toast.error(err.response?.data?.detail || "Approval failed"); }
    finally { setSaving(s => ({ ...s, [id]: null })); }
  };

  const handleReject = async () => {
    if (!rejectModal || !reason.trim()) return;
    setSaving(s => ({ ...s, [rejectModal.id]: "rejecting" }));
    try {
      await rejectGoal(rejectModal.id, reason);
      toast.success("Goal returned to employee");
      setRejectModal(null); setReason("");
      load();
    } catch { toast.error("Rejection failed"); }
    finally { setSaving(s => ({ ...s, [rejectModal?.id]: null })); }
  };

  const getInitials = (name) => {
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  };

  return (
    <div className="max-w-[1200px] mx-auto pb-10 space-y-8">
      {/* ── Header ── */}
      <div>
        <h2 className="font-display text-[26px] text-primary">Team Overview</h2>
        <p className="font-sans text-[13px] text-ink-secondary mt-1">{cycle?.name} — {team.length} direct reports</p>
      </div>

      {/* ── KPI Row ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Direct Reports", value: team.length },
          { label: "Goals Pending Approval", value: pending.length },
          { label: "Check-ins This Week", value: checkinsThisWeek },
          { label: "Team Avg Progress", value: `${teamAvgProgress}%` },
        ].map((kpi, i) => (
          <div key={i} className="card p-6 flex flex-col justify-center border border-surface-border">
            <p className="font-mono text-3xl text-accent mb-2">{kpi.value}</p>
            <p className="font-sans text-[13px] text-ink-secondary font-medium tracking-wide uppercase">{kpi.label}</p>
          </div>
        ))}
      </div>

      {/* ── Split Layout ── */}
      <div className="flex flex-col lg:flex-row gap-6">

        {/* Left: Team Progress (60%) */}
        <div className="flex-[3] card border border-surface-border p-6">
          <h3 className="font-display text-lg text-primary mb-6">Team Progress</h3>

          <div className="space-y-5">
            {teamProgressData.length === 0 ? (
              <p className="text-sm text-ink-secondary">No active goals found.</p>
            ) : (
              teamProgressData.map((emp, i) => (
                <div key={i} className="flex items-center gap-4">
                  <div className="w-[120px] shrink-0">
                    <p className="font-sans text-[13px] text-primary truncate">{emp.name}</p>
                  </div>
                  <div className="flex-1 h-2 bg-surface-border rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${emp.progress}%` }}
                      transition={{ duration: 1, delay: i * 0.1 }}
                      className="h-full bg-accent rounded-full"
                    />
                  </div>
                  <div className="w-10 text-right shrink-0">
                    <p className="font-mono text-[12px] text-ink-secondary">{emp.progress}%</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right: Pending Approvals (40%) */}
        <div className="flex-[2] card border border-surface-border flex flex-col">
          <div className="p-5 border-b border-surface-border flex items-center justify-between">
            <h3 className="font-display text-lg text-primary">Pending Approvals</h3>
            <Link to="/manager/approvals" className="font-sans text-xs text-accent hover:underline flex items-center">
              View all <ChevronRight className="w-3 h-3 ml-0.5" />
            </Link>
          </div>

          <div className="p-2 space-y-1">
            {pending.length === 0 ? (
              <div className="p-8 text-center text-ink-secondary font-sans text-sm">All caught up!</div>
            ) : (
              pending.slice(0, 5).map(g => (
                <div key={g.id} className="flex items-start gap-3 p-3 rounded-xl hover:bg-primary-tint/30 transition-colors group">
                  <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shrink-0">
                    <span className="font-sans text-[11px] font-bold text-white">{getInitials(g.owner?.name || "??")}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-sans text-[14px] font-medium text-primary truncate">{g.owner?.name}</p>
                    <p className="font-sans text-[13px] text-ink-secondary truncate mb-1">{g.title}</p>
                    <div className="flex items-center gap-2">
                      <Clock className="w-3 h-3 text-ink-secondary/50" />
                      <span className="font-mono text-[11px] text-ink-secondary/70">Submitted recently</span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => handleApprove(g.id)} disabled={saving[g.id]}
                      className="px-2 py-1 bg-accent text-white rounded text-[11px] font-semibold hover:bg-accent/90 transition-colors w-16 flex justify-center">
                      {saving[g.id] === "approving" ? <Spinner size="sm" /> : "Approve"}
                    </button>
                    <button onClick={() => setRejectModal(g)}
                      className="px-2 py-1 border border-danger text-danger rounded text-[11px] font-semibold hover:bg-danger-light transition-colors w-16">
                      Reject
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ── Recent Check-ins Feed ── */}
      <div className="card border border-surface-border p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-display text-lg text-primary">Recent Check-ins</h3>
          <Link to="/manager/checkin-review" className="font-sans text-xs text-accent hover:underline flex items-center">
            Review all <ChevronRight className="w-3 h-3 ml-0.5" />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {recentCheckIns.length === 0 ? (
            <div className="col-span-1 md:col-span-3 py-8 text-center text-ink-secondary text-sm font-sans">
              No recent check-ins submitted yet.
            </div>
          ) : (
            recentCheckIns.map(ci => (
              <div key={ci.id} className="p-4 border border-surface-border rounded-xl bg-surface-bg/50">
                <div className="flex justify-between items-start mb-2">
                  <p className="font-sans text-[14px] font-bold text-primary">{ci.name}</p>
                  <span className="font-mono text-[11px] text-ink-secondary">{ci.time}</span>
                </div>
                <p className="font-sans text-[12px] text-ink-secondary font-medium mb-3 truncate">{ci.goal}</p>
                <div className="p-3 bg-white rounded-lg border border-surface-border/50 text-[13px] font-sans text-ink-secondary italic line-clamp-2">
                  "{ci.note}"
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Reject Modal */}
      <Modal open={!!rejectModal} onClose={() => { setRejectModal(null); setReason(""); }} title="Reject Goal" size="sm">
        <p className="font-sans text-[13px] text-ink-secondary mb-3">Goal: <strong className="text-primary">{rejectModal?.title}</strong></p>
        <textarea className="input min-h-[90px] resize-none mb-4 font-sans text-sm" placeholder="Reason for rejection (employee will see this)…"
          value={reason} onChange={e => setReason(e.target.value)} />
        <div className="flex gap-3">
          <button onClick={() => { setRejectModal(null); setReason(""); }} className="btn-secondary flex-1">Cancel</button>
          <button onClick={handleReject} disabled={!reason.trim() || saving[rejectModal?.id] === "rejecting"} className="btn-primary bg-danger hover:bg-danger/90 border-transparent flex-1 justify-center">
            {saving[rejectModal?.id] === "rejecting" ? <Spinner /> : "Reject Goal"}
          </button>
        </div>
      </Modal>

    </div>
  );
}
