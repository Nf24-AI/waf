import React from "react";
import { CalendarCheck, CalendarDays, CheckCircle2, Clock, LayoutGrid } from "lucide-react";
import { FILTERS, type FilterId } from "@shared/board";

/**
 * شريط الفلاتر — يعمل فعلاً، لا يزيّن.
 *
 * المرجع يضع «كل المشاريع ▼» بجانبه. ولا مشاريع في هذا المنتج بعد، وقائمة
 * منسدلة فارغة تَعِد بما لا يوجد — فتُترك حتى تُبنى المشاريع.
 */

const ICONS: Record<FilterId, typeof Clock> = {
  all: LayoutGrid,
  today: CalendarDays,
  week: CalendarCheck,
  upcoming: Clock,
  done: CheckCircle2,
};

export default function FilterBar({
  value,
  counts,
  onChange,
}: {
  value: FilterId;
  counts: Record<FilterId, number>;
  onChange: (next: FilterId) => void;
}) {
  return (
    <div className="bd-filters" role="tablist" aria-label="تصفية المهام">
      {FILTERS.map(filter => {
        const Icon = ICONS[filter.id];
        const current = filter.id === value;
        return (
          <button
            key={filter.id}
            type="button"
            role="tab"
            aria-selected={current}
            className={current ? "bd-filter is-current" : "bd-filter"}
            onClick={() => onChange(filter.id)}
          >
            <Icon size={15} aria-hidden="true" />
            {filter.label}
            {/* العدد يُقرأ قبل الضغط: يعرف المستخدم إن كان الفلتر سيُفرغ الشاشة. */}
            <span className="bd-filter-count">{counts[filter.id]}</span>
          </button>
        );
      })}
    </div>
  );
}
