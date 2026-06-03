import React, { useState } from 'react';
import { BCFIssue, ClashStatus, ClashSeverity } from '../types';
import { 
  FileText, 
  CloudUpload, 
  CheckCircle, 
  RefreshCw, 
  AlertTriangle, 
  Trash2, 
  Sparkles, 
  Plus, 
  Info, 
  Link2,
  Calendar,
  User,
  Activity,
  Layers,
  ArrowRight,
  Download
} from 'lucide-react';

interface BCFIssueTrackerProps {
  projectId: string;
  bcfIssues: BCFIssue[];
  onAddBCFIssueToFeed: (fields: Omit<BCFIssue, 'id' | 'createdAt'>) => Promise<void>;
  onDeleteBCFIssue: (id: string) => Promise<void>;
  onSyncIssueToClash: (issue: BCFIssue) => Promise<string | null>;
}

export default function BCFIssueTracker({
  projectId,
  bcfIssues,
  onAddBCFIssueToFeed,
  onDeleteBCFIssue,
  onSyncIssueToClash
}: BCFIssueTrackerProps) {
  const [pasteContent, setPasteContent] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'synced'>('all');

  // Multi-user dynamic simulation mock presets
  const XML_PRESET = `<?xml version="1.0" encoding="utf-8"?>
<Markup>
  <Header>
    <File IfcProject="IFC4_Design" />
  </Header>
  <Topic Guid="d83c21a4-965a-4e2b-be42-b06fac60ff0d" TopicType="Clash" TopicStatus="Open">
    <Title>Mechanical Pipe Clashing with Structural Beam B12</Title>
    <Priority>Critical</Priority>
    <Description>Main 200mm piping system passes straight through structural concrete header beam at grid intersection C-4. Level 2 elevation.</Description>
    <CreationDate>2026-06-02T12:00:00Z</CreationDate>
    <CreationAuthor>karthik.nadar@bim.co</CreationAuthor>
    <AssignedTo>Sarah Jenkins (MEP Lead)</AssignedTo>
  </Topic>
  <Comment>
    <Comment>Rerouting is imperative. Slide lower line clearance downwards by 220mm.</Comment>
  </Comment>
  <Viewpoint>
    <CoordinateX>12.4</CoordinateX>
    <CoordinateY>8.5</CoordinateY>
    <CoordinateZ>3.2</CoordinateZ>
    <Discipline1>HVAC</Discipline1>
    <Discipline2>Structural</Discipline2>
  </Viewpoint>
</Markup>`;

  const JSON_PRESET = `{
  "topic": {
    "guid": "b53f62e8-d102-4bf1-a472-a169dc1e779a",
    "title": "Electrical Cable Tray vs HVAC Duct Fittings",
    "topic_type": "Clash",
    "topic_status": "In Progress",
    "priority": "High",
    "description": "Heavy voltage data cable tray overlaps directly with primary HVAC layout duct fittings on level 3 zone F.",
    "creation_date": "2026-06-02T15:10:00Z",
    "creation_author": "marcus.arch@bim.co",
    "assigned_to": "Dave Myers (Electrical)"
  },
  "comment": {
    "text": "Elevate cable tray by 300mm against HVAC drop. Model modification cleared by BIM office."
  },
  "viewpoint": {
    "coordinate_x": 18.2,
    "coordinate_y": 14.1,
    "coordinate_z": 2.5,
    "discipline_1": "Electrical",
    "discipline_2": "HVAC"
  }
}`;

  const handleLoadPreset = (type: 'xml' | 'json') => {
    setPasteContent(type === 'xml' ? XML_PRESET : JSON_PRESET);
    setParseError(null);
  };

  const handleImportPacket = async () => {
    if (!pasteContent.trim()) {
      setParseError("Please paste BCF data or click a preset first.");
      return;
    }

    setIsParsing(true);
    setParseError(null);
    setSuccessMsg(null);

    try {
      const response = await fetch('/api/bcf/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawContent: pasteContent })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Failed to process BCF packet.");
      }

      const { issue } = await response.json();
      await onAddBCFIssueToFeed(issue);
      
      setSuccessMsg(`Successfully parsed issue: "${issue.title}" which has been pushed to the live web coordination feed!`);
      setPasteContent('');
    } catch (err: any) {
      setParseError(err.message || "An unexpected error occurred during XML parsing.");
    } finally {
      setIsParsing(false);
    }
  };

  // Drag and drop processing
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setPasteContent(event.target.result as string);
        }
      };
      reader.readAsText(file);
    }
  };

  // Sync BCF feed item to the 3D model
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const handleSyncToBIMModel = async (issue: BCFIssue) => {
    setSyncingId(issue.id);
    try {
      const clashId = await onSyncIssueToClash(issue);
      if (clashId) {
        // Success alert
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSyncingId(null);
    }
  };

  // Export BCF issues as beautifully formatted JSON packets
  const handleExportBCFJSON = () => {
    if (bcfIssues.length === 0) {
      alert("No BCF issues currently present in this project's feed to export.");
      return;
    }

    const bcfAuditData = {
      project_id: projectId,
      audit_type: "BCF_COORDINATION_ISSUES_LEDGER",
      generated_at: new Date().toISOString(),
      standards_conformance: "BIM Collaboration Format (BCF) XML/JSON schema schema-2.1 compatible",
      verification_status: "Verified",
      total_records: bcfIssues.length,
      unresolved_issues: bcfIssues.filter(i => !i.synced).length,
      resolved_issues: bcfIssues.filter(i => i.synced).length,
      coordination_ledger: bcfIssues.map(b => ({
        id: b.id,
        guid: b.guid,
        title: b.title,
        description: b.description,
        priority: b.priority,
        status: b.status,
        creationDate: b.creationDate,
        creationAuthor: b.creationAuthor,
        assignedTo: b.assignedTo,
        coordinateX: b.coordinateX,
        coordinateY: b.coordinateY,
        coordinateZ: b.coordinateZ,
        discipline1: b.discipline1,
        discipline2: b.discipline2,
        comment: b.comment,
        synced: b.synced,
        syncedClashId: b.syncedClashId || null
      }))
    };

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(bcfAuditData, null, 2));
    const link = document.createElement("a");
    link.setAttribute("href", dataStr);
    link.setAttribute("download", `${projectId}_BCF_Issues_Compliance_Report.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filter feed list
  const filteredIssues = bcfIssues.filter(issue => {
    if (activeTab === 'pending') return !issue.synced;
    if (activeTab === 'synced') return issue.synced;
    return true;
  });

  return (
    <div className="bg-white text-gray-800 rounded-md border border-gray-200 overflow-hidden shadow-sm font-sans">
      
      {/* Visual Section Header banner */}
      <div className="bg-zinc-900 text-zinc-100 p-4 border-b border-zinc-800 flex justify-between items-center">
        <div>
          <div className="flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-amber-500 animate-pulse" />
            <span className="font-bold text-xs tracking-wider uppercase text-zinc-300">STANDARD BIM PROTOCOL INTEGRATION</span>
          </div>
          <h2 className="text-sm font-extrabold tracking-tight mt-0.5 text-white uppercase">
            LIVE BCF (BIM COLLABORATION FORMAT) ISSUE TRACKER & WEB FEED
          </h2>
        </div>
        <div className="flex items-center gap-1 text-[9px] bg-zinc-800 p-1 px-2.5 rounded border border-zinc-750 font-mono text-zinc-400">
          <Activity className="w-3.5 h-3.5 text-emerald-500 animate-pulse mr-1" />
          <span>REAL-TIME DISK LISTENER ACTIVE</span>
        </div>
      </div>

      {/* Overview Card Description */}
      <div className="bg-amber-50/50 p-3.5 px-4 text-[11.5px] border-b border-gray-150 border-gray-100 text-gray-650 text-gray-600 leading-normal flex items-start gap-2.5">
        <Info className="w-4 h-4 text-amber-505 text-amber-600 mt-0.5 flex-shrink-0" />
        <div>
          <p className="font-medium">
            <strong>What is BCF?</strong> BIM Collaboration Format is an open file XML standard used by heavy civil tools (Archicad, Revit, Solibri) to exchange model coordination issues without transferring heavy size geometry files.
          </p>
          <p className="mt-1">
            <strong>How this works:</strong> Paste any BCF markup packet exported by construction inspectors in the parser below. The server immediately extracts topics, schedules, verbal comments and 3D space parameters, making them instantly clickable on the 3D model.
          </p>
        </div>
      </div>

      {/* Main Multi-grid workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 p-4 items-start">
        
        {/* LEFT COLUMN: Input payload parser forms (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-gray-50 border border-gray-200 rounded p-3.5">
            <h3 className="font-bold text-[11px] uppercase tracking-wider text-gray-800 mb-2 flex items-center gap-1.5">
              <CloudUpload className="w-3.5 h-3.5 text-blue-505 text-blue-500" />
              UPLOAD / PASTE BCF COORDINATES PACKET
            </h3>

            {/* Presets selectors */}
            <div className="flex gap-2 mb-3">
              <button
                type="button"
                onClick={() => handleLoadPreset('xml')}
                className="flex-1 bg-white hover:bg-zinc-50 border border-gray-250 border-gray-200 py-1.5 px-2 rounded text-[10px] font-bold text-gray-700 uppercase tracking-wide transition cursor-pointer flex items-center justify-center gap-1"
              >
                <FileText className="w-3 h-3 text-red-500" />
                Seed sample BCF XML
              </button>
              <button
                type="button"
                onClick={() => handleLoadPreset('json')}
                className="flex-1 bg-white hover:bg-zinc-50 border border-gray-250 border-gray-200 py-1.5 px-2 rounded text-[10px] font-bold text-gray-700 uppercase tracking-wide transition cursor-pointer flex items-center justify-center gap-1"
              >
                <FileText className="w-3 h-3 text-blue-500" />
                Seed sample BCF JSON
              </button>
            </div>

            {/* Input textarea */}
            <div 
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              className="relative"
            >
              <textarea
                value={pasteContent}
                onChange={(e) => {
                  setPasteContent(e.target.value);
                  setParseError(null);
                }}
                placeholder="Drag & drop a .bcfxml file here, or paste XML Markup / JSON content directly..."
                className="w-full h-56 bg-white border border-gray-200 rounded p-2.5 font-mono text-[10px] text-gray-700 leading-normal focus:outline-none focus:border-zinc-500"
              />
              {pasteContent.length === 0 && (
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-gray-400 text-center p-4">
                  <CloudUpload className="w-7 h-7 mb-1.5 text-gray-300 animate-pulse" />
                  <p className="text-[10px] font-bold uppercase tracking-wider">Drag & Drop OR Paste</p>
                  <p className="text-[9px] text-gray-400 mt-0.5">Click the preset buttons above to test instantly</p>
                </div>
              )}
            </div>

            {/* Validation notifications */}
            {parseError && (
              <div className="bg-rose-50 border border-rose-200 text-rose-700 text-[10.5px] p-2.5 rounded mt-3 leading-snug flex items-start gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                <span>{parseError}</span>
              </div>
            )}

            {successMsg && (
              <div className="bg-emerald-50 border border-emerald-250 border-emerald-100 text-emerald-800 text-[10.5px] p-2.5 rounded mt-3 leading-snug flex items-start gap-1.5">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0 mt-0.5 animate-bounce" />
                <span>{successMsg}</span>
              </div>
            )}

            {/* Submit button */}
            <button
              id="btn-submit-bcf-import"
              type="button"
              disabled={isParsing || !pasteContent.trim()}
              onClick={handleImportPacket}
              className="w-full mt-3 bg-gray-900 hover:bg-gray-850 disabled:bg-gray-200 disabled:text-gray-400 text-white font-bold py-2 rounded text-[10.5px] uppercase tracking-wider transition cursor-pointer flex items-center justify-center gap-1.5"
            >
              {isParsing ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Parsing Markup Elements...
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  Import Packet into BCF feed
                </>
              )}
            </button>
          </div>
        </div>

        {/* RIGHT COLUMN: Live incoming coordination feed list (7 cols) */}
        <div className="lg:col-span-7 flex flex-col gap-3">
          
          {/* Feed Filter controls tab */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-150 border-gray-100 pb-2 mb-1.5">
            <span className="font-bold text-[10px] uppercase tracking-wider text-gray-500">
              LIVE BROADCAST INCOMING STREAM ({filteredIssues.length})
            </span>
            
            <div className="flex items-center gap-2 self-end sm:self-auto">
              {bcfIssues.length > 0 && (
                <button
                  type="button"
                  onClick={handleExportBCFJSON}
                  className="bg-zinc-800 hover:bg-zinc-700 text-amber-400 font-bold px-2 py-1 rounded text-[9px] uppercase tracking-wider flex items-center gap-1 transition cursor-pointer"
                  title="Export raw JSON BCF feed ledger"
                >
                  <Download className="w-3 h-3 text-amber-400" />
                  <span>Export BCF Ledger (JSON)</span>
                </button>
              )}

              <div className="flex gap-1">
                {['all', 'pending', 'synced'].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab as any)}
                    className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border cursor-pointer ${
                      activeTab === tab 
                        ? 'bg-zinc-900 border-zinc-900 text-white' 
                        : 'bg-white border-gray-200 text-gray-500 hover:text-gray-800 hover:border-gray-300'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Dynamic Feed stream cards list */}
          <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
            {filteredIssues.map((issue) => {
              const borderColors: Record<string, string> = {
                critical: 'border-l-rose-500',
                high: 'border-l-orange-500',
                medium: 'border-l-amber-500',
                low: 'border-l-blue-500'
              };
              const bgColors: Record<string, string> = {
                critical: 'bg-rose-50/20',
                high: 'bg-orange-50/20',
                medium: 'bg-amber-50/20',
                low: 'bg-blue-50/20'
              };
              const colorPref = borderColors[issue.priority.toLowerCase()] || 'border-l-gray-400';
              const bgPref = bgColors[issue.priority.toLowerCase()] || 'bg-gray-50/30';
              
              return (
                <div 
                  key={issue.id} 
                  className={`border border-gray-200 rounded p-3 text-[11px] leading-relaxed relative flex flex-col justify-between transition-all gap-2 border-l-[4px] ${colorPref} ${bgPref} hover:border-gray-300`}
                >
                  <div>
                    {/* Header line status */}
                    <div className="flex justify-between items-center mb-1.5">
                      <div className="flex items-center gap-1.5">
                        <span className={`text-[8.5px] font-extrabold px-1.5 py-0.2 rounded border font-mono tracking-wider uppercase ${
                          issue.priority.toLowerCase() === 'critical' 
                            ? 'bg-rose-50 text-rose-700 border-rose-100 font-bold' 
                            : 'bg-gray-50 text-gray-700 border-gray-150'
                        }`}>
                          {issue.priority} PRIOR
                        </span>
                        
                        {issue.synced ? (
                          <span className="text-[8.5px] items-center gap-0.5 bg-emerald-50 text-emerald-800 border border-emerald-100 font-bold px-1.5 rounded uppercase tracking-wider inline-flex">
                            <CheckCircle className="w-2.5 h-2.5 text-emerald-600" /> Synced to Model
                          </span>
                        ) : (
                          <span className="text-[8.5px] bg-red-50 text-red-700 border border-red-100 font-bold px-1.5 rounded uppercase tracking-wider inline-flex">
                            Pending Sync
                          </span>
                        )}
                      </div>

                      <button
                        onClick={() => onDeleteBCFIssue(issue.id)}
                        className="text-gray-400 hover:text-red-500 cursor-pointer p-0.5 hover:bg-gray-100 rounded"
                        title="Remove BCF Card Feed"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>

                    {/* Title and descriptions */}
                    <h4 className="font-extrabold text-[12px] text-gray-900 leading-tight">
                      {issue.title}
                    </h4>
                    <p className="text-gray-600 font-medium text-[10.5px] mt-1 leading-snug">
                      {issue.description}
                    </p>

                    {/* Spacer Comment line */}
                    {issue.comment && (
                      <div className="bg-white/80 border border-dashed border-gray-200 p-2 rounded mt-2 text-[10px] text-indigo-900 font-medium">
                        <span className="block text-[8px] uppercase font-bold text-gray-400 mb-0.5">BCF Comment Thread:</span>
                        "{issue.comment}"
                      </div>
                    )}
                  </div>

                  {/* Visual Coordinate vectors and action triggers */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between border-t border-gray-150 border-gray-100 pt-2.5 mt-1.5 text-[9.5px]">
                    <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-gray-500 leading-none mb-1.5 sm:mb-0">
                      <div className="flex items-center gap-1 font-mono">
                        <ArrowRight className="w-2.5 h-2.5 text-gray-400" />
                        <span>COORDS: X:{issue.coordinateX}m, Y:{issue.coordinateY}m</span>
                      </div>
                      <div className="flex items-center gap-1 font-semibold uppercase text-indigo-700 bg-indigo-50/50 p-0.2 px-1 rounded border border-indigo-100 max-w-fit">
                        <span>{issue.discipline1} vs {issue.discipline2}</span>
                      </div>
                      <div className="flex items-center gap-1 mt-0.5">
                        <Calendar className="w-2.5 h-2.5 text-gray-300" />
                        <span>Parsed: {new Date(issue.creationDate).toLocaleDateString()}</span>
                      </div>
                      <div className="flex items-center gap-1 mt-0.5">
                        <User className="w-2.5 h-2.5 text-gray-300" />
                        <span>By: {issue.creationAuthor}</span>
                      </div>
                    </div>

                    <div>
                      {issue.synced ? (
                        <div className="flex items-center gap-1 text-emerald-800 font-bold uppercase tracking-wider text-[8.5px] bg-emerald-50 px-2 py-1 rounded border border-emerald-150">
                          <Link2 className="w-3 h-3 text-emerald-600" /> Linked (UID: {issue.syncedClashId?.substring(0, 10)})
                        </div>
                      ) : (
                        <button
                          type="button"
                          disabled={syncingId === issue.id}
                          onClick={() => handleSyncToBIMModel(issue)}
                          className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-100 disabled:text-gray-450 text-white font-bold py-1 px-3 rounded text-[9px] uppercase tracking-wider flex items-center gap-1 cursor-pointer transition shadow-none"
                        >
                          {syncingId === issue.id ? (
                            <>
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Syncing...
                            </>
                          ) : (
                            <>
                              <Link2 className="w-3.5 h-3.5" /> Sync with BIM Viewer
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {filteredIssues.length === 0 && (
              <div className="bg-gray-25/50 bg-[#fafafa] border border-dashed border-gray-200 p-8 rounded text-center text-gray-400">
                <FileText className="w-8 h-8 stroke-1 mx-auto mb-1.5 text-gray-400" />
                <p className="text-[11.5px] font-bold uppercase tracking-wider">No issue feed parsed</p>
                <p className="text-[10px] text-gray-400 mt-0.5 max-w-xs mx-auto leading-normal">
                  Drop XML / JSON exported packet documents or paste content in the BCF Parser sidebar to trigger live real-time coordination feeds on this project dashboard.
                </p>
              </div>
            )}
          </div>
        </div>

      </div>

    </div>
  );
}
