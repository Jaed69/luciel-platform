import { ReactNode } from "react";

export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
}

export function DataTable<T extends { id: number }>({
  columns,
  data,
  emptyState,
}: {
  columns: Column<T>[];
  data: T[];
  emptyState?: ReactNode;
}) {
  if (data.length === 0 && emptyState) {
    return <div className="py-12 text-center text-text-espresso-soft font-nunito">{emptyState}</div>;
  }
  return (
    <div className="overflow-x-auto rounded-lg border border-gold/30">
      <table className="w-full border-collapse">
        <thead className="sticky top-0 bg-primary text-on-primary">
          <tr>
            {columns.map((c) => (
              <th key={c.key} className="text-left px-3 py-2 text-sm font-semibold border-b border-gold">
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={row.id} className={i % 2 === 1 ? "bg-stone-wall/30" : "bg-canvas"}>
              {columns.map((c) => (
                <td key={c.key} className="px-3 py-2 text-[13px] text-text-espresso font-nunito">
                  {c.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}