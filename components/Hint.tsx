import type { ReactNode } from "react";

/** Short explanation behind a small "؟" button, instead of a permanent paragraph. No JS needed. */
export default function Hint({ children }: { children: ReactNode }) {
  return (
    <details className="hint">
      <summary aria-label="شرح">؟</summary>
      <span role="note">{children}</span>
    </details>
  );
}
