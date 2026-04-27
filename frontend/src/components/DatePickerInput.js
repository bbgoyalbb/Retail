import { useState } from "react";
import { format, parseISO, isValid } from "date-fns";
import { CalendarBlank } from "@phosphor-icons/react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";

/**
 * A styled date picker input that wraps the shadcn Calendar inside a Popover.
 * value: ISO date string "YYYY-MM-DD" or ""
 * onChange: (isoString) => void
 * placeholder: string
 * className: extra classes for the trigger button
 */
export function DatePickerInput({ value, onChange, placeholder = "Pick a date", className = "" }) {
  const [open, setOpen] = useState(false);

  const parsed = value ? parseISO(value) : undefined;
  const selected = parsed && isValid(parsed) ? parsed : undefined;
  const display = selected ? format(selected, "dd MMM yyyy") : null;

  const handleSelect = (day) => {
    if (day) {
      onChange(format(day, "yyyy-MM-dd"));
    } else {
      onChange("");
    }
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`flex items-center gap-2 px-3 py-2 text-sm border border-[var(--border-subtle)] rounded-sm focus:outline-none focus:ring-1 focus:ring-[var(--brand)] bg-[var(--surface)] text-left ${!display ? "text-[var(--text-secondary)]" : "text-[var(--text-primary)]"} ${className}`}
        >
          <CalendarBlank size={14} className="flex-shrink-0 text-[var(--text-secondary)]" />
          <span className="flex-1 truncate">{display || placeholder}</span>
          {value && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => { e.stopPropagation(); onChange(""); }}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.stopPropagation(); onChange(""); } }}
              className="ml-1 text-[var(--text-secondary)] hover:text-[var(--error)] leading-none"
              aria-label="Clear date"
            >
              ✕
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          onSelect={handleSelect}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}
