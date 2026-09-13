"use client";

import { useCallback, useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import {
  DAYS,
  GRID_TEMPLATE_COLUMNS,
  TIMES,
  dayLabel,
  formatTime,
  shortDate,
  slotKey,
  weekDates,
  type Locale,
} from "@/lib/schedule";

type Cell = { d: number; t: number };
type DragState = { anchor: Cell; current: Cell; mode: "add" | "remove"; base: Set<string> };
type TouchState = {
  cell: Cell;
  startX: number;
  startY: number;
  timer: ReturnType<typeof setTimeout> | null;
  dragging: boolean;
};

const LONG_PRESS_MS = 250;
const MOVE_TOLERANCE_PX = 10;

function cellFromElement(el: EventTarget | Element | null): Cell | null {
  if (!(el instanceof Element)) return null;
  const node = el.closest<HTMLElement>("[data-cell]");
  if (!node) return null;
  return { d: Number(node.dataset.d), t: Number(node.dataset.t) };
}

/** Applies the drag rectangle (anchor → current) to the snapshot taken at drag start. */
function applyDrag(drag: DragState) {
  const next = new Set(drag.base);
  const [d0, d1] = [drag.anchor.d, drag.current.d].sort((a, b) => a - b);
  const [t0, t1] = [drag.anchor.t, drag.current.t].sort((a, b) => a - b);
  for (let d = d0; d <= d1; d++) {
    for (let t = t0; t <= t1; t++) {
      const key = slotKey(DAYS[d], TIMES[t]);
      if (drag.mode === "add") next.add(key);
      else next.delete(key);
    }
  }
  return next;
}

/**
 * When2Meet-style availability grid.
 * Desktop: click or click-and-drag. Touch: tap to toggle, press-and-hold then drag to paint.
 */
export default function AvailabilityGrid({
  weekStart,
  selected,
  onChange,
  highlighted,
  locale = "en",
  disabled = false,
}: {
  weekStart: string;
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
  /** Slots to outline, e.g. times when Jay is available. */
  highlighted?: Set<string>;
  locale?: Locale;
  disabled?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const touchRef = useRef<TouchState | null>(null);
  const selectedRef = useRef(selected);
  const onChangeRef = useRef(onChange);
  const [preview, setPreview] = useState<Set<string> | null>(null);

  useEffect(() => {
    selectedRef.current = selected;
    onChangeRef.current = onChange;
  });

  const begin = useCallback(
    (cell: Cell) => {
      if (disabled) return;
      const base = new Set(selectedRef.current);
      const mode = base.has(slotKey(DAYS[cell.d], TIMES[cell.t])) ? "remove" : "add";
      dragRef.current = { anchor: cell, current: cell, mode, base };
      setPreview(applyDrag(dragRef.current));
    },
    [disabled],
  );

  const move = useCallback((cell: Cell) => {
    const drag = dragRef.current;
    if (!drag || (drag.current.d === cell.d && drag.current.t === cell.t)) return;
    drag.current = cell;
    setPreview(applyDrag(drag));
  }, []);

  const end = useCallback(() => {
    const drag = dragRef.current;
    if (!drag) return;
    dragRef.current = null;
    setPreview(null);
    onChangeRef.current(applyDrag(drag));
  }, []);

  // Mouse: finish the drag even if released outside the grid.
  useEffect(() => {
    window.addEventListener("mouseup", end);
    return () => window.removeEventListener("mouseup", end);
  }, [end]);

  // Touch: native listeners so touchmove can be non-passive (blocks scroll while painting).
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const cancelTouch = () => {
      if (touchRef.current?.timer) clearTimeout(touchRef.current.timer);
      touchRef.current = null;
    };

    const onTouchStart = (e: TouchEvent) => {
      cancelTouch();
      if (e.touches.length !== 1) return;
      const cell = cellFromElement(e.target);
      if (!cell) return;
      const touch = e.touches[0];
      const state: TouchState = {
        cell,
        startX: touch.clientX,
        startY: touch.clientY,
        dragging: false,
        timer: null,
      };
      state.timer = setTimeout(() => {
        state.timer = null;
        state.dragging = true;
        begin(cell);
        navigator.vibrate?.(10);
      }, LONG_PRESS_MS);
      touchRef.current = state;
    };

    const onTouchMove = (e: TouchEvent) => {
      const state = touchRef.current;
      if (!state) return;
      const touch = e.touches[0];
      if (state.dragging) {
        if (e.cancelable) e.preventDefault();
        const cell = cellFromElement(document.elementFromPoint(touch.clientX, touch.clientY));
        if (cell) move(cell);
      } else if (
        Math.hypot(touch.clientX - state.startX, touch.clientY - state.startY) > MOVE_TOLERANCE_PX
      ) {
        cancelTouch(); // user is scrolling
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      const state = touchRef.current;
      if (!state) return;
      touchRef.current = null;
      if (state.dragging) {
        e.preventDefault();
        end();
      } else if (state.timer) {
        clearTimeout(state.timer);
        e.preventDefault(); // suppress the emulated mouse click
        begin(state.cell);
        end();
      }
    };

    const onTouchCancel = () => {
      if (touchRef.current?.dragging) end();
      cancelTouch();
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd, { passive: false });
    el.addEventListener("touchcancel", onTouchCancel);
    return () => {
      cancelTouch();
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", onTouchCancel);
    };
  }, [begin, move, end]);

  const onMouseDown = (e: ReactMouseEvent) => {
    if (e.button !== 0) return;
    const cell = cellFromElement(e.target);
    if (!cell) return;
    e.preventDefault();
    begin(cell);
  };

  const onMouseOver = (e: ReactMouseEvent) => {
    const cell = cellFromElement(e.target);
    if (cell) move(cell);
  };

  const shown = preview ?? selected;
  const dates = weekDates(weekStart);

  return (
    <div className="overflow-x-auto overscroll-x-contain rounded-xl border border-stone-200 [-webkit-touch-callout:none]">
      <div
        ref={containerRef}
        role="grid"
        aria-label={locale === "ko" ? "가능 시간 선택" : "Availability grid"}
        aria-disabled={disabled}
        onMouseDown={onMouseDown}
        onMouseOver={onMouseOver}
        className={`grid w-full min-w-[520px] select-none bg-white sm:min-w-0 ${
          disabled ? "pointer-events-none opacity-60" : ""
        }`}
        style={{ gridTemplateColumns: GRID_TEMPLATE_COLUMNS }}
      >
        {/* Header row */}
        <div className="sticky left-0 z-10 border-b border-stone-200 bg-white" />
        {DAYS.map((day, d) => (
          <div
            key={day}
            role="columnheader"
            className="border-b border-l border-stone-200 px-1 py-2 text-center"
          >
            <div className="text-xs font-semibold text-stone-800">{dayLabel(d, locale)}</div>
            <div className="text-[11px] text-stone-400">{shortDate(dates[d])}</div>
          </div>
        ))}

        {TIMES.map((time, t) => {
          const onHour = time.endsWith(":00");
          return (
            <div key={time} role="row" className="contents">
              <div
                role="rowheader"
                className="sticky left-0 z-10 -mt-px whitespace-nowrap bg-white pr-2 text-right text-[10.5px] leading-none text-stone-400"
              >
                {onHour && <span className="relative -top-1.5">{formatTime(time, locale)}</span>}
              </div>
              {DAYS.map((day, d) => {
                const key = slotKey(day, time);
                const isOn = shown.has(key);
                const isHighlighted = highlighted?.has(key) ?? false;
                return (
                  <div
                    key={key}
                    role="gridcell"
                    aria-selected={isOn}
                    aria-label={`${dayLabel(d, locale)} ${formatTime(time, locale)}`}
                    data-cell=""
                    data-d={d}
                    data-t={t}
                    className={`relative h-7 cursor-pointer border-l border-stone-200 transition-colors duration-75 sm:h-6 ${
                      onHour ? "border-t border-t-stone-200" : "border-t border-t-stone-100"
                    } ${isOn ? "bg-emerald-500 hover:bg-emerald-600" : "hover:bg-emerald-50"} ${
                      isHighlighted
                        ? isOn
                          ? "shadow-[inset_0_0_0_2px_#1d4ed8]"
                          : "bg-sky-50 shadow-[inset_0_0_0_2px_#60a5fa]"
                        : ""
                    }`}
                  >
                    {isOn && isHighlighted && (
                      <span className="pointer-events-none absolute inset-0 grid place-items-center text-[11px] leading-none text-white">
                        ★
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
