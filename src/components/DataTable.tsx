import { useState, useMemo, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronUp, ChevronDown, ChevronsUpDown, Check, ChevronLeft, ChevronRight } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

export interface Column<T> {
  id: string;
  header: string;
  sortable?: boolean;
  className?: string;
  render: (row: T, index: number) => ReactNode;
  /** Returns the raw value used for sorting. Falls back to stringifying column id. */
  getValue?: (row: T) => string | number;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (row: T) => string;
  onRowClick?: (row: T) => void;
  pageSize?: number;
  emptyMessage?: string;
  bulkActions?: (selected: T[]) => ReactNode;
}

export default function DataTable<T>({
  columns,
  data,
  keyExtractor,
  onRowClick,
  pageSize = 10,
  emptyMessage = "No data available.",
  bulkActions,
}: DataTableProps<T>) {
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(0);

  const sorted = useMemo(() => {
    if (!sortCol) return data;
    const col = columns.find((c) => c.id === sortCol);
    if (!col) return data;
    return [...data].sort((a, b) => {
      const aVal = col.getValue ? col.getValue(a) : String((a as Record<string, unknown>)[sortCol] ?? "");
      const bVal = col.getValue ? col.getValue(b) : String((b as Record<string, unknown>)[sortCol] ?? "");
      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortDir === "asc" ? aVal - bVal : bVal - aVal;
      }
      const cmp = String(aVal).localeCompare(String(bVal));
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [data, sortCol, sortDir, columns]);

  const totalPages = Math.ceil(sorted.length / pageSize);
  const paged = sorted.slice(page * pageSize, (page + 1) * pageSize);

  const toggleSort = (colId: string) => {
    setPage(0);
    if (sortCol === colId) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortCol(colId);
      setSortDir("asc");
    }
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === paged.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(paged.map(keyExtractor)));
    }
  };

  const selectedRows = data.filter((r) => selected.has(keyExtractor(r)));

  return (
    <div>
      {selected.size > 0 && bulkActions && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-3 flex items-center gap-3 rounded-xl border border-hairline bg-surface/60 px-4 py-2.5"
        >
          <span className="text-sm text-muted-foreground">{selected.size} selected</span>
          {bulkActions(selectedRows)}
        </motion.div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-hairline text-left">
              {bulkActions && (
                <th scope="col" className="w-10 p-4">
                  <Checkbox
                    checked={selected.size === paged.length && paged.length > 0}
                    onCheckedChange={toggleSelectAll}
                    aria-label="Select all rows on this page"
                  />
                </th>
              )}
              {columns.map((col) => (
                <th
                  key={col.id}
                  scope="col"
                  aria-sort={col.sortable ? (sortCol === col.id ? (sortDir === "asc" ? "ascending" : "descending") : "none") : undefined}
                  className={`p-4 ${col.className || ""}`}
                >
                  {col.sortable ? (
                    <button
                      type="button"
                      onClick={() => toggleSort(col.id)}
                      className="eyebrow flex cursor-pointer select-none items-center gap-1.5 hover:text-foreground"
                    >
                      {col.header}
                      <span className="text-muted-foreground" aria-hidden="true">
                        {sortCol === col.id ? (
                          sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
                        ) : (
                          <ChevronsUpDown className="h-3 w-3 opacity-40" />
                        )}
                      </span>
                    </button>
                  ) : (
                    <span className="eyebrow">{col.header}</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline/50">
            <AnimatePresence>
              {paged.length === 0 ? (
                <tr>
                  <td colSpan={columns.length + (bulkActions ? 1 : 0)} className="py-12 text-center text-sm text-muted-foreground">
                    {emptyMessage}
                  </td>
                </tr>
              ) : (
                paged.map((row, i) => {
                  const id = keyExtractor(row);
                  return (
                    <motion.tr
                      key={id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.2, delay: Math.min(i * 0.02, 0.2) }}
                      className={`transition-colors ${onRowClick ? "cursor-pointer hover:bg-foreground/[0.04]" : "hover:bg-foreground/[0.02]"}`}
                      onClick={() => onRowClick?.(row)}
                      onKeyDown={(e) => {
                        if (onRowClick && (e.key === "Enter" || e.key === " ")) {
                          e.preventDefault();
                          onRowClick(row);
                        }
                      }}
                      tabIndex={onRowClick ? 0 : undefined}
                    >
                      {bulkActions && (
                        <td className="w-10 p-4" onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selected.has(id)}
                            onCheckedChange={() => toggleSelect(id)}
                            aria-label={`Select row ${i + 1}`}
                          />
                        </td>
                      )}
                      {columns.map((col) => (
                        <td key={col.id} className={`p-4 ${col.className || ""}`}>
                          {col.render(row, i)}
                        </td>
                      ))}
                    </motion.tr>
                  );
                })
              )}
            </AnimatePresence>
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-hairline px-4 py-3">
          <span className="text-xs text-muted-foreground">
            Showing {page * pageSize + 1}–{Math.min((page + 1) * pageSize, sorted.length)} of {sorted.length}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              aria-label="Previous page"
              className="rounded-md p-1.5 text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            </button>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              const p = totalPages <= 5 ? i : Math.max(0, Math.min(page - 2, totalPages - 5)) + i;
              return (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  aria-label={`Page ${p + 1}`}
                  aria-current={p === page ? "page" : undefined}
                  className={`h-7 w-7 rounded-md text-xs transition-colors ${p === page ? "bg-foreground text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                >
                  {p + 1}
                </button>
              );
            })}
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              aria-label="Next page"
              className="rounded-md p-1.5 text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
