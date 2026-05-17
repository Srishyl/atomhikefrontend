import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Share2, Users, X, Check, Filter, Search, Grid, List as ListIcon, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import { getTeamGoals, shareGoal } from "../../api/goals";
import { getTeam } from "../../api/users";
import { PageSkeleton, Spinner } from "../../components/loaders/Skeletons";
import StatusBadge from "../../components/common/StatusBadge";
import EmptyState from "../../components/common/EmptyState";
import Modal from "../../components/common/Modal";
import { fmtDate } from "../../utils/dateHelpers";

const STATUS_FILTERS = ["ALL", "DRAFT", "PENDING_APPROVAL", "LOCKED", "REJECTED"];

export default function TeamGoalsPage() {
  const [goals, setGoals] = useState([]);
  const [team, setTeam] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("ALL");
  const [empFilter, setEmpFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState("list");

  // Share modal state
  const [shareModal,   setShareModal]   = useState(null); // the master goal being shared
  const [selectedEmps, setSelectedEmps] = useState([]);
  const [shareWeight,  setShareWeight]  = useState(20);
  const [sharing,      setSharing]      = useState(false);

  const load = () =>
    Promise.all([
      getTeamGoals(),
      getTeam().catch(() => ({ data: [] })),
    ]).then(([gr, tr]) => {
      setGoals(gr.data);
      setTeam(tr.data);
    }).finally(() => setLoading(false));

  useEffect(() => { load(); }, []);

  if (loading) return <PageSkeleton />;

  const uniqueEmployees = [...new Set(goals.map(g => g.owner?.name).filter(Boolean))];

  const filtered = goals
    .filter(g => filter === "ALL" || g.status === filter)
    .filter(g => empFilter === "ALL" || g.owner?.name === empFilter)
    .filter(g => !search || g.title.toLowerCase().includes(search.toLowerCase()) || g.owner?.name.toLowerCase().includes(search.toLowerCase()));

  // Group by employee
  const grouped = filtered.reduce((acc, g) => {
    const key = g.owner?.name || "Unknown";
    if (!acc[key]) acc[key] = [];
    acc[key].push(g);
    return acc;
  }, {});

  const getInitials = (name) => {
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  };

  const getGoalProgress = (goal) => {
    if (!goal.checkIns || goal.checkIns.length === 0) return 0;
    const sorted = [...goal.checkIns].sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));
    return Math.round(sorted[0].achievementPct || 0);
  };

  const openShare = (goal) => {
    setShareModal(goal);
    setSelectedEmps([]);
    setShareWeight(20);
  };

  const toggleEmp = (id) =>
    setSelectedEmps(prev => prev.includes(id) ? prev.filter(e => e !== id) : [...prev, id]);

  const handleShare = async () => {
    if (!shareModal || selectedEmps.length === 0) {
      toast.error("Select at least one employee to share with");
      return;
    }
    if (shareWeight < 10 || shareWeight > 100) {
      toast.error("Weightage must be between 10% and 100%");
      return;
    }
    setSharing(true);
    try {
      await shareGoal({
        masterGoalId: shareModal.id,
        employeeIds:  selectedEmps,
        weightage:    parseFloat(shareWeight),
      });
      toast.success(`Goal shared to ${selectedEmps.length} employee(s)!`);
      setShareModal(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to share goal");
    } finally { setSharing(false); }
  };

  return (
    <div className="max-w-[1200px] mx-auto pb-10 space-y-8">
      {/* ── Header & Controls ── */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-[24px] text-primary">Team Goals</h2>
          <p className="font-sans text-[13px] text-ink-secondary mt-1">{goals.length} total goals · click Share on any LOCKED/DRAFT goal to push it to employees</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-secondary" />
            <input
              type="text"
              placeholder="Search goals or employees…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 pr-4 py-2 border border-surface-border rounded-lg font-sans text-[14px] text-primary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all w-64"
            />
          </div>

          {/* Employee Filter */}
          <select
            value={empFilter}
            onChange={e => setEmpFilter(e.target.value)}
            className="px-4 py-2 border border-surface-border rounded-lg font-sans text-[14px] text-primary focus:outline-none focus:border-accent bg-white"
          >
            <option value="ALL">All Employees</option>
            {uniqueEmployees.map(emp => (
              <option key={emp} value={emp}>{emp}</option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={filter}
            onChange={e => setFilter(e.target.value)}
            className="px-4 py-2 border border-surface-border rounded-lg font-sans text-[14px] text-primary focus:outline-none focus:border-accent bg-white"
          >
            {STATUS_FILTERS.map(s => (
              <option key={s} value={s}>{s === "ALL" ? "All Statuses" : s.replace("_", " ")}</option>
            ))}
          </select>

          {/* Toggle View */}
          <div className="flex bg-surface-bg border border-surface-border rounded-lg p-1 ml-auto">
            <button
              onClick={() => setViewMode("list")}
              className={`p-1.5 rounded transition-colors ${viewMode === "list" ? "bg-white shadow-sm text-accent" : "text-ink-secondary hover:text-primary"}`}
            >
              <ListIcon className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode("grid")}
              className={`p-1.5 rounded transition-colors ${viewMode === "grid" ? "bg-white shadow-sm text-accent" : "text-ink-secondary hover:text-primary"}`}
            >
              <Grid className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Main Content ── */}
      {Object.keys(grouped).length === 0 ? (
        <EmptyState title="No goals found" desc="Try adjusting your filters" />
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([empName, empGoals], idx) => (
            <motion.div key={empName} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.06 }}
              className="card overflow-hidden border border-surface-border bg-white rounded-2xl shadow-sm">

              {/* Employee Header */}
              <div className="flex items-center gap-3 px-6 py-4 bg-primary-tint/20 border-b border-surface-border">
                <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shrink-0">
                  <span className="font-sans text-[12px] font-bold text-white">
                    {getInitials(empName)}
                  </span>
                </div>
                <div>
                  <p className="font-sans text-[15px] font-bold text-primary">{empName}</p>
                </div>
                <div className="ml-4 px-2 py-0.5 rounded bg-primary-tint text-primary font-sans text-[11px] font-semibold tracking-wide uppercase">
                  {empGoals.length} Goals
                </div>
              </div>

              {/* Goals List */}
              {viewMode === "list" ? (
                <div className="flex flex-col">
                  {/* Table Header (Desktop only) */}
                  <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-3 border-b border-surface-border bg-[#FAFAFD] font-sans text-[12px] font-semibold text-ink-secondary uppercase tracking-wider">
                    <div className="col-span-4">Goal Title</div>
                    <div className="col-span-2">Thrust Area</div>
                    <div className="col-span-2">Progress</div>
                    <div className="col-span-2 text-center">Status</div>
                    <div className="col-span-2 text-right">Last Updated</div>
                  </div>

                  {/* Rows */}
                  {empGoals.map((g, i) => {
                    const isAlt = i % 2 !== 0;
                    const progress = getGoalProgress(g);

                    return (
                      <div key={g.id} className={`grid grid-cols-1 md:grid-cols-12 gap-4 items-center px-6 py-4 border-b border-surface-border last:border-b-0 transition-colors ${isAlt ? "bg-[#FAFAFD]" : "bg-white"} hover:bg-[#F0F0F8] group`}>
                        <div className="col-span-1 md:col-span-4">
                          <p className="font-sans text-[14px] text-primary font-medium line-clamp-1">{g.title}</p>
                          {g.isShared && <span className="inline-flex items-center text-[10px] text-accent font-semibold mt-0.5">↗ Shared KPI · {g.weightage}%</span>}
                          {g.rejectionReason && <p className="text-red-500 font-sans text-[11px] mt-0.5">↩ {g.rejectionReason}</p>}
                        </div>
                        <div className="col-span-1 md:col-span-2">
                          <span className="inline-flex px-2 py-1 rounded bg-surface-bg border border-surface-border font-sans text-[11px] text-ink-secondary truncate max-w-full">
                            {g.thrustArea?.name || "No Area"}
                          </span>
                        </div>
                        <div className="col-span-1 md:col-span-2">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 bg-surface-border rounded-full overflow-hidden">
                              <div className="h-full bg-accent rounded-full" style={{ width: `${progress}%` }} />
                            </div>
                            <span className="font-mono text-[12px] text-ink-secondary">{progress}%</span>
                          </div>
                        </div>
                        <div className="col-span-1 md:col-span-2 md:text-center">
                          <StatusBadge status={g.status} />
                        </div>
                        <div className="col-span-1 md:col-span-2 flex items-center justify-between md:justify-end gap-3">
                          <span className="font-mono text-[12px] text-ink-secondary mr-1">{fmtDate(g.updatedAt)}</span>
                          {(g.status === "LOCKED" || g.status === "DRAFT") && (
                            <button
                              onClick={() => openShare(g)}
                              className="inline-flex items-center justify-center p-1.5 rounded-lg bg-accent/10 text-accent hover:bg-accent/20 transition-all duration-200"
                              title="Share KPI"
                            >
                              <Share2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <Link to={`/manager/approvals`} className="font-sans text-[13px] text-accent font-medium opacity-0 group-hover:opacity-100 transition-opacity flex items-center shrink-0">
                            View <ChevronRight className="w-3 h-3" />
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-6 bg-[#FAFAFD]">
                  {empGoals.map(g => (
                    <div key={g.id} className="p-4 border border-surface-border bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow flex flex-col h-full group">
                      <div className="flex justify-between items-start mb-3">
                        <span className="inline-flex px-2 py-0.5 rounded bg-surface-bg border border-surface-border font-sans text-[10px] text-ink-secondary uppercase truncate max-w-[120px]">
                          {g.thrustArea?.name || "No Area"}
                        </span>
                        <StatusBadge status={g.status} />
                      </div>
                      <p className="font-sans text-[14px] text-primary font-medium mb-1 flex-1">{g.title}</p>
                      {g.isShared && <p className="text-[10px] text-accent font-semibold mb-2">↗ Shared KPI · {g.weightage}%</p>}
                      {g.rejectionReason && <p className="text-red-500 font-sans text-[11px] mb-2">↩ {g.rejectionReason}</p>}
                      <div className="pt-3 border-t border-surface-border flex items-center justify-between">
                        <span className="font-mono text-[11px] text-ink-secondary">Updated: {fmtDate(g.updatedAt)}</span>
                        <div className="flex items-center gap-2">
                          {(g.status === "LOCKED" || g.status === "DRAFT") && (
                            <button
                              onClick={() => openShare(g)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-accent/10 text-accent text-xs font-semibold hover:bg-accent/20 transition-all duration-200"
                            >
                              <Share2 className="w-3 h-3" /> Share
                            </button>
                          )}
                          <Link to={`/manager/approvals`} className="font-sans text-[12px] text-accent font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                            View Details
                          </Link>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          ))}
        </div>
      )}

      {/* ── Share Goal Modal ─────────────────────────────────────────────────── */}
      <Modal open={!!shareModal} onClose={() => setShareModal(null)} title="Share Goal to Employees" size="md">
        {shareModal && (
          <div className="space-y-5">
            {/* Master goal info */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <p className="text-xs text-slate-400 mb-0.5">Master Goal</p>
              <p className="text-sm font-semibold text-slate-800">{shareModal.title}</p>
              <p className="text-xs text-slate-500">{shareModal.thrustArea?.name} · {shareModal.weightage}% · <StatusBadge status={shareModal.status} /></p>
            </div>

            {/* Default weightage for copies */}
            <div>
              <label className="label">Default Weightage for Each Employee (%)</label>
              <input type="number" min={10} max={100} className="input"
                value={shareWeight} onChange={e => setShareWeight(e.target.value)} />
              <p className="text-xs text-slate-400 mt-1">Each employee copy will start with this weightage. Employees can adjust it in their goals.</p>
            </div>

            {/* Employee selection */}
            <div>
              <label className="label">Select Employees to Share With</label>
              {team.length === 0 ? (
                <p className="text-sm text-slate-400 py-4 text-center">No team members found</p>
              ) : (
                <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                  {team.map(emp => (
                    <button key={emp.id} onClick={() => toggleEmp(emp.id)}
                      className={`w-full flex items-center gap-3 p-2.5 rounded-xl border text-left transition-all
                        ${selectedEmps.includes(emp.id)
                          ? "bg-brand-50 border-brand-300 text-brand-800"
                          : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"}`}>
                      <div className="w-7 h-7 rounded-full bg-brand-600 flex items-center justify-center shrink-0">
                        <span className="text-white text-xs font-bold">
                          {emp.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{emp.name}</p>
                        <p className="text-xs text-slate-400 truncate">{emp.department || emp.email}</p>
                      </div>
                      <AnimatePresence>
                        {selectedEmps.includes(emp.id) && (
                          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                            <Check className="w-4 h-4 text-brand-600" />
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </button>
                  ))}
                </div>
              )}
              {selectedEmps.length > 0 && (
                <p className="text-xs text-brand-600 mt-2 font-medium">{selectedEmps.length} employee(s) selected</p>
              )}
            </div>

            <div className="flex gap-3 pt-1">
              <button onClick={() => setShareModal(null)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={handleShare} disabled={sharing || selectedEmps.length === 0}
                className="btn-primary flex-1 justify-center">
                {sharing ? <Spinner size="sm" /> : <Share2 className="w-4 h-4" />}
                Share to {selectedEmps.length || "..."} Employee{selectedEmps.length !== 1 ? "s" : ""}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
