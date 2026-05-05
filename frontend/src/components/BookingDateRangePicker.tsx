"use client";

import * as React from "react";
import { DayPicker, type DateRange } from "react-day-picker";

type Props = {
  value: DateRange | undefined;
  onChange: (next: DateRange | undefined) => void;
  reservedDates: Date[];
  className?: string;
};

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function rangeIncludesReserved(range: DateRange, reserved: Date[]) {
  if (!range.from || !range.to) return false;
  const from = startOfDay(range.from).getTime();
  const to = startOfDay(range.to).getTime();
  const min = Math.min(from, to);
  const max = Math.max(from, to);

  for (const r of reserved) {
    const t = startOfDay(r).getTime();
    if (t >= min && t <= max) return true;
  }
  return false;
}

export default function BookingDateRangePicker({
  value,
  onChange,
  reservedDates,
  className,
}: Props) {
  const [error, setError] = React.useState<string | null>(null);

  const reservedDaysUnique = React.useMemo(() => {
    const unique: Date[] = [];
    for (const d of reservedDates) {
      const day = startOfDay(d);
      if (!unique.some((u) => isSameDay(u, day))) unique.push(day);
    }
    return unique;
  }, [reservedDates]);

  return (
    <div className={className}>
      <div className="flex items-center justify-between gap-3 mb-2">
        <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide">
          Choose dates
        </p>
        <div className="flex items-center gap-2 text-[11px] text-slate-600">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded bg-red-200 border border-red-300" />
            Reserved
          </span>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-2">
        <DayPicker
          mode="range"
          selected={value}
          onSelect={(next) => {
            setError(null);
            if (next?.from && next?.to && rangeIncludesReserved(next, reservedDaysUnique)) {
              setError("That range overlaps reserved dates.");
              return;
            }
            onChange(next);
          }}
          numberOfMonths={1}
          disabled={reservedDaysUnique}
          modifiers={{ reserved: reservedDaysUnique }}
          modifiersClassNames={{
            reserved:
              "bg-red-100 text-red-700 border border-red-200 rounded-md !cursor-not-allowed",
          }}
          classNames={{
            months: "flex flex-col",
            month: "w-full",
            caption: "flex items-center justify-between px-2 py-2",
            caption_label: "text-sm font-semibold text-slate-900",
            nav: "flex items-center gap-1",
            nav_button:
              "h-8 w-8 inline-flex items-center justify-center rounded-md border border-slate-200 text-slate-700 hover:bg-slate-50",
            table: "w-full border-collapse",
            head_row: "grid grid-cols-7 px-1",
            head_cell:
              "text-[11px] font-medium text-slate-500 text-center py-1",
            row: "grid grid-cols-7 px-1",
            cell: "p-0.5",
            day: "h-9 w-full rounded-md text-sm text-slate-800 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-900/30",
            day_selected:
              "bg-slate-900 text-white hover:bg-slate-900 focus:bg-slate-900",
            day_range_start:
              "bg-slate-900 text-white hover:bg-slate-900 focus:bg-slate-900",
            day_range_end:
              "bg-slate-900 text-white hover:bg-slate-900 focus:bg-slate-900",
            day_range_middle: "bg-slate-100 text-slate-900",
            day_today: "border border-slate-300",
            day_outside: "text-slate-300",
            day_disabled: "text-slate-300 !cursor-not-allowed",
          }}
        />
      </div>

      {error && (
        <p className="mt-2 text-[11px] text-red-700 bg-red-50 border border-red-100 rounded-md px-2 py-1">
          {error}
        </p>
      )}
    </div>
  );
}

