"use client";

import { useState } from "react";

/** Groups digits with a space every 3 places from the right — e.g. "63000000" -> "63 000 000". */
export function formatThousands(digits: string): string {
  if (!digits) return "";
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

function toDigits(value: string): string {
  return value.replace(/\D/g, "");
}

/**
 * Whole-number input (Ft amounts, m² counts) that shows a thousands-grouped
 * display while typing, but keeps the field's own `name` submitting clean
 * digits via a hidden input — server actions parsing `formData.get(name)`
 * need no changes.
 */
export function FormattedNumberInput({
  name,
  defaultValue,
  className,
  placeholder,
}: {
  name: string;
  defaultValue?: string | number | null;
  className?: string;
  placeholder?: string;
}) {
  const [digits, setDigits] = useState(() =>
    toDigits(String(defaultValue ?? "")),
  );

  return (
    <>
      <input
        type="text"
        inputMode="numeric"
        placeholder={placeholder}
        value={formatThousands(digits)}
        onChange={(e) => setDigits(toDigits(e.target.value))}
        className={className}
      />
      <input type="hidden" name={name} value={digits} />
    </>
  );
}
