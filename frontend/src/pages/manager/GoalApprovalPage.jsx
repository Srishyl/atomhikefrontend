import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, XCircle, Search, Clock, CheckCircle } from "lucide-react";
import toast from "react-hot-toast";
import { getTeamGoals, approveGoal, rejectGoal } from "../../api/goals";
import { PageSkeleton, Spinner } from "../../components/loaders/Skeletons";
import StatusBadge from "../../components/common/StatusBadge";
import { UOM_LABELS } from "../../utils/uom";
import { fmtDate } from "../../utils/dateHelpers";

export default function GoalApprovalPage() {
  const [goals,    setGoals]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState({});
  const [selectedGoalId, setSelectedGoalId] = useState(null);
  const [reason,   setReason]   = useState("");
  const [search,   setSearch]   = useState("");

  const load = () => {
    getTeamGoals()
      .then(r => {
        const pending = r.data.filter(g => g.status === "PENDING_APPROVAL");
        setGoals(pending);
        if (pending.length > 0 && !pending.find(g => g.id === selectedGoalId)) {
          setSelectedGoalId(pending[0].id);
        } else if (pending.length === 0) {
          setSelectedGoalId(null);
        }
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleApprove = async (id) => {
    setSaving(s => ({ ...s, [id]: "approving" }));
    try {
      await approveGoal(id);
      toast.success("Goal approved and locked!");
      setReason("");
      load();
    } catch (err) { toast.error(err.response?.data?.detail || "Approval failed"); }
    finally { setSaving(s => ({ ...s, [id]: null })); }
  };

  const handleReject = async (id) => {
    if (!reason.trim()) {
      toast.error("Please provide a reason for rejection.");
      return;
    }
    setSaving(s => ({ ...s, [id]: "rejecting" }));
    try {
      await rejectGoal(id, reason);
      toast.success("Goal returned to employee");
      setReason("");
      load();
    } catch { toast.error("Rejection failed"); }
    finally { setSaving(s => ({ ...s, [id]: null })); }
  };

  if (loading) return <PageSkeleton />;

  const filteredGoals = goals.filter(g => 
    !search || 
    g.title.toLowerCase().includes(search.toLowerCase()) || 
    g.owner?.name.toLowerCase().includes(search.toLowerCase())
  );

  const selectedGoal = goals.find(g => g.id === selectedGoalId);

  return (
    <div className="max-w-[1200px] mx-auto h-[calc(100vh-140px)] flex flex-col pb-6">
      
      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-6 shrink-0 gap-4">
        <div>
          <h2 className="font-display text-[26px] text-primary">Goal Approvals</h2>
          <p className="font-sans text-[13px] text-ink-secondary mt-1">Review and approve team performance objectives.</p>
        </div>
      </div>

      {goals.length === 0 ? (
        <div className="flex-1 card flex flex-col items-center justify-center text-center p-12 border border-surface-border">
          <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mb-6">
            <CheckCircle className="w-10 h-10 text-emerald-500" />
          </div>
          <h3 className="font-display text-[24px] text-primary mb-2">All caught up!</h3>
          <p className="font-sans text-[14px] text-ink-secondary max-w-sm">
            There are no pending goals awaiting your approval at this time.
          </p>
        </div>
      ) : (
        <div className="flex-1 flex gap-6 min-h-0 overflow-hidden">
          
          {/* ── Left Panel: List (360px fixed) ── */}
          <div className="w-[360px] flex flex-col border border-surface-border rounded-2xl bg-surface-bg overflow-hidden shadow-sm shrink-0">
            <div className="p-4 border-b border-surface-border bg-white">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-secondary" />
                <input 
                  type="text" 
                  placeholder="Search approvals…"
                  value={search} 
                  onChange={e => setSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-surface-bg border border-surface-border rounded-lg font-sans text-[13px] text-primary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {filteredGoals.map(goal => {
                const isActive = goal.id === selectedGoalId;
                return (
                  <button 
                    key={goal.id} 
                    onClick={() => setSelectedGoalId(goal.id)}
                    className={`w-full text-left p-4 border-b border-surface-border transition-all duration-200 block
                      ${isActive 
                        ? "bg-primary-tint/30 border-l-4 border-l-accent border-b-transparent shadow-sm" 
                        : "bg-white border-l-4 border-l-transparent hover:bg-[#FAFAFD]"}`}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <p className="font-sans text-[14px] font-semibold text-primary truncate pr-2">{goal.owner?.name}</p>
                      <StatusBadge status="PENDING_APPROVAL" className="scale-90 origin-right" />
                    </div>
                    <p className={`font-display text-[15px] font-bold leading-tight mb-2 line-clamp-2
                      ${isActive ? "text-primary" : "text-ink-secondary"}`}>
                      {goal.title}
                    </p>
                    <div className="flex items-center justify-between mt-3">
                      <span className="inline-flex px-1.5 py-0.5 rounded bg-surface-border font-sans text-[10px] text-ink-secondary uppercase truncate max-w-[120px]">
                        {goal.thrustArea?.name || "No Area"}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3 h-3 text-ink-secondary" />
                        <span className="font-mono text-[11px] text-ink-secondary">
                          {fmtDate(goal.updatedAt)}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
              {filteredGoals.length === 0 && (
                <div className="p-8 text-center font-sans text-[13px] text-ink-secondary">
                  No matching goals found.
                </div>
              )}
            </div>
          </div>

          {/* ── Right Panel: Details ── */}
          <div className="flex-1 flex flex-col border border-surface-border rounded-2xl bg-white overflow-hidden shadow-sm relative">
            {selectedGoal ? (
              <div className="flex flex-col h-full overflow-y-auto">
                {/* Details Header */}
                <div className="px-8 py-6 border-b border-surface-border bg-[#FAFAFD]">
                  <h3 className="font-display text-[22px] text-primary mb-6">Goal Details</h3>
                  <h4 className="font-display text-[20px] text-primary leading-snug mb-3">{selectedGoal.title}</h4>
                  {selectedGoal.description && (
                    <p className="font-sans text-[14px] text-ink-secondary leading-relaxed max-w-3xl">
                      {selectedGoal.description}
                    </p>
                  )}
                </div>

                {/* Grid Info */}
                <div className="p-8 border-b border-surface-border grid grid-cols-2 gap-y-6 gap-x-8">
                  <div>
                    <p className="font-sans text-[12px] font-semibold text-ink-secondary uppercase tracking-wider mb-1">Thrust Area</p>
                    <p className="font-sans text-[14px] text-primary font-medium">{selectedGoal.thrustArea?.name || "—"}</p>
                  </div>
                  <div>
                    <p className="font-sans text-[12px] font-semibold text-ink-secondary uppercase tracking-wider mb-1">Submitted By</p>
                    <p className="font-sans text-[14px] text-primary font-medium">{selectedGoal.owner?.name}</p>
                  </div>
                  <div>
                    <p className="font-sans text-[12px] font-semibold text-ink-secondary uppercase tracking-wider mb-1">UoM Type</p>
                    <p className="font-sans text-[14px] text-primary font-medium">{UOM_LABELS[selectedGoal.uomType]?.label}</p>
                  </div>
                  <div>
                    <p className="font-sans text-[12px] font-semibold text-ink-secondary uppercase tracking-wider mb-1">Submitted On</p>
                    <p className="font-sans text-[14px] text-primary font-medium">{fmtDate(selectedGoal.updatedAt)}</p>
                  </div>
                  <div>
                    <p className="font-sans text-[12px] font-semibold text-ink-secondary uppercase tracking-wider mb-1">Target Value</p>
                    <p className="font-mono text-[16px] text-accent font-semibold">{selectedGoal.targetValue || "—"}</p>
                  </div>
                  <div>
                    <p className="font-sans text-[12px] font-semibold text-ink-secondary uppercase tracking-wider mb-1">Weightage</p>
                    <p className="font-mono text-[16px] text-primary font-semibold">{selectedGoal.weightage}%</p>
                  </div>
                </div>

                {/* Approval Decision */}
                <div className="p-8 bg-surface-bg flex-1">
                  <h4 className="font-sans text-[14px] font-bold text-primary mb-4">Approval Decision</h4>
                  <div className="max-w-2xl">
                    <textarea 
                      className="w-full p-4 border border-surface-border rounded-xl font-sans text-[14px] text-primary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all resize-none min-h-[100px] mb-4 bg-white" 
                      placeholder="Add comments (required for rejection)..."
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                    />
                    
                    <div className="flex gap-4">
                      <motion.button whileTap={{ scale: 0.98 }}
                        onClick={() => handleApprove(selectedGoal.id)}
                        disabled={saving[selectedGoal.id]}
                        className="flex-1 bg-accent hover:bg-accent/90 text-white font-sans text-[14px] font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2 shadow-sm">
                        {saving[selectedGoal.id] === "approving" ? <Spinner /> : <><CheckCircle2 className="w-5 h-5" /> Approve Goal</>}
                      </motion.button>
                      
                      <motion.button whileTap={{ scale: 0.98 }}
                        onClick={() => handleReject(selectedGoal.id)}
                        disabled={saving[selectedGoal.id]}
                        className="flex-1 border border-danger text-danger hover:bg-danger-light font-sans text-[14px] font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2">
                        {saving[selectedGoal.id] === "rejecting" ? <Spinner /> : <><XCircle className="w-5 h-5" /> Return for Revision</>}
                      </motion.button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <p className="font-sans text-[14px] text-ink-secondary">Select a goal to review</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
