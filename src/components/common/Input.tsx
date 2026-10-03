import React, { forwardRef } from 'react';

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value'> {
  value?: string | number | readonly string[] | null | undefined;
  label?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }> | React.ReactNode;
  rightIcon?: React.ComponentType<{ className?: string }> | React.ReactNode;
  error?: string | React.ReactNode;
  helperText?: string | React.ReactNode;
  mono?: boolean;
  sizeVariant?: 'sm' | 'md' | 'lg';
  containerClassName?: string;
  labelClassName?: string;
}

export interface TextareaProps extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'value'> {
  value?: string | number | readonly string[] | null | undefined;
  label?: React.ReactNode;
  error?: string | React.ReactNode;
  helperText?: string | React.ReactNode;
  containerClassName?: string;
  labelClassName?: string;
}

const renderIcon = (
  icon: React.ComponentType<{ className?: string }> | React.ReactNode,
  extraClass: string
) => {
  if (!icon) return null;
  if (React.isValidElement(icon)) {
    return icon;
  }
  if (typeof icon === 'function') {
    const IconComponent = icon as React.ComponentType<{ className?: string }>;
    return <IconComponent className={extraClass} />;
  }
  return null;
};

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      value,
      label,
      icon,
      rightIcon,
      error,
      helperText,
      mono = false,
      sizeVariant = 'md',
      containerClassName = '',
      labelClassName = '',
      className = '',
      disabled,
      id,
      ...props
    },
    ref
  ) => {
    // Normalize null to empty string for clean React controlled inputs
    const safeValue = value === null ? '' : value;

    const sizeClasses = {
      sm: 'px-2.5 py-1.5 text-xs',
      md: 'px-3 py-2 text-xs',
      lg: 'px-3.5 py-2.5 text-sm',
    };

    const hasLeftIcon = Boolean(icon);
    const hasRightIcon = Boolean(rightIcon);

    const paddingWithIcon = hasLeftIcon
      ? sizeVariant === 'sm'
        ? 'pl-8'
        : 'pl-9'
      : '';
    const paddingWithRightIcon = hasRightIcon
      ? sizeVariant === 'sm'
        ? 'pr-8'
        : 'pr-9'
      : '';

    return (
      <div className={`w-full ${containerClassName}`}>
        {label && (
          <label
            htmlFor={id}
            className={`block text-xs font-semibold text-neutral-300 mb-1 flex items-center gap-1.5 ${labelClassName}`}
          >
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {hasLeftIcon && (
            <div className="absolute left-2.5 flex items-center pointer-events-none text-neutral-400">
              {renderIcon(icon, 'w-3.5 h-3.5')}
            </div>
          )}

          <input
            ref={ref}
            id={id}
            value={safeValue}
            disabled={disabled}
            className={`w-full bg-neutral-950 border rounded-lg text-neutral-100 placeholder-neutral-500 transition-colors focus:outline-none focus:ring-1 ${
              error
                ? 'border-rose-500/80 focus:border-rose-500 focus:ring-rose-500/20'
                : 'border-neutral-800 focus:border-emerald-500 focus:ring-emerald-500/20'
            } ${mono ? 'font-mono' : ''} ${sizeClasses[sizeVariant]} ${paddingWithIcon} ${paddingWithRightIcon} ${
              disabled ? 'opacity-50 cursor-not-allowed bg-neutral-900' : ''
            } ${className}`}
            {...props}
          />

          {hasRightIcon && (
            <div className="absolute right-2.5 flex items-center text-neutral-400">
              {renderIcon(rightIcon, 'w-3.5 h-3.5')}
            </div>
          )}
        </div>

        {error ? (
          <p className="mt-1 text-[11px] font-medium text-rose-400">{error}</p>
        ) : helperText ? (
          <p className="mt-1 text-[11px] text-neutral-500">{helperText}</p>
        ) : null}
      </div>
    );
  }
);

Input.displayName = 'Input';

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    {
      value,
      label,
      error,
      helperText,
      containerClassName = '',
      labelClassName = '',
      className = '',
      disabled,
      id,
      rows = 3,
      ...props
    },
    ref
  ) => {
    // Normalize null to empty string
    const safeValue = value === null ? '' : value;

    return (
      <div className={`w-full ${containerClassName}`}>
        {label && (
          <label
            htmlFor={id}
            className={`block text-xs font-semibold text-neutral-300 mb-1 flex items-center gap-1.5 ${labelClassName}`}
          >
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={id}
          rows={rows}
          value={safeValue}
          disabled={disabled}
          className={`w-full bg-neutral-950 border rounded-lg text-xs text-neutral-100 placeholder-neutral-500 transition-colors focus:outline-none focus:ring-1 resize-none px-3 py-2 ${
            error
              ? 'border-rose-500/80 focus:border-rose-500 focus:ring-rose-500/20'
              : 'border-neutral-800 focus:border-emerald-500 focus:ring-emerald-500/20'
          } ${disabled ? 'opacity-50 cursor-not-allowed bg-neutral-900' : ''} ${className}`}
          {...props}
        />
        {error ? (
          <p className="mt-1 text-[11px] font-medium text-rose-400">{error}</p>
        ) : helperText ? (
          <p className="mt-1 text-[11px] text-neutral-500">{helperText}</p>
        ) : null}
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';

export default Input;
