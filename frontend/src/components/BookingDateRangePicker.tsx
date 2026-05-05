"use client";

import * as React from "react";
import { format } from "date-fns";
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
      </div>

      <div className="flex items-center gap-3 text-[11px] text-slate-500 mb-2 px-1">
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-green-600 inline-block" /> Selected
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-green-100 inline-block border border-green-200" />{" "}
          In range
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-red-100 inline-block border border-red-300" />{" "}
          Reserved
        </span>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-3">
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
          captionLayout="dropdown"
          fromYear={new Date().getFullYear()}
          toYear={new Date().getFullYear() + 5}
          numberOfMonths={1}
          disabled={reservedDaysUnique}
          modifiers={{ reserved: reservedDaysUnique }}
          modifiersClassNames={{
            reserved:
              "text-red-400 opacity-70 !cursor-not-allowed [&>button]:line-through [&>button]:bg-red-50 [&>button]:border [&>button]:border-red-200 [&>button]:text-red-500",
            selected:
              "[&>button]:bg-green-600 [&>button]:text-white [&>button]:font-semibold [&>button]:shadow-sm [&>button]:hover:bg-green-600 [&>button]:focus:bg-green-600",
            range_start:
              "bg-green-50 rounded-l-full [&>button]:bg-green-600 [&>button]:text-white [&>button]:font-semibold [&>button]:rounded-full [&>button]:shadow-sm",
            range_end:
              "bg-green-50 rounded-r-full [&>button]:bg-green-600 [&>button]:text-white [&>button]:font-semibold [&>button]:rounded-full [&>button]:shadow-sm",
            range_middle:
              "bg-green-50 text-slate-900 rounded-none [&>button]:bg-transparent [&>button]:text-slate-700 [&>button]:font-medium",
            today:
              "[&>button]:relative [&>button]:after:content-[''] [&>button]:after:absolute [&>button]:after:bottom-1 [&>button]:after:left-1/2 [&>button]:after:-translate-x-1/2 [&>button]:after:h-1 [&>button]:after:w-1 [&>button]:after:rounded-full [&>button]:after:bg-slate-400",
            disabled: "text-slate-300 opacity-40 !cursor-not-allowed",
          }}
          classNames={{
            months: "flex flex-col",
            month: "w-full space-y-2",
            caption: "flex items-center justify-between px-1 py-1 mb-1",
            caption_label: "text-sm font-semibold text-slate-900",
            nav: "flex items-center gap-1",
            nav_button:
              "h-7 w-7 inline-flex items-center justify-center rounded-full border border-slate-200 text-slate-700 hover:bg-slate-50",
            nav_button_previous: "",
            nav_button_next: "",
            dropdown: "rounded-md border border-slate-200 bg-white px-2 py-1 text-sm",
            dropdown_month: "",
            dropdown_year: "",
            dropdowns: "flex items-center gap-2",
            table: "w-full border-collapse",
            head_row: "flex",
            head_cell:
              "text-[11px] font-medium text-slate-500 w-9 text-center py-1",
            row: "flex w-full mt-0.5",
            cell: "h-9 w-9 p-0 text-center",
            day: "h-9 w-9 p-0 text-sm text-slate-800 hover:bg-transparent focus:outline-none",
            day_button:
              "h-8 w-8 rounded-full border border-transparent text-sm text-slate-800 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-900/20 transition-colors",
            day_outside: "text-slate-300",
          }}
        />
      </div>

      {(value?.from || value?.to) && (
        <div className="mt-2 flex items-center justify-between rounded-md bg-green-50 border border-green-200 px-3 py-2 text-sm">
          <span className="text-slate-600">
            <span className="font-semibold text-green-700">Start:</span>{" "}
            {value?.from ? format(value.from, "MMM d, yyyy") : "—"}
          </span>
          <span className="text-slate-400 mx-2">→</span>
          <span className="text-slate-600">
            <span className="font-semibold text-green-700">End:</span>{" "}
            {value?.to ? format(value.to, "MMM d, yyyy") : "Not selected"}
          </span>
        </div>
      )}

      {(value?.from || value?.to) && (
        <div className="mt-2 flex items-center justify-end">
          <button
            type="button"
            className="text-xs font-medium text-slate-600 hover:text-slate-900 underline underline-offset-2"
            onClick={() => {
              setError(null);
              onChange(undefined);
            }}
          >
            Clear dates
          </button>
        </div>
      )}

      {error && (
        <p className="mt-2 text-[11px] text-red-700 bg-red-50 border border-red-100 rounded-md px-2 py-1">
          {error}
        </p>
      )}
    </div>
  );
}

