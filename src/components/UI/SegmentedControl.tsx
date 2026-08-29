'use client';

import React from 'react';

export interface SegmentedOption<T extends string = string> {
  value: T;
  label: string;
  count?: number | string;
  icon?: React.ReactNode;
  disabled?: boolean;
}

export interface SegmentedControlProps<T extends string = string> {
  value: T;
  onChange: (value: T) => void;
  options: (SegmentedOption<T> | T)[];
  height?: number | string;
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  className?: string;
  style?: React.CSSProperties;
  textTransform?: 'uppercase' | 'none' | 'capitalize';
  id?: string;
}

export function SegmentedControl<T extends string = string>({
  value,
  onChange,
  options,
  height = 32,
  size = 'md',
  fullWidth = false,
  className = '',
  style = {},
  textTransform = 'uppercase',
  id,
}: SegmentedControlProps<T>) {
  const normalizedOptions: SegmentedOption<T>[] = options.map((opt) =>
    typeof opt === 'string'
      ? { value: opt, label: opt }
      : opt
  );

  const fontSize = size === 'sm' ? 10.5 : size === 'lg' ? 12.5 : 11;
  const paddingX = size === 'sm' ? 10 : size === 'lg' ? 16 : 14;

  return (
    <div
      id={id}
      className={`segmented-control-root ${className}`}
      style={{
        display: fullWidth ? 'flex' : 'inline-flex',
        width: fullWidth ? '100%' : 'auto',
        border: '1px solid #E5E3DF',
        borderRadius: 6,
        overflow: 'hidden',
        height,
        background: '#FFFFFF',
        boxSizing: 'border-box',
        alignItems: 'stretch',
        ...style,
      }}
    >
      {normalizedOptions.map((opt, idx) => {
        const isSelected = value === opt.value;
        const isLast = idx === normalizedOptions.length - 1;

        return (
          <button
            key={opt.value}
            type="button"
            disabled={opt.disabled}
            onClick={() => onChange(opt.value)}
            style={{
              flex: fullWidth ? 1 : 'none',
              height: '100%',
              padding: `0 ${paddingX}px`,
              fontSize,
              fontWeight: isSelected ? 700 : 500,
              textTransform,
              letterSpacing: textTransform === 'uppercase' ? '0.04em' : 'normal',
              border: 'none',
              borderRight: !isLast ? '1px solid #E5E3DF' : 'none',
              background: isSelected ? '#1A1A1A' : '#FFFFFF',
              color: isSelected ? '#FFFFFF' : '#888580',
              cursor: opt.disabled ? 'not-allowed' : 'pointer',
              opacity: opt.disabled ? 0.5 : 1,
              transition: 'all 0.12s ease',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              whiteSpace: 'nowrap',
              fontFamily: 'inherit',
              userSelect: 'none',
            }}
            onMouseEnter={(e) => {
              if (!isSelected && !opt.disabled) {
                e.currentTarget.style.background = '#F9F8F6';
                e.currentTarget.style.color = '#1A1A1A';
              }
            }}
            onMouseLeave={(e) => {
              if (!isSelected && !opt.disabled) {
                e.currentTarget.style.background = '#FFFFFF';
                e.currentTarget.style.color = '#888580';
              }
            }}
          >
            {opt.icon && <span>{opt.icon}</span>}
            <span>{opt.label}</span>
            {opt.count !== undefined && opt.count !== null && (
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  padding: '1px 6px',
                  borderRadius: 10,
                  background: isSelected ? 'rgba(255, 255, 255, 0.22)' : '#F1EFEA',
                  color: isSelected ? '#FFFFFF' : '#6B7280',
                  marginLeft: 2,
                  lineHeight: '13px',
                }}
              >
                {opt.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
