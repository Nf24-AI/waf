// توزيع المهام على المصفوفة: صينية غير المصنّفة، والأرباع الأربعة، والمنجزة.

import type { Quadrant, Task } from "@/data/types";
import { isOpen } from "@/lib/tasks";

export interface MatrixGroups {
  inbox: Task[];
  quads: Record<Quadrant, Task[]>;
  done: Task[];
}

export function groupMatrix(tasks: Task[]): MatrixGroups {
  const quads: Record<Quadrant, Task[]> = { do: [], plan: [], delegate: [], drop: [] };
  const inbox: Task[] = [];
  const done: Task[] = [];
  for (const t of tasks) {
    if (!isOpen(t)) done.push(t);
    else if (t.quadrant) quads[t.quadrant].push(t);
    else inbox.push(t);
  }
  const newest = (a: Task, b: Task) => Date.parse(b.createdAt) - Date.parse(a.createdAt);
  inbox.sort(newest);
  for (const q of Object.keys(quads) as Quadrant[]) quads[q].sort(newest);
  done.sort((a, b) => Date.parse(b.completedAt!) - Date.parse(a.completedAt!));
  return { inbox, quads, done };
}

/** هدف الإفلات: رُبع، أو الصينية (إلغاء التصنيف) */
export type DropZone = Quadrant | "inbox";

export function parseZone(value: string | undefined | null): DropZone | null {
  return value === "do" || value === "plan" || value === "delegate" || value === "drop" || value === "inbox" ? value : null;
}

/** الرُّبع الجديد عند الإفلات، أو undefined إن لم يتغيّر شيء */
export function quadrantAfterDrop(task: Pick<Task, "quadrant">, zone: DropZone): Quadrant | null | undefined {
  const next = zone === "inbox" ? null : zone;
  return next === task.quadrant ? undefined : next;
}
