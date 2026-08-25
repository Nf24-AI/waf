export type MeetingStatus = "مسودة" | "جاهز للعرض" | "تم الاجتماع";

export function getMeetingReadiness(status: MeetingStatus) {
  return status === "جاهز للعرض" ? 100 : status === "تم الاجتماع" ? 100 : 60;
}

export function formatAgendaIndex(index: number) {
  return String(index + 1).padStart(2, "0");
}

export function moveListItem<T>(items: T[], from: number, to: number) {
  const next = [...items];
  [next[from], next[to]] = [next[to], next[from]];
  return next;
}
