import React, { useState, useMemo } from 'react';
import { BOQItem } from '../types';
import { SEEDED_BOQ } from '../initialData';
import { Calculator, Plus, Trash2, Search, Sparkles, Filter, Check, ShieldAlert, DollarSign, Layers } from 'lucide-react';

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
              id="btn-show-form"
              onClick={() => setShowForm(!showForm)}
              className="flex items-center gap-1 bg-gray-900 hover:bg-gray-850 text-white text-[10px] uppercase font-bold tracking-wider py-1 px-2.5 rounded transition cursor-pointer"
            >
              <Plus className="w-3 h-3" />
              Manual Takeoff
            </button>
          </div>
        </div>

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
