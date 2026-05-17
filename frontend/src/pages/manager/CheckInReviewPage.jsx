import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquare, Search, Send, Clock, AlertCircle } from "lucide-react";
import toast from "react-hot-toast";
import { getTeamGoals } from "../../api/goals";
import { getGoalCheckIns, addComment } from "../../api/checkIns";
import { PageSkeleton, Spinner } from "../../components/loaders/Skeletons";
import EmptyState from "../../components/common/EmptyState";
import { fmtDate } from "../../utils/dateHelpers";

const QUARTERS = ["Q1", "Q2", "Q3", "Q4"];

export default function CheckInReviewPage() {
  const [goals,    setGoals]    = useState([]);
  const [checkIns, setCheckIns] = useState({});
  const [activeQ,  setActiveQ]  = useState("Q1");
  const [loading,  setLoading]  = useState(true);
  
  const [search, setSearch] = useState("");
  const [empFilter, setEmpFilter] = useState("ALL");
  const [expandedId, setExpandedId] = useState(null);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getTeamGoals().then(async r => {
      const locked = r.data.filter(g => g.status === "LOCKED");
      setGoals(locked);
      const ciMap = {};
      await Promise.all(locked.map(async g => {
        try { ciMap[g.id] = (await getGoalCheckIns(g.id)).data; }
        catch { ciMap[g.id] = []; }
      }));
      setCheckIns(ciMap);
    }).finally(() => setLoading(false));
  }, []);

  const getCI = (goalId) => checkIns[goalId]?.find(ci => ci.quarterWindow?.quarter === activeQ);

  const handleComment = async (ciId) => {
    if (!comment.trim()) return;
    setSaving(true);
    try {
      await addComment(ciId, comment);
      toast.success("Feedback submitted!");
      setExpandedId(null);
      setComment("");
    } catch { toast.error("Failed to submit feedback"); }
    finally { setSaving(false); }
  };

  if (loading) return <PageSkeleton />;

  const allRows = goals.map(g => ({ goal: g, ci: getCI(g.id) })).filter(r => r.ci);
  const uniqueEmployees = [...new Set(allRows.map(r => r.goal.owner?.name).filter(Boolean))];

  const filteredRows = allRows
    .filter(r => empFilter === "ALL" || r.goal.owner?.name === empFilter)
    .filter(r => !search || r.goal.title.toLowerCase().includes(search.toLowerCase()) || r.goal.owner?.name.toLowerCase().includes(search.toLowerCase()));

  const getStatusColor = (status) => {
    switch (status) {
      case "ON_TRACK": return "bg-success";
      case "AT_RISK": return "bg-warning";
      case "BEHIND": return "bg-danger";
      default: return "bg-surface-border";
    }
  };

  const getInitials = (name) => {
    return name?.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) || "U";
  };

  return (
    <div className="max-w-[800px] mx-auto pb-10 space-y-8">
      {/* ── Header ── */}
      <div className="flex flex-col gap-4">
        <div>
          <h2 className="font-display text-[26px] text-primary">Check-In Reviews</h2>
          <p className="font-sans text-[13px] text-ink-secondary mt-1">Review team progress updates and provide timely feedback.</p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 bg-white p-4 rounded-xl border border-surface-border shadow-sm">
          {/* Quarter Tabs */}
          <div className="flex bg-surface-bg border border-surface-border rounded-lg p-1">
            {QUARTERS.map(q => (
              <button key={q} onClick={() => setActiveQ(q)}
                className={`px-4 py-1.5 rounded transition-all font-sans text-[13px] font-semibold
                  ${activeQ === q ? "bg-white shadow-sm text-accent" : "text-ink-secondary hover:text-primary"}`}>
                {q}
              </button>
            ))}
          </div>

          <div className="w-px h-6 bg-surface-border mx-1 hidden sm:block" />

          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-secondary" />
            <input 
              type="text" 
              placeholder="Search check-ins..."
              value={search} 
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 border border-surface-border rounded-lg font-sans text-[13px] text-primary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all"
            />
          </div>

          {/* Employee Filter */}
          <select 
            value={empFilter} 
            onChange={e => setEmpFilter(e.target.value)}
            className="px-4 py-1.5 border border-surface-border rounded-lg font-sans text-[13px] text-primary focus:outline-none focus:border-accent bg-white min-w-[160px]"
          >
            <option value="ALL">All Employees</option>
            {uniqueEmployees.map(emp => (
              <option key={emp} value={emp}>{emp}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ── Timeline Feed ── */}
      {filteredRows.length === 0 ? (
        <EmptyState title={`No check-ins found for ${activeQ}`} desc="Try adjusting your search or filters." />
      ) : (
        <div className="space-y-6 relative before:absolute before:inset-0 before:ml-6 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-surface-border">
          {filteredRows.map(({ goal, ci }, i) => {
            const isExpanded = expandedId === ci.id;
            const statusColor = getStatusColor(ci.progressStatus);

            return (
              <motion.div key={ci.id} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                
                {/* Timeline Dot */}
                <div className="flex items-center justify-center w-12 h-12 rounded-full border-4 border-surface-bg bg-white shadow-sm shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10 absolute left-0 md:left-1/2 md:-ml-6">
                  <div className={`w-3 h-3 rounded-full ${statusColor}`} />
                </div>

                {/* Card */}
                <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] ml-auto md:ml-0 overflow-hidden bg-white rounded-2xl border border-surface-border shadow-sm hover:shadow-md transition-shadow">
                  {/* Left Accent Stripe */}
                  <div className="relative">
                    <div className={`absolute left-0 top-0 bottom-0 w-1 ${statusColor}`} />
                    
                    <div className="p-5 pl-6">
                      {/* Card Header */}
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shrink-0">
                            <span className="font-sans text-[12px] font-bold text-white">{getInitials(goal.owner?.name)}</span>
                          </div>
                          <div>
                            <p className="font-sans text-[14px] font-bold text-primary">{goal.owner?.name}</p>
                            <p className="font-mono text-[11px] text-ink-secondary flex items-center gap-1">
                              <Clock className="w-3 h-3" /> {fmtDate(ci.submittedAt || ci.updatedAt)}
                            </p>
                          </div>
                        </div>
                        <span className="inline-flex px-2 py-0.5 rounded bg-surface-bg border border-surface-border font-sans text-[10px] text-ink-secondary uppercase">
                          {ci.progressStatus?.replace("_", " ")}
                        </span>
                      </div>

                      {/* Goal Title */}
                      <p className="font-display text-[15px] italic text-primary mb-4 leading-snug">"{goal.title}"</p>

                      {/* Metrics */}
                      <div className="grid grid-cols-2 gap-4 mb-4 bg-[#FAFAFD] p-3 rounded-xl border border-surface-border/50">
                        <div>
                          <p className="font-sans text-[11px] font-semibold text-ink-secondary uppercase tracking-wider mb-1">Target</p>
                          <p className="font-mono text-[14px] text-primary">{goal.targetValue || "—"}</p>
                        </div>
                        <div>
                          <p className="font-sans text-[11px] font-semibold text-ink-secondary uppercase tracking-wider mb-1">Actual</p>
                          <p className="font-mono text-[14px] text-accent font-semibold">{ci.actualValue || "—"}</p>
                        </div>
                      </div>

                      {/* Check-In Notes */}
                      {ci.notes && (
                        <div className="mb-5">
                          <p className="font-sans text-[13px] text-primary leading-relaxed bg-white/50 p-3 rounded-lg border-l-2 border-l-surface-border">
                            {ci.notes}
                          </p>
                        </div>
                      )}

                      {/* Feedback Action */}
                      {!isExpanded ? (
                        <button 
                          onClick={() => { setExpandedId(ci.id); setComment(""); }}
                          className="w-full flex items-center justify-center gap-2 py-2 rounded-lg border border-accent/30 text-accent font-sans text-[13px] font-semibold hover:bg-accent/5 transition-colors"
                        >
                          <MessageSquare className="w-4 h-4" /> Provide Feedback
                        </button>
                      ) : (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} className="overflow-hidden">
                          <div className="pt-2">
                            <textarea 
                              className="w-full p-3 border border-surface-border rounded-xl font-sans text-[13px] text-primary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent resize-none min-h-[80px] bg-white mb-3"
                              placeholder="Write your feedback..."
                              value={comment}
                              onChange={e => setComment(e.target.value)}
                              autoFocus
                            />
                            <div className="flex gap-2">
                              <button 
                                onClick={() => { setExpandedId(null); setComment(""); }}
                                className="flex-1 py-2 rounded-lg font-sans text-[13px] font-medium text-ink-secondary hover:text-primary transition-colors"
                              >
                                Cancel
                              </button>
                              <button 
                                onClick={() => handleComment(ci.id)}
                                disabled={saving || !comment.trim()}
                                className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-accent text-white font-sans text-[13px] font-semibold hover:bg-accent/90 transition-colors disabled:opacity-50"
                              >
                                {saving ? <Spinner /> : <><Send className="w-3.5 h-3.5" /> Submit</>}
                              </button>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
