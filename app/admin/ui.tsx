export function AdminTable({ head, children, minWidth = 720 }: { head: string[]; children: React.ReactNode; minWidth?: number }) {
  return (
    <div className="card overflow-x-auto">
      <table className="w-full text-sm" style={{ minWidth }}>
        <thead className="border-b border-line bg-paper text-left text-xs text-muted">
          <tr>{head.map((h, i) => <th key={i} className={`px-4 py-2.5 font-semibold ${i === head.length - 1 ? "text-right" : ""}`}>{h}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-line">{children}</tbody>
      </table>
    </div>
  );
}

export const td = "px-4 py-3 align-middle";
