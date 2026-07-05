// apps/tours/web/src/app/(app)/admin/auditoria/_components/AuditRowExpander.tsx
// S6 — "Ver datos" text-link toggling JSON pretty-printed inside stone-wall panel.
"use client";

import { useState } from "react";

type Props = {
  antes: { pretty: string | null; passwordNull: boolean };
  despues: { pretty: string | null; passwordNull: boolean };
  rowId: number;
};

function JSONPanel({ label, value }: { label: string; value: string | null }) {
  if (!value) return <p className="text-text-espresso-soft text-[13px]">{label}: —</p>;
  return (
    <div className="mb-2">
      <p className="text-text-espresso-soft text-[13px] font-nunito mb-1">{label}:</p>
      <pre className="bg-stone-wall text-text-espresso p-2 rounded text-[13px] font-mono whitespace-pre-wrap overflow-x-auto">
        {value}
      </pre>
    </div>
  );
}

export function AuditRowExpander({ antes, despues, rowId }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        type="button"
        className="text-primary underline-offset-4 hover:underline text-[13px] font-nunito"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls={`audit-data-${rowId}`}
      >
        {open ? "Ocultar datos" : "Ver datos"}
      </button>
      {open && (
        <div id={`audit-data-${rowId}`} className="mt-2">
          <JSONPanel label="Antes" value={antes.pretty} />
          <JSONPanel label="Después" value={despues.pretty} />
          {(antes.passwordNull || despues.passwordNull) && (
            <p className="text-text-espresso-soft text-[12px] font-nunito italic">
              password_hash redacted → null (D-26)
            </p>
          )}
        </div>
      )}
    </div>
  );
}