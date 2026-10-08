/**
 * Backup & Restore Dedicated Management View
 * Features:
 * - Real-time SQLite database record telemetry (Products, Sales, Purchases, Expenses, Staff)
 * - Plain-text SQL script dump generation (.sql) with transaction safety
 * - Binary immutable SQLite database snapshot export (.sqlite)
 * - Universal restore with auto-detection of SQL script vs SQLite binary
 * - Pre-restore confirmation modal with file name, size, and format details
 * - Google Sheets Cloud Sync:
 *   * OAuth2 Authentication with Google Identity Services (asking for user permission)
 *   * Auto-detection or creation of "StockForge POS - Database Backup" spreadsheet
 *   * Full structured multi-sheet backup (Overview, Products, Sales, Purchases, Vendors, etc.) + full SQL Dump
 *   * Instant cloud restore with pre-restore inspection modal & transaction rollback safety
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
  ShoppingBag,
  Receipt,
  Truck,
  ReceiptText,
  Users,
  CheckCircle2,
  AlertTriangle,
  Cloud,
  CloudUpload,
  CloudDownload,
  ExternalLink,
  Settings,
  RefreshCw,
  FileSpreadsheet,
  LogOut,
  Info,
  Loader2,
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
import {
  getGoogleSyncConfig,
  saveGoogleSyncConfig,
  authenticateWithGoogle,
  getOrCreateBackupSpreadsheet,
  exportDatabaseToGoogleSheets,
  inspectGoogleSheetForRestore,
  executeRestoreFromGoogleSheet,
  clearGoogleAuthSession,
  getActiveAccessToken,
  type GoogleRestorePreview,
  type GoogleSyncConfig,
} from "../lib/services/googleSheetsService.ts";
import { ConfirmDialog } from "../components/common/ConfirmDialog.tsx";
import { Modal } from "../components/common/Modal.tsx";
import { Input } from "../components/common/Input.tsx";
import { useToast } from "../context/ToastContext.tsx";
import { useLanguage } from "../context/LanguageContext.tsx";
import { useAuth } from "../context/AuthContext.tsx";

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
  const { currentShop } = useAuth();

  const [stats, setStats] = useState<DatabaseStats>({
    products: 0,
    sales: 0,
    purchases: 0,
    expenses: 0,
    staff: 0,
  });

  // Local File Restore State
  const [pendingRestore, setPendingRestore] = useState<PendingRestore | null>(null);
  const [isRestoreConfirmOpen, setIsRestoreConfirmOpen] = useState(false);
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  // Google Sheets Cloud Sync State
  const [googleConfig, setGoogleConfig] = useState<GoogleSyncConfig>(getGoogleSyncConfig);
  const [isGoogleConfigModalOpen, setIsGoogleConfigModalOpen] = useState(false);
  const [isGoogleRestoreConfirmOpen, setIsGoogleRestoreConfirmOpen] = useState(false);
  const [googleRestorePreview, setGoogleRestorePreview] = useState<GoogleRestorePreview | null>(null);
  const [isGoogleBackingUp, setIsGoogleBackingUp] = useState(false);
  const [isGoogleRestoring, setIsGoogleRestoring] = useState(false);
  const [googleStatusMessage, setGoogleStatusMessage] = useState<string>("");

  // Google Config Modal Form Fields
  const [inputClientId, setInputClientId] = useState(googleConfig.clientId);
  const [inputSheetId, setInputSheetId] = useState(googleConfig.sheetId);

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

  useEffect(() => {
    setGoogleConfig(getGoogleSyncConfig());
  }, []);

  // -------------------------------------------------------------
  // LOCAL FILE BACKUP & RESTORE
  // -------------------------------------------------------------
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
        "success"
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
        "success"
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
              : "The selected backup file is empty."
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
                : "The SQL backup file is empty."
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
          isNepali ? "फाइल अमान्य छ" : "Invalid File"
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
          "success"
        );
      } else if (pendingRestore.binaryData) {
        await importBinaryFile(pendingRestore.binaryData);
        showToast(
          isNepali
            ? `डाटाबेस सफलतापूर्वक पुनर्स्थापित भयो (${pendingRestore.name})`
            : `Database successfully restored from backup file (${pendingRestore.name})`,
          "success"
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
        "success"
      );
      onDatabaseRestored?.();
      loadStats();
    } catch (err: unknown) {
      showToast((err as Error).message, "error", "Reset Failed");
    }
  };

  // -------------------------------------------------------------
  // GOOGLE SHEETS CLOUD SYNC: BACKUP & RESTORE
  // -------------------------------------------------------------

  /**
   * Helper: Ensure client ID is provided or open settings modal
   */
  const ensureGoogleClientId = (): string | null => {
    const config = getGoogleSyncConfig();
    if (!config.clientId.trim() && !getActiveAccessToken()) {
      setInputClientId(config.clientId);
      setInputSheetId(config.sheetId);
      setIsGoogleConfigModalOpen(true);
      showToast(
        isNepali
          ? "कृपया सुरु गर्नु अघि गुगल क्लाउड क्लाइन्ट आईडी (Client ID) प्रविष्ट गर्नुहोस्।"
          : "Please enter your Google OAuth Client ID to connect your Google account.",
        "info",
        "Google Setup Required"
      );
      return null;
    }
    return config.clientId.trim();
  };

  /**
   * BACKUP TO GOOGLE SHEETS:
   * 1. Authenticate with Google (OAuth2 consent)
   * 2. Find existing or create "StockForge POS - Database Backup" sheet
   * 3. Export all tables + full SQL dump
   */
  const handleGoogleSheetsBackup = async () => {
    const clientId = ensureGoogleClientId();
    if (!clientId && !getActiveAccessToken()) return;

    setIsGoogleBackingUp(true);
    setGoogleStatusMessage(
      isNepali ? "गुगलसँग प्रमाणीकरण हुँदैछ..." : "Authenticating with Google..."
    );

    try {
      // 1. Authenticate & request permission
      const accessToken = await authenticateWithGoogle(clientId || "");

      // 2. Locate or create spreadsheet
      setGoogleStatusMessage(
        isNepali
          ? "गुगल स्प्रेडसिट जाँच तथा सिर्जना गरिँदैछ..."
          : "Verifying / Creating backup Google Spreadsheet..."
      );
      const sheetInfo = await getOrCreateBackupSpreadsheet(
        accessToken,
        currentShop?.name
      );

      // 3. Export all SQLite tables + SQL dump
      setGoogleStatusMessage(
        isNepali
          ? "डाटा गुगल सिटमा अपलोड हुँदैछ..."
          : "Uploading all tables & SQL dump to Google Sheet..."
      );
      const result = await exportDatabaseToGoogleSheets(
        accessToken,
        sheetInfo.id,
        currentShop?.name
      );

      // Refresh config state
      const updatedConfig = getGoogleSyncConfig();
      setGoogleConfig(updatedConfig);

      showToast(
        isNepali
          ? `गुगल सिटमा ब्याकअप सम्पन्न भयो (${result.totalRows} रेकर्डहरू)`
          : `Backed up successfully to Google Sheets (${result.totalRows} records synced)`,
        "success",
        sheetInfo.isNew ? "Sheet Created & Backed Up" : "Google Sheet Updated"
      );
    } catch (err: unknown) {
      console.error("Google Backup Error:", err);
      showToast(
        (err as Error).message || "Google Sheets backup failed.",
        "error",
        "Google Backup Failed"
      );
    } finally {
      setIsGoogleBackingUp(false);
      setGoogleStatusMessage("");
    }
  };

  /**
   * RESTORE FROM GOOGLE SHEETS:
   * 1. Authenticate with Google
   * 2. Inspect sheet for data & SQL dump
   * 3. Open pre-restore confirmation dialog with details
   */
  const handleGoogleSheetsRestoreClick = async () => {
    const clientId = ensureGoogleClientId();
    if (!clientId && !getActiveAccessToken()) return;

    setIsGoogleRestoring(true);
    setGoogleStatusMessage(
      isNepali ? "गुगलसँग प्रमाणीकरण हुँदैछ..." : "Authenticating with Google..."
    );

    try {
      const accessToken = await authenticateWithGoogle(clientId || "");

      // Get spreadsheet
      setGoogleStatusMessage(
        isNepali
          ? "ब्याकअप गुगल सिट खोल्दै..."
          : "Locating backup Google Spreadsheet..."
      );
      const sheetInfo = await getOrCreateBackupSpreadsheet(
        accessToken,
        currentShop?.name
      );

      // Inspect sheet and prepare preview
      setGoogleStatusMessage(
        isNepali
          ? "गुगल सिटबाट रेकर्डहरू पढ्दै..."
          : "Reading database records from Google Sheet..."
      );
      const preview = await inspectGoogleSheetForRestore(
        accessToken,
        sheetInfo.id
      );

      setGoogleRestorePreview(preview);
      setIsGoogleRestoreConfirmOpen(true);
    } catch (err: unknown) {
      console.error("Google Restore Error:", err);
      showToast(
        (err as Error).message || "Failed to inspect Google Sheet backup.",
        "error",
        "Google Restore Error"
      );
    } finally {
      setIsGoogleRestoring(false);
      setGoogleStatusMessage("");
    }
  };

  /**
   * CONFIRM RESTORE FROM GOOGLE SHEETS:
   * Executes database restore with SQLite transaction safety
   */
  const handleConfirmGoogleRestore = async () => {
    if (!googleRestorePreview?.sqlDump) return;

    setIsGoogleRestoring(true);
    setGoogleStatusMessage(
      isNepali
        ? "डाटाबेस पुनर्स्थापित गरिँदैछ..."
        : "Applying database restore from Google Sheet..."
    );

    try {
      await executeRestoreFromGoogleSheet(googleRestorePreview.sqlDump);
      showToast(
        isNepali
          ? "गुगल सिटबाट डाटाबेस सफलतापूर्वक पुनर्स्थापित भयो!"
          : "Database successfully restored from Google Sheet!",
        "success"
      );
      setIsGoogleRestoreConfirmOpen(false);
      setGoogleRestorePreview(null);
      onDatabaseRestored?.();
      loadStats();
    } catch (err: unknown) {
      showToast((err as Error).message, "error", "Restore Failed");
    } finally {
      setIsGoogleRestoring(false);
      setGoogleStatusMessage("");
    }
  };

  /**
   * Save Google Cloud Sync Settings
   */
  const handleSaveGoogleSettings = (e: React.FormEvent) => {
    e.preventDefault();
    saveGoogleSyncConfig({
      clientId: inputClientId.trim(),
      sheetId: inputSheetId.trim(),
      sheetUrl: inputSheetId.trim()
        ? `https://docs.google.com/spreadsheets/d/${inputSheetId.trim()}/edit`
        : undefined,
    });
    setGoogleConfig(getGoogleSyncConfig());
    setIsGoogleConfigModalOpen(false);
    showToast(
      isNepali
        ? "गुगल क्लाउड सेटिङहरू सुरक्षित गरियो।"
        : "Google Cloud Sync settings saved successfully.",
      "success"
    );
  };

  /**
   * Disconnect Google Account session
   */
  const handleDisconnectGoogle = () => {
    clearGoogleAuthSession();
    saveGoogleSyncConfig({
      userEmail: "",
      userName: "",
    });
    setGoogleConfig(getGoogleSyncConfig());
    showToast(
      isNepali
        ? "गुगल सेसन विच्छेद (Disconnected) गरियो।"
        : "Google authentication session disconnected.",
      "info"
    );
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
                  SQLite WASM · Google Sheets
                </span>
              </h1>
              <p className="text-xs text-neutral-400 mt-0.5">
                {isNepali
                  ? "गुगल सिट क्लाउड ब्याकअप, स्थानीय एसक्यूएल डम्प (.sql) र बाइनरी (.sqlite) मार्फत डाटा सुरक्षित राख्नुहोस्।"
                  : "Manage Google Sheets cloud sync, offline SQL dumps, binary snapshots, and disaster recovery."}
              </p>
            </div>
          </div>
        </div>

        {/* Engine Status Badges */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-neutral-900 border border-neutral-800 text-xs text-neutral-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>
              {isNepali ? "१००% अफलाइन सुरक्षित" : "100% Offline & Private"}
            </span>
          </div>
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

      {/* ========================================================= */}
      {/* GOOGLE SHEETS CLOUD SYNC SECTION */}
      {/* ========================================================= */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 relative overflow-hidden shadow-sm">
        {/* Decorative corner glow */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="space-y-3 max-w-2xl">
            {/* Header with Google Brand Badge */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-neutral-100">
                    {isNepali
                      ? "गुगल सिट क्लाउड ब्याकअप र पुनर्स्थापना (Google Sheets Sync)"
                      : "Google Sheets Cloud Backup & Recovery"}
                  </h2>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                    Google Drive
                  </span>
                </div>
                <p className="text-xs text-neutral-400 mt-0.5">
                  {isNepali
                    ? "तपाईंको आफ्नै गुगल खातामा स्वचालित रूपमा स्प्रेडसिट सिर्जना गरी सम्पूर्ण डाटा सुरक्षित राख्नुहोस् वा सिटबाट पुनर्स्थापित गर्नुहोस्।"
                    : "Authenticate with Google to automatically create and sync a private Google Spreadsheet for backup and 1-click cloud restoration."}
                </p>
              </div>
            </div>

            {/* Connection Status & Linked Spreadsheet */}
            <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
              {googleConfig.userEmail ? (
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-neutral-950 border border-neutral-800 text-neutral-300">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span>
                    {isNepali ? "जोडिएको खाता:" : "Connected as:"}{" "}
                    <strong className="text-neutral-100">{googleConfig.userEmail}</strong>
                  </span>
                </div>
              ) : (
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-neutral-950 border border-neutral-800 text-neutral-400">
                  <span className="w-2 h-2 rounded-full bg-neutral-600" />
                  <span>
                    {isNepali
                      ? "गुगल खाता जोडिएको छैन (ब्याकअप गर्दा अनुमति माग्नेछ)"
                      : "Google account not connected (will prompt on click)"}
                  </span>
                </div>
              )}

              {googleConfig.sheetUrl && (
                <a
                  href={googleConfig.sheetUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-medium transition-colors cursor-pointer"
                  title="Open backup spreadsheet in Google Sheets"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>{isNepali ? "गुगल सिट खोल्नुहोस्" : "Open Google Sheet"}</span>
                </a>
              )}

              {googleConfig.lastBackupTime && (
                <span className="text-[11px] text-neutral-500 font-mono">
                  {isNepali ? "अन्तिम सिङ्क:" : "Last Sync:"}{" "}
                  {new Date(googleConfig.lastBackupTime).toLocaleString()}
                </span>
              )}
            </div>

            {/* Ongoing status progress text */}
            {(isGoogleBackingUp || isGoogleRestoring) && (
              <div className="flex items-center gap-2 text-xs text-emerald-400 animate-pulse pt-1">
                <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                <span>{googleStatusMessage}</span>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row lg:flex-col gap-2.5 shrink-0 min-w-[220px]">
            {/* Backup Button */}
            <button
              type="button"
              disabled={isGoogleBackingUp || isGoogleRestoring}
              onClick={handleGoogleSheetsBackup}
              className="py-2.5 px-4 text-xs font-bold text-neutral-900 bg-emerald-400 hover:bg-emerald-300 disabled:opacity-50 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md"
              title="Backup current database into Google Sheets"
            >
              {isGoogleBackingUp ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{isNepali ? "ब्याकअप हुँदैछ..." : "Syncing to Sheets..."}</span>
                </>
              ) : (
                <>
                  <CloudUpload className="w-4 h-4" />
                  <span>
                    {isNepali ? "गुगल सिटमा ब्याकअप लिनुहोस्" : "Backup to Google Sheets"}
                  </span>
                </>
              )}
            </button>

            {/* Restore Button */}
            <button
              type="button"
              disabled={isGoogleBackingUp || isGoogleRestoring}
              onClick={handleGoogleSheetsRestoreClick}
              className="py-2.5 px-4 text-xs font-bold text-white bg-sky-600 hover:bg-sky-500 disabled:opacity-50 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md"
              title="Restore database from Google Sheets"
            >
              {isGoogleRestoring ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{isNepali ? "पढ्दैछ..." : "Reading Sheet..."}</span>
                </>
              ) : (
                <>
                  <CloudDownload className="w-4 h-4" />
                  <span>
                    {isNepali ? "गुगल सिटबाट पुनर्स्थापना" : "Restore from Google Sheets"}
                  </span>
                </>
              )}
            </button>

            {/* Configure Client ID / Settings */}
            <button
              type="button"
              onClick={() => {
                setInputClientId(googleConfig.clientId);
                setInputSheetId(googleConfig.sheetId);
                setIsGoogleConfigModalOpen(true);
              }}
              className="py-2 px-3 text-xs font-medium text-neutral-400 hover:text-neutral-200 bg-neutral-950 hover:bg-neutral-800/80 border border-neutral-800 rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              title="Configure Google OAuth Client ID or sheet link"
            >
              <Settings className="w-3.5 h-3.5" />
              <span>{isNepali ? "गुगल सेटिङ / क्लाइन्ट आईडी" : "Google Cloud Settings"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Actions Grid: Local File Backup vs Restore */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* LOCAL BACKUP SECTION */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 flex flex-col justify-between space-y-6">
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-neutral-800">
              <Download className="w-4 h-4 text-emerald-400" />
              <h2 className="text-sm font-semibold text-neutral-100">
                {isNepali
                  ? "१. स्थानीय फाइल ब्याकअप (Local File Export)"
                  : "1. Export Local Backup Files"}
              </h2>
            </div>

            <p className="text-xs text-neutral-400 leading-relaxed">
              {isNepali
                ? "तपाईंको सबै व्यापारिक विवरणहरू (सामान, स्टक, ग्राहक, बिक्री, खरिद, खर्च र कर्मचारी) कम्प्युटरमा सुरक्षित राख्न .sql वा .sqlite ब्याकअप डाउनलोड गर्नुहोस्।"
                : "Create a complete offline snapshot of your catalog, stock history, vendors, sales, purchases, expenses, and staff data."}
            </p>

            <div className="space-y-3 pt-2">
              {/* Option A: SQL Script */}
              <div className="p-3.5 rounded-lg bg-neutral-950 border border-neutral-800 flex items-start gap-3">
                <FileCode className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-neutral-200">
                    {isNepali ? "एसक्यूएल डम्प (.sql)" : "SQL Script Dump (.sql)"}
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
                    {isNepali ? "बाइनरी डाटाबेस (.sqlite)" : "Binary Database (.sqlite)"}
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
              <span>{isNepali ? "डाउनलोड .sql डम्प" : "Download .sql Dump"}</span>
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

        {/* LOCAL RESTORE SECTION */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 flex flex-col justify-between space-y-6">
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-neutral-800">
              <Upload className="w-4 h-4 text-sky-400" />
              <h2 className="text-sm font-semibold text-neutral-100">
                {isNepali
                  ? "२. स्थानीय फाइल पुनर्स्थापना (Local File Restore)"
                  : "2. Restore from Local File"}
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
              {isNepali ? "डाटाबेस रिसेट / खाली गर्नुहोस्" : "Clear & Reset Database"}
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
            <span>{isNepali ? "डाटाबेस रिसेट गर्नुहोस्" : "Reset Database"}</span>
          </button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* MODALS & CONFIRMATION DIALOGS */}
      {/* ========================================================= */}

      {/* 1. Google Sheets Configuration Modal */}
      <Modal
        isOpen={isGoogleConfigModalOpen}
        onClose={() => setIsGoogleConfigModalOpen(false)}
        title={
          isNepali
            ? "गुगल क्लाउड सिङ्क सेटिङ (Google OAuth Setup)"
            : "Google Cloud Sync Setup"
        }
        subtitle={
          isNepali
            ? "तपाईंको गुगल ड्राइभ र सिटसँग जोड्न Google Client ID प्रविष्ट गर्नुहोस्"
            : "Connect your Google Drive & Sheets using OAuth 2.0 Client ID"
        }
        maxWidth="lg"
      >
        <form onSubmit={handleSaveGoogleSettings} className="space-y-4 text-xs">
          <div>
            <label className="block text-xs font-semibold text-neutral-300 mb-1">
              {isNepali ? "गुगल क्लाइन्ट आईडी (Google Client ID) *" : "Google OAuth Client ID *"}
            </label>
            <Input
              type="text"
              required
              placeholder="e.g. 123456789-abcdef.apps.googleusercontent.com"
              value={inputClientId}
              onChange={(e) => setInputClientId(e.target.value)}
              className="w-full font-mono text-xs"
            />
            <p className="text-[11px] text-neutral-400 mt-1">
              {isNepali
                ? "Google Cloud Console मा सिर्जना गरिएको Web Application Client ID।"
                : "Standard OAuth 2.0 Web Application Client ID from Google Cloud Console."}
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-300 mb-1">
              {isNepali
                ? "जोडिएको गुगल स्प्रेडसिट आईडी (वैकल्पिक)"
                : "Linked Google Spreadsheet ID (Optional)"}
            </label>
            <Input
              type="text"
              placeholder="Leave blank to auto-create 'StockForge POS - Database Backup'"
              value={inputSheetId}
              onChange={(e) => setInputSheetId(e.target.value)}
              className="w-full font-mono text-xs"
            />
            <p className="text-[11px] text-neutral-500 mt-1">
              {isNepali
                ? "खाली छोड्दा पहिलो पटक ब्याकअप गर्दा स्वतः नयाँ सिट बनाइनेछ।"
                : "Leave blank to automatically detect or create 'StockForge POS - Database Backup'."}
            </p>
          </div>

          {/* Quick Guide Card */}
          <div className="p-3 rounded-xl bg-neutral-950 border border-neutral-800 space-y-2 text-[11px] text-neutral-400">
            <div className="font-semibold text-neutral-200 flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-sky-400" />
              <span>{isNepali ? "गुगल क्लाइन्ट आईडी बनाउने तरिका:" : "How to get a Google Client ID in 3 steps:"}</span>
            </div>
            <ol className="list-decimal pl-4 space-y-1 text-neutral-400">
              <li>
                Open{" "}
                <a
                  href="https://console.cloud.google.com/apis/credentials"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-emerald-400 underline"
                >
                  console.cloud.google.com/apis/credentials
                </a>
              </li>
              <li>
                Enable <strong>Google Sheets API</strong> and <strong>Google Drive API</strong>.
              </li>
              <li>
                Create an <strong>OAuth Client ID (Web Application)</strong>, add{" "}
                <code className="text-neutral-300 bg-neutral-900 px-1 rounded">
                  {typeof window !== "undefined" ? window.location.origin : "http://localhost:3000"}
                </code>{" "}
                to <em>Authorized JavaScript origins</em>, and paste the Client ID above.
              </li>
            </ol>
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-neutral-800">
            {googleConfig.userEmail ? (
              <button
                type="button"
                onClick={handleDisconnectGoogle}
                className="px-3 py-1.5 text-xs text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>{isNepali ? "खाता विच्छेद (Disconnect)" : "Disconnect Google"}</span>
              </button>
            ) : <div />}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsGoogleConfigModalOpen(false)}
                className="px-3 py-1.5 text-xs text-neutral-400 hover:text-neutral-200 bg-neutral-800 rounded-lg transition-colors cursor-pointer"
              >
                {isNepali ? "रद्द गर्नुहोस्" : "Cancel"}
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 text-xs font-semibold text-neutral-900 bg-emerald-400 hover:bg-emerald-300 rounded-lg transition-colors cursor-pointer shadow-xs"
              >
                {isNepali ? "सुरक्षित गर्नुहोस्" : "Save Settings"}
              </button>
            </div>
          </div>
        </form>
      </Modal>

      {/* 2. Google Sheets Restore Confirmation Dialog */}
      <Modal
        isOpen={isGoogleRestoreConfirmOpen}
        onClose={() => {
          if (!isGoogleRestoring) {
            setIsGoogleRestoreConfirmOpen(false);
            setGoogleRestorePreview(null);
          }
        }}
        title={
          isNepali
            ? "गुगल सिटबाट डाटाबेस पुनर्स्थापित (Restore) गर्ने हो?"
            : "Restore Database from Google Sheets?"
        }
        subtitle={
          googleRestorePreview?.spreadsheetTitle || "StockForge POS Backup"
        }
        maxWidth="lg"
      >
        <div className="space-y-4 text-xs">
          {/* Warning Banner */}
          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
            <div className="text-[11px] leading-relaxed">
              {isNepali
                ? "गुगल सिटबाट पुनर्स्थापना गर्दा हालको सबै उत्पादन, स्टक र कारोबारहरू नयाँ फाइल अनुसार बदलिनेछ। यो प्रक्रिया रद्द गर्न सकिँदैन।"
                : "Restoring will replace all local products, inventory levels, sales, and expenses with the records from the Google Sheet. This action cannot be undone."}
            </div>
          </div>

          {/* Backup Summary Metadata */}
          {googleRestorePreview && (
            <div className="p-3.5 rounded-xl bg-neutral-950 border border-neutral-800 space-y-3">
              <div className="flex items-center justify-between text-neutral-300 border-b border-neutral-800 pb-2">
                <span className="text-neutral-400">{isNepali ? "ब्याकअप मिति:" : "Backup Date:"}</span>
                <span className="font-mono font-medium">
                  {googleRestorePreview.backupDate}
                </span>
              </div>

              <div className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">
                {isNepali ? "पुनर्स्थापित हुने विवरणहरू:" : "Records to be restored:"}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-neutral-300">
                <div className="p-2 rounded-lg bg-neutral-900 border border-neutral-800/80">
                  <span className="text-[10px] text-neutral-500 block">
                    {isNepali ? "उत्पादनहरू" : "Products"}
                  </span>
                  <strong className="text-sm font-mono text-indigo-400">
                    {googleRestorePreview.recordCounts.products}
                  </strong>
                </div>

                <div className="p-2 rounded-lg bg-neutral-900 border border-neutral-800/80">
                  <span className="text-[10px] text-neutral-500 block">
                    {isNepali ? "बिक्री बिलहरू" : "Sales"}
                  </span>
                  <strong className="text-sm font-mono text-emerald-400">
                    {googleRestorePreview.recordCounts.sales}
                  </strong>
                </div>

                <div className="p-2 rounded-lg bg-neutral-900 border border-neutral-800/80">
                  <span className="text-[10px] text-neutral-500 block">
                    {isNepali ? "खरिद रेकर्ड" : "Purchases"}
                  </span>
                  <strong className="text-sm font-mono text-sky-400">
                    {googleRestorePreview.recordCounts.purchases}
                  </strong>
                </div>

                <div className="p-2 rounded-lg bg-neutral-900 border border-neutral-800/80">
                  <span className="text-[10px] text-neutral-500 block">
                    {isNepali ? "खर्चहरू" : "Expenses"}
                  </span>
                  <strong className="text-sm font-mono text-amber-400">
                    {googleRestorePreview.recordCounts.expenses}
                  </strong>
                </div>

                <div className="p-2 rounded-lg bg-neutral-900 border border-neutral-800/80">
                  <span className="text-[10px] text-neutral-500 block">
                    {isNepali ? "आपूर्तिकर्ता" : "Vendors"}
                  </span>
                  <strong className="text-sm font-mono text-neutral-200">
                    {googleRestorePreview.recordCounts.vendors}
                  </strong>
                </div>

                <div className="p-2 rounded-lg bg-neutral-900 border border-neutral-800/80">
                  <span className="text-[10px] text-neutral-500 block">
                    {isNepali ? "ग्राहकहरू" : "Customers"}
                  </span>
                  <strong className="text-sm font-mono text-neutral-200">
                    {googleRestorePreview.recordCounts.customers}
                  </strong>
                </div>

                <div className="p-2 rounded-lg bg-neutral-900 border border-neutral-800/80 col-span-2">
                  <span className="text-[10px] text-neutral-500 block">
                    {isNepali ? "कर्मचारी" : "Staff"}
                  </span>
                  <strong className="text-sm font-mono text-purple-400">
                    {googleRestorePreview.recordCounts.staff}
                  </strong>
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-neutral-800">
            <button
              type="button"
              disabled={isGoogleRestoring}
              onClick={() => {
                setIsGoogleRestoreConfirmOpen(false);
                setGoogleRestorePreview(null);
              }}
              className="px-3.5 py-2 text-xs text-neutral-400 hover:text-neutral-200 bg-neutral-800 rounded-lg transition-colors cursor-pointer"
            >
              {isNepali ? "रद्द गर्नुहोस्" : "Cancel"}
            </button>
            <button
              type="button"
              disabled={isGoogleRestoring}
              onClick={handleConfirmGoogleRestore}
              className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 disabled:opacity-50 rounded-lg transition-colors flex items-center gap-2 cursor-pointer shadow-md"
            >
              {isGoogleRestoring ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{isNepali ? "पुनर्स्थापित हुँदैछ..." : "Restoring..."}</span>
                </>
              ) : (
                <span>
                  {isNepali
                    ? "डाटा बदल्नुहोस् र पुनर्स्थापना गर्नुहोस्"
                    : "Replace & Restore from Google Sheet"}
                </span>
              )}
            </button>
          </div>
        </div>
      </Modal>

      {/* 3. Confirmation Dialog: Restore from Local File */}
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

      {/* 4. Confirmation Dialog: Reset Database */}
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
