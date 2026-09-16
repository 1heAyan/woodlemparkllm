'use client';

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CalendarClock, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';

interface DateTimePickerProps {
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  placeholder?: string;
  accent?: string;
}

/* ───────────── helpers ───────────── */

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const HOURS = Array.from({ length: 12 }, (_, i) => String(i + 1));
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));
const ITEM_H = 32;

const pad = (n: number) => String(n).padStart(2, '0');

/** Convert a Date into the local "YYYY-MM-DDTHH:mm" string this picker always works with. */
const toLocalInput = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

const parseLocal = (v?: string): Date | null => {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
};

const startOfDay = (d: Date) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

const formatDisplay = (value: string): string => {
  const d = parseLocal(value);
  if (!d) return '';
  const dateStr = d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  const timeStr = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  return `${dateStr} · ${timeStr}`;
};

const format12 = (hour24: number) => ((hour24 + 11) % 12) + 1;
const periodOf = (hour24: number) => (hour24 < 12 ? 'AM' : 'PM');

const applyHour = (d: Date, h12: number) => {
  const next = new Date(d);
  const isPm = next.getHours() >= 12;
  next.setHours(isPm ? (h12 % 12) + 12 : h12 % 12);
  return next;
};
const applyMinute = (d: Date, m: number) => {
  const next = new Date(d);
  next.setMinutes(m);
  return next;
};
const applyPeriod = (d: Date, pm: boolean) => {
  const next = new Date(d);
  const h = next.getHours();
  if (pm && h < 12) next.setHours(h + 12);
  if (!pm && h >= 12) next.setHours(h - 12);
  return next;
};

const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/* ───────────── time scroll column ───────────── */

const TimeScrollColumn: React.FC<{
  items: string[];
  value: string;
  onChange: (v: string) => void;
  label: string;
}> = ({ items, value, onChange, label }) => {
  const ref = useRef<HTMLDivElement>(null);
  const idx = items.indexOf(value);

  useEffect(() => {
    const el = ref.current;
    if (!el || idx < 0) return;
    const target = idx * ITEM_H;
    if (Math.abs(el.scrollTop - target) > 2) el.scrollTop = target;
  }, [idx]);

  const handleScroll = () => {
    const el = ref.current;
    if (!el) return;
    const i = Math.max(0, Math.min(items.length - 1, Math.round(el.scrollTop / ITEM_H)));
    if (items[i] !== value) onChange(items[i]);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, minWidth: 0 }}>
      <div
        className="dt-time-scroll"
        ref={ref}
        onScroll={handleScroll}
        role="listbox"
        aria-label={label}
      >
        {items.map((it) => {
          const active = it === value;
          return (
            <div
              key={it}
              role="option"
              aria-selected={active}
              className={`dt-time-opt${active ? ' dt-time-opt-active' : ''}`}
              style={{ height: ITEM_H, lineHeight: `${ITEM_H}px` }}
              onClick={() => {
                onChange(it);
                const el = ref.current;
                if (el) el.scrollTop = items.indexOf(it) * ITEM_H;
              }}
            >
              {it}
            </div>
          );
        })}
      </div>
      <div style={{ fontSize: 10.5, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
      </div>
    </div>
  );
};

/* ───────────── picker ───────────── */

