import React from "react";
import { Link } from "wouter";
import { QUADRANTS, type Task } from "@shared/tasks";
import { TIME_METHOD_ROUTES } from "@shared/routes";

/**
 * توزيع المهام على الأرباع.
 *
 * المرجع يضع «مشاريعي» في هذا العمود، ولا مشاريع في المنتج بعد — وبطاقات
 * بأسماء مخترعة ونسبٍ ملفّقة تملأ المكان وتكذب. فيحلّ محلّها ما هو موجود
 * فعلاً وله نفس الوزن: أين تقع مهامك من المصفوفة.
 *
 * والنسبة تُقاس على أكبر ربع لا على المجموع: الفرق بين الأرباع هو الخبر.
 */
export default function QuadrantPanel({ tasks }: { tasks: Task[] }) {
  const rows = QUADRANTS.map(quadrant => ({
    ...quadrant,
    count: tasks.filter(task => task.quadrant === quadrant.id).length,
  }));
  const unclassified = tasks.filter(task => !task.quadrant).length;
  const peak = Math.max(1, ...rows.map(row => row.count));

  return (
    <section className="bd-panel" aria-labelledby="bd-quad-title">
      <header className="bd-panel-head">
        <h2 id="bd-quad-title">أين تقع مهامك</h2>
        <Link className="bd-panel-more" href={TIME_METHOD_ROUTES.eisenhower}>
          المصفوفة
        </Link>
      </header>

      <ul className="bd-quads">
        {rows.map(row => (
          <li className="bd-quad" data-q={row.id} key={row.id}>
            <span className="bd-quad-head">
              <span className="bd-quad-name">{row.title}</span>
              <span className="bd-quad-count">{row.count}</span>
            </span>
            <span className="bd-quad-track" aria-hidden="true">
              <span className="bd-quad-fill" style={{ inlineSize: `${(row.count / peak) * 100}%` }} />
            </span>
            <span className="bd-quad-verb">{row.verb}</span>
          </li>
        ))}
      </ul>

      {unclassified > 0 && (
        <p className="bd-empty">
          و{unclassified} بلا تصنيف — صنّفها لتعرف أين تقع.
        </p>
      )}
    </section>
  );
}
