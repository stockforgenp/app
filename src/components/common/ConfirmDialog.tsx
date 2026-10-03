/**
 * Confirmation Dialog for destructive operations
 */
import React from "react";
import { AlertTriangle } from "lucide-react";
import { Modal } from "./Modal.tsx";

export interface ConfirmDialogProps {
  isOpen: boolean;
  onClose?: () => void;
  onCancel?: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
  variant?: "danger" | "warning" | "primary" | string;
  confirmVariant?: "danger" | "warning" | "primary" | string;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  onClose,
  onCancel,
  onConfirm,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  isDestructive = true,
  variant,
  confirmVariant,
}) => {
  const handleDismiss = () => {
    if (onClose) onClose();
    else if (onCancel) onCancel();
  };

  const isDanger =
    isDestructive ||
    variant === "danger" ||
    variant === "destructive" ||
    confirmVariant === "danger" ||
    confirmVariant === "destructive";

  return (
    <Modal isOpen={isOpen} onClose={handleDismiss} title={title} maxWidth="md">
      <div className="flex gap-4">
        <div
          className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
            isDanger
              ? "bg-rose-500/10 text-rose-400"
              : "bg-amber-500/10 text-amber-400"
          }`}
        >
          <AlertTriangle className="w-5 h-5" />
        </div>
        <div className="flex-1 text-sm text-neutral-300 leading-relaxed pt-1">
          {message}
        </div>
      </div>

      <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-neutral-800">
        <button
          type="button"
          onClick={handleDismiss}
          className="px-4 py-2 text-xs font-medium text-neutral-300 bg-neutral-800 hover:bg-neutral-700 rounded-lg transition-colors cursor-pointer"
        >
          {cancelText}
        </button>
        <button
          type="button"
          onClick={() => {
            onConfirm();
            handleDismiss();
          }}
          className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
            isDanger
              ? "bg-rose-600 hover:bg-rose-500 text-white"
              : "bg-emerald-600 hover:bg-emerald-500 text-white"
          }`}
        >
          {confirmText}
        </button>
      </div>
    </Modal>
  );
};
