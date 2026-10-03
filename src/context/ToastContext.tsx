/**
 * Toast Notification Context & Hook with Framer Motion physics
 */
import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastOptions {
  title?: string;
  action?: ToastAction;
  duration?: number;
}

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  title?: string;
  action?: ToastAction;
}

interface ToastContextType {
  showToast: (
    message: string,
    type?: ToastType,
    titleOrOptions?: string | ToastOptions,
    options?: ToastOptions
  ) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (
      message: string,
      type: ToastType = 'success',
      titleOrOptions?: string | ToastOptions,
      options?: ToastOptions
    ) => {
      const id = Math.random().toString(36).substring(2, 9);
      let title: string | undefined;
      let action: ToastAction | undefined;
      let duration = 4500;

      if (typeof titleOrOptions === 'string') {
        title = titleOrOptions;
        if (options) {
          action = options.action;
          if (options.duration) duration = options.duration;
        }
      } else if (titleOrOptions && typeof titleOrOptions === 'object') {
        title = titleOrOptions.title;
        action = titleOrOptions.action;
        if (titleOrOptions.duration) duration = titleOrOptions.duration;
      }

      if (type === 'warning' && !options?.duration && !((titleOrOptions as ToastOptions)?.duration)) {
        duration = 7000; // Give users longer to read warning alerts
      }

      setToasts((prev) => [...prev, { id, message, type, title, action }]);

      setTimeout(() => {
        removeToast(id);
      }, duration);
    },
    [removeToast]
  );

  return (
    <ToastContext.Provider value={{ showToast, removeToast }}>
      {children}
      {/* Toast container */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none">
        <AnimatePresence mode="popLayout">
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: 16, scale: 0.94 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: 24, scale: 0.94 }}
              transition={{
                type: 'spring',
                damping: 24,
                stiffness: 350,
                mass: 0.5,
              }}
              className={`pointer-events-auto flex items-start gap-3 p-3.5 rounded-xl border shadow-2xl backdrop-blur-md text-neutral-100 ${
                t.type === 'warning'
                  ? 'bg-neutral-900/98 border-amber-500/40 shadow-amber-950/20'
                  : t.type === 'error'
                  ? 'bg-neutral-900/98 border-rose-500/40'
                  : 'bg-neutral-900/95 border-neutral-800'
              }`}
            >
              {t.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />}
              {t.type === 'error' && <XCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />}
              {t.type === 'warning' && <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5 animate-bounce-short" />}
              {t.type === 'info' && <Info className="w-5 h-5 text-sky-400 shrink-0 mt-0.5" />}

              <div className="flex-1 text-sm min-w-0">
                {t.title && (
                  <div
                    className={`font-semibold text-xs mb-0.5 ${
                      t.type === 'warning' ? 'text-amber-300' : 'text-neutral-100'
                    }`}
                  >
                    {t.title}
                  </div>
                )}
                <div className="text-neutral-300 leading-snug break-words text-xs">{t.message}</div>

                {t.action && (
                  <div className="mt-2.5">
                    <button
                      type="button"
                      onClick={() => {
                        t.action!.onClick();
                        removeToast(t.id);
                      }}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 transition-colors cursor-pointer shadow-xs"
                    >
                      <span>{t.action.label}</span>
                    </button>
                  </div>
                )}
              </div>

              <motion.button
                whileHover={{ scale: 1.15 }}
                whileTap={{ scale: 0.85 }}
                onClick={() => removeToast(t.id)}
                className="text-neutral-500 hover:text-neutral-300 transition-colors p-1 -mr-1 -mt-1 rounded cursor-pointer"
                aria-label="Dismiss"
              >
                <X className="w-4 h-4" />
              </motion.button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextType {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
