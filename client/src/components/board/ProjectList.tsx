import React from "react";
import { BookOpen, BarChart3, Folder, Laptop, Target } from "lucide-react";
import { Link } from "wouter";
import { allProgress, progressLabel, type Project, type ProjectProgress } from "@shared/projects";
import { type Task } from "@shared/tasks";
import { TASKS_ROUTE } from "@shared/routes";

/**
 * بطاقات المشاريع.
 *
 * النسبة محسوبة من مهام المشروع عند القراءة، لا عموداً يُحدَّث. وعمودٌ كهذا
 * يتباعد أوّل ما تُحذف مهمة، ولا يُكتشف انحرافه لأن لا شيء يقارنه بشيء.
 *
 * ومشروع بلا مهام يقرأ صفراً لا مئة: «لا شيء فيه» و«كلّه منجَز» حالان
 * مختلفتان، ومكافأة الفراغ بمئةٍ تجعل الرقم بلا معنى.
 */

/** أيقونة لكل لون — ثابتة، فلا يتغيّر شكل المشروع بين زيارتين. */
const ICONS = [Laptop, BarChart3, BookOpen, Target, Folder] as const;

function iconFor(project: Project): (typeof ICONS)[number] {
  // مشتقّة من المعرّف: نفس المشروع يأخذ نفس الأيقونة دائماً بلا عمود إضافي.
  let sum = 0;
  for (const char of project.id) sum += char.charCodeAt(0);
  return ICONS[sum % ICONS.length];
}

function ProjectCard({ row }: { row: ProjectProgress }) {
  const Icon = iconFor(row.project);

  return (
    <li className="bd-project" data-tone={row.project.color}>
      <span className="bd-project-icon" aria-hidden="true">
        <Icon size={20} />
      </span>

      <span className="bd-project-body">
        <span className="bd-project-name">{row.project.name}</span>
        <span className="bd-project-sub">{progressLabel(row)}</span>
      </span>

      <span className="bd-project-track" aria-hidden="true">
        <span className="bd-project-fill" style={{ inlineSize: `${row.percent}%` }} />
      </span>

      <span className="bd-project-percent">{row.percent}%</span>
    </li>
  );
}

export default function ProjectList({ projects, tasks }: { projects: Project[]; tasks: Task[] }) {
  const rows = allProgress(projects, tasks);

  return (
    <section className="bd-panel" aria-labelledby="bd-projects-title">
      <header className="bd-panel-head">
        <h2 id="bd-projects-title">مشاريعي</h2>
        <Link className="bd-panel-more" href={TASKS_ROUTE}>
          عرض الكل
        </Link>
      </header>

      <ul className="bd-projects">
        {rows.map(row => (
          <ProjectCard key={row.project.id} row={row} />
        ))}
      </ul>
    </section>
  );
}
