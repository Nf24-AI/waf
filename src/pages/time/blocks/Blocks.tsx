// صفحة مؤقّتة — تُبنى لاحقاً
import type { TaskOrigin } from "@/data/types";
export default function Blocks({ origin }: { origin: TaskOrigin }) {
  return <p>Blocks {origin}</p>;
}