export const DateTimePicker: React.FC<DateTimePickerProps> = ({
  value,
  onChange,
  min,
  max,
  placeholder = 'Select date & time',
  accent = '#2C6E6A',
}) => {
  const triggerRef = useRef<HTMLDivElement>(null);
  const popRef = useRef<HTMLDivElement>(null);

  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const [viewDate, setViewDate] = useState<Date>(() => parseLocal(value) || new Date());
  const [draft, setDraft] = useState<Date>(() => parseLocal(value) || new Date());
  const [pos, setPos] = useState<{ topLeft: { top: number; left: number }; width: number }>({ topLeft: { top: 0, left: 0 }, width: 348 });

  const isEmpty = !value;
  const display = value ? formatDisplay(value) : '';
  const minDate = useMemo(() => (min ? parseLocal(min) : null), [min]);
  const maxDate = useMemo(() => (max ? parseLocal(max) : null), [max]);

  const openPop = useCallback(() => {
    setDraft(parseLocal(value) || new Date());
    setViewDate(parseLocal(value) || new Date());
    setOpen(true);
  }, [value]);

  /* Reposition relative to trigger, flip up when no room below, clamp to viewport. */
  const computePos = useCallback((heightHint: number) => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const gap = 8;
    const width = Math.min(348, window.innerWidth - 24);
    const left = Math.max(gap, Math.min(rect.left, window.innerWidth - width - gap));
    const spaceBelow = window.innerHeight - rect.bottom - gap;
    const spaceAbove = rect.top - gap;
    const placeAbove = heightHint > spaceBelow && heightHint <= spaceAbove;
    const top = placeAbove ? rect.bottom - heightHint - gap : rect.bottom + gap;
    setPos({ topLeft: { top, left }, width });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    const measureAndPlace = () => {
      const h = popRef.current?.offsetHeight || 560;
      computePos(h);
    };
    measureAndPlace();
    window.addEventListener('resize', measureAndPlace);
    window.addEventListener('scroll', measureAndPlace, true);
    return () => {
      window.removeEventListener('resize', measureAndPlace);
      window.removeEventListener('scroll', measureAndPlace, true);
    };
  }, [open, computePos]);

  /* Close on outside click + Escape. */
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      const t = e.target as Node;
      if (popRef.current?.contains(t) || triggerRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const monthLabel = `${MONTHS[viewDate.getMonth()]} ${viewDate.getFullYear()}`;

  const cells = useMemo(() => {
    const first = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1);
    const startOffset = first.getDay();
    return Array.from({ length: 42 }, (_, i) => new Date(viewDate.getFullYear(), viewDate.getMonth(), 1 - startOffset + i));
  }, [viewDate]);

  /* A date is disabled ONLY when it falls outside the permitted range.
     Being in an adjacent month never makes a date disabled. */
  const isDisabled = (d: Date) => {
    const day = startOfDay(d);
    if (minDate && day < startOfDay(minDate)) return true;
    if (maxDate && day > startOfDay(maxDate)) return true;
    return false;
  };

  const today = new Date();
  const hasValue = !!parseLocal(value);

  const commit = () => {
    onChange(toLocalInput(draft));
    setOpen(false);
    triggerRef.current?.focus();
  };

  const cancel = () => {
    setOpen(false);
    triggerRef.current?.focus();
  };

  const clear = () => {
    onChange('');
    setOpen(false);
    triggerRef.current?.focus();
  };

  const selected = parseLocal(value);

  const popup = open
    ? createPortal(
        <div
          ref={popRef}
          role="dialog"
          aria-label={placeholder}
          className="dt-pop"
          style={{ top: pos.topLeft.top, left: pos.topLeft.left, width: pos.width }}
        >
          {/* Header */}
          <div className="dt-pop-head">
            <div className="dt-pop-title">{hasValue ? 'Update date & time' : 'Select date & time'}</div>
          </div>

          {/* Month navigation */}
          <div className="dt-month-nav">
            <button
              type="button"
              className="dt-icon-btn"
              aria-label="Previous month"
              onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1))}
            >
              <ChevronLeft size={16} />
            </button>
            <span className="dt-month-label">{monthLabel}</span>
            <button
              type="button"
              className="dt-icon-btn"
              aria-label="Next month"
              onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1))}
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Weekday labels */}
          <div className="dt-weekdays">
            {WEEKDAYS.map((w) => (
              <span key={w} className="dt-weekday">{w}</span>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="dt-days">
            {cells.map((d, i) => {
              const isOutOfMonth = d.getMonth() !== viewDate.getMonth();
              const disabled = isDisabled(d);
              const isToday = isSameDay(d, today);
              const isSelected = selected ? isSameDay(d, selected) : false;
              const isDraft = isSameDay(d, draft);
              return (
                <button
                  type="button"
                  key={i}
                  className={[
                    'dt-day',
                    isOutOfMonth ? 'dt-day-out' : '',
                    disabled ? 'dt-day-disabled' : '',
                    isToday ? 'dt-day-today' : '',
                    isSelected ? 'dt-day-selected' : '',
                    !isSelected && isDraft ? 'dt-day-draft' : '',
                  ].join(' ')}
                  disabled={disabled}
                  aria-label={d.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                  aria-pressed={isSelected}
                  onClick={() => {
                    const next = new Date(d);
                    next.setHours(draft.getHours(), draft.getMinutes());
                    setDraft(next);
                    if (isOutOfMonth) setViewDate(new Date(d.getFullYear(), d.getMonth(), 1));
                  }}
                >
                  {d.getDate()}
                </button>
              );
            })}
          </div>

          {/* Divider */}
          <div className="dt-divider" />

          {/* Time */}
          <div className="dt-time-row">
            <div className="dt-time-group" role="group" aria-label="Set time">
              <TimeScrollColumn items={HOURS} value={String(format12(draft.getHours()))} onChange={(h) => setDraft((d) => applyHour(d, parseInt(h, 10)))} label="Hour" />
              <span className="dt-time-sep" aria-hidden="true">:</span>
              <TimeScrollColumn items={MINUTES} value={pad(draft.getMinutes())} onChange={(m) => setDraft((d) => applyMinute(d, parseInt(m, 10)))} label="Minute" />
              <span style={{ width: 6 }} />
              <div className="dt-period-col">
                <div className="dt-period" role="group" aria-label="AM or PM">
                  {(['AM', 'PM'] as const).map((p) => {
                    const active = periodOf(draft.getHours()) === p;
                    return (
                      <button
                        key={p}
                        type="button"
                        className={`dt-period-btn${active ? ' dt-period-active' : ''}`}
                        aria-pressed={active}
                        onClick={() => setDraft((d) => applyPeriod(d, p === 'PM'))}
                      >
                        {p}
                      </button>
                    );
                  })}
                </div>
                <div style={{ fontSize: 10.5, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 6 }}>
                  Period
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="dt-footer">
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {hasValue && (
                <button type="button" className="dt-clear-btn" onClick={clear}>
                  Clear
                </button>
              )}
              <button type="button" className="dt-cancel-btn" onClick={cancel}>
                Cancel
              </button>
              <button type="button" className="dt-done-btn" onClick={commit}>
                Done
              </button>
            </div>
          </div>
        </div>,
        document.body
      )
    : null;

  return (
    <>
      <style>{`
        .dtp-shell {
          position: relative;
          display: block;
          width: 100%;
        }

        .dtp-trigger {
          position: relative;
          width: 100%;
          padding: 11px 38px 11px 40px;
          border: 1px solid ${focused ? accent : '#CBD5E1'};
          border-radius: 10px;
          background: #FFFFFF;
          outline: none;
          cursor: pointer;
          text-align: left;
          font-family: inherit;
          font-size: 13.5px;
          transition: border-color 0.15s ease, box-shadow 0.15s ease;
        }
        .dtp-trigger:hover { border-color: #94A3B8; }
        .dtp-shell.dtp-focused .dtp-trigger {
          border-color: ${accent};
          box-shadow: 0 0 0 3px ${accent}26;
        }
        .dtp-trigger.has-value { color: #1F2937; font-weight: 600; }
        .dtp-trigger.is-empty { color: #9AA7B5; font-weight: 500; }

        /* Popover */
        .dt-pop {
          position: fixed;
          z-index: 200000;
          background: #FFFFFF;
          border: 1px solid #E7E5E0;
          border-radius: 14px;
          box-shadow: 0 16px 48px rgba(28, 27, 25, 0.14), 0 2px 8px rgba(28, 27, 25, 0.06);
          padding: 14px 16px 12px;
          box-sizing: border-box;
          max-height: calc(100vh - 16px);
          overflow-y: auto;
          color: #2D2C2A;
          font-family: inherit;
          user-select: none;
        }

        .dt-pop-head { padding: 0 2px 10px; }
        .dt-pop-title { font-size: 12.5px; font-weight: 700; color: #2D2C2A; }

        .dt-month-nav {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          margin-bottom: 8px;
        }
        .dt-month-label { font-size: 13.5px; font-weight: 700; color: #2D2C2A; flex: 1; text-align: center; }

        .dt-icon-btn {
          border: 1px solid #E5E3DF;
          background: #FFFFFF;
          width: 28px;
          height: 28px;
          border-radius: 8px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          color: #57534E;
          transition: background 0.12s ease, border-color 0.12s ease;
        }
        .dt-icon-btn:hover { background: #F5F4F2; border-color: #D6D3CC; }

        .dt-weekdays {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          margin-bottom: 4px;
        }
        .dt-weekday {
          text-align: center;
          font-size: 10.5px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          color: #A8A5A0;
          padding: 4px 0;
        }

        .dt-days {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          gap: 2px;
        }
        .dt-day {
          border: none;
          background: transparent;
          border-radius: 8px;
          height: 34px;
          font-size: 13px;
          font-family: inherit;
          color: #2D2C2A;
          cursor: pointer;
          transition: background 0.1s ease, color 0.1s ease;
        }
        .dt-day:hover:not(:disabled) { background: #F1EFEC; }
        .dt-day-out { color: #7A7672; }
        .dt-day-out:hover:not(:disabled) { background: #F1EFEC; color: #2D2C2A; }
        .dt-day-disabled { color: #D6D3CE; cursor: not-allowed; }
        .dt-day-disabled:hover { background: transparent; }
        .dt-day-today { position: relative; }
        .dt-day-today:not(.dt-day-selected)::after {
          content: '';
          position: absolute;
          left: 50%;
          bottom: 4px;
          transform: translateX(-50%);
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: ${accent};
        }
        .dt-day-draft { box-shadow: inset 0 0 0 1.5px ${accent}; }
        .dt-day-selected {
          background: ${accent};
          color: #FFFFFF;
          font-weight: 700;
        }
        .dt-day-selected:hover:not(:disabled) { background: ${accent}; }
        .dt-day-selected::after { display: none; }
        .dt-day:focus-visible {
          outline: 2px solid ${accent};
          outline-offset: -1px;
        }

        .dt-divider {
          height: 1px;
          background: #EFEDE9;
          margin: 12px 0 10px;
        }

        .dt-time-row { display: flex; justify-content: center; }
        .dt-time-group {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 4px;
          border-radius: 10px;
        }
        .dt-time-sep {
          font-size: 18px;
          font-weight: 700;
          color: #A8A5A0;
          align-self: flex-start;
          margin-top: 34px;
          padding: 0 2px;
        }

        .dt-time-scroll {
          width: 48px;
          height: ${ITEM_H * 3}px;
          overflow-y: auto;
          scrollbar-width: none;
          padding: ${ITEM_H}px 0;
          box-sizing: content-box;
          border-radius: 10px;
          background: #FAFAF8;
          border: 1px solid #EFEDE9;
          scroll-behavior: smooth;
        }
        .dt-time-scroll::-webkit-scrollbar { display: none; }
        .dt-time-opt {
          font-size: 13px;
          text-align: center;
          color: #78746E;
          cursor: pointer;
          border-radius: 6px;
          transition: background 0.1s ease, color 0.1s ease;
        }
        .dt-time-opt:hover { background: #F1EFEC; color: #2D2C2A; }
        .dt-time-opt-active {
          background: ${accent};
          color: #FFFFFF;
          font-weight: 700;
        }
        .dt-time-opt-active:hover { background: ${accent}; color: #FFFFFF; }

        .dt-period-col { display: flex; flex-direction: column; align-items: center; }
        .dt-period {
          display: flex;
          flex-direction: column;
          gap: 4px;
          height: ${ITEM_H * 3}px;
          justify-content: space-between;
        }
        .dt-period-btn {
          width: 46px;
          height: ${ITEM_H - 4}px;
          border: 1px solid #E5E3DF;
          background: #FAFAF8;
          border-radius: 8px;
          font-family: inherit;
          font-size: 12.5px;
          font-weight: 700;
          color: #78746E;
          cursor: pointer;
          transition: all 0.12s ease;
        }
        .dt-period-btn:hover { background: #F1EFEC; color: #2D2C2A; }
        .dt-period-active {
          background: ${accent};
          border-color: ${accent};
          color: #FFFFFF;
        }
        .dt-period-active:hover { background: ${accent}; color: #FFFFFF; }

        .dt-footer {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 8px;
          margin-top: 12px;
          padding-top: 10px;
          border-top: 1px solid #EFEDE9;
        }
        .dt-clear-btn {
          border: none;
          background: transparent;
          color: #B4533A;
          font-size: 12.5px;
          font-weight: 600;
          font-family: inherit;
          cursor: pointer;
          padding: 7px 10px;
          border-radius: 6px;
        }
        .dt-clear-btn:hover { background: #FDF1F0; }
        .dt-cancel-btn {
          border: 1px solid #E5E3DF;
          background: #FFFFFF;
          color: #57534E;
          font-size: 12.5px;
          font-weight: 600;
          font-family: inherit;
          cursor: pointer;
          padding: 7px 14px;
          border-radius: 8px;
        }
        .dt-cancel-btn:hover { background: #F5F4F2; }
        .dt-done-btn {
          border: none;
          background: ${accent};
          color: #FFFFFF;
          font-size: 12.5px;
          font-weight: 700;
          font-family: inherit;
          cursor: pointer;
          padding: 7px 18px;
          border-radius: 8px;
        }
        .dt-done-btn:hover { background: #245A56; }
        .dt-done-btn:focus-visible,
        .dt-cancel-btn:focus-visible,
        .dt-clear-btn:focus-visible,
        .dt-period-btn:focus-visible,
        .dt-icon-btn:focus-visible {
          outline: 2px solid ${accent};
          outline-offset: 1px;
        }
      `}</style>

      <div className={`dtp-shell${focused ? ' dtp-focused' : ''}`}>
        <div
          ref={triggerRef}
          role="button"
          tabIndex={0}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-label={placeholder}
          className={`dtp-trigger ${isEmpty ? 'is-empty' : 'has-value'}`}
          onClick={() => (open ? cancel() : openPop())}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              open ? cancel() : openPop();
            }
          }}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        >
          <CalendarClock
            size={17}
            style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: accent, pointerEvents: 'none' }}
          />
          <span>{isEmpty ? placeholder : display}</span>
          <ChevronDown
            size={15}
            style={{ position: 'absolute', right: 13, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8', pointerEvents: 'none' }}
          />
        </div>
      </div>

      {popup}
    </>
  );
};

export default DateTimePicker;