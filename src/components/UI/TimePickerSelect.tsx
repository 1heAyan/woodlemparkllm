'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Clock, ChevronDown, Check, Zap, Minus, Plus } from 'lucide-react';

export interface TimePickerSelectProps {
  value: string; // e.g. "07:35 AM", "7:35 AM", "07:35", or "7:35"
  onChange: (formattedTime: string) => void;
  disabled?: boolean;
  style?: React.CSSProperties;
  buttonStyle?: React.CSSProperties;
  id?: string;
}

const COMMON_PRESETS = [
  '07:15 AM',
  '07:30 AM',
  '07:45 AM',
  '08:00 AM',
  '08:15 AM',
  '08:30 AM',
  '08:45 AM',
  '09:00 AM',
  '09:30 AM',
];

const HOURS_LIST = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const MINUTES_LIST = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

/**
 * Parse time string safely into hour (1-12), minute (0-59), period ('AM' | 'PM')
 */
function parseTime(str: string): { hour: number; minute: number; period: 'AM' | 'PM' } {
  const now = new Date();
  let defaultHour = now.getHours();
  const defaultMin = now.getMinutes();
  const defaultPeriod: 'AM' | 'PM' = defaultHour >= 12 ? 'PM' : 'AM';
  defaultHour = defaultHour % 12 || 12;

  if (!str || typeof str !== 'string' || !str.trim()) {
    return { hour: defaultHour, minute: defaultMin, period: defaultPeriod };
  }

  const clean = str.trim();
  const match = clean.match(/^(\d{1,2}):(\d{2})(?:\s*([AaPp][Mm]))?$/i);
  if (!match) {
    return { hour: defaultHour, minute: defaultMin, period: defaultPeriod };
  }

  let h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  let p: 'AM' | 'PM' = defaultPeriod;

  if (match[3]) {
    p = match[3].toUpperCase() === 'PM' ? 'PM' : 'AM';
  } else {
    if (h >= 12) {
      p = 'PM';
      if (h > 12) h -= 12;
    } else if (h === 0) {
      h = 12;
      p = 'AM';
    }
  }

  h = Math.min(12, Math.max(1, h));
  const min = Math.min(59, Math.max(0, isNaN(m) ? 0 : m));

  return { hour: h, minute: min, period: p };
}

function format12Time(hour: number, minute: number, period: 'AM' | 'PM'): string {
  const hStr = String(hour).padStart(2, '0');
  const mStr = String(minute).padStart(2, '0');
  return `${hStr}:${mStr} ${period}`;
}

export const TimePickerSelect: React.FC<TimePickerSelectProps> = ({
  value,
  onChange,
  disabled = false,
  style,
  buttonStyle,
  id,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [menuPos, setMenuPos] = useState<{
    top: number;
    left: number;
    width: number;
    openUpward?: boolean;
  } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const parsed = parseTime(value);
  const displayTime = value ? format12Time(parsed.hour, parsed.minute, parsed.period) : 'Select time...';

  const calculatePosition = useCallback(() => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const popoverHeight = 330;
      const spaceBelow = viewportHeight - rect.bottom - 12;
      const spaceAbove = rect.top - 12;

      const shouldOpenUpward = spaceBelow < popoverHeight && spaceAbove > spaceBelow;
      const top = shouldOpenUpward
        ? Math.max(10, rect.top - popoverHeight - 4)
        : rect.bottom + 4;

      // Ensure menu stays within screen width
      const menuWidth = 320;
      let left = rect.left;
      if (left + menuWidth > window.innerWidth - 12) {
        left = Math.max(12, window.innerWidth - menuWidth - 12);
      }

      setMenuPos({
        top,
        left,
        width: menuWidth,
        openUpward: shouldOpenUpward,
      });
    }
  }, []);

  const handleToggle = () => {
    if (disabled) return;
    if (!isOpen) {
      calculatePosition();
    }
    setIsOpen((prev) => !prev);
  };

  // Close on outside click or reposition on external scroll
  useEffect(() => {
    if (!isOpen) return;

    const handleOutsideClick = (e: MouseEvent) => {
      const menuEl = popoverRef.current || document.getElementById('__time_picker_portal__');
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node) &&
        !(menuEl && menuEl.contains(e.target as Node))
      ) {
        setIsOpen(false);
      }
    };

    const handleScroll = (e: Event) => {
      const menuEl = popoverRef.current || document.getElementById('__time_picker_portal__');
      if (menuEl && (menuEl === e.target || menuEl.contains(e.target as Node))) {
        return;
      }
      if (buttonRef.current) {
        const rect = buttonRef.current.getBoundingClientRect();
        if (rect.bottom < 0 || rect.top > window.innerHeight) {
          setIsOpen(false);
        } else {
          calculatePosition();
        }
      }
    };

    const handleResize = () => calculatePosition();

    document.addEventListener('mousedown', handleOutsideClick);
    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', handleResize);

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', handleResize);
    };
  }, [isOpen, calculatePosition]);

  const setHour = (h: number) => {
    const formatted = format12Time(h, parsed.minute, parsed.period);
    onChange(formatted);
  };

  const setMinute = (m: number) => {
    const formatted = format12Time(parsed.hour, m, parsed.period);
    onChange(formatted);
  };

  const setPeriod = (p: 'AM' | 'PM') => {
    const formatted = format12Time(parsed.hour, parsed.minute, p);
    onChange(formatted);
  };

  const shiftMinutes = (delta: number) => {
    let totalMinutes = (parsed.hour % 12) * 60 + parsed.minute;
    if (parsed.period === 'PM') totalMinutes += 12 * 60;

    totalMinutes += delta;
    if (totalMinutes < 0) totalMinutes += 24 * 60;
    totalMinutes = totalMinutes % (24 * 60);

    let h24 = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    const p: 'AM' | 'PM' = h24 >= 12 ? 'PM' : 'AM';
    let h12 = h24 % 12;
    if (h12 === 0) h12 = 12;

    const formatted = format12Time(h12, m, p);
    onChange(formatted);
  };

  const setToCurrentTime = () => {
    const now = new Date();
    let h = now.getHours();
    const m = now.getMinutes();
    const p: 'AM' | 'PM' = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    const formatted = format12Time(h, m, p);
    onChange(formatted);
  };

  const selectPreset = (preset: string) => {
    onChange(preset);
  };

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        display: 'inline-block',
        width: '100%',
        ...style,
      }}
    >
      {/* TRIGGER BUTTON (32px Woodlem LMS Style) */}
      <button
        ref={buttonRef}
        type="button"
        id={id}
        onClick={handleToggle}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        style={{
          width: '100%',
          height: 32,
          padding: '0 10px',
          borderRadius: 6,
          border: '1px solid #E5E3DF',
          background: '#FFFFFF',
          color: '#1A1A1A',
          fontSize: 12,
          fontWeight: 600,
          cursor: disabled ? 'not-allowed' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 6,
          outline: 'none',
          boxSizing: 'border-box',
          transition: 'all 0.15s ease',
          boxShadow: isOpen ? '0 0 0 2px rgba(44, 110, 106, 0.15)' : 'none',
          borderColor: isOpen ? '#2C6E6A' : '#E5E3DF',
          ...buttonStyle,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
          <Clock size={13} style={{ color: '#2C6E6A', flexShrink: 0 }} />
          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {displayTime}
          </span>
        </div>
        <ChevronDown
          size={13}
          style={{
            color: '#888580',
            flexShrink: 0,
            transform: isOpen ? 'rotate(180deg)' : 'none',
            transition: 'transform 0.15s ease',
          }}
        />
      </button>

      {/* PORTAL POPOVER FOR SELECTION */}
      {mounted &&
        isOpen &&
        menuPos &&
        createPortal(
          <div
            id="__time_picker_portal__"
            ref={popoverRef}
            style={{
              position: 'fixed',
              top: `${menuPos.top}px`,
              left: `${menuPos.left}px`,
              width: `${menuPos.width}px`,
              zIndex: 99999,
              background: '#FFFFFF',
              border: '1px solid var(--border-color)',
              borderRadius: 10,
              boxShadow: '0 12px 32px rgba(0, 0, 0, 0.12), 0 4px 12px rgba(0, 0, 0, 0.06)',
              padding: '14px 16px',
              fontFamily: 'inherit',
              boxSizing: 'border-box',
              animation: 'fadeInTimePicker 0.15s ease-out',
            }}
          >
            {/* Header: Title + Snap to Current Time Button */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingBottom: 10,
                borderBottom: '1px solid #F0EEE9',
                marginBottom: 12,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Clock size={14} style={{ color: '#2C6E6A' }} />
                <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--neutral-dark)' }}>
                  Select Arrival Time
                </span>
              </div>
              <button
                type="button"
                onClick={setToCurrentTime}
                style={{
                  padding: '3px 9px',
                  borderRadius: 5,
                  border: '1px solid #2C6E6A',
                  background: '#E6F0EE',
                  color: '#2C6E6A',
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  transition: 'all 0.12s ease',
                }}
              >
                <Zap size={11} />
                <span>Now</span>
              </button>
            </div>

            {/* SECTION 1: COMMON ARRIVAL PRESETS (The user's favorite!) */}
            <div style={{ marginBottom: 14 }}>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  color: 'var(--text-secondary)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  marginBottom: 8,
                }}
              >
                Common Arrival Presets
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: 6,
                }}
              >
                {COMMON_PRESETS.map((preset) => {
                  const isSelected = value === preset || displayTime === preset;
                  return (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => selectPreset(preset)}
                      style={{
                        height: 28,
                        fontSize: 11,
                        fontWeight: isSelected ? 700 : 500,
                        borderRadius: 6,
                        border: isSelected ? '1px solid #1A1A1A' : '1px solid #E5E3DF',
                        background: isSelected ? '#1A1A1A' : '#FAF9F6',
                        color: isSelected ? '#FFFFFF' : '#333333',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.12s ease',
                      }}
                    >
                      {preset}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* SECTION 2: STRUCTURED CUSTOM TIME SELECTOR */}
            <div
              style={{
                background: '#FAF9F6',
                border: '1px solid #EBE9E4',
                borderRadius: 8,
                padding: '12px 10px',
                marginBottom: 12,
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  color: 'var(--text-secondary)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  marginBottom: 8,
                  textAlign: 'center',
                }}
              >
                Or Set Custom Time
              </div>

              {/* Clean 3-part Selector: [Hour v] : [Minute v] [AM | PM] */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                }}
              >
                {/* Hour Select */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                  <span style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                    Hour
                  </span>
                  <div style={{ position: 'relative' }}>
                    <select
                      value={parsed.hour}
                      onChange={(e) => setHour(parseInt(e.target.value, 10))}
                      style={{
                        height: 34,
                        width: 66,
                        padding: '0 20px 0 8px',
                        fontSize: 13,
                        fontWeight: 700,
                        borderRadius: 6,
                        border: '1px solid #D8D5CF',
                        background: '#FFFFFF',
                        color: '#1A1A1A',
                        outline: 'none',
                        cursor: 'pointer',
                        appearance: 'none',
                        textAlign: 'center',
                      }}
                    >
                      {HOURS_LIST.map((h) => (
                        <option key={h} value={h}>
                          {String(h).padStart(2, '0')}
                        </option>
                      ))}
                    </select>
                    <ChevronDown
                      size={12}
                      style={{
                        position: 'absolute',
                        right: 6,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        pointerEvents: 'none',
                        color: '#888580',
                      }}
                    />
                  </div>
                </div>

                {/* Colon Separator */}
                <span style={{ fontSize: 16, fontWeight: 800, color: '#888580', marginTop: 14 }}>
                  :
                </span>

                {/* Minute Select */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                  <span style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                    Minute
                  </span>
                  <div style={{ position: 'relative' }}>
                    <select
                      value={parsed.minute}
                      onChange={(e) => setMinute(parseInt(e.target.value, 10))}
                      style={{
                        height: 34,
                        width: 66,
                        padding: '0 20px 0 8px',
                        fontSize: 13,
                        fontWeight: 700,
                        borderRadius: 6,
                        border: '1px solid #D8D5CF',
                        background: '#FFFFFF',
                        color: '#1A1A1A',
                        outline: 'none',
                        cursor: 'pointer',
                        appearance: 'none',
                        textAlign: 'center',
                      }}
                    >
                      {/* Common 5m intervals first, followed by specific if needed */}
                      {MINUTES_LIST.map((m) => (
                        <option key={m} value={m}>
                          :{String(m).padStart(2, '0')}
                        </option>
                      ))}
                      {!MINUTES_LIST.includes(parsed.minute) && (
                        <option value={parsed.minute}>
                          :{String(parsed.minute).padStart(2, '0')}
                        </option>
                      )}
                    </select>
                    <ChevronDown
                      size={12}
                      style={{
                        position: 'absolute',
                        right: 6,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        pointerEvents: 'none',
                        color: '#888580',
                      }}
                    />
                  </div>
                </div>

                {/* AM / PM Segmented Control */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, marginLeft: 4 }}>
                  <span style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                    Period
                  </span>
                  <div
                    style={{
                      height: 34,
                      display: 'flex',
                      background: '#ECEAE5',
                      padding: 2,
                      borderRadius: 6,
                      border: '1px solid #DDD9D2',
                    }}
                  >
                    {(['AM', 'PM'] as const).map((p) => {
                      const isSelected = parsed.period === p;
                      return (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setPeriod(p)}
                          style={{
                            height: 28,
                            padding: '0 9px',
                            fontSize: 11.5,
                            fontWeight: 700,
                            borderRadius: 4,
                            border: 'none',
                            background: isSelected ? '#1A1A1A' : 'transparent',
                            color: isSelected ? '#FFFFFF' : '#666460',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 0.12s ease',
                          }}
                        >
                          {p}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Quick Fine-tune Adjusters */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 5,
                  marginTop: 10,
                  paddingTop: 8,
                  borderTop: '1px dashed #E2DFD8',
                }}
              >
                <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)', marginRight: 2 }}>
                  Adjust:
                </span>
                <button
                  type="button"
                  onClick={() => shiftMinutes(-15)}
                  style={{
                    height: 22,
                    padding: '0 6px',
                    fontSize: 10.5,
                    fontWeight: 600,
                    borderRadius: 4,
                    border: '1px solid #E0DDD7',
                    background: '#FFFFFF',
                    color: '#444444',
                    cursor: 'pointer',
                  }}
                >
                  -15m
                </button>
                <button
                  type="button"
                  onClick={() => shiftMinutes(-5)}
                  style={{
                    height: 22,
                    padding: '0 6px',
                    fontSize: 10.5,
                    fontWeight: 600,
                    borderRadius: 4,
                    border: '1px solid #E0DDD7',
                    background: '#FFFFFF',
                    color: '#444444',
                    cursor: 'pointer',
                  }}
                >
                  -5m
                </button>
                <button
                  type="button"
                  onClick={() => shiftMinutes(5)}
                  style={{
                    height: 22,
                    padding: '0 6px',
                    fontSize: 10.5,
                    fontWeight: 600,
                    borderRadius: 4,
                    border: '1px solid #E0DDD7',
                    background: '#FFFFFF',
                    color: '#444444',
                    cursor: 'pointer',
                  }}
                >
                  +5m
                </button>
                <button
                  type="button"
                  onClick={() => shiftMinutes(15)}
                  style={{
                    height: 22,
                    padding: '0 6px',
                    fontSize: 10.5,
                    fontWeight: 600,
                    borderRadius: 4,
                    border: '1px solid #E0DDD7',
                    background: '#FFFFFF',
                    color: '#444444',
                    cursor: 'pointer',
                  }}
                >
                  +15m
                </button>
              </div>
            </div>

            {/* Footer Summary & Done Button */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingTop: 2,
              }}
            >
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                Time:{' '}
                <strong style={{ color: 'var(--neutral-dark)', fontSize: 13 }}>
                  {displayTime}
                </strong>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                style={{
                  height: 30,
                  padding: '0 16px',
                  borderRadius: 6,
                  border: 'none',
                  background: '#1A1A1A',
                  color: '#FFFFFF',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  transition: 'background 0.15s ease',
                }}
              >
                <span>Done</span>
              </button>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
