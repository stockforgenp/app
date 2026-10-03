import React, { forwardRef } from 'react';

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value'> {
  value?: string | number | readonly string[] | null | undefined;
  label?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }> | React.ReactNode;
  iconPosition?: 'left' | 'right';
  rightIcon?: React.ComponentType<{ className?: string }> | React.ReactNode;
  clearable?: boolean;
  onClear?: () => void;
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
      iconPosition = 'left',
      rightIcon,
      clearable = false,
      onClear,
      error,
      helperText,
      mono = false,
      sizeVariant = 'md',
      containerClassName = '',
      labelClassName = '',
      className = '',
      disabled,
      id,
      type,
      ...props
    },
    ref
  ) => {
    // If hidden, render directly without wrapper
    if (type === 'hidden' || (className && className.includes('hidden'))) {
      return (
        <input
          ref={ref}
          id={id}
          type={type}
          disabled={disabled}
          className={className}
          {...(value !== undefined ? { value: value === null ? '' : value } : {})}
          {...props}
        />
      );
    }

    // If it's a checkbox or radio, render minimal wrapper
    if (type === 'checkbox' || type === 'radio') {
      const inputEl = (
        <input
          ref={ref}
          id={id}
          type={type}
          disabled={disabled}
          className={`cursor-pointer rounded border-neutral-700 bg-neutral-950 text-emerald-500 focus:ring-emerald-500 transition-colors ${
            disabled ? 'opacity-50 cursor-not-allowed' : ''
          } ${className}`}
          {...(value !== undefined ? { value: value === null ? '' : value } : {})}
          {...props}
        />
      );

      if (!label && !error && !helperText) {
        return inputEl;
      }

      return (
        <div className={`flex items-center gap-2 ${containerClassName}`}>
          {inputEl}
          {label && (
            <label
              htmlFor={id}
              className={`text-xs text-neutral-300 cursor-pointer select-none ${labelClassName}`}
            >
              {label}
            </label>
          )}
          {error && <span className="text-[11px] text-rose-400">{error}</span>}
        </div>
      );
    }

    // Normalize null to empty string for React controlled inputs
    const safeValue = value === null ? '' : value;

    const sizeClasses = {
      sm: 'px-2.5 py-1.5 text-xs',
      md: 'px-3 py-2 text-xs',
      lg: 'px-3.5 py-2.5 text-sm',
    };

    const effectiveLeftIcon = iconPosition === 'left' ? icon : undefined;
    const effectiveRightIcon = iconPosition === 'right' ? icon : rightIcon;
    const isClearable = clearable && Boolean(safeValue) && Boolean(onClear);

    const hasLeftIcon = Boolean(effectiveLeftIcon);
    const hasRightContent = Boolean(effectiveRightIcon) || isClearable;

    const paddingWithIcon = hasLeftIcon
      ? sizeVariant === 'sm'
        ? 'pl-8'
        : 'pl-9'
      : '';
    const paddingWithRightIcon = hasRightContent
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
              {renderIcon(effectiveLeftIcon, 'w-3.5 h-3.5')}
            </div>
          )}

          <input
            ref={ref}
            id={id}
            type={type}
            disabled={disabled}
            className={`w-full bg-neutral-950 border rounded-lg text-neutral-100 placeholder-neutral-500 transition-colors focus:outline-none focus:ring-1 ${
              error
                ? 'border-rose-500/80 focus:border-rose-500 focus:ring-rose-500/20'
                : 'border-neutral-800 focus:border-emerald-500 focus:ring-emerald-500/20'
            } ${mono ? 'font-mono' : ''} ${sizeClasses[sizeVariant]} ${paddingWithIcon} ${paddingWithRightIcon} ${
              disabled ? 'opacity-50 cursor-not-allowed bg-neutral-900' : ''
            } ${className}`}
            {...(value !== undefined ? { value: safeValue } : {})}
            {...props}
          />

          {isClearable ? (
            <button
              type="button"
              onClick={onClear}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300 text-xs cursor-pointer p-0.5"
              title="Clear input"
            >
              ✕
            </button>
          ) : effectiveRightIcon ? (
            <div className="absolute right-2.5 flex items-center text-neutral-400">
              {renderIcon(effectiveRightIcon, 'w-3.5 h-3.5')}
            </div>
          ) : null}
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
          disabled={disabled}
          className={`w-full bg-neutral-950 border rounded-lg text-xs text-neutral-100 placeholder-neutral-500 transition-colors focus:outline-none focus:ring-1 resize-none px-3 py-2 ${
            error
              ? 'border-rose-500/80 focus:border-rose-500 focus:ring-rose-500/20'
              : 'border-neutral-800 focus:border-emerald-500 focus:ring-emerald-500/20'
          } ${disabled ? 'opacity-50 cursor-not-allowed bg-neutral-900' : ''} ${className}`}
          {...(value !== undefined ? { value: safeValue } : {})}
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
