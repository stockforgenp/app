/**
 * Backup & Restore Dedicated Management View
 * Features:
 * - Real-time SQLite database record telemetry (Products, Sales, Purchases, Expenses, Staff)
 * - Plain-text SQL script dump generation (.sql) with transaction safety
 * - Binary immutable SQLite database snapshot export (.sqlite)
 * - Universal restore with auto-detection of SQL script vs SQLite binary
 * - Pre-restore confirmation modal with file name, size, and format details
 * - Database reset to fresh clean slate
 * - 100% offline-first with IndexedDB persistence
 */
import React, { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Database,
  Download,
  Upload,
  RotateCcw,
  FileCode,
  HardDrive,
  Layers,
  ShoppingBag,
  Receipt,
  Truck,
  ReceiptText,
  Users,
  CheckCircle2,
  AlertTriangle,
  Info,
} from "lucide-react";
import { subscribeToDbChanges } from "../lib/db/sqliteEngine.ts";
import {
  getDatabaseStats,
  exportSqlDump,
  exportBinaryFile,
  importSqlDump,
  importBinaryFile,
  resetDatabaseRecords,
  type DatabaseStats,
} from "../lib/services/backupService.ts";
import { ConfirmDialog } from "../components/common/ConfirmDialog.tsx";
import { Input } from "../components/common/Input.tsx";
import { useToast } from "../context/ToastContext.tsx";
import { useLanguage } from "../context/LanguageContext.tsx";

interface PendingRestore {
  type: "sql" | "binary";
  name: string;
  size: number;
  sqlData?: string;
  binaryData?: Uint8Array;
}

interface BackupRestoreViewProps {
  onDatabaseRestored?: () => void;
}

