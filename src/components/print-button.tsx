"use client";

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-full border border-border px-5 py-2.5 font-medium hover:bg-accent-soft"
    >
      Print
    </button>
  );
}
