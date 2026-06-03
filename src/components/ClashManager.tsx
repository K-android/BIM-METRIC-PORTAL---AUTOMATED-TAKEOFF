import React, { useState } from 'react';
import { Clash, ClashStatus, ClashSeverity } from '../types';
import { AlertCircle, Plus, CheckCircle, Clock, Trash2, HelpCircle, User, Sparkles, SlidersHorizontal, Locate, ShieldAlert } from 'lucide-react';

interface ClashManagerProps {
  clashes: Clash[];
  selectedClash: Clash | null;
  onSelectClash: (clash: Clash) => void;
  onUpdateClashStatus: (id: string, status: ClashStatus, aiRecommendation?: string) => Promise<void>;
  onDeleteClash: (id: string) => Promise<void>;
  onAddClash: (fields: Omit<Clash, 'id' | 'projectId' | 'createdAt' | 'updatedAt' | 'aiRecommendation'>) => Promise<void>;
}

export default function ClashManager({
  clashes,
  selectedClash,
  onSelectClash,
  onUpdateClashStatus,
  onDeleteClash,
  onAddClash
}: ClashManagerProps) {
  
  // Filtering states
  const [filterStatus, setFilterStatus] = useState<string>('All');
  const [filterSeverity, setFilterSeverity] = useState<string>('All');

  // New manual clash addition state
  const [showAddForm, setShowAddForm] = useState(false);
  const [newClash, setNewClash] = useState({
    title: '',
    discipline1: 'HVAC',
    discipline2: 'Structural',
    severity: ClashSeverity.HIGH,
    status: ClashStatus.OPEN,
    coordinateX: '',
    coordinateY: '',
    coordinateZ: '',
    assignedTo: ''
  });

  // AI advisory generation states
  const [isConsultingAI, setIsConsultingAI] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // Active status counts
  const statistics = React.useMemo(() => {
    let openCount = 0;
    let reviewCount = 0;
    let resolvedCount = 0;

    clashes.forEach(c => {
      if (c.status === ClashStatus.OPEN) openCount++;
      else if (c.status === ClashStatus.IN_REVIEW) reviewCount++;
      else if (c.status === ClashStatus.RESOLVED) resolvedCount++;
    });

    return { openCount, reviewCount, resolvedCount, total: clashes.length };
  }, [clashes]);

  const filteredClashes = React.useMemo(() => {
    return clashes.filter(c => {
      const matchStatus = filterStatus === 'All' || c.status === filterStatus;
      const matchSev = filterSeverity === 'All' || c.severity === filterSeverity;
      return matchStatus && matchSev;
    });
  }, [clashes, filterStatus, filterSeverity]);

  // Submit manual clash form
  const handleCreateClash = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClash.title || !newClash.coordinateX || !newClash.coordinateY || !newClash.coordinateZ) {
      alert("Please complete required visual coordinates.");
      return;
    }

    try {
      await onAddClash({
        title: newClash.title,
        discipline1: newClash.discipline1,
        discipline2: newClash.discipline2,
        severity: newClash.severity,
        status: newClash.status,
        coordinateX: parseFloat(newClash.coordinateX) || 0,
        coordinateY: parseFloat(newClash.coordinateY) || 0,
        coordinateZ: parseFloat(newClash.coordinateZ) || 0,
        assignedTo: newClash.assignedTo || 'Unassigned Coordinator'
      });

      // Clear values
      setNewClash({
        title: '',
        discipline1: 'HVAC',
        discipline2: 'Structural',
        severity: ClashSeverity.HIGH,
        status: ClashStatus.OPEN,
        coordinateX: '',
        coordinateY: '',
        coordinateZ: '',
        assignedTo: ''
      });
      setShowAddForm(false);
    } catch (err) {
      console.error(err);
    }
  };

  // Call Gemini Advisor resolution guidance
  const handleQueryAIAdvisor = async () => {
    if (!selectedClash) return;
    setIsConsultingAI(true);
    setAiError(null);

    try {
      const response = await fetch('/api/clash/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: selectedClash.title,
          discipline1: selectedClash.discipline1,
          discipline2: selectedClash.discipline2,
          severity: selectedClash.severity,
          coordinateX: selectedClash.coordinateX,
          coordinateY: selectedClash.coordinateY,
          coordinateZ: selectedClash.coordinateZ
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "AI Advisor failed to coordinate resolution.");
      }

      const data = await response.json();
      if (data.advice) {
        // Automatically save advice back into parent clash payload in real-time Firestore database
        await onUpdateClashStatus(selectedClash.id, ClashStatus.IN_REVIEW, data.advice);
      } else {
        throw new Error("Empty guideline parsed.");
      }
    } catch (err: any) {
      setAiError(err.message || "BIM server connectivity failure.");
    } finally {
      setIsConsultingAI(false);
    }
  };

  // Render badge utility
  const renderSeverityBadge = (sev: ClashSeverity) => {
    const classes: Record<ClashSeverity, string> = {
      [ClashSeverity.LOW]: 'bg-blue-50 text-blue-700 border-blue-200',
      [ClashSeverity.MEDIUM]: 'bg-amber-50 text-amber-700 border-amber-200',
      [ClashSeverity.HIGH]: 'bg-orange-50 text-orange-700 border-orange-200',
      [ClashSeverity.CRITICAL]: 'bg-rose-50 text-rose-700 border-rose-200'
    };
    return (
      <span className={`text-[10px] font-semibold py-0.5 px-2 rounded-full border inline-block ${classes[sev]}`}>
        {sev.toUpperCase()}
      </span>
    );
  };

  const renderStatusBadge = (status: ClashStatus) => {
    const classes: Record<ClashStatus, string> = {
      [ClashStatus.OPEN]: 'bg-red-50 text-red-700 border-red-100',
      [ClashStatus.IN_REVIEW]: 'bg-amber-50 text-amber-700 border-amber-100',
      [ClashStatus.RESOLVED]: 'bg-emerald-50 text-emerald-700 border-emerald-100',
      [ClashStatus.IGNORED]: 'bg-slate-100 text-slate-600 border-slate-200'
    };
    return (
      <span className={`text-[10px] uppercase tracking-wide font-bold py-0.5 px-1.5 rounded border inline-block ${classes[status] || classes[ClashStatus.OPEN]}`}>
        {status.replace('_', ' ')}
      </span>
    );
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">

      {/* LEFT SECTION: CLASH TRACKING LIST (8 cols) */}
      <div className="lg:col-span-12 xl:col-span-7 flex flex-col gap-3">
        
        {/* Coordination statistics counts row */}
        <div className="grid grid-cols-4 gap-2">
          <div className="bg-white border border-gray-200 p-2 rounded text-center">
            <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">TOTAL</span>
            <span className="block font-sans font-bold text-sm text-gray-900 mt-0.5">{statistics.total}</span>
          </div>
          <div className="bg-white border border-gray-200 p-2 rounded text-center">
            <span className="text-[9px] text-red-500 font-bold uppercase tracking-wider">OPEN</span>
            <span className="block font-sans font-bold text-sm text-red-600 mt-0.5">{statistics.openCount}</span>
          </div>
          <div className="bg-white border border-gray-200 p-2 rounded text-center">
            <span className="text-[9px] text-amber-500 font-bold uppercase tracking-wider">REVIEW</span>
            <span className="block font-sans font-bold text-sm text-amber-600 mt-0.5">{statistics.reviewCount}</span>
          </div>
          <div className="bg-white border border-gray-200 p-2 rounded text-center">
            <span className="text-[9px] text-emerald-500 font-bold uppercase tracking-wider">RESOLVED</span>
            <span className="block font-sans font-bold text-sm text-emerald-600 mt-0.5">{statistics.resolvedCount}</span>
          </div>
        </div>

        {/* Head bands with filters */}
        <div className="bg-white border border-gray-200 rounded p-3 shadow-none">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <h3 className="font-sans font-bold text-[11px] uppercase tracking-tight text-gray-700 flex items-center gap-1.5">
              <SlidersHorizontal className="w-3.5 h-3.5 text-blue-500" />
              SPATIAL INTERSECTION FILTERING
            </h3>

            <button
              id="btn-add-clash-form"
              onClick={() => setShowAddForm(!showAddForm)}
              className="px-2 py-1.5 bg-gray-900 text-white rounded text-[10px] font-bold uppercase tracking-wider hover:bg-gray-850 transition flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3 h-3" /> Record Clash
            </button>
          </div>

          <div className="flex flex-wrap gap-1.5 text-[11px]">
            <div className="flex items-center gap-1 bg-gray-50 border border-gray-200 px-2 py-0.5 rounded">
              <span className="text-[9px] text-gray-400 font-bold uppercase">Status:</span>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="font-bold bg-transparent text-gray-700 outline-none cursor-pointer"
              >
                <option value="All">All statuses</option>
                <option value="open">Open</option>
                <option value="in_review">In Review</option>
                <option value="resolved">Resolved</option>
                <option value="ignored">Ignored</option>
              </select>
            </div>

            <div className="flex items-center gap-1 bg-gray-50 border border-gray-200 px-2 py-0.5 rounded">
              <span className="text-[9px] text-gray-400 font-bold uppercase">Severity:</span>
              <select
                value={filterSeverity}
                onChange={(e) => setFilterSeverity(e.target.value)}
                className="font-bold bg-transparent text-gray-700 outline-none cursor-pointer"
              >
                <option value="All">All severities</option>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
          </div>
        </div>

        {/* Create Clash Form Option */}
        {showAddForm && (
          <form onSubmit={handleCreateClash} className="bg-slate-50 border rounded-xl p-4 animate-in slide-in-from-top duration-300">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3">Add Custom Clash Interference coordinate</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-[10px] text-slate-500 uppercase font-semibold mb-1">Clash Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Gravity Duct vs Floor Opening Shift"
                  value={newClash.title}
                  onChange={(e) => setNewClash({ ...newClash, title: e.target.value })}
                  className="w-full bg-white border rounded-lg p-2 text-xs text-slate-800 outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] text-slate-500 uppercase font-semibold mb-1">Assigned MEP Inspector</label>
                <input
                  type="text"
                  placeholder="e.g. Sarah Jenkins"
                  value={newClash.assignedTo}
                  onChange={(e) => setNewClash({ ...newClash, assignedTo: e.target.value })}
                  className="w-full bg-white border rounded-lg p-2 text-xs text-slate-800 outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <div>
                <label className="block text-[10px] text-slate-500 uppercase font-semibold mb-1">Discipline 1</label>
                <select
                  value={newClash.discipline1}
                  onChange={(e) => setNewClash({ ...newClash, discipline1: e.target.value })}
                  className="w-full bg-white border rounded-lg p-2 text-xs text-slate-800 outline-none"
                >
                  <option value="HVAC">HVAC Services</option>
                  <option value="Structural">Structural Concrete</option>
                  <option value="Plumbing">Plumbing Drainage</option>
                  <option value="Electrical">Electrical Tray</option>
                  <option value="Architectural">Architectural</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] text-slate-500 uppercase font-semibold mb-1">Discipline 2</label>
                <select
                  value={newClash.discipline2}
                  onChange={(e) => setNewClash({ ...newClash, discipline2: e.target.value })}
                  className="w-full bg-white border rounded-lg p-2 text-xs text-slate-800 outline-none"
                >
                  <option value="Structural">Structural Concrete</option>
                  <option value="HVAC">HVAC Services</option>
                  <option value="Plumbing">Plumbing Drainage</option>
                  <option value="Electrical">Electrical Tray</option>
                  <option value="Architectural">Architectural</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] text-slate-500 uppercase font-semibold mb-1">Severity</label>
                <select
                  value={newClash.severity}
                  onChange={(e) => setNewClash({ ...newClash, severity: e.target.value as ClashSeverity })}
                  className="w-full bg-white border rounded-lg p-2 text-xs text-slate-800 outline-none"
                >
                  <option value={ClashSeverity.CRITICAL}>Critical</option>
                  <option value={ClashSeverity.HIGH}>High</option>
                  <option value={ClashSeverity.MEDIUM}>Medium</option>
                  <option value={ClashSeverity.LOW}>Low</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] text-slate-500 uppercase font-semibold mb-1">Initial Status</label>
                <select
                  value={newClash.status}
                  onChange={(e) => setNewClash({ ...newClash, status: e.target.value as ClashStatus })}
                  className="w-full bg-white border rounded-lg p-2 text-xs text-slate-800 outline-none"
                >
                  <option value={ClashStatus.OPEN}>Open</option>
                  <option value={ClashStatus.IN_REVIEW}>At Review</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 mb-4">
              <div>
                <label className="block text-[10px] text-slate-500 uppercase font-semibold mb-1">X Coordinate (m) *</label>
                <input
                  type="number"
                  required
                  step="any"
                  placeholder="e.g. 10.4"
                  value={newClash.coordinateX}
                  onChange={(e) => setNewClash({ ...newClash, coordinateX: e.target.value })}
                  className="w-full bg-white border rounded-lg p-2 text-xs text-slate-800 outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] text-slate-500 uppercase font-semibold mb-1">Y Coordinate (m) *</label>
                <input
                  type="number"
                  required
                  step="any"
                  placeholder="e.g. 8.5"
                  value={newClash.coordinateY}
                  onChange={(e) => setNewClash({ ...newClash, coordinateY: e.target.value })}
                  className="w-full bg-white border rounded-lg p-2 text-xs text-slate-800 outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] text-slate-500 uppercase font-semibold mb-1">Z Elevation (m) *</label>
                <input
                  type="number"
                  required
                  step="any"
                  placeholder="e.g. 3.2"
                  value={newClash.coordinateZ}
                  onChange={(e) => setNewClash({ ...newClash, coordinateZ: e.target.value })}
                  className="w-full bg-white border rounded-lg p-2 text-xs text-slate-800 outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="px-3.5 py-1.5 border rounded-lg text-slate-600 bg-white hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 bg-slate-950 border border-transparent rounded-lg text-white hover:bg-slate-850"
              >
                Save Clash Card
              </button>
            </div>
          </form>
        )}

        {/* Clash Items Interactive Cards list */}
        <div className="flex flex-col gap-2">
          {filteredClashes.map((c) => {
            const isSelected = selectedClash?.id === c.id;
            return (
              <div
                key={c.id}
                onClick={() => onSelectClash(c)}
                className={`text-gray-850 text-[11px] p-2.5 rounded border transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-blue-50/40 border-blue-405 border-blue-400 shadow-none ring-1 ring-blue-400/10'
                    : 'bg-white border-gray-200 hover:bg-gray-50'
                }`}
              >
                <div className="flex justify-between items-start gap-1.5 mb-1">
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-1 mb-1 shadow-none">
                      {renderSeverityBadge(c.severity)}
                      {renderStatusBadge(c.status)}
                    </div>
                    <h4 className="font-sans font-bold text-[11px] text-gray-900 leading-tight">
                      {c.title}
                    </h4>
                  </div>
                  <div className="text-right flex-shrink-0 text-[9px] font-mono text-gray-400 leading-normal">
                    <div>X: {c.coordinateX.toFixed(1)}m</div>
                    <div>Y: {c.coordinateY.toFixed(1)}m</div>
                    <div>Z: {c.coordinateZ.toFixed(1)}m</div>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[10px] text-gray-400 border-t border-gray-50 pt-1.5 mt-1.5 leading-none">
                  <span className="flex items-center gap-1 text-gray-500">
                    <User className="w-2.5 h-2.5 text-gray-400" />
                    <span>Lead: <strong className="font-bold text-gray-700">{c.assignedTo}</strong></span>
                  </span>
                  
                  <div className="flex items-center gap-1.5">
                    <span className="text-[8px] uppercase font-bold text-indigo-700 bg-indigo-50 px-1 py-0.5 rounded border border-indigo-100 font-mono">
                      {c.discipline1} vs {c.discipline2}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteClash(c.id);
                      }}
                      className="text-gray-400 hover:text-red-500 p-0.5 rounded hover:bg-red-50 transition cursor-pointer"
                      title="Remove Clash Ticket"
                    >
                      <Trash2 className="w-3 h-3 text-gray-450" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          {filteredClashes.length === 0 && (
            <div className="bg-white border border-gray-200 p-6 rounded text-center text-gray-400">
              <CheckCircle className="w-6 h-6 mx-auto mb-1 opacity-50 text-gray-400" />
              <p className="text-[11px]">Congratulations! No coordinated clashes identified for current filters.</p>
            </div>
          )}
        </div>
      </div>

      {/* RIGHT SECTION: AI ADVISOR DETAILS DETECTIVES PANEL (5 cols) */}
      <div className="lg:col-span-12 xl:col-span-5">
        <div className="bg-white border border-gray-200 rounded p-4 sticky top-4 shadow-none">
          <div className="border-b border-gray-200 pb-2 mb-3">
            <h3 className="font-sans font-bold text-xs text-gray-950 flex items-center gap-1.5 uppercase tracking-tight">
              <Sparkles className="w-3.5 h-3.5 text-indigo-505 text-indigo-500 block" />
              MEP COORDINATOR AI ADVISOR
            </h3>
            <p className="text-[10px] text-gray-400 mt-0.5 font-semibold">Automated structural priority and IBC code advice</p>
          </div>

          {selectedClash ? (
            <div className="space-y-3">
              
              {/* Active selected info panel */}
              <div className="bg-gray-50 p-2.5 rounded border border-gray-200 text-[11px] leading-relaxed text-gray-600">
                <div className="text-[9px] text-gray-400 font-bold uppercase tracking-wider leading-none">SELECTED COORDINATES</div>
                <div className="font-mono text-[10px] text-gray-900 font-bold mt-0.5 mb-1.5">
                  X: {selectedClash.coordinateX}m, Y: {selectedClash.coordinateY}m, Z Elevation: {selectedClash.coordinateZ}m
                </div>
                <div>
                  <span className="font-semibold text-gray-700">Interference disciplines:</span> {selectedClash.discipline1} (MEP Systems) with {selectedClash.discipline2} element core section.
                </div>
              </div>

              {/* Resolution guideline stream */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center bg-transparent">
                  <span className="text-[9px] text-gray-400 font-bold uppercase tracking-widest block">AI ADVISORY RESOLUTION PATH:</span>
                  
                  {/* Status editing selector block */}
                  <div className="flex items-center gap-1 bg-gray-50 border border-gray-200 px-1.5 py-0.5 rounded text-[10px]">
                    <span className="text-[9px] text-gray-400 font-semibold">Change:</span>
                    <select
                      value={selectedClash.status}
                      disabled={isConsultingAI}
                      onChange={(e) => onUpdateClashStatus(selectedClash.id, e.target.value as ClashStatus)}
                      className="text-[10px] font-bold text-gray-700 uppercase bg-transparent outline-none cursor-pointer"
                    >
                      <option value="open">Open</option>
                      <option value="in_review">In Review</option>
                      <option value="resolved">Resolved ✔</option>
                      <option value="ignored">Ignored</option>
                    </select>
                  </div>
                </div>

                <div className="bg-gray-50 border border-gray-200 rounded p-2.5 text-[11px] text-gray-700 leading-relaxed font-sans max-h-52 overflow-y-auto whitespace-pre-line border-dashed">
                  {selectedClash.aiRecommendation || 'No guidelines calculated for this clash coordinates yet.'}
                </div>
              </div>

              {aiError && (
                <div className="bg-red-50 border border-red-100 text-red-700 text-[11px] p-2 rounded flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>{aiError}</span>
                </div>
              )}

              {/* Action query button */}
              <button
                id="btn-ai-resolve"
                disabled={isConsultingAI}
                onClick={handleQueryAIAdvisor}
                className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-100 disabled:text-gray-400 py-1.5 px-3 rounded font-sans text-[10px] font-bold uppercase tracking-wider text-white transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {isConsultingAI ? (
                  <>
                    <div className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin"></div>
                    Executing Model Advice...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 text-blue-100" />
                    Query Gemini Advisory Guideline
                  </>
                )}
              </button>
            </div>
          ) : (
            <div className="text-center p-6 bg-gray-50 border border-gray-100/50 rounded">
              <Locate className="w-6 h-6 mx-auto mb-1 text-gray-400 animate-pulse opacity-40" />
              <h4 className="text-[11px] font-bold uppercase text-gray-500">No active clash node selected</h4>
              <p className="text-[10px] text-gray-400 max-w-xs mx-auto mt-1 leading-snug">
                Select any clash ticket list item block or click any red coordinate target on the 3D model viewer to call Gemini advisory resolution guidance.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
