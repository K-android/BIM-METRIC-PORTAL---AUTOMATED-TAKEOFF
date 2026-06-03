import React, { useState, useMemo } from 'react';
import { BOQItem } from '../types';
import { SEEDED_BOQ } from '../initialData';
import { Calculator, Plus, Trash2, Search, Sparkles, Filter, Check, ShieldAlert, DollarSign, Layers, Upload, X, FileText, CheckCircle2 } from 'lucide-react';

interface QuantitySurveyorProps {
  items: BOQItem[];
  onAddBOQItem: (item: Omit<BOQItem, 'id' | 'projectId' | 'createdAt' | 'updatedAt' | 'totalPrice'>) => Promise<void>;
  onAddManyBOQItems: (items: Omit<BOQItem, 'id' | 'projectId' | 'createdAt' | 'updatedAt' | 'totalPrice'>[]) => Promise<void>;
  onDeleteBOQItem: (id: string) => Promise<void>;
  projectLocation: string;
}

export default function QuantitySurveyor({
  items,
  onAddBOQItem,
  onAddManyBOQItems,
  onDeleteBOQItem,
  projectLocation
}: QuantitySurveyorProps) {
  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  // Manual Add Form State
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    category: 'Structural Concrete',
    elementType: '',
    quantity: '',
    unit: 'm3',
    unitPrice: '',
    sourceLocation: '',
    notes: ''
  });

  // AI Generation Form State
  const [aiPrompt, setAiPrompt] = useState('Commercial tower Level 3 concrete shear wall slab with high-strength pillars mapping seismic factors');
  const [aiCategory, setAiCategory] = useState('Structural Concrete');
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiGeneratedPreview, setAiGeneratedPreview] = useState<any[] | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  // CSV Import State
  const [showImportPanel, setShowImportPanel] = useState(false);
  const [csvPreview, setCsvPreview] = useState<any[] | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  // Helper template string for clipboard copy suggestion
  const templateCsv = `category,elementType,quantity,unit,unitPrice,sourceLocation,notes
Structural Concrete,Seismic Concrete Beam Tier B4,142.5,m3,185.00,Basement B1,Heavy subgrade reinforcement slab
Structural Steel,W12x26 Welded Girder Plate,12,pcs,450.00,Level 3 Sector-A,Structural facade cantilever connection
HVAC Ductwork,Carbon Exhaust Extraction Shaft,4,m,120.00,Basement B1,Tunnel CO2 vent air induction`;

  // Dynamic CSV Parser
  const parseCSV = (text: string) => {
    try {
      const lines = text.split(/\r?\n/).map(line => line.trim()).filter(line => line.length > 0);
      if (lines.length < 2) {
        throw new Error("CSV file must contain at least a header row and one valid data row.");
      }

      // Read clean header elements
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/["']/g, ''));
      
      // Smart header finding matches
      const colMap = {
        category: headers.findIndex(h => h.includes('category') || h.includes('discipline') || h.includes('group')),
        elementType: headers.findIndex(h => h.includes('element') || h.includes('material') || h.includes('name') || h.includes('type') || h.includes('item')),
        quantity: headers.findIndex(h => h.includes('qty') || h.includes('quantity') || h.includes('volume') || h.includes('count') || h.includes('amount')),
        unit: headers.findIndex(h => h.includes('unit') || h.includes('measure')),
        unitPrice: headers.findIndex(h => h.includes('price') || h.includes('rate') || h.includes('cost') || h.includes('unitprice')),
        sourceLocation: headers.findIndex(h => h.includes('location') || h.includes('zone') || h.includes('level') || h.includes('floor') || h.includes('elevation')),
        notes: headers.findIndex(h => h.includes('notes') || h.includes('remarks') || h.includes('desc') || h.includes('comments'))
      };

      // Guard boundaries
      if (colMap.elementType === -1) {
        throw new Error("Could not find an 'elementType' or 'material name' column in the header line.");
      }
      if (colMap.quantity === -1) {
        throw new Error("Could not find a 'quantity' or 'qty' column in the header line.");
      }
      if (colMap.unitPrice === -1) {
        throw new Error("Could not find a 'unitPrice' or 'rate' column in the header line.");
      }

      const parsedRows: any[] = [];
      const validationErrors: string[] = [];

      for (let i = 1; i < lines.length; i++) {
        // Safe quote-aware row splitting
        const rowText = lines[i];
        const cells: string[] = [];
        let currentCell = '';
        let inQuotes = false;
        
        for (let charIndex = 0; charIndex < rowText.length; charIndex++) {
          const char = rowText[charIndex];
          if (char === '"') {
            inQuotes = !inQuotes;
          } else if (char === ',' && !inQuotes) {
            cells.push(currentCell.trim());
            currentCell = '';
          } else {
            currentCell += char;
          }
        }
        cells.push(currentCell.trim());

        const getCell = (index: number, fallback: string = '') => {
          if (index < 0 || index >= cells.length) return fallback;
          let textVal = cells[index];
          // Strip outer quotes if present
          if (textVal.startsWith('"') && textVal.endsWith('"')) {
            textVal = textVal.substring(1, textVal.length - 1);
          }
          if (textVal.startsWith("'") && textVal.endsWith("'")) {
            textVal = textVal.substring(1, textVal.length - 1);
          }
          return textVal.trim();
        };

        const elementType = getCell(colMap.elementType);
        if (!elementType) continue; // Skip blank rows cleanly

        const qtyStr = getCell(colMap.quantity);
        const priceStr = getCell(colMap.unitPrice);

        const quantity = parseFloat(qtyStr.replace(/[^0-9.-]/g, ''));
        const unitPrice = parseFloat(priceStr.replace(/[^0-9.-]/g, ''));

        if (isNaN(quantity)) {
          validationErrors.push(`Row ${i} skipped: Invalid quantity number "${qtyStr}"`);
          continue;
        }

        if (isNaN(unitPrice)) {
          validationErrors.push(`Row ${i} skipped: Invalid unit price/rate number "${priceStr}"`);
          continue;
        }

        const category = getCell(colMap.category) || 'Structural Concrete';
        const unit = getCell(colMap.unit) || 'm3';
        const sourceLocation = getCell(colMap.sourceLocation) || 'Level 1 Core';
        const notes = getCell(colMap.notes) || 'Bulk CSV imported';

        parsedRows.push({
          category,
          elementType,
          quantity,
          unit,
          unitPrice,
          sourceLocation,
          notes
        });
      }

      if (parsedRows.length === 0) {
        throw new Error(validationErrors.length > 0 ? validationErrors.join('; ') : "No valid data rows parsed. Check columns & values.");
      }

      setCsvPreview(parsedRows);
      setImportError(validationErrors.length > 0 ? `Tolerant Parsing Complete (With warning: ${validationErrors.join(', ')})` : null);
    } catch (err: any) {
      setImportError(err.message || "Unknown error parsing CSV format structure.");
      setCsvPreview(null);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target && typeof event.target.result === 'string') {
          parseCSV(event.target.result);
        }
      };
      reader.readAsText(file);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target && typeof event.target.result === 'string') {
          parseCSV(event.target.result);
        }
      };
      reader.readAsText(file);
    }
  };

  const handleApproveCsvImport = async () => {
    if (!csvPreview) return;
    try {
      await onAddManyBOQItems(csvPreview.map(i => ({
        category: i.category,
        elementType: i.elementType,
        quantity: i.quantity,
        unit: i.unit,
        unitPrice: i.unitPrice,
        sourceLocation: i.sourceLocation,
        notes: `📥 CSV Import: ${i.notes}`
      })));
      setCsvPreview(null);
      setShowImportPanel(false);
    } catch (err) {
      console.error(err);
      setImportError("Database write error saving bulk components.");
    }
  };

  // Categories list
  const categories = useMemo(() => {
    const list = new Set<string>();
    items.forEach(item => list.add(item.category));
    return ['All', ...Array.from(list)];
  }, [items]);

  // Combined filters
  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const matchSearch = item.elementType.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          item.sourceLocation.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          item.category.toLowerCase().includes(searchTerm.toLowerCase());
      const matchCat = selectedCategory === 'All' || item.category === selectedCategory;
      return matchSearch && matchCat;
    });
  }, [items, searchTerm, selectedCategory]);

  // Derived financial statistics
  const metrics = useMemo(() => {
    let totalBudget = 0;
    let concreteBudget = 0;
    let steelBudget = 0;

    items.forEach(item => {
      totalBudget += item.totalPrice;
      if (item.category.toLowerCase().includes('concrete')) {
        concreteBudget += item.totalPrice;
      } else if (item.category.toLowerCase().includes('steel')) {
        steelBudget += item.totalPrice;
      }
    });

    return {
      totalBudget,
      concreteShare: totalBudget > 0 ? (concreteBudget / totalBudget) * 100 : 0,
      steelShare: totalBudget > 0 ? (steelBudget / totalBudget) * 100 : 0,
      itemCount: items.length
    };
  }, [items]);

  // Handle manual additions
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.elementType || !formData.quantity || !formData.unitPrice) {
      alert("Please complete core fields correctly.");
      return;
    }
    
    try {
      await onAddBOQItem({
        category: formData.category,
        elementType: formData.elementType,
        quantity: parseFloat(formData.quantity),
        unit: formData.unit,
        unitPrice: parseFloat(formData.unitPrice),
        sourceLocation: formData.sourceLocation || 'Level 1 Core',
        notes: formData.notes || 'Manually surveyed'
      });

      // Clear values
      setFormData({
        category: 'Structural Concrete',
        elementType: '',
        quantity: '',
        unit: 'm3',
        unitPrice: '',
        sourceLocation: '',
        notes: ''
      });
      setShowForm(false);
    } catch (err) {
      console.error(err);
    }
  };

  // Trigger Gemini AI Automated Takeoff
  const handleAIEstimate = async () => {
    if (!aiPrompt.trim()) return;
    setIsGenerating(true);
    setAiGeneratedPreview(null);
    setAiError(null);

    try {
      const res = await fetch('/api/takeoff/estimate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectDescription: aiPrompt,
          category: aiCategory,
          location: projectLocation
        })
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Generation endpoint failed.");
      }

      const data = await res.json();
      if (data.items && data.items.length > 0) {
        setAiGeneratedPreview(data.items);
      } else {
        throw new Error("No products returned. Check the formatting structure.");
      }
    } catch (err: any) {
      setAiError(err.message || "An unexpected network error occurred.");
    } finally {
      setIsGenerating(false);
    }
  };

  // Submit AI recommended items to database
  const handleApproveAIEstimates = async () => {
    if (!aiGeneratedPreview) return;
    try {
      await onAddManyBOQItems(aiGeneratedPreview.map(i => ({
        category: i.category,
        elementType: i.elementType,
        quantity: parseFloat(i.quantity) || 0,
        unit: i.unit,
        unitPrice: parseFloat(i.unitPrice) || 0,
        sourceLocation: i.sourceLocation || 'Level 1 Grid',
        notes: `🤖 AI Generated Suggestion: ${i.notes}`
      })));
      setAiGeneratedPreview(null);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      
      {/* 📊 BUDGET ANALYTICS DASHBOARD */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
        <div className="bg-white p-2.5 px-3 rounded border border-gray-200 flex items-center justify-between shadow-none">
          <div>
            <span className="text-[9px] uppercase font-bold text-gray-400 tracking-wider">TOTAL ESTIMATED BOQ</span>
            <span className="block font-sans font-bold text-base text-gray-900 mt-0.5">
              ${metrics.totalBudget.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <div className="bg-blue-50 text-blue-500 p-1.5 rounded">
            <DollarSign className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-white p-2.5 px-3 rounded border border-gray-200 flex items-center justify-between shadow-none">
          <div>
            <span className="text-[9px] uppercase font-bold text-gray-400 tracking-wider">MEASURED TAKEOFFS</span>
            <span className="block font-sans font-bold text-base text-gray-900 mt-0.5">
              {metrics.itemCount} Elements
            </span>
          </div>
          <div className="bg-indigo-50 text-indigo-500 p-1.5 rounded">
            <Calculator className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-white p-2.5 px-3 rounded border border-gray-200 flex items-center justify-between shadow-none">
          <div>
            <span className="text-[9px] uppercase font-bold text-gray-400 tracking-wider">CONCRETE ZONE</span>
            <span className="block font-sans font-bold text-base text-gray-950 mt-0.5">
              {metrics.concreteShare.toFixed(1)}%
            </span>
          </div>
          <div className="w-7 h-7 rounded-full border-2 border-gray-105 border-gray-100 border-t-emerald-500 flex items-center justify-center font-bold text-[10px] text-gray-600">
            C
          </div>
        </div>

        <div className="bg-white p-2.5 px-3 rounded border border-gray-200 flex items-center justify-between shadow-none">
          <div>
            <span className="text-[9px] uppercase font-bold text-gray-400 tracking-wider">STEEL ZONE</span>
            <span className="block font-sans font-bold text-base text-gray-950 mt-0.5">
              {metrics.steelShare.toFixed(1)}%
            </span>
          </div>
          <div className="w-7 h-7 rounded-full border-2 border-gray-105 border-gray-100 border-t-indigo-500 flex items-center justify-center font-bold text-[10px] text-gray-600">
            S
          </div>
        </div>
      </div>

      {/* 🤖 GEMINI AUTOMATED TAKEOFF ESTIMATOR CO-PILOT */}
      <div className="bg-gradient-to-r from-gray-950 via-gray-900 to-gray-950 rounded p-4 text-white border border-gray-800 shadow-none">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3 pb-2.5 border-b border-gray-800/40">
          <div className="flex items-center gap-2">
            <div className="bg-indigo-500/10 p-1.5 rounded border border-indigo-500/20 text-indigo-400">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-sans font-bold text-xs uppercase tracking-wider text-white">GEMINI BIM QUANTITY TAKEOFF GENERATOR</h3>
              <p className="text-[10px] text-gray-400">Model-based structural volume material mapping assistant</p>
            </div>
          </div>

          {/* 🟢 Live Model Database Connection Status Indicator */}
          <div className="flex items-center gap-2 bg-slate-900 border border-gray-800 py-1 px-2.5 rounded text-[9px] font-mono text-gray-300 self-start sm:self-auto shadow-sm select-none">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span>Database Status: <strong className="text-emerald-400 font-bold uppercase tracking-wide">Synced via Webhook</strong></span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
          <div className="md:col-span-3">
            <label className="block text-[9px] font-bold text-gray-300 uppercase mb-1 tracking-wider">BIM Element Category</label>
            <select
              value={aiCategory}
              onChange={(e) => setAiCategory(e.target.value)}
              className="w-full bg-slate-950 border border-gray-800 rounded p-1.5 text-[11px] text-gray-200 outline-none focus:border-indigo-500 cursor-pointer"
            >
              <option value="Structural Concrete">Structural Concrete</option>
              <option value="Structural Steel">Structural Steel</option>
              <option value="HVAC Ductwork">HVAC Ductwork</option>
              <option value="Electrical Cabling">Electrical Cabling</option>
              <option value="Drywall & Masonry">Drywall & Masonry</option>
              <option value="Plumbing & Drainage">Plumbing & Drainage</option>
            </select>
          </div>

          <div className="md:col-span-6">
            <label className="block text-[9px] font-bold text-gray-300 uppercase mb-1 tracking-wider">Physical Specifications / Layout Descriptors</label>
            <input
              type="text"
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              placeholder="e.g. Seismic-proof Grade Level columns and beams layout..."
              className="w-full bg-slate-950 border border-gray-800 rounded p-1.5 text-[11px] text-gray-200 outline-none focus:border-indigo-500"
            />
          </div>

          <div className="md:col-span-3">
            <button
              id="btn-ai-takeoff"
              disabled={isGenerating || !aiPrompt}
              onClick={handleAIEstimate}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-800 disabled:text-gray-500 py-1.5 px-3 rounded font-sans text-[10px] font-bold uppercase tracking-wider text-white transition flex items-center justify-center gap-1.5 cursor-pointer"
            >
              {isGenerating ? (
                <>
                  <div className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin"></div>
                  Estimating Vol...
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  Generate estimate
                </>
              )}
            </button>
          </div>
        </div>

        {aiError && (
          <div className="bg-red-950/40 border border-red-900/50 text-red-300 text-[10px] mt-2.5 p-2 rounded flex items-center gap-1.5">
            <ShieldAlert className="w-3.5 h-3.5 flex-shrink-0" />
            <span>{aiError}</span>
          </div>
        )}

        {/* AI PREVIEW LIST */}
        {aiGeneratedPreview && (
          <div className="mt-4 bg-gray-950 rounded border border-gray-850 p-3 animate-in fade-in duration-200">
            <div className="flex justify-between items-center mb-2.5">
              <span className="text-[10px] text-indigo-400 font-bold tracking-wider uppercase">AI TAKEOFF SUGGESTED PROJECTION:</span>
              <div className="flex gap-1.5">
                <button
                  onClick={() => setAiGeneratedPreview(null)}
                  className="px-2 py-0.5 text-[9px] font-bold bg-gray-800 hover:bg-gray-750 text-gray-400 rounded transition cursor-pointer uppercase"
                >
                  Discard
                </button>
                <button
                  id="btn-ai-approve"
                  onClick={handleApproveAIEstimates}
                  className="px-2.5 py-0.5 text-[9px] font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded transition flex items-center gap-1 cursor-pointer uppercase"
                >
                  <Check className="w-3 h-3" /> Approve & Save
                </button>
              </div>
            </div>

            <div className="overflow-x-auto text-[10.5px] text-gray-300 max-h-40 overflow-y-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-gray-800 text-gray-400 text-left font-mono text-[9px] uppercase tracking-wider">
                    <th className="pb-1.5">Material / Type</th>
                    <th className="pb-1.5">Quantity</th>
                    <th className="pb-1.5">Avg Price</th>
                    <th className="pb-1.5">Total Cost</th>
                    <th className="pb-1.5">Model Zone</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-900">
                  {aiGeneratedPreview.map((item, index) => (
                    <tr key={index} className="hover:bg-gray-900/50">
                      <td className="py-1.5 pr-2">
                        <div className="font-semibold text-gray-100">{item.elementType}</div>
                        <div className="text-[8px] text-gray-500 uppercase">{item.category}</div>
                      </td>
                      <td className="py-1.5 font-mono">{item.quantity} {item.unit}</td>
                      <td className="py-1.5 font-mono">${item.unitPrice}</td>
                      <td className="py-1.5 font-mono text-indigo-400 font-bold">${(item.quantity * item.unitPrice).toFixed(2)}</td>
                      <td className="py-1.5 text-gray-400">{item.sourceLocation}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* 📋 CORE TASK TABLE AND DYNAMIC FILTERS */}
      <div className="bg-white rounded border border-gray-200 overflow-hidden shadow-none">
        
        {/* Table Filters Top Band */}
        <div className="p-2 px-3 bg-gray-50 border-b border-gray-200 flex flex-wrap justify-between items-center gap-3">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            {/* Search Input */}
            <div className="relative flex-1 sm:w-56">
              <Search className="w-3.5 h-3.5 absolute left-2 top-2 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search element types, zones..."
                className="pl-7 pr-3 py-1 w-full bg-white border border-gray-200 rounded text-[11px] outline-none focus:border-blue-500 text-gray-800"
              />
            </div>

            {/* Category selection selector */}
            <div className="flex items-center gap-1 bg-white border border-gray-200 pl-2 pr-1 ml-1 py-1 rounded">
              <Filter className="w-3 h-3 text-gray-400" />
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="text-[11px] font-bold text-gray-700 bg-transparent outline-none cursor-pointer"
              >
                {categories.map((cat, idx) => (
                  <option key={idx} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              id="btn-show-import"
              onClick={() => {
                setShowImportPanel(!showImportPanel);
                setShowForm(false);
              }}
              className={`flex items-center gap-1 text-[10px] uppercase font-bold tracking-wider py-1 px-2.5 rounded transition cursor-pointer ${showImportPanel ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-700 hover:bg-blue-150 border border-blue-200'}`}
            >
              <Upload className="w-3 h-3" />
              Bulk CSV Import
            </button>
            <button
              id="btn-show-form"
              onClick={() => {
                setShowForm(!showForm);
                setShowImportPanel(false);
              }}
              className={`flex items-center gap-1 text-[10px] uppercase font-bold tracking-wider py-1 px-2.5 rounded transition cursor-pointer ${showForm ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-750 hover:bg-gray-200 border border-gray-200'}`}
            >
              <Plus className="w-3 h-3" />
              Manual Takeoff
            </button>
          </div>
        </div>

        {/* CSV Bulk Import Section */}
        {showImportPanel && (
          <div className="p-4 bg-blue-50/45 border-b border-gray-200 text-[11px] animate-in slide-in-from-top duration-200">
            <div className="flex justify-between items-start mb-3">
              <div>
                <h4 className="text-[10px] font-bold text-blue-900 uppercase tracking-widest flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-blue-600" />
                  Bulk Material Takeoff CSV Import
                </h4>
                <p className="text-[10px] text-gray-500 mt-0.5">
                  Import multi-row surveyed assemblies instantly. Columns are dynamically mapped from your design schedule files.
                </p>
              </div>
              <button
                type="button"
                className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100 cursor-pointer"
                onClick={() => {
                  setShowImportPanel(false);
                  setCsvPreview(null);
                  setImportError(null);
                }}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              {/* Drag & Drop Input Target Area */}
              <div className="lg:col-span-5 flex flex-col gap-2">
                <div
                  onDragEnter={handleDrag}
                  onDragOver={handleDrag}
                  onDragLeave={handleDrag}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-lg p-5 text-center transition flex flex-col items-center justify-center min-h-[140px] ${
                    dragActive 
                      ? 'border-blue-500 bg-blue-50/80 text-blue-605' 
                      : 'border-slate-300 bg-white hover:border-blue-400 text-gray-500'
                  }`}
                >
                  <Upload className={`w-8 h-8 mb-2 ${dragActive ? 'animate-bounce text-blue-600' : 'text-slate-400'}`} />
                  <p className="text-[11px] font-semibold text-gray-700">Drag & Drop model CSV schedule here</p>
                  <p className="text-[9px] text-gray-400 mt-0.5">or click to browse local files</p>
                  
                  <label className="mt-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-[9px] uppercase tracking-wider py-1 px-3 rounded cursor-pointer transition">
                    Browse CSV
                    <input 
                      type="file" 
                      accept=".csv" 
                      onChange={handleFileChange} 
                      className="hidden" 
                    />
                  </label>
                </div>

                {importError && (
                  <div className="bg-amber-50 border border-amber-200 text-amber-900 p-2 rounded text-[10px] flex items-start gap-1.5 leading-snug">
                    <ShieldAlert className="w-3.5 h-3.5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <span className="break-words font-medium">{importError}</span>
                  </div>
                )}
              </div>

              {/* CSV Schema Help & Download Info */}
              <div className="lg:col-span-7 bg-white p-3 border border-gray-200 rounded-lg flex flex-col justify-between">
                <div>
                  <h5 className="font-bold text-[9px] uppercase text-gray-650 tracking-wider mb-1 flex items-center gap-1 text-slate-700">
                    <FileText className="w-3 h-3 text-blue-500" />
                    Expected Schema Mappings
                  </h5>
                  <p className="text-[10px] text-gray-500 mb-2 leading-relaxed">
                    We automatically map headers. Your file must have headers equivalent to the following parameters:
                  </p>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5 font-mono text-[9px] mb-3">
                    <div className="bg-slate-50 border border-slate-100 p-1 px-1.5 rounded">
                      <span className="font-bold text-slate-800">elementType *</span>
                      <span className="block text-[8px] text-slate-400">e.g. Columns, Slab</span>
                    </div>
                    <div className="bg-slate-50 border border-slate-100 p-1 px-1.5 rounded">
                      <span className="font-bold text-slate-800">quantity *</span>
                      <span className="block text-[8px] text-slate-400">e.g. 14.5, 230</span>
                    </div>
                    <div className="bg-slate-50 border border-slate-100 p-1 px-1.5 rounded">
                      <span className="font-bold text-slate-800">unitPrice *</span>
                      <span className="block text-[8px] text-slate-400">e.g. 150.00</span>
                    </div>
                    <div className="bg-slate-50 border border-slate-100 p-1 px-1.5 rounded text-gray-500">
                      <span className="font-medium">category</span>
                      <span className="block text-[8px] text-slate-400">e.g. Structural Concrete</span>
                    </div>
                    <div className="bg-slate-50 border border-slate-100 p-1 px-1.5 rounded text-gray-500">
                      <span className="font-medium">sourceLocation</span>
                      <span className="block text-[8px] text-slate-400">e.g. Level B2</span>
                    </div>
                    <div className="bg-slate-50 border border-slate-100 p-1 px-1.5 rounded text-gray-500">
                      <span className="font-medium">unit</span>
                      <span className="block text-[8px] text-slate-400">e.g. m3, m2, pcs</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-2 items-center justify-between bg-blue-50/30 p-2 rounded border border-blue-100/50">
                  <span className="text-[9.5px] text-gray-650 font-medium">Use our calibrated schedule template to get started:</span>
                  <button
                    type="button"
                    onClick={() => {
                      const blob = new Blob([templateCsv], { type: 'text/csv' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = 'bim_quantity_takeoff_template.csv';
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                    className="bg-zinc-800 hover:bg-zinc-900 text-white font-bold text-[8.5px] uppercase tracking-wider py-1 px-2.5 rounded transition flex items-center gap-1 cursor-pointer"
                  >
                    Download Template CSV
                  </button>
                </div>
              </div>
            </div>

            {/* CSV PARSED PREVIEW ZONE */}
            {csvPreview && csvPreview.length > 0 && (
              <div className="mt-4 bg-white rounded border border-blue-200 overflow-hidden animate-in fade-in duration-200">
                <div className="p-2.5 px-3 bg-blue-50 border-b border-blue-200 flex justify-between items-center">
                  <span className="text-[10px] text-blue-900 font-bold tracking-wider uppercase flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    Valid schedule found: {csvPreview.length} items parsed successfully
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setCsvPreview(null)}
                      className="px-2.5 py-1 text-[9px] font-bold bg-white hover:bg-gray-100 border border-gray-200 text-gray-650 rounded transition cursor-pointer uppercase text-gray-600"
                    >
                      Reset File
                    </button>
                    <button
                      id="btn-csv-approve"
                      onClick={handleApproveCsvImport}
                      className="px-3 py-1 text-[9px] font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded shadow-sm transition flex items-center gap-1 font-sans cursor-pointer uppercase hover:bg-emerald-700"
                    >
                      <Check className="w-3 h-3" /> Save Takeoff to Project
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto max-h-48 text-[10px]">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b border-gray-250 bg-gray-50 text-gray-550 font-semibold text-left font-mono text-[8.5px] uppercase tracking-wider">
                        <th className="p-2 pl-3">Material Descriptor</th>
                        <th className="p-2">Model Category</th>
                        <th className="p-2">Dimension Location</th>
                        <th className="p-2 text-right">Measured Qty</th>
                        <th className="p-2 text-right">Unit Price</th>
                        <th className="p-2 text-right pr-3">Total Cost</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {csvPreview.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/55 transition-colors">
                          <td className="p-2 pl-3">
                            <div className="font-bold text-slate-800">{item.elementType}</div>
                            <div className="text-[8px] text-slate-450 font-medium">{item.notes}</div>
                          </td>
                          <td className="p-2 uppercase font-mono text-[8.5px] text-slate-500">
                            {item.category.replace('Structural ', '')}
                          </td>
                          <td className="p-2 text-slate-600 font-medium">{item.sourceLocation}</td>
                          <td className="p-2 text-right font-mono font-bold text-slate-850">{item.quantity} {item.unit}</td>
                          <td className="p-2 text-right font-mono text-slate-400">${item.unitPrice.toFixed(2)}</td>
                          <td className="p-2 text-right font-mono font-bold text-blue-600 pr-3">${(item.quantity * item.unitPrice).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Create Form Expanded */}
        {showForm && (
          <form onSubmit={handleSubmit} className="p-3 bg-gray-50 border-b border-gray-200 animate-in slide-in-from-top duration-200 text-[11px]">
            <h4 className="text-[10px] font-bold text-gray-800 uppercase tracking-widest mb-2.5">Record Surveyed Takeoff Element</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-2">
              <div>
                <label className="block text-[9px] text-gray-500 uppercase font-bold mb-0.5">Category</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full bg-white border border-gray-200 rounded p-1.5 text-[11px] text-gray-800 outline-none"
                >
                  <option value="Structural Concrete">Structural Concrete</option>
                  <option value="Structural Steel">Structural Steel</option>
                  <option value="HVAC Ductwork">HVAC Ductwork</option>
                  <option value="Electrical Cabling">Electrical Cabling</option>
                  <option value="Plumbing & Drainage">Plumbing & Drainage</option>
                  <option value="Glazing & Curtain Walls">Glazing & Curtain Walls</option>
                  <option value="Masonry & Core Partition">Masonry & Core Partition</option>
                </select>
              </div>

              <div>
                <label className="block text-[9px] text-gray-550 text-gray-500 uppercase font-bold mb-0.5">Element Model Descriptor *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. C30 Rectangular Column 500x505"
                  value={formData.elementType}
                  onChange={(e) => setFormData({ ...formData, elementType: e.target.value })}
                  className="w-full bg-white border border-gray-200 rounded p-1.5 text-[11px] text-gray-800 outline-none"
                />
              </div>

              <div>
                <label className="block text-[9px] text-gray-550 text-gray-500 uppercase font-bold mb-0.5">Location / Zone</label>
                <input
                  type="text"
                  placeholder="e.g. Level 2 Section C Grid C-3"
                  value={formData.sourceLocation}
                  onChange={(e) => setFormData({ ...formData, sourceLocation: e.target.value })}
                  className="w-full bg-white border border-gray-200 rounded p-1.5 text-[11px] text-gray-800 outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-2 mb-3">
              <div>
                <label className="block text-[9px] text-gray-550 text-gray-500 uppercase font-bold mb-0.5">Measured Qty. *</label>
                <input
                  type="number"
                  required
                  step="any"
                  min="0"
                  placeholder="0.0"
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                  className="w-full bg-white border border-gray-200 rounded p-1.5 text-[11px] text-gray-800 outline-none"
                />
              </div>

              <div>
                <label className="block text-[9px] text-gray-550 text-gray-500 uppercase font-bold mb-0.5">Unit</label>
                <select
                  value={formData.unit}
                  onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                  className="w-full bg-white border border-gray-200 rounded p-1.5 text-[11px] text-gray-850 outline-none"
                >
                  <option value="m3">m3 (Cubic Vol)</option>
                  <option value="m2">m2 (Area)</option>
                  <option value="m">m (Linear length)</option>
                  <option value="pcs">pcs (Item Count)</option>
                  <option value="kg">kg (Weight)</option>
                </select>
              </div>

              <div>
                <label className="block text-[9px] text-gray-550 text-gray-500 uppercase font-bold mb-0.5">Price Per Unit (USD) *</label>
                <input
                  type="number"
                  required
                  step="any"
                  min="0"
                  placeholder="0.0"
                  value={formData.unitPrice}
                  onChange={(e) => setFormData({ ...formData, unitPrice: e.target.value })}
                  className="w-full bg-white border border-gray-200 rounded p-1.5 text-[11px] text-gray-800 outline-none"
                />
              </div>

              <div>
                <label className="block text-[9px] text-gray-550 text-gray-500 uppercase font-bold mb-0.5">Remarks / Notes</label>
                <input
                  type="text"
                  placeholder="Additional survey notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full bg-white border border-gray-200 rounded p-1.5 text-[11px] text-gray-800 outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-1.5 text-[10px] font-bold uppercase tracking-wider">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-2.5 py-1 border border-gray-200 rounded text-gray-500 bg-white hover:bg-gray-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-3 py-1 bg-gray-900 border border-transparent text-white rounded hover:bg-gray-800 cursor-pointer"
              >
                Submit Takeoff
              </button>
            </div>
          </form>
        )}

        {/* Interactive Takeoff list Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-gray-800 text-[11px] text-left">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-gray-400 font-bold text-[9px] uppercase tracking-wider">
                <th className="p-2.5 pl-3">BIM Elements Details</th>
                <th className="p-2.5">Model Category</th>
                <th className="p-2.5">Model Location</th>
                <th className="p-2.5 text-right">Measured Quantity</th>
                <th className="p-2.5 text-right">Unit Price</th>
                <th className="p-2.5 text-right">Total Budget</th>
                <th className="p-2.5 text-center pr-3">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredItems.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50/70 transition-colors group">
                  <td className="p-2.5 pl-3">
                    <div className="font-bold text-gray-900 leading-tight">{item.elementType}</div>
                    <div className="text-[10px] text-gray-400 max-w-sm mt-0.5 font-normal leading-normal">{item.notes}</div>
                  </td>
                  <td className="p-2.5">
                    <span className="bg-gray-150 text-gray-650 bg-gray-100 text-gray-700 font-mono py-0.5 px-2 rounded text-[9px] font-bold inline-block border border-gray-200/50 uppercase leading-none">
                      {item.category.replace('Structural ', '')}
                    </span>
                  </td>
                  <td className="p-2.5 text-gray-600 font-medium">{item.sourceLocation}</td>
                  <td className="p-2.5 text-right font-mono font-bold text-gray-950">
                    {item.quantity.toLocaleString(undefined, { maximumFractionDigits: 2 })} {item.unit}
                  </td>
                  <td className="p-2.5 text-right font-mono text-gray-400">${item.unitPrice.toFixed(2)}</td>
                  <td className="p-2.5 text-right font-mono font-bold text-gray-900">${item.totalPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  <td className="p-2.5 text-center pr-3">
                    <button
                      onClick={() => onDeleteBOQItem(item.id)}
                      className="text-gray-400 hover:text-red-500 p-1 hover:bg-red-50 rounded transition-colors inline-block cursor-pointer"
                      title="Delete Takeoff Item"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </td>
                </tr>
              ))}

              {filteredItems.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center p-6 text-gray-400">
                    <Layers className="w-6 h-6 mx-auto mb-1 opacity-40 text-gray-400" />
                    <p className="text-[11px]">No quantity takeoff items matching your current criteria.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
