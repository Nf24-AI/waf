// صفحة مؤقّتة — تُبنى لاحقاً
import type { TaskOrigin } from "@/data/types";
export default function Focus({ origin }: { origin: TaskOrigin }) {
  return <p>Focus {origin}</p>;
}
