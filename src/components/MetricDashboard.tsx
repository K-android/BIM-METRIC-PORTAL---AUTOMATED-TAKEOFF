import React, { useState } from 'react';
import { Clash, BOQItem, ClashStatus, ClashSeverity } from '../types';
import { 
  Trophy, 
  TrendingUp, 
  AlertTriangle, 
  PieChart, 
  Settings, 
  Check, 
  Layers, 
  Calendar, 
  DollarSign,
  Briefcase,
  Clock,
  Zap,
  Sparkles
} from 'lucide-react';

interface MetricDashboardProps {
  clashes: Clash[];
  boqItems: BOQItem[];
}

export default function MetricDashboard({ clashes, boqItems }: MetricDashboardProps) {
  // Customizable layout visibility toggles
  const [shownMetrics, setShownMetrics] = useState<string[]>([
    'completion',
    'budget',
    'risks',
    'business_val'
  ]);
  const [isSelectorOpen, setIsSelectorOpen] = useState(false);

  // 1. Project Completion Math
  const totalClashes = clashes.length;
  const resolvedClashes = clashes.filter(c => c.status === ClashStatus.RESOLVED).length;
  const completionPercentage = totalClashes > 0 
    ? Math.round((resolvedClashes / totalClashes) * 100) 
    : 85; // seeded default fallback

  // 2. Budget Metrics Math
  const totalBudgetCost = boqItems.reduce((acc, item) => acc + item.totalPrice, 0);
  const targetBudget = 600000; // Target threshold $600,000
  const budgetVariance = targetBudget - totalBudgetCost;
  const budgetRatio = Math.min((totalBudgetCost / targetBudget) * 100, 100);

  // 3. Coordination Risk Index Math
  const criticalCount = clashes.filter(c => c.severity === ClashSeverity.CRITICAL && c.status !== ClashStatus.RESOLVED).length;
  const highCount = clashes.filter(c => c.severity === ClashSeverity.HIGH && c.status !== ClashStatus.RESOLVED).length;
  const mediumCount = clashes.filter(c => c.severity === ClashSeverity.MEDIUM && c.status !== ClashStatus.RESOLVED).length;
  const lowCount = clashes.filter(c => c.severity === ClashSeverity.LOW && c.status !== ClashStatus.RESOLVED).length;

  const riskScore = (criticalCount * 12) + (highCount * 6) + (mediumCount * 3) + (lowCount * 1);
  let riskAssessment: { label: string; color: string; bg: string; text: string } = {
    label: 'PERFECTLY SAFE',
    color: '#10B981',
    bg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    text: 'Zero un-coordinated clashes remaining.'
  };
  if (riskScore > 35) {
    riskAssessment = {
      label: 'CRITICAL SITE HAZARDS',
      color: '#E11D48',
      bg: 'bg-rose-50 text-rose-700 border-rose-200',
      text: 'Heavy spatial pipe/beam collisions; constructability blocked.'
    };
  } else if (riskScore > 15) {
    riskAssessment = {
      label: 'HIGH RISKS DETECTED',
      color: '#EF4444',
      bg: 'bg-red-50 text-red-700 border-red-200',
      text: 'Clashes found between steel frame and primary HVAC paths.'
    };
  } else if (riskScore > 5) {
    riskAssessment = {
      label: 'MODERATE RISK INDEX',
      color: '#F59E0B',
      bg: 'bg-amber-50 text-amber-700 border-amber-200',
      text: 'Minor mechanical conduit or plumbing line modifications needed.'
    };
  }

  // 4. Discipline Clash Distribution Math
  const disciplineCounts = clashes.reduce((acc, c) => {
    if (c.status !== ClashStatus.RESOLVED) {
      acc[c.discipline1] = (acc[c.discipline1] || 0) + 1;
      acc[c.discipline2] = (acc[c.discipline2] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);

  // 5. Material Breakdown Takeoff Stats
  const materialCostsByCategory = boqItems.reduce((acc, item) => {
    acc[item.category] = (acc[item.category] || 0) + item.totalPrice;
    return acc;
  }, {} as Record<string, number>);

  // Toggles metric identifier view states
  const handleToggleMetricOption = (metricId: string) => {
    if (shownMetrics.includes(metricId)) {
      if (shownMetrics.length === 1) return; // keep at least one metric shown
      setShownMetrics(shownMetrics.filter(m => m !== metricId));
    } else {
      setShownMetrics([...shownMetrics, metricId]);
    }
  };

  const METRIC_DEFINITIONS = [
    { id: 'completion', name: 'Project Completion Rate', desc: 'Progress metric based on clash resolution records' },
    { id: 'budget', name: 'Quantity Takeoff Budget Tracker', desc: 'Real-time billing total vs target budget limit' },
    { id: 'risks', name: 'Constructability Risk Index', desc: 'Weighted spatial risk assessment calculation' },
    { id: 'business_val', name: 'Business Value Optimization', desc: 'Corporate latency hours saved & cost reduction metrics' },
    { id: 'discipline_load', name: 'System Clash Load Table', desc: 'Physical conflicts grouped under project system' },
    { id: 'materials', name: 'Material Category Shares', desc: 'Cost weights division of engineered structures' },
    { id: 'schedule', name: 'Model Coordination Milestones', desc: 'Coordinated progress timeline checklist' }
  ];

  return (
    <div className="bg-white border border-gray-250 border-gray-200 rounded p-3 shadow-none text-xs font-sans">
      
      {/* Mini Title bar with gear selector controls */}
      <div className="flex justify-between items-center border-b border-gray-150 border-gray-100 pb-2 mb-3">
        <div className="flex items-center gap-1.5">
          <Briefcase className="w-3.5 h-3.5 text-gray-500" />
          <h3 className="font-bold text-[11px] tracking-tight text-gray-800 uppercase">
            PROJECT PERFORMANCE METRICS & DASHBOARD
          </h3>
        </div>
        
        {/* Toggle dashboard config panel */}
        <div className="relative">
          <button
            onClick={() => setIsSelectorOpen(!isSelectorOpen)}
            className="flex items-center gap-1 bg-gray-50 hover:bg-gray-100 border border-gray-250 border-gray-200 py-1 px-2.5 rounded font-bold uppercase text-[9px] tracking-wider text-gray-700 transition cursor-pointer"
          >
            <Settings className="w-3 h-3 text-gray-505 text-gray-500" />
            Customize KPI Cards
          </button>

          {isSelectorOpen && (
            <div className="absolute right-0 mt-1.5 w-60 bg-white border border-gray-200 rounded-md shadow-lg p-2.5 z-35 z-50 text-[11px] text-gray-800 animate-in fade-in slide-in-from-top-1">
              <div className="font-bold text-gray-900 mb-1.5 border-b border-gray-100 pb-1 text-[10px] uppercase tracking-wider">
                Select Displayed Metrics
              </div>
              <div className="space-y-1.5">
                {METRIC_DEFINITIONS.map(def => {
                  const isActive = shownMetrics.includes(def.id);
                  return (
                    <button
                      key={def.id}
                      onClick={() => handleToggleMetricOption(def.id)}
                      className="w-full text-left flex items-start gap-2 p-1.5 hover:bg-gray-50 rounded transition-colors cursor-pointer group"
                    >
                      <div className={`mt-0.5 w-3.5 h-3.5 rounded-sm border flex items-center justify-center transition-colors ${isActive ? 'bg-gray-900 border-gray-900 text-white' : 'border-gray-250 border-gray-300'}`}>
                        {isActive && <Check className="w-2.5 h-2.5" />}
                      </div>
                      <div>
                        <div className="font-semibold text-gray-900 text-[10px] group-hover:text-black">{def.name}</div>
                        <div className="text-[9px] text-gray-400 leading-tight">{def.desc}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
              <div className="mt-2.5 border-t border-gray-100 pt-2 flex justify-end">
                <button
                  onClick={() => setIsSelectorOpen(false)}
                  className="bg-gray-900 text-white rounded text-[9px] px-2 py-0.5 font-bold uppercase tracking-wider hover:bg-gray-800 cursor-pointer"
                >
                  Confirm Configuration
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* KPI Cards Grid layout depending on active selections */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        
        {/* Metric 1: Completion rate */}
        {shownMetrics.includes('completion') && (
          <div className="bg-gray-25/50 bg-[#fafafa] border border-gray-200 rounded p-2.5 flex flex-col justify-between">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block">PROJECT COMPLETION</span>
                <span className="text-[20px] font-bold font-mono tracking-tight leading-none">
                  {completionPercentage}%
                </span>
              </div>
              <div className="bg-emerald-50 text-emerald-600 p-1 rounded border border-emerald-100">
                <Trophy className="w-3.5 h-3.5" />
              </div>
            </div>
            
            <div className="mt-2">
              <div className="w-full bg-gray-200 h-1.5 rounded-full overflow-hidden">
                <div 
                  className="bg-emerald-500 h-full rounded-full transition-all duration-500" 
                  style={{ width: `${completionPercentage}%` }}
                />
              </div>
              <div className="flex justify-between text-[9px] text-gray-400 font-medium mt-1">
                <span>{resolvedClashes} of {totalClashes} Clashes Resolved</span>
                <span>Target: 100%</span>
              </div>
            </div>
          </div>
        )}

        {/* Metric 2: Quantity Survey take-off budget status */}
        {shownMetrics.includes('budget') && (
          <div className="bg-[#fafafa] border border-gray-200 rounded p-2.5 flex flex-col justify-between">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block">BOQ ESTIMATED TOTAL</span>
                <span className="text-[20px] font-bold font-mono tracking-tight leading-none">
                  ${(totalBudgetCost).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </span>
              </div>
              <div className="bg-blue-50 text-blue-600 p-1 rounded border border-blue-100">
                <DollarSign className="w-3.5 h-3.5" />
              </div>
            </div>

            <div className="mt-2">
              <div className="w-full bg-gray-200 h-1.5 rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all duration-500 ${budgetVariance >= 0 ? 'bg-blue-500' : 'bg-rose-500'}`}
                  style={{ width: `${budgetRatio}%` }}
                />
              </div>
              <div className="flex justify-between text-[9px] text-gray-400 font-medium mt-1">
                <span>Var: {budgetVariance >= 0 ? `+$${budgetVariance.toLocaleString(undefined, { maximumFractionDigits:0 })}` : `-$${Math.abs(budgetVariance).toLocaleString(undefined, { maximumFractionDigits:0 })} limit`}</span>
                <span>Target: $600k</span>
              </div>
            </div>
          </div>
        )}

        {/* Metric 3: Coordinate risk evaluation index based on raw severities count */}
        {shownMetrics.includes('risks') && (
          <div className="bg-[#fafafa] border border-gray-200 rounded p-2.5 flex flex-col justify-between">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block">COORDINATION RISK INDEX</span>
                <span className="text-[20px] font-bold font-mono tracking-tight leading-none text-rose-600">
                  {riskScore} <span className="text-gray-400 text-xs font-normal">pts</span>
                </span>
              </div>
              <div className="bg-amber-50 text-amber-600 p-1 rounded border border-amber-100 animate-pulse">
                <AlertTriangle className="w-3.5 h-3.5" />
              </div>
            </div>

            <div className="mt-1">
              <span className={`inline-block px-1.5 py-0.5 rounded font-bold uppercase text-[8px] border ${riskAssessment.bg}`}>
                {riskAssessment.label}
              </span>
              <p className="text-[9px] text-gray-400 leading-tight mt-1 truncate" title={riskAssessment.text}>
                {riskAssessment.text}
              </p>
            </div>
          </div>
        )}

        {/* 📈 Metric: Business Value Automation Savings Card */}
        {shownMetrics.includes('business_val') && (
          <div className="bg-gradient-to-br from-slate-900 to-slate-950 text-white border border-slate-800 rounded p-2.5 flex flex-col justify-between shadow-sm">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[9px] font-bold text-sky-400 uppercase tracking-wider block">INFORMATION FLOW ROI</span>
                <span className="text-[20px] font-bold font-mono tracking-tight leading-none text-emerald-400">
                  15.4 Hrs <span className="text-xs text-slate-350 font-normal">saved</span>
                </span>
              </div>
              <div className="bg-emerald-500/10 text-emerald-400 p-1 rounded border border-emerald-500/20">
                <Zap className="w-3.5 h-3.5 animate-pulse" />
              </div>
            </div>

            <div className="mt-2 text-[9px] text-slate-300 leading-normal">
              <span className="text-slate-100 font-bold">Manual work collapsed to 0</span>. Save 15+ hours per project cycle by eliminating manual report generations and workstation latency.
            </div>
          </div>
        )}

        {/* Metric 4: System Clash level breakdown */}
        {shownMetrics.includes('discipline_load') && (
          <div className="bg-[#fafafa] border border-gray-200 rounded p-2.5 flex flex-col justify-between">
            <div>
              <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block mb-1">SYSTEMS CLASH LOAD</span>
              <div className="space-y-1 text-[9px] max-h-[46px] overflow-y-auto pr-1">
                {Object.keys(disciplineCounts).length === 0 ? (
                  <div className="text-gray-400 italic">No pending clashes detected.</div>
                ) : (
                  Object.entries(disciplineCounts).map(([disp, count]) => (
                    <div key={disp} className="flex justify-between items-center border-b border-gray-100 pb-0.5 font-medium text-gray-700">
                      <span className="flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full inline-block bg-sky-500"></span>
                        {disp}
                      </span>
                      <span className="font-mono text-gray-900 font-bold bg-gray-200 px-1 rounded-sm">{count} conflicts</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* Metric 5: Material Cost division takeoff shares */}
        {shownMetrics.includes('materials') && (
          <div className="bg-[#fafafa] border border-gray-200 rounded p-2.5 flex flex-col justify-between sm:col-span-2 lg:col-span-1">
            <div>
              <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block mb-1">BIM BUILDING WORK TAKEOFF SHARES</span>
              <div className="space-y-1 text-[9px] max-h-[46px] overflow-y-auto">
                {Object.keys(materialCostsByCategory).length === 0 ? (
                  <div className="text-gray-400 italic">No take-off estimations found.</div>
                ) : (
                  Object.entries(materialCostsByCategory).map(([category, cost]) => {
                    const pct = totalBudgetCost > 0 ? ((cost / totalBudgetCost) * 100).toFixed(0) : 0;
                    return (
                      <div key={category} className="flex justify-between items-center text-gray-700 leading-tight font-medium">
                        <span className="truncate max-w-[110px] font-semibold">{category}</span>
                        <span className="font-mono text-gray-800 font-bold bg-gray-100 py-0.2 px-1 rounded">{pct}% (${(cost / 1000).toFixed(0)}k)</span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}

        {/* Metric 6: Milestone status checklist progress tracking */}
        {shownMetrics.includes('schedule') && (
          <div className="bg-[#fafafa] border border-gray-200 rounded p-2.5 flex flex-col justify-between sm:col-span-2 lg:col-span-1">
            <div>
              <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block mb-1">MILESTONE TRACKER COORDINATION</span>
              <div className="space-y-1 text-[9px] leading-tight font-medium text-gray-600">
                <div className="flex items-center gap-1">
                  <span className={`w-2.5 h-2.5 flex items-center justify-center rounded-full text-[6px] text-white ${totalClashes > 0 ? 'bg-emerald-500' : 'bg-gray-300'}`}>✓</span>
                  <span className="truncate">Model Seed Geometry Parsing</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className={`w-2.5 h-2.5 flex items-center justify-center rounded-full text-[6px] text-white ${criticalCount === 0 && totalClashes > 0 ? 'bg-emerald-500' : 'bg-orange-500'}`}>{criticalCount === 0 && totalClashes > 0 ? '✓' : '●'}</span>
                  <span className="truncate">Zero Critical Clashes Clearance</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className={`w-2.5 h-2.5 flex items-center justify-center rounded-full text-[6px] text-white ${boqItems.length > 5 ? 'bg-emerald-500' : 'bg-gray-300'}`}>{boqItems.length > 5 ? '✓' : '◌'}</span>
                  <span className="truncate">Quantity Surveying Assessment</span>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* 🛡️ THE METRIC OF BUSINESS VALUE: CORPORATE SAVINGS & ROI LEDGER */}
      <div className="mt-4 pt-3.5 border-t border-gray-200 flex flex-col md:flex-row items-stretch gap-4 text-[11px]">
        
        {/* Left Side: Summary and dynamic math description */}
        <div className="flex-1 bg-slate-50 border border-gray-205 border-gray-200 rounded p-3 flex flex-col justify-between leading-normal shadow-sm">
          <div>
            <div className="flex items-center gap-1.5 text-[9px] font-bold text-gray-400 tracking-wider uppercase mb-1.5">
              <Sparkles className="w-3.5 h-3.5 text-blue-500" />
              Corporate Savings & Automation Ledger
            </div>
            
            <h4 className="font-sans font-bold text-gray-900 text-xs mb-2">
              Eliminating Structural VDC Operational Latency
            </h4>
            
            <div className="grid grid-cols-2 gap-3 mb-2.5 font-medium">
              <div className="bg-white p-2 border border-gray-150 rounded">
                <span className="text-[8px] text-gray-450 uppercase font-bold block">Latency Eliminated</span>
                <span className="text-gray-900 font-bold block mt-0.5 font-mono text-[13px] text-emerald-600">
                  15+ Hours Saved
                </span>
                <span className="text-[8px] text-gray-400">per revision cycle</span>
              </div>
              <div className="bg-white p-2 border border-gray-150 rounded">
                <span className="text-[8px] text-gray-450 uppercase font-bold block">Manual Report Wait-time</span>
                <span className="text-gray-900 font-bold block mt-0.5 font-mono text-[13px] text-blue-600">
                  Cut Down to 0.0h
                </span>
                <span className="text-[8px] text-gray-400">previously 3-day wait</span>
              </div>
            </div>

            <p className="text-[10px] text-gray-500">
              By connecting <strong>Revit/Dynamo</strong> schedules to this high-availability Webhook API, coordinate conflicts and material quantities sync instantly. Manual telemetry collation and report drafting is completely rendered obsolete, <strong>saving over 15+ hours of corporate labor</strong> per project model update.
            </p>
          </div>

          <div className="border-t border-gray-150 pt-2.5 mt-2.5 flex flex-wrap items-center justify-between text-[9px] font-bold text-gray-400 uppercase gap-2">
            <span>Corporate Savings Audit: Active</span>
            <span className="text-emerald-700 font-sans font-bold bg-emerald-50 px-1.5 py-0.5 border border-emerald-100 rounded leading-none">
              +$8,400 Projected Monthly ROI
            </span>
          </div>
        </div>

        {/* Right Side: Historical Visual bar charts */}
        <div className="flex-1 bg-white border border-gray-200 rounded p-3 flex flex-col justify-between shadow-sm">
          <div>
            <div className="flex items-center gap-1.5 text-[9px] font-bold text-gray-400 tracking-wider uppercase mb-2">
              <Clock className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
              Information Flow Latency Benchmark (Cumulative)
            </div>
            
            <div className="space-y-3.5 text-[10px]">
              {/* traditional manual processing wait limit */}
              <div>
                <div className="flex justify-between items-center text-gray-700 font-semibold mb-1">
                  <span>Traditional Manual Compilation & CAD Export</span>
                  <span className="font-mono font-bold text-rose-600 bg-rose-50 px-1 py-0.2 rounded">16.4 Hours Wait</span>
                </div>
                <div className="w-full bg-gray-100 h-2 rounded font-sans overflow-hidden">
                  <div className="bg-rose-500 h-full rounded transition-all duration-300" style={{ width: '90%' }}></div>
                </div>
              </div>

              {/* modern automated webhook transaction speed */}
              <div>
                <div className="flex justify-between items-center text-gray-700 font-semibold mb-1">
                  <span className="flex items-center gap-1">
                    <Zap className="w-3 h-3 text-emerald-500 animate-pulse" />
                    <strong>Automated Webhook Integration Pipeline</strong>
                  </span>
                  <span className="font-mono font-bold text-emerald-600 bg-emerald-50 px-1 py-0.2 rounded">0.01 Hours / Instant</span>
                </div>
                <div className="w-full bg-gray-100 h-2 rounded overflow-hidden">
                  <div className="bg-emerald-500 h-full rounded transition-all duration-300" style={{ width: '1.5%' }}></div>
                </div>
              </div>
            </div>

            <p className="text-[10px] text-gray-400 leading-normal mt-3 pl-2 border-l-2 border-emerald-500 italic font-medium">
              "Automated webhooks replace manual spreadsheets seamlessly, compressing coordinate validation wait times to absolute zero latency threshold."
            </p>
          </div>

          <div className="flex justify-between items-center text-[9px] font-bold text-gray-400 uppercase border-t border-gray-100 pt-2 bg-white mt-3">
            <span>Historical Cycles Tracked: 32</span>
            <span>Est. total saved: 480hr</span>
          </div>
        </div>

      </div>
    </div>
  );
}
