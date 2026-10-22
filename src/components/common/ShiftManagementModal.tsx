/**
 * Cash Drawer & Shift Management Modal (Z-Report & Reconciliation)
 * Manages cashier shifts: opening float, real-time drawer tracking,
 * physical cash counting, over/short variance calculation, and closure slips.
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Wallet,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Printer,
  History,
  Lock,
  Unlock,
  DollarSign,
  Receipt,
  FileText,
  User,
  Plus,
} from 'lucide-react';
import { ShiftSession } from '../../types/index.ts';
import {
  getCurrentOpenShift,
  openShift,
  closeShift,
  getShiftLiveMetrics,
  getAllShifts,
  ShiftLiveMetrics,
} from '../../lib/services/shiftService.ts';
import { formatCurrency, toMinorUnits, fromMinorUnits, formatDateTime } from '../../lib/utils/format.ts';
import { useLanguage } from '../../context/LanguageContext.tsx';
import { useToast } from '../../context/ToastContext.tsx';
import { getAllStaff } from '../../lib/services/staffService.ts';

export interface ShiftManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  currencySymbol: string;
  storeName?: string;
}

export const ShiftManagementModal: React.FC<ShiftManagementModalProps> = ({
  isOpen,
  onClose,
  currencySymbol,
  storeName = 'StockForge Retail',
}) => {
  const { isNepali } = useLanguage();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<'CURRENT' | 'HISTORY'>('CURRENT');
  const [currentShift, setCurrentShift] = useState<ShiftSession | null>(null);
  const [liveMetrics, setLiveMetrics] = useState<ShiftLiveMetrics | null>(null);
  const [allShifts, setAllShifts] = useState<ShiftSession[]>([]);
  const [staffList, setStaffList] = useState<{ id: number; name: string }[]>([]);

  // Open Shift Form State
  const [cashierName, setCashierName] = useState('Counter 1');
  const [selectedStaffId, setSelectedStaffId] = useState<number | ''>('');
  const [openingFloat, setOpeningFloat] = useState('2000');
  const [openNotes, setOpenNotes] = useState('');

  // Close Shift Form State
  const [closingCashInput, setClosingCashInput] = useState('');
  const [closeNotes, setCloseNotes] = useState('');
  const [closedShiftForReceipt, setClosedShiftForReceipt] = useState<ShiftSession | null>(null);

  const printSlipRef = useRef<HTMLDivElement>(null);

  const loadData = () => {
    try {
      const active = getCurrentOpenShift();
      setCurrentShift(active);
      if (active) {
        const m = getShiftLiveMetrics(active.id);
        setLiveMetrics(m);
        setClosingCashInput(fromMinorUnits(m.expectedDrawerCash).toString());
      } else {
        setLiveMetrics(null);
      }
      setAllShifts(getAllShifts());
      const staff = getAllStaff();
      setStaffList(staff.map((s) => ({ id: s.id, name: s.name })));
    } catch (e) {
      console.error('Failed to load shift data:', e);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  // Open Shift Handler
  const handleOpenShift = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cashierName.trim()) {
      showToast(isNepali ? 'क्यासियरको नाम लेख्नुहोस्।' : 'Cashier name is required.', 'warning');
      return;
    }

    try {
      const floatMinor = toMinorUnits(openingFloat || '0');
      const shift = openShift({
        cashierName: cashierName.trim(),
        staffId: selectedStaffId ? Number(selectedStaffId) : undefined,
        openingFloat: floatMinor,
        notes: openNotes.trim() || undefined,
      });

      showToast(
        isNepali
          ? `सिफ्ट #${shift.id} सुरु भयो (ओपनिङ: ${formatCurrency(shift.opening_float, currencySymbol)})`
          : `Shift #${shift.id} opened with ${formatCurrency(shift.opening_float, currencySymbol)} float!`,
        'success'
      );

      loadData();
    } catch (err: unknown) {
      showToast((err as Error).message, 'error');
    }
  };

  // Close Shift Handler
  const handleCloseShift = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentShift) return;

    try {
      const countedMinor = toMinorUnits(closingCashInput || '0');
      const closed = closeShift({
        shiftId: currentShift.id,
        closingCash: countedMinor,
        notes: closeNotes.trim() || undefined,
      });

      showToast(
        isNepali
          ? `सिफ्ट #${closed.id} बन्द भयो। ड्रयर रिकन्सिलिएसन सम्पन्न!`
          : `Shift #${closed.id} closed and reconciled!`,
        'success'
      );

      setClosedShiftForReceipt(closed);
      loadData();
    } catch (err: unknown) {
      showToast((err as Error).message, 'error');
    }
  };

  const calculatedVariance = useMemo(() => {
    if (!liveMetrics) return 0;
    const counted = toMinorUnits(closingCashInput || '0');
    return counted - liveMetrics.expectedDrawerCash;
  }, [closingCashInput, liveMetrics]);

  const handlePrintSlip = () => {
    window.print();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-neutral-950/80 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-3xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="px-5 py-4 border-b border-neutral-800 flex items-center justify-between bg-neutral-950/60 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className={`p-2 rounded-xl border ${
                currentShift
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                  : 'bg-neutral-800 text-neutral-400 border-neutral-700'
              }`}>
                <Wallet className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-bold text-neutral-100 flex items-center gap-2">
                  <span>{isNepali ? 'काउन्टर तथा सिफ्ट व्यवस्थापन' : 'Cash Drawer & Shift Management'}</span>
                  {currentShift ? (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 font-semibold border border-emerald-500/30 flex items-center gap-1">
                      <Unlock className="w-3 h-3" />
                      <span>{isNepali ? 'सिफ्ट खुला' : 'Shift Active'}</span>
                    </span>
                  ) : (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-400 font-semibold border border-neutral-700 flex items-center gap-1">
                      <Lock className="w-3 h-3" />
                      <span>{isNepali ? 'सिफ्ट बन्द' : 'No Open Shift'}</span>
                    </span>
                  )}
                </h2>
                <p className="text-xs text-neutral-400">
                  {isNepali
                    ? 'ओपनिङ फ्लोट, दिनभरको नगद संकलन र काउन्टर रिकन्सिलिएसन।'
                    : 'Opening float, live drawer balance, physical count & day-end closure.'}
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Bar */}
          <div className="px-5 py-2.5 bg-neutral-950/40 border-b border-neutral-800/80 flex items-center gap-2 shrink-0">
            <button
              onClick={() => setActiveTab('CURRENT')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                activeTab === 'CURRENT'
                  ? 'bg-neutral-800 text-neutral-100 border border-neutral-700'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>{currentShift ? (isNepali ? 'सक्रिय सिफ्ट (Active)' : 'Active Shift') : (isNepali ? 'नयाँ सिफ्ट खोल्नुहोस्' : 'Open Shift')}</span>
            </button>

            <button
              onClick={() => setActiveTab('HISTORY')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                activeTab === 'HISTORY'
                  ? 'bg-neutral-800 text-neutral-100 border border-neutral-700'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>{isNepali ? 'सिफ्ट इतिहास' : 'Shift History'} ({allShifts.length})</span>
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-5">
            {activeTab === 'CURRENT' && (
              <div>
                {!currentShift ? (
                  /* ==================== OPEN NEW SHIFT FORM ==================== */
                  <form onSubmit={handleOpenShift} className="max-w-lg mx-auto py-4 space-y-4">
                    <div className="p-4 rounded-xl bg-neutral-950/60 border border-neutral-800 text-center">
                      <Lock className="w-8 h-8 text-neutral-500 mx-auto mb-2" />
                      <h3 className="text-sm font-bold text-neutral-100">
                        {isNepali ? 'काउन्टर सिफ्ट सुरु गर्नुहोस्' : 'Start a Cashier Shift'}
                      </h3>
                      <p className="text-xs text-neutral-400 mt-1">
                        {isNepali
                          ? 'काउन्टरमा खुद्रा रकम (ओपनिङ फ्लोट) राखेर दिनको कारोबार सुरु गर्नुहोस्।'
                          : 'Set starting drawer cash float to unlock the register and track cash accurately.'}
                      </p>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-medium text-neutral-300 mb-1">
                          {isNepali ? 'क्यासियर / काउन्टरको नाम' : 'Cashier / Counter Name'} *
                        </label>
                        <input
                          type="text"
                          value={cashierName}
                          onChange={(e) => setCashierName(e.target.value)}
                          placeholder="e.g. Counter 1 / Cashier"
                          className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-xs text-neutral-100 focus:outline-none focus:border-emerald-500"
                        />
                      </div>

                      {staffList.length > 0 && (
                        <div>
                          <label className="block text-xs font-medium text-neutral-300 mb-1">
                            {isNepali ? 'कर्मचारी छान्नुहोस् (ऐच्छिक)' : 'Linked Staff Member (Optional)'}
                          </label>
                          <select
                            value={selectedStaffId}
                            onChange={(e) => setSelectedStaffId(e.target.value ? Number(e.target.value) : '')}
                            className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-xs text-neutral-100 focus:outline-none focus:border-emerald-500"
                          >
                            <option value="">-- {isNepali ? 'कर्मचारी' : 'Staff Profile'} --</option>
                            {staffList.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      <div>
                        <label className="block text-xs font-medium text-neutral-300 mb-1">
                          {isNepali ? 'प्रारम्भिक क्यास / ओपनिङ फ्लोट' : `Opening Cash Float (${currencySymbol})`} *
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-2.5 text-xs text-neutral-500 font-mono">
                            {currencySymbol}
                          </span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={openingFloat}
                            onChange={(e) => setOpeningFloat(e.target.value)}
                            placeholder="2000"
                            className="w-full bg-neutral-950 border border-neutral-800 rounded-lg pl-8 pr-3 py-2 text-xs text-emerald-400 font-mono font-bold focus:outline-none focus:border-emerald-500"
                          />
                        </div>
                        <p className="text-[10px] text-neutral-500 mt-1">
                          {isNepali
                            ? 'दिनको सुरुमा ड्रयरमा राखिएको खुद्रा/चेन्ज रकम।'
                            : 'Coins and change placed in the till at the beginning of the shift.'}
                        </p>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-neutral-300 mb-1">
                          {isNepali ? 'कैफियत (Notes)' : 'Shift Notes (Optional)'}
                        </label>
                        <input
                          type="text"
                          value={openNotes}
                          onChange={(e) => setOpenNotes(e.target.value)}
                          placeholder="e.g. Morning Shift, 100/50 notes"
                          className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-xs text-neutral-100 focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/20 transition-colors flex items-center justify-center gap-2"
                    >
                      <Unlock className="w-4 h-4" />
                      <span>{isNepali ? 'सिफ्ट सुरु गर्नुहोस् (Open Till)' : 'Open Shift & Unlock Till'}</span>
                    </button>
                  </form>
                ) : (
                  /* ==================== ACTIVE SHIFT RECONCILIATION ==================== */
                  <div className="space-y-5">
                    {/* Shift Info Banner */}
                    <div className="p-4 rounded-xl bg-neutral-950/80 border border-neutral-800 flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-sm text-neutral-100">
                            Shift #{currentShift.id}
                          </span>
                          <span className="text-xs px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 font-semibold border border-emerald-500/20">
                            {currentShift.cashier_name}
                          </span>
                        </div>
                        <div className="text-[11px] text-neutral-400 mt-1 flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-neutral-500" />
                          <span>Started: {formatDateTime(currentShift.opened_at)}</span>
                        </div>
                      </div>

                      <div className="text-right font-mono">
                        <div className="text-[10px] text-neutral-400 uppercase">Opening Float</div>
                        <div className="text-sm font-bold text-neutral-200">
                          {formatCurrency(currentShift.opening_float, currencySymbol)}
                        </div>
                      </div>
                    </div>

                    {/* Live KPIs Grid */}
                    {liveMetrics && (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="p-3 rounded-xl bg-neutral-950/60 border border-neutral-800">
                          <div className="text-[10px] font-bold text-neutral-400 uppercase">
                            {isNepali ? 'नगद बिक्री' : 'Cash Sales'}
                          </div>
                          <div className="text-sm font-bold text-emerald-400 font-mono mt-0.5">
                            +{formatCurrency(liveMetrics.cashSales, currencySymbol)}
                          </div>
                          <div className="text-[9px] text-neutral-500 mt-0.5">
                            {liveMetrics.totalTransactionsCount} transactions
                          </div>
                        </div>

                        <div className="p-3 rounded-xl bg-neutral-950/60 border border-neutral-800">
                          <div className="text-[10px] font-bold text-neutral-400 uppercase">
                            {isNepali ? 'उधारो बिक्री' : 'Credit Dues'}
                          </div>
                          <div className="text-sm font-bold text-amber-400 font-mono mt-0.5">
                            {formatCurrency(liveMetrics.creditSales, currencySymbol)}
                          </div>
                          <div className="text-[9px] text-neutral-500 mt-0.5">Customer balance</div>
                        </div>

                        <div className="p-3 rounded-xl bg-neutral-950/60 border border-neutral-800">
                          <div className="text-[10px] font-bold text-neutral-400 uppercase">
                            {isNepali ? 'फिर्ता / खर्च' : 'Refunds & Exp'}
                          </div>
                          <div className="text-sm font-bold text-rose-400 font-mono mt-0.5">
                            -{formatCurrency(liveMetrics.cashRefunds + liveMetrics.cashExpenses, currencySymbol)}
                          </div>
                          <div className="text-[9px] text-neutral-500 mt-0.5">Paid from till</div>
                        </div>

                        <div className="p-3 rounded-xl bg-cyan-950/30 border border-cyan-800/40">
                          <div className="text-[10px] font-bold text-cyan-300 uppercase">
                            {isNepali ? 'अपेक्षित क्यास' : 'Expected Cash'}
                          </div>
                          <div className="text-sm font-bold text-cyan-300 font-mono mt-0.5">
                            {formatCurrency(liveMetrics.expectedDrawerCash, currencySymbol)}
                          </div>
                          <div className="text-[9px] text-cyan-500 mt-0.5">System calculation</div>
                        </div>
                      </div>
                    )}

                    {/* Close Shift & Day-end Reconciliation Form */}
                    <form onSubmit={handleCloseShift} className="p-4 rounded-xl bg-neutral-950/80 border border-neutral-800 space-y-4">
                      <div className="flex items-center justify-between pb-2 border-b border-neutral-800">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-200 flex items-center gap-2">
                          <Lock className="w-4 h-4 text-amber-400" />
                          <span>{isNepali ? 'सिफ्ट क्लोजिङ तथा ड्रयर हिसाब' : 'Close Shift & Reconcile Cash'}</span>
                        </h3>
                        <span className="text-[11px] text-neutral-400">
                          {isNepali ? 'गनेको नगद प्रविष्टि गर्नुहोस्' : 'Enter physically counted cash'}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-medium text-neutral-300 mb-1">
                            {isNepali ? 'वास्तविक गनेको नगद (Physical Count)' : `Physically Counted Cash (${currencySymbol})`} *
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={closingCashInput}
                            onChange={(e) => setClosingCashInput(e.target.value)}
                            className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-neutral-100 font-mono font-bold focus:outline-none focus:border-amber-500"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-neutral-300 mb-1">
                            {isNepali ? 'अन्तर / विचलन (Variance)' : 'Variance (Over / Short)'}
                          </label>
                          <div className={`px-3 py-2 rounded-lg border font-mono font-bold text-sm flex items-center justify-between ${
                            calculatedVariance === 0
                              ? 'bg-emerald-950/50 text-emerald-300 border-emerald-800/60'
                              : calculatedVariance > 0
                              ? 'bg-amber-950/50 text-amber-300 border-amber-800/60'
                              : 'bg-rose-950/50 text-rose-300 border-rose-800/60'
                          }`}>
                            <span>
                              {calculatedVariance === 0
                                ? isNepali ? 'सन्तुलित (Balanced)' : 'Exact Balanced'
                                : calculatedVariance > 0
                                ? isNepali ? `बढी (+${formatCurrency(calculatedVariance, currencySymbol)})` : `Cash Over (+${formatCurrency(calculatedVariance, currencySymbol)})`
                                : isNepali ? `घटी / घाटा (${formatCurrency(calculatedVariance, currencySymbol)})` : `Cash Short (${formatCurrency(calculatedVariance, currencySymbol)})`}
                            </span>
                            {calculatedVariance === 0 ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                            ) : (
                              <AlertTriangle className="w-4 h-4 text-amber-400" />
                            )}
                          </div>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-neutral-300 mb-1">
                          {isNepali ? 'क्लोजिङ कैफियत' : 'Closing Remarks'}
                        </label>
                        <input
                          type="text"
                          value={closeNotes}
                          onChange={(e) => setCloseNotes(e.target.value)}
                          placeholder="e.g. Clean handover, deposit to safe"
                          className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-neutral-100 focus:outline-none focus:border-amber-500"
                        />
                      </div>

                      <div className="pt-2 flex justify-end">
                        <button
                          type="submit"
                          className="py-2.5 px-6 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs shadow-lg shadow-amber-600/20 transition-colors flex items-center gap-2"
                        >
                          <Lock className="w-4 h-4" />
                          <span>{isNepali ? 'सिफ्ट बन्द गर्नुहोस् (Close & Generate Z-Slip)' : 'Close Shift & Finalize Audit'}</span>
                        </button>
                      </div>
                    </form>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'HISTORY' && (
              <div className="space-y-3">
                {allShifts.length === 0 ? (
                  <div className="p-8 text-center text-xs text-neutral-500">
                    {isNepali ? 'कुनै सिफ्ट रेकर्ड छैन।' : 'No shift records found.'}
                  </div>
                ) : (
                  <div className="overflow-x-auto bg-neutral-950/60 rounded-xl border border-neutral-800">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-neutral-900 text-neutral-400 font-medium border-b border-neutral-800">
                        <tr>
                          <th className="py-2.5 px-3">Shift ID</th>
                          <th className="py-2.5 px-3">Cashier</th>
                          <th className="py-2.5 px-3 text-right">Opening</th>
                          <th className="py-2.5 px-3 text-right">Closing Cash</th>
                          <th className="py-2.5 px-3 text-right">Variance</th>
                          <th className="py-2.5 px-3 text-center">Status</th>
                          <th className="py-2.5 px-3">Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-800/60 font-mono">
                        {allShifts.map((s) => (
                          <tr key={s.id} className="hover:bg-neutral-800/30">
                            <td className="py-2.5 px-3 font-bold text-neutral-200">#{s.id}</td>
                            <td className="py-2.5 px-3 font-sans font-medium text-neutral-300">
                              {s.cashier_name}
                            </td>
                            <td className="py-2.5 px-3 text-right text-neutral-300">
                              {formatCurrency(s.opening_float, currencySymbol)}
                            </td>
                            <td className="py-2.5 px-3 text-right font-bold text-neutral-100">
                              {s.closing_cash !== null && s.closing_cash !== undefined
                                ? formatCurrency(s.closing_cash, currencySymbol)
                                : '-'}
                            </td>
                            <td className={`py-2.5 px-3 text-right font-bold ${
                              (s.variance ?? 0) === 0
                                ? 'text-emerald-400'
                                : (s.variance ?? 0) > 0
                                ? 'text-amber-400'
                                : 'text-rose-400'
                            }`}>
                              {(s.variance ?? 0) > 0 ? '+' : ''}
                              {formatCurrency(s.variance ?? 0, currencySymbol)}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-sans font-semibold ${
                                s.status === 'OPEN'
                                  ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                                  : 'bg-neutral-800 text-neutral-400'
                              }`}>
                                {s.status}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-neutral-400 text-[11px] font-sans">
                              {new Date(s.opened_at).toLocaleDateString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