export const BackupRestoreView: React.FC<BackupRestoreViewProps> = ({
  onDatabaseRestored,
}) => {
  const { showToast } = useToast();
  const { isNepali } = useLanguage();

  const [stats, setStats] = useState<DatabaseStats>({
    products: 0,
    sales: 0,
    purchases: 0,
    expenses: 0,
    staff: 0,
  });

  const [pendingRestore, setPendingRestore] = useState<PendingRestore | null>(
    null,
  );
  const [isRestoreConfirmOpen, setIsRestoreConfirmOpen] = useState(false);
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  const loadStats = useCallback(() => {
    try {
      setStats(getDatabaseStats());
    } catch (err) {
      console.error("Failed to load database stats:", err);
    }
  }, []);

  useEffect(() => {
    loadStats();
    const unsubscribe = subscribeToDbChanges(() => {
      loadStats();
    });
    return unsubscribe;
  }, [loadStats]);

  const handleExportSqlBackup = () => {
    try {
      const sqlContent = exportSqlDump();
      const blob = new Blob([sqlContent], {
        type: "application/sql;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      a.href = url;
      a.download = `stockforge_backup_${timestamp}.sql`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast(
        isNepali
          ? "एसक्यूएल ब्याकअप स्क्रिप्ट (.sql) सफलतापूर्वक डाउनलोड भयो"
          : "SQL database backup script (.sql) downloaded successfully",
        "success",
      );
    } catch (err: unknown) {
      showToast((err as Error).message, "error", "Export Failed");
    }
  };

  const handleExportBinaryBackup = () => {
    try {
      const binary = exportBinaryFile();
      const blob = new Blob([binary.buffer as ArrayBuffer], {
        type: "application/x-sqlite3",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      a.href = url;
      a.download = `stockforge_backup_${timestamp}.sqlite`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast(
        isNepali
          ? "डाटाबेस बाइनरी (.sqlite) ब्याकअप सफलतापूर्वक डाउनलोड भयो"
          : "SQLite database backup (.sqlite) downloaded successfully",
        "success",
      );
    } catch (err: unknown) {
      showToast((err as Error).message, "error", "Export Failed");
    }
  };

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const buffer = reader.result as ArrayBuffer;
        if (!buffer || buffer.byteLength === 0) {
          throw new Error(
            isNepali
              ? "चयन गरिएको ब्याकअप फाइल खाली छ।"
              : "The selected backup file is empty.",
          );
        }

        // Check for SQLite 3 binary magic header: "SQLite format 3\0"
        const headerBytes = new Uint8Array(buffer.slice(0, 16));
        const magic = "SQLite format 3\0";
        const isSqlite =
          headerBytes.length >= 16 &&
          String.fromCharCode(...headerBytes) === magic;

        if (isSqlite) {
          setPendingRestore({
            type: "binary",
            name: file.name,
            size: file.size,
            binaryData: new Uint8Array(buffer),
          });
        } else {
          // Decode as UTF-8 SQL text script
          const textDecoder = new TextDecoder("utf-8");
          const sqlText = textDecoder.decode(buffer);
          if (!sqlText.trim()) {
            throw new Error(
              isNepali
                ? "एसक्यूएल स्क्रिप्ट खाली छ।"
                : "The SQL backup file is empty.",
            );
          }
          setPendingRestore({
            type: "sql",
            name: file.name,
            size: file.size,
            sqlData: sqlText,
          });
        }
        setIsRestoreConfirmOpen(true);
      } catch (err: unknown) {
        showToast(
          (err as Error).message,
          "error",
          isNepali ? "फाइल अमान्य छ" : "Invalid File",
        );
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = "";
  };

  const handleConfirmRestore = async () => {
    if (!pendingRestore) return;
    setIsRestoring(true);
    try {
      if (pendingRestore.type === "sql" && pendingRestore.sqlData) {
        await importSqlDump(pendingRestore.sqlData);
        showToast(
          isNepali
            ? `डाटाबेस एसक्यूएल फाइलबाट सफलतापूर्वक पुनर्स्थापित भयो (${pendingRestore.name})`
            : `Database successfully restored from SQL script (${pendingRestore.name})`,
          "success",
        );
      } else if (pendingRestore.binaryData) {
        await importBinaryFile(pendingRestore.binaryData);
        showToast(
          isNepali
            ? `डाटाबेस सफलतापूर्वक पुनर्स्थापित भयो (${pendingRestore.name})`
            : `Database successfully restored from backup file (${pendingRestore.name})`,
          "success",
        );
      }
      onDatabaseRestored?.();
      loadStats();
    } catch (err: unknown) {
      showToast((err as Error).message, "error", "Restore Failed");
    } finally {
      setIsRestoring(false);
      setPendingRestore(null);
    }
  };

  const handleConfirmReset = async () => {
    try {
      await resetDatabaseRecords();
      showToast(
        isNepali
          ? "डाटाबेस प्रारम्भिक अवस्थामा रिसेट भयो"
          : "Database reset to initial sample state",
        "success",
      );
      onDatabaseRestored?.();
      loadStats();
    } catch (err: unknown) {
      showToast((err as Error).message, "error", "Reset Failed");
    }
  };

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-150">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-neutral-100 flex items-center gap-2">
                <span>
                  {isNepali
                    ? "डाटाबेस ब्याकअप र पुनर्स्थापना"
                    : "Database Backup & Recovery"}
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  SQLite WASM
                </span>
              </h1>
              <p className="text-xs text-neutral-400 mt-0.5">
                {isNepali
                  ? "एसक्यूएल (.sql) र बाइनरी (.sqlite) फाइल मार्फत डाटा सुरक्षित राख्नुहोस् वा पुनर्स्थापना गर्नुहोस्।"
                  : "Manage offline SQL dumps, binary snapshots, and disaster recovery."}
              </p>
            </div>
          </div>
        </div>

        {/* Offline Engine Badge */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-neutral-900 border border-neutral-800 text-xs text-neutral-400 self-start sm:self-auto">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>
            {isNepali ? "१००% अफलाइन सुरक्षित" : "100% Offline & Private"}
          </span>
        </div>
      </div>

      {/* Database Telemetry Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <motion.div
          whileHover={{ y: -2 }}
          className="p-4 rounded-xl bg-neutral-900 border border-neutral-800 flex flex-col justify-between"
        >
          <div className="flex items-center justify-between text-neutral-400">
            <span className="text-[11px] font-medium">
              {isNepali ? "उत्पादनहरू" : "Products"}
            </span>
            <ShoppingBag className="w-3.5 h-3.5 text-indigo-400" />
          </div>
          <div className="mt-2 text-xl font-bold font-mono text-neutral-100 tabular-nums">
            {stats.products}
          </div>
        </motion.div>

        <motion.div
          whileHover={{ y: -2 }}
          className="p-4 rounded-xl bg-neutral-900 border border-neutral-800 flex flex-col justify-between"
        >
          <div className="flex items-center justify-between text-neutral-400">
            <span className="text-[11px] font-medium">
              {isNepali ? "बिक्री बिलहरू" : "Sales"}
            </span>
            <Receipt className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="mt-2 text-xl font-bold font-mono text-neutral-100 tabular-nums">
            {stats.sales}
          </div>
        </motion.div>

        <motion.div
          whileHover={{ y: -2 }}
          className="p-4 rounded-xl bg-neutral-900 border border-neutral-800 flex flex-col justify-between"
        >
          <div className="flex items-center justify-between text-neutral-400">
            <span className="text-[11px] font-medium">
              {isNepali ? "खरिद रेकर्ड" : "Purchases"}
            </span>
            <Truck className="w-3.5 h-3.5 text-sky-400" />
          </div>
          <div className="mt-2 text-xl font-bold font-mono text-neutral-100 tabular-nums">
            {stats.purchases}
          </div>
        </motion.div>

        <motion.div
          whileHover={{ y: -2 }}
          className="p-4 rounded-xl bg-neutral-900 border border-neutral-800 flex flex-col justify-between"
        >
          <div className="flex items-center justify-between text-neutral-400">
            <span className="text-[11px] font-medium">
              {isNepali ? "खर्चहरू" : "Expenses"}
            </span>
            <ReceiptText className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="mt-2 text-xl font-bold font-mono text-neutral-100 tabular-nums">
            {stats.expenses}
          </div>
        </motion.div>

        <motion.div
          whileHover={{ y: -2 }}
          className="p-4 rounded-xl bg-neutral-900 border border-neutral-800 flex flex-col justify-between col-span-2 sm:col-span-1"
        >
          <div className="flex items-center justify-between text-neutral-400">
            <span className="text-[11px] font-medium">
              {isNepali ? "कर्मचारी" : "Staff"}
            </span>
            <Users className="w-3.5 h-3.5 text-purple-400" />
          </div>
          <div className="mt-2 text-xl font-bold font-mono text-neutral-100 tabular-nums">
            {stats.staff}
          </div>
        </motion.div>
      </div>

      {/* Main Actions Grid: Backup vs Restore */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* BACKUP SECTION */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 flex flex-col justify-between space-y-6">
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-neutral-800">
              <Download className="w-4 h-4 text-emerald-400" />
              <h2 className="text-sm font-semibold text-neutral-100">
                {isNepali
                  ? "१. डाटाबेस ब्याकअप (Export)"
                  : "1. Export Database Backup"}
              </h2>
            </div>

            <p className="text-xs text-neutral-400 leading-relaxed">
              {isNepali
                ? "तपाईंको सबै व्यापारिक विवरणहरू (सामान, स्टक, ग्राहक, बिक्री, खरिद, खर्च र कर्मचारी) कम्प्युटरमा सुरक्षित राख्न ब्याकअप लिनुहोस्।"
                : "Create a complete snapshot of your catalog, stock history, vendors, sales, purchases, expenses, and staff data."}
            </p>

            <div className="space-y-3 pt-2">
              {/* Option A: SQL Script */}
              <div className="p-3.5 rounded-lg bg-neutral-950 border border-neutral-800 flex items-start gap-3">
                <FileCode className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-neutral-200">
                    {isNepali
                      ? "एसक्यूएल डम्प (.sql)"
                      : "SQL Script Dump (.sql)"}
                  </div>
                  <div className="text-[11px] text-neutral-500 mt-0.5">
                    {isNepali
                      ? "मानव-पढ्न मिल्ने टेक्स्ट स्क्रिप्ट, जुनसुकै SQLite वा टेक्स्ट एडिटरमा खोल्न सकिन्छ।"
                      : "Human-readable script with DROP/CREATE TABLE and INSERT statements."}
                  </div>
                </div>
              </div>

              {/* Option B: SQLite Binary */}
              <div className="p-3.5 rounded-lg bg-neutral-950 border border-neutral-800 flex items-start gap-3">
                <HardDrive className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-neutral-200">
                    {isNepali
                      ? "बाइनरी डाटाबेस (.sqlite)"
                      : "Binary Database (.sqlite)"}
                  </div>
                  <div className="text-[11px] text-neutral-500 mt-0.5">
                    {isNepali
                      ? "अपरिवर्तनीय बाइनरी स्न्यापसट, DB Browser for SQLite मार्फत सिधै खोल्न सकिन्छ।"
                      : "Immutable binary snapshot, compatible with standard SQLite tools."}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              type="button"
              onClick={handleExportSqlBackup}
              className="flex-1 py-2.5 px-4 text-xs font-semibold text-neutral-900 bg-emerald-400 hover:bg-emerald-300 rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-xs"
              title={
                isNepali
                  ? "एसक्यूएल डम्प स्क्रिप्ट डाउनलोड गर्नुहोस्"
                  : "Download plain-text SQL dump script"
              }
            >
              <FileCode className="w-4 h-4" />
              <span>
                {isNepali ? "डाउनलोड .sql डम्प" : "Download .sql Dump"}
              </span>
            </button>

            <button
              type="button"
              onClick={handleExportBinaryBackup}
              className="py-2.5 px-4 text-xs font-semibold text-neutral-200 bg-neutral-800 hover:bg-neutral-700 rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer"
              title={
                isNepali
                  ? "बाइनरी .sqlite फाइल डाउनलोड गर्नुहोस्"
                  : "Download binary .sqlite file"
              }
            >
              <Download className="w-4 h-4" />
              <span>.sqlite File</span>
            </button>
          </div>
        </div>

        {/* RESTORE SECTION */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 flex flex-col justify-between space-y-6">
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-neutral-800">
              <Upload className="w-4 h-4 text-sky-400" />
              <h2 className="text-sm font-semibold text-neutral-100">
                {isNepali
                  ? "२. डाटाबेस पुनर्स्थापना (Restore)"
                  : "2. Restore Database"}
              </h2>
            </div>

            <p className="text-xs text-neutral-400 leading-relaxed">
              {isNepali
                ? "पहिले ब्याकअप गरिएको .sql वा .sqlite फाइल अपलोड गरी सम्पूर्ण डाटा पुनर्स्थापित गर्नुहोस्।"
                : "Restore your application state from a previously exported .sql script or .sqlite binary file."}
            </p>

            <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-800/80 space-y-3">
              <div className="flex items-center gap-2 text-xs font-medium text-neutral-300">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>
                  {isNepali
                    ? "स्वचालित फाइल पहिचान (.sql वा .sqlite)"
                    : "Automatic Format Detection"}
                </span>
              </div>
              <p className="text-[11px] text-neutral-500 leading-relaxed">
                {isNepali
                  ? "प्रणालीले स्वतः फाइलको प्रकार (SQL स्क्रिप्ट वा बाइनरी SQLite) पत्ता लगाई सुरक्षित कारोबार मार्फत डाटा पुनर्स्थापित गर्छ।"
                  : "The recovery engine automatically parses SQL dump scripts or binary database headers to safely verify and apply records."}
              </p>

              <div className="flex items-center gap-2 text-[11px] text-amber-400/90 bg-amber-500/10 border border-amber-500/20 px-3 py-2 rounded-lg">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span>
                  {isNepali
                    ? "पुनर्स्थापना गर्दा हालको डाटा बदलिनेछ।"
                    : "Restoring will replace all current data."}
                </span>
              </div>
            </div>
          </div>

          <div>
            <label className="w-full py-2.5 px-4 text-xs font-semibold text-neutral-100 bg-sky-600 hover:bg-sky-500 rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-xs">
              <Upload className="w-4 h-4" />
              <span>
                {isNepali
                  ? ".sql वा .sqlite फाइल छान्नुहोस्..."
                  : "Select Backup File (.sql or .sqlite)..."}
              </span>
              <Input
                type="file"
                accept=".sql,.sqlite,.db"
                onChange={handleFileSelected}
                className="hidden"
              />
            </label>
          </div>
        </div>
      </div>

      {/* Danger Zone: Reset Database */}
      <div className="p-6 rounded-xl bg-neutral-900 border border-neutral-800 space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-rose-400">
          <AlertTriangle className="w-4 h-4" />
          <span>{isNepali ? "खतरा क्षेत्र (Danger Zone)" : "Danger Zone"}</span>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
          <div>
            <div className="text-xs font-medium text-neutral-200">
              {isNepali
                ? "डाटाबेस रिसेट / खाली गर्नुहोस्"
                : "Clear & Reset Database"}
            </div>
            <div className="text-[11px] text-neutral-500 mt-0.5">
              {isNepali
                ? "सबै बिक्री, खरिद, उत्पादन, खर्च र कर्मचारी विवरणहरू पूर्ण रूपमा मेटाएर नयाँ सफा सुरुआत गर्दछ।"
                : "Permanently wipes all transactions, movements, products, expenses, and staff data for a clean slate."}
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsResetConfirmOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 rounded-lg transition-colors cursor-pointer shrink-0"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>
              {isNepali ? "डाटाबेस रिसेट गर्नुहोस्" : "Reset Database"}
            </span>
          </button>
        </div>
      </div>

      {/* Confirmation Dialog: Restore Backup */}
      <ConfirmDialog
        isOpen={isRestoreConfirmOpen}
        onClose={() => {
          if (!isRestoring) {
            setIsRestoreConfirmOpen(false);
            setPendingRestore(null);
          }
        }}
        onConfirm={handleConfirmRestore}
        title={
          isNepali
            ? "डाटाबेस पुनर्स्थापित (Restore) गर्ने हो?"
            : "Restore Database from Backup?"
        }
        message={
          pendingRestore
            ? isNepali
              ? `"${pendingRestore.name}" (${(pendingRestore.size / 1024).toFixed(1)} KB, ${pendingRestore.type === "sql" ? "SQL स्क्रिप्ट" : "SQLite बाइनरी"}) बाट डाटा पुनर्स्थापना गर्दा हालको सबै उत्पादन, स्टक र कारोबारहरू नयाँ फाइल अनुसार बदलिनेछ। यो प्रक्रिया रद्द गर्न सकिँदैन।`
              : `Restoring from "${pendingRestore.name}" (${(pendingRestore.size / 1024).toFixed(1)} KB, ${pendingRestore.type === "sql" ? "SQL Script" : "SQLite Binary"}) will permanently REPLACE all current products, stock levels, and historical transactions with the uploaded backup. This operation cannot be undone.`
            : "Restoring from a backup file will permanently REPLACE all current products, stock levels, and historical transactions with the uploaded file data. This operation cannot be undone."
        }
        confirmText={
          isNepali
            ? "डाटा बदल्नुहोस् र पुनर्स्थापना गर्नुहोस्"
            : "Replace & Restore Data"
        }
        isDestructive={true}
      />

      {/* Confirmation Dialog: Reset Database */}
      <ConfirmDialog
        isOpen={isResetConfirmOpen}
        onClose={() => setIsResetConfirmOpen(false)}
        onConfirm={handleConfirmReset}
        title={
          isNepali
            ? "डाटाबेस खाली र रिसेट गर्ने हो?"
            : "Clear & Reset Database?"
        }
        message={
          isNepali
            ? "यसले हालका सबै उत्पादनहरू, मौज्दात चलान, कारोबार, खर्च र कर्मचारी रेकर्डहरू पूर्ण रूपमा मेटाउनेछ। के तपाईं साँच्चै नयाँ सुरुआत गर्न चाहनुहुन्छ?"
            : "This will completely wipe all current products, inventory movements, transactions, expenses, and staff records. Are you sure you wish to start with a clean slate?"
        }
        confirmText={isNepali ? "सबै डाटा मेटाउनुहोस्" : "Clear All Data"}
        isDestructive={true}
      />
    </div>
  );
};
