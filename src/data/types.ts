// أنواع البيانات التي تتبادلها الواجهة مع طبقة البيانات.
// التواريخ: اليوم "YYYY-MM-DD"، والساعة "HH:MM"، واللحظة ISO كاملة.

export type MeetingKind = "internal" | "partner" | "leadership" | "other";
export type MeetingStatus = "draft" | "ready" | "done";

export interface AgendaItem {
  id: string;
  title: string;
  context: string;
  goal: string;
  decision: string;
  owner: string;
  covered: boolean;
}

export interface Followup {
  id: string;
  text: string;
  done: boolean;
}

export interface Meeting {
  id: string;
  title: string;
  day: string | null;
  startTime: string | null;
  endTime: string | null;
  kind: MeetingKind;
  status: MeetingStatus;
  attendees: string[];
  goal: string;
  note: string;
  link: string;
  image: string;
  shareToken: string | null;
  agenda: AgendaItem[];
  followups: Followup[];
  updatedAt: string;
}

/** الحقول التي تُعدَّل مباشرة على الاجتماع (البنود والمتابعات لها حفظها الخاص). */
export type MeetingFields = Omit<Meeting, "id" | "shareToken" | "agenda" | "followups" | "updatedAt">;

/** ما يراه صاحب رابط القراءة فقط: بلا ملاحظات ولا رمز مشاركة. */
export type SharedMeeting = Omit<Meeting, "note" | "shareToken" | "updatedAt">;

export type TaskOrigin = "matrix" | "blocks" | "focus" | "waf";
export type Quadrant = "do" | "plan" | "delegate" | "drop";
export type Category = "deep" | "meeting" | "personal" | "project" | "other";
export type Priority = "low" | "medium" | "high";
export type RepeatRule = "daily" | "weekdays" | "weekly" | "custom";

export interface Task {
  id: string;
  title: string;
  notes: string;
  origin: TaskOrigin;
  quadrant: Quadrant | null;
  startsAt: string | null;
  endsAt: string | null;
  estimateMinutes: number | null;
  category: Category;
  priority: Priority;
  repeatRule: RepeatRule | null;
  /** 0 = الأحد */
  repeatDays: number[];
  sourceMeetingId: string | null;
  completedAt: string | null;
  createdAt: string;
  /** عدد جلسات التركيز المكتملة على المهمة */
  focusSessions: number;
}

export interface TaskInput {
  title: string;
  origin: TaskOrigin;
  notes?: string;
  quadrant?: Quadrant | null;
  startsAt?: string | null;
  endsAt?: string | null;
  estimateMinutes?: number | null;
  category?: Category;
  priority?: Priority;
  repeatRule?: RepeatRule | null;
  repeatDays?: number[];
  sourceMeetingId?: string | null;
}

export type TaskPatch = Partial<Omit<TaskInput, "origin">>;

export type FocusMode = "pomodoro" | "timer" | "stopwatch";

export interface FocusStart {
  taskId: string | null;
  origin: TaskOrigin;
  mode: FocusMode;
  plannedMinutes: number | null;
}

export interface FocusEnd {
  workedSeconds: number;
  completed: boolean;
}

export type ApiErrorCode = "conflict" | "invalid" | "not_found" | "expired" | "unauthorized" | "network";

export class ApiError extends Error {
  constructor(
    public code: ApiErrorCode,
    /** نصّ عربي جاهز للعرض */
    public ar: string,
    /** النص نفسه بالإنجليزية */
    public en: string,
  ) {
    super(en);
  }
}

export interface Api {
  meetings: {
    list(): Promise<Meeting[]>;
    create(fields?: Partial<MeetingFields> & { agenda?: Omit<AgendaItem, "id">[]; followups?: Omit<Followup, "id">[] }): Promise<Meeting>;
    update(id: string, patch: Partial<MeetingFields>): Promise<Meeting>;
    /** يستبدل البنود كلها بالترتيب المعطى. البند بلا id يُنشأ. */
    saveAgenda(meetingId: string, items: (Omit<AgendaItem, "id"> & { id?: string })[]): Promise<AgendaItem[]>;
    saveFollowups(meetingId: string, items: (Omit<Followup, "id"> & { id?: string })[]): Promise<Followup[]>;
    remove(id: string): Promise<void>;
    share(id: string): Promise<string>;
    unshare(id: string): Promise<void>;
    shared(token: string): Promise<SharedMeeting>;
  };
  tasks: {
    /** المهام غير المؤرشفة لهذا المصدر: المفتوحة كلها والمنجزة خلال آخر ١٤ يوماً. */
    list(origin: TaskOrigin): Promise<Task[]>;
    create(input: TaskInput): Promise<Task>;
    update(id: string, patch: TaskPatch): Promise<Task>;
    /** يُنجز المهمة، وإن كانت متكرّرة ومحجوزة يُنشئ موعدها التالي. */
    complete(id: string): Promise<{ task: Task; next: Task | null }>;
    reopen(id: string): Promise<Task>;
    archive(id: string): Promise<void>;
    restore(id: string): Promise<Task>;
  };
  focus: {
    start(input: FocusStart): Promise<string>;
    end(id: string, result: FocusEnd): Promise<void>;
    /** ثواني العمل المسجّلة اليوم (بتوقيت الجهاز) لهذا المصدر */
    todaySeconds(origin: TaskOrigin): Promise<number>;
  };
}
