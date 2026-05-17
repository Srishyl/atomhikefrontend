import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Lock, LockIcon, Calendar, CalendarOff, ChevronRight, Activity, Clock, MessageSquare, Target, CheckCircle2, TrendingUp, AlertCircle, Pencil } from "lucide-react";
import toast from "react-hot-toast";
import { getMyGoals } from "../../api/goals";
import { submitCheckIn, getGoalCheckIns } from "../../api/checkIns";
import { getActiveCycle, getQuarterWindows } from "../../api/cycles";
import { PageSkeleton, Spinner } from "../../components/loaders/Skeletons";
import { UOM_LABELS, computeAchievement, achievementBg } from "../../utils/uom";
import { isWindowOpen, fmtDate } from "../../utils/dateHelpers";

const QUARTERS = ["Q1", "Q2", "Q3", "Q4"];
const PROGRESS_OPTIONS = ["NOT_STARTED", "ON_TRACK", "COMPLETED", "DELAYED"];

export default function CheckInPage() {
  const [goals, setGoals] = useState([]);
  const [cycle, setCycle] = useState(null);
  const [windows, setWindows] = useState([]);
  const [checkIns, setCheckIns] = useState({});
  const [activeQ, setActiveQ] = useState(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState({});
  const [selectedGoalId, setSelectedGoalId] = useState(null);
  // Track which goals were JUST saved in this session → show "Saved ✓" state
  const [justSaved, setJustSaved] = useState({});
  // Track which goals are in "editing" mode (to re-show form after save)
  const [editing, setEditing] = useState({});

  const load = async () => {
    try {
      const cr = await getActiveCycle();
      setCycle(cr.data);
      const [gr, wr] = await Promise.all([
        getMyGoals(),
        getQuarterWindows(cr.data.id),
      ]);
      const lockedGoals = gr.data.filter(g => g.status === "LOCKED");
      setGoals(lockedGoals);
      if (lockedGoals.length > 0) {
        setSelectedGoalId(lockedGoals[0].id);
      }

      setWindows(wr.data);

      const active = wr.data.find(w => w.isActive && isWindowOpen(w.windowOpen, w.windowClose));
      setActiveQ(active?.quarter || null);

      const ciMap = {};
      await Promise.all(lockedGoals.map(async g => {
        try { const r = await getGoalCheckIns(g.id); ciMap[g.id] = r.data; }
        catch { ciMap[g.id] = []; }
      }));
      setCheckIns(ciMap);
    } catch { toast.error("Could not load check-in data"); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const activeWindow = windows.find(w => w.quarter === activeQ);
  const selectedGoal = goals.find(g => g.id === selectedGoalId);

  const getFormVal = (gid, field) => form[gid]?.[field] ?? "";
  const setFormVal = (gid, field, val) => setForm(f => ({ ...f, [gid]: { ...f[gid], [field]: val } }));
  const getExisting = (gid) => checkIns[gid]?.find(ci => ci.quarterWindow?.quarter === activeQ);

  const handleSubmit = async (goal) => {
    const f = form[goal.id] || {};
    setSaving(s => ({ ...s, [goal.id]: true }));
    try {
      await submitCheckIn({
        goalId: goal.id,
        actualValue: f.actualValue !== "" && f.actualValue !== undefined ? parseFloat(f.actualValue) : null,
        actualDate: f.actualDate || null,
        progressStatus: f.progressStatus || null,
      });
      toast.success(`Check-in saved for "${goal.title}"`);
      // Mark as "just saved" and exit editing mode
      setJustSaved(s => ({ ...s, [goal.id]: true }));
      setEditing(s => ({ ...s, [goal.id]: false }));
      load(); // refresh data
    } catch (err) {
      const detail = err.response?.data?.detail;
      const msg = Array.isArray(detail)
        ? detail.map(d => d.msg || JSON.stringify(d)).join("; ")
        : (detail || "Failed to save check-in");
      toast.error(msg);
    } finally { setSaving(s => ({ ...s, [goal.id]: false })); }
  };

  const startEditing = (goal) => {
    const existing = getExisting(goal.id);
    // Pre-fill form with existing values
    setForm(f => ({
      ...f,
      [goal.id]: {
        actualValue: existing?.actualValue ?? "",
        actualDate: existing?.actualDate?.slice(0, 10) ?? "",
        progressStatus: existing?.progressStatus ?? "",
      }
    }));
    setEditing(s => ({ ...s, [goal.id]: true }));
    setJustSaved(s => ({ ...s, [goal.id]: false }));
  };

  if (loading) return <PageSkeleton />;

  return (
    <div className="max-w-[1200px] mx-auto h-[calc(100vh-140px)] flex flex-col pb-6">

      {/* ── Header Workspace Banner ── */}
      <div className="bg-white rounded-2xl border border-surface-border p-5 md:p-6 relative overflow-hidden shadow-sm shrink-0 mb-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="absolute right-0 top-0 bottom-0 w-80 bg-gradient-to-l from-accent/5 to-transparent pointer-events-none" />

        <div className="relative z-10">
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-accent-light text-accent text-xs font-semibold mb-2.5">
            Progress Check-ins
          </span>
          <h2 className="font-display text-2xl text-primary font-bold mb-1">
            Quarterly Check-ins
          </h2>
          <p className="font-sans text-xs text-ink-secondary">
            {cycle?.name} · Log actual performance updates against your locked targets below.
          </p>
        </div>

        {/* Dynamic Quarter Tab Selector */}
        <div className="flex gap-1.5 p-1 bg-[#F9F9FB] border border-surface-border rounded-xl shrink-0 relative z-10 self-start md:self-auto">
          {QUARTERS.map(q => {
            const w = windows.find(ww => ww.quarter === q);
            const isOpen = w && isWindowOpen(w.windowOpen, w.windowClose);
            return (
              <button
                key={q}
                onClick={() => setActiveQ(q)}
                className={`px-3.5 py-1.5 rounded-lg font-sans text-xs font-bold transition-all duration-200 flex items-center gap-1.5
                  ${activeQ === q
                    ? "bg-white text-accent shadow-sm border border-surface-border"
                    : "text-ink-secondary hover:text-primary border border-transparent"}`}
              >
                {q}
                {isOpen && (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                )}
              </button>
            );
          })}
        </div>
      </div>

  {/* ── Window Status Banner ── */}
  {
    activeWindow && (
      <div className={`shrink-0 mb-6 flex items-center gap-2 px-5 py-3.5 rounded-xl font-sans text-xs border shadow-sm
          ${isWindowOpen(activeWindow.windowOpen, activeWindow.windowClose)
          ? "bg-emerald-50/60 border-green-200 text-green-800"
          : "bg-[#F9F9FB] border-surface-border text-ink-secondary"}`}>
        {isWindowOpen(activeWindow.windowOpen, activeWindow.windowClose) ? (
          <>
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="font-semibold">Window Open:</span>
            <span>Check-ins are active for {activeWindow.quarter} from {fmtDate(activeWindow.windowOpen)} to {fmtDate(activeWindow.windowClose)}.</span>
          </>
        ) : (
          <>
            <Clock className="w-4 h-4 text-ink-secondary/70 shrink-0" />
            <span className="font-semibold">Window Closed:</span>
            <span>Check-in period for {activeWindow.quarter} ({fmtDate(activeWindow.windowOpen)} – {fmtDate(activeWindow.windowClose)}) is locked.</span>
          </>
        )}
      </div>
    )
  }

  {/* ── Main Split View ── */}
  {
    goals.length === 0 ? (
      <div className="bg-white border border-surface-border rounded-2xl flex-1 flex flex-col items-center justify-center text-center p-12 max-w-lg mx-auto my-6 shadow-sm">
        <div className="w-14 h-14 rounded-full bg-primary-tint/50 flex items-center justify-center text-ink-secondary/70 mb-4">
          <Lock className="w-7 h-7" />
        </div>
        <h3 className="font-display text-lg font-bold text-primary mb-1.5">No Approved Goals</h3>
        <p className="font-sans text-sm text-ink-secondary max-w-sm leading-relaxed">
          Your performance goals must be approved and locked by your manager before you can submit quarterly progress check-ins.
        </p>
      </div>
    ) : (
    <div className="flex-1 flex gap-6 min-h-0 overflow-hidden">

      {/* ── LEFT PANEL: Goals Index (40% width) ── */}
      <div className="w-[40%] flex flex-col border border-surface-border rounded-2xl bg-white overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-surface-border bg-[#F9F9FB] shrink-0">
          <h3 className="font-sans text-xs font-bold text-primary uppercase tracking-wider flex items-center gap-2">
            <Target className="w-4 h-4 text-accent" /> Select Target
          </h3>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {goals.map(goal => {
            const isActive = goal.id === selectedGoalId;
            const existing = getExisting(goal.id);
            const isCompleted = existing && (existing.progressStatus === "COMPLETED" || existing.actualValue);

            return (
              <button
                key={goal.id}
                onClick={() => setSelectedGoalId(goal.id)}
                className={`w-full text-left p-4 rounded-xl border transition-all duration-200 group flex items-start justify-between
                      ${isActive
                    ? "bg-accent-light/40 border-accent/40 shadow-sm"
                    : "bg-white border-transparent hover:border-surface-border hover:bg-[#F9F9FB]"}`}
              >
                <div className="pr-4 flex-1 min-w-0">
                  <p className={`font-display text-sm leading-snug mb-2 transition-colors truncate
                        ${isActive ? "text-primary font-bold" : "text-primary group-hover:text-accent"}`}>
                    {goal.title}
                  </p>

                  <div className="flex items-center gap-2 font-sans text-[10px]">
                    <span className="px-1.5 py-0.5 rounded bg-surface-border text-ink-secondary font-medium tracking-wide">
                      {UOM_LABELS[goal.uomType]?.label}
                    </span>
                    {isCompleted && (
                      <span className="text-emerald-600 font-semibold flex items-center gap-1">
                        <Activity className="w-3.5 h-3.5" /> Checked-in
                      </span>
                    )}
                  </div>
                </div>
                <ChevronRight className={`w-4 h-4 mt-1 shrink-0 transition-all ${isActive ? "text-accent translate-x-0.5" : "text-transparent group-hover:text-ink-secondary"}`} />
              </button>
            );
          })}
        </div>
      </div>


              {/* ── RIGHT PANEL: Forms & Progress Comparison (60% width) ── */}
              <div className="flex-1 flex flex-col border border-surface-border rounded-2xl bg-white overflow-hidden shadow-sm relative">
                {selectedGoal ? (() => {
                  const goal = selectedGoal;
                  const existing = getExisting(goal.id);
                  const fActual = getFormVal(goal.id, "actualValue");
                  const fDate = getFormVal(goal.id, "actualDate");
                  const fStatus = getFormVal(goal.id, "progressStatus");
                  const preview = computeAchievement(goal.uomType, goal.targetValue, parseFloat(fActual) || existing?.actualValue, goal.targetDate, fDate || existing?.actualDate);
                  const canEdit = activeWindow && isWindowOpen(activeWindow.windowOpen, activeWindow.windowClose);

                  return (
                    <>
                      {/* Selected Goal Header */}
                      <div className="px-6 py-5 border-b border-surface-border bg-white shrink-0 flex items-start justify-between gap-4">
                        <div>
                          <h3 className="font-display text-lg font-bold text-primary leading-snug mb-1">{goal.title}</h3>
                          <p className="font-sans text-xs text-ink-secondary">
                            Thrust Area: <span className="font-semibold text-primary">{goal.thrustArea?.name}</span> · Weightage: <span className="font-semibold text-primary">{goal.weightage}%</span>
                          </p>
                        </div>

                        {preview !== null && (
                          <div className="text-right shrink-0">
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-lg font-mono text-xs font-bold ${achievementBg(preview)}`}>
                              {preview.toFixed(1)}% Score
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Form & Feed Content Scroll Container */}
                      <div className="flex-1 overflow-y-auto p-6 bg-[#F9F9FB]">

                        {/* Comparative Cards Dashboard Grid */}
                        <div className="grid grid-cols-2 gap-4 mb-6">
                          <div className="bg-white border border-surface-border rounded-xl p-4 shadow-sm">
                            <p className="font-sans text-[10px] font-bold uppercase text-ink-secondary tracking-wider mb-1.5 flex items-center gap-1.5">
                              <Target className="w-3.5 h-3.5 text-ink-secondary" /> Targets Set
                            </p>
                            <p className="font-mono text-xl text-primary font-bold">
                              {goal.targetValue || fmtDate(goal.targetDate) || "—"}
                            </p>
                          </div>
                          <div className="bg-white border border-accent/20 rounded-xl p-4 shadow-sm relative overflow-hidden">
                            <div className="absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-l from-accent/5 to-transparent" />
                            <p className="font-sans text-[10px] font-bold uppercase text-accent tracking-wider mb-1.5 flex items-center gap-1.5 relative z-10">
                              <TrendingUp className="w-3.5 h-3.5 text-accent" /> Logged Progress ({activeQ})
                            </p>
                            <p className="font-mono text-xl text-accent font-bold relative z-10">
                              {(existing?.actualValue ?? fActual) || "Not Entered"}
                            </p>
                          </div>
                        </div>

                         {/* Progress Editor Form Card */}
                         {canEdit ? (
                           (() => {
                             const isEditing = editing[goal.id];
                             const wasSaved = justSaved[goal.id];

                             if (!isEditing && existing && !wasSaved) {
                               return (
                                 <div className="bg-white border border-emerald-100 rounded-xl p-5 shadow-sm space-y-4">
                                   <div className="flex items-center justify-between">
                                     <h4 className="font-display text-sm font-bold text-emerald-800 flex items-center gap-2">
                                       <CheckCircle2 className="w-4.5 h-4.5 text-emerald-600" /> Check-in Submitted
                                     </h4>
                                     <button onClick={() => startEditing(goal)} className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5 hover:bg-slate-50 transition-all duration-200">
                                       <Pencil className="w-3.5 h-3.5 text-ink-secondary" /> Edit Entry
                                     </button>
                                   </div>
                                   <div className="bg-emerald-50/50 rounded-xl p-4 space-y-2 border border-emerald-100/50">
                                     <div className="flex justify-between text-xs font-sans">
                                       <span className="text-emerald-700/80 font-medium">Logged Progress:</span>
                                       <span className="font-mono text-emerald-900 font-bold">
                                         {goal.uomType === "TIMELINE" ? (existing?.actualDate ? fmtDate(existing.actualDate) : "—") : (existing?.actualValue ?? "—")}
                                       </span>
                                     </div>
                                     {existing?.progressStatus && (
                                       <div className="flex justify-between text-xs font-sans border-t border-emerald-100/30 pt-2">
                                         <span className="text-emerald-700/80 font-medium">Status:</span>
                                         <span className="font-sans text-emerald-900 font-bold uppercase tracking-wider text-[10px] bg-emerald-100/80 px-2 py-0.5 rounded-full">
                                           {existing.progressStatus.replace("_", " ")}
                                         </span>
                                       </div>
                                     )}
                                   </div>
                                 </div>
                               );
                             }

                             if (wasSaved) {
                               return (
                                 <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 shadow-sm space-y-4 relative overflow-hidden">
                                   <div className="absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-l from-emerald-100/30 to-transparent pointer-events-none" />
                                   <div className="flex items-center justify-between relative z-10">
                                     <h4 className="font-display text-sm font-bold text-emerald-800 flex items-center gap-2">
                                       <CheckCircle2 className="w-4.5 h-4.5 text-emerald-600 animate-bounce" /> Saved Successfully!
                                     </h4>
                                     <button onClick={() => startEditing(goal)} className="btn-secondary text-xs px-3 py-1.5 border-emerald-200 text-emerald-700 bg-white hover:bg-emerald-100/50 transition-all duration-200">
                                       <Pencil className="w-3.5 h-3.5" /> Edit
                                     </button>
                                   </div>
                                   <p className="font-sans text-xs text-emerald-700 relative z-10">
                                     Your latest update has been securely recorded and is ready for manager evaluation.
                                   </p>
                                 </div>
                               );
                             }

                             return (
                               <div className="bg-white border border-surface-border rounded-xl p-5 shadow-sm space-y-5">
                                 <h4 className="font-display text-sm font-bold text-primary flex items-center gap-2 border-b border-surface-border pb-3.5">
                                   <Activity className="w-4.5 h-4.5 text-accent" /> Update Performance Log
                                 </h4>

                                 <div className="space-y-4">
                                   {(goal.uomType === "MIN" || goal.uomType === "MAX" || goal.uomType === "ZERO_BASED") && (
                                     <div>
                                       <label className="label">Actual Logged Value *</label>
                                       <input className="input font-mono text-sm max-w-xs" type="number" placeholder="e.g., 85"
                                         value={fActual !== "" ? fActual : (existing?.actualValue || "")}
                                         onChange={e => setFormVal(goal.id, "actualValue", e.target.value)} />
                                     </div>
                                   )}

                                   {goal.uomType === "TIMELINE" && (
                                     <div>
                                       <label className="label">Actual Date of Completion *</label>
                                       <input className="input font-sans text-sm max-w-xs" type="date"
                                         value={fDate || existing?.actualDate?.slice(0, 10) || ""}
                                         onChange={e => setFormVal(goal.id, "actualDate", e.target.value)} />
                                     </div>
                                   )}

                                   <div>
                                     <label className="label">Check-in Status</label>
                                     <div className="flex flex-wrap gap-2">
                                       {PROGRESS_OPTIONS.map(opt => {
                                         const isSelected = (fStatus || existing?.progressStatus) === opt;
                                         return (
                                           <button
                                             key={opt}
                                             type="button"
                                             onClick={() => setFormVal(goal.id, "progressStatus", opt)}
                                             className={`px-3 py-1.5 rounded-lg font-sans text-[11px] font-bold border transition-all duration-200
                                           ${isSelected
                                                 ? "bg-accent text-white border-accent shadow-sm"
                                                 : "bg-white text-ink-secondary border-surface-border hover:border-accent/40 hover:text-primary"}`}
                                           >
                                             {opt.replace("_", " ")}
                                           </button>
                                         );
                                       })}
                                     </div>
                                   </div>

                                   <div className="pt-4 border-t border-surface-border flex justify-end">
                                     {isEditing && (
                                       <button onClick={() => { setEditing(s => ({ ...s, [goal.id]: false })); }}
                                         className="btn-secondary text-xs px-4 py-2 mr-2">
                                         Cancel
                                       </button>
                                     )}
                                     <motion.button
                                       whileTap={{ scale: 0.97 }}
                                       onClick={() => handleSubmit(goal)}
                                       disabled={saving[goal.id]}
                                       className="btn-primary min-w-[140px] justify-center"
                                     >
                                       {saving[goal.id] ? <Spinner /> : existing ? "Update Log" : "Save Log Entry"}
                                     </motion.button>
                                   </div>
                                 </div>
                               </div>
                             );
                           })()
                         ) : (
                           <div className="bg-white border border-surface-border rounded-xl p-8 flex flex-col items-center justify-center text-center shadow-sm">
                             <Lock className="w-8 h-8 text-ink-secondary/40 mb-3" />
                             <p className="font-sans text-sm text-primary font-bold">Log window is locked</p>
                             <p className="font-sans text-xs text-ink-secondary mt-1 max-w-xs">
                               Check-ins can only be submitted when a quarterly evaluation period is officially active.
                             </p>
                           </div>
                         )}

                        {/* Manager Comments Section */}
                        {existing?.comments?.length > 0 && (
                          <div className="mt-6">
                            <h4 className="font-sans text-xs font-bold uppercase tracking-wider text-ink-secondary mb-3 flex items-center gap-1.5">
                              <MessageSquare className="w-3.5 h-3.5 text-ink-secondary" /> Manager Guidance Feed
                            </h4>

                            <div className="space-y-3">
                              {existing.comments.map(c => (
                                <div key={c.id} className="bg-amber-50/50 border border-amber-200/50 rounded-xl p-4 shadow-sm relative overflow-hidden">
                                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-amber-400" />
                                  <div className="flex items-center gap-1.5 text-[10px] text-amber-700 font-bold uppercase tracking-wide mb-1">
                                    <AlertCircle className="w-3.5 h-3.5" /> Feedback Received
                                  </div>
                                  <p className="font-sans text-xs leading-relaxed text-amber-900 italic">
                                    "{c.content}"
                                  </p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                      </div>
                    </>
                  );
                })() : (
                  <div className="flex-1 flex flex-col items-center justify-center text-ink-secondary font-sans text-sm p-6 text-center">
                    <Target className="w-8 h-8 text-ink-secondary/30 mb-2" />
                    Select a target goal from the left panel to review log status
                  </div>
                )}
              </div>

            </div>
          )
        }
    </div>
      );
}
