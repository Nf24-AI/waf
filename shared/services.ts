/**
 * كتالوج خدمات منصّة واف.
 *
 * واف لم يعد أداة اجتماعات واحدة: هو منصّة يدخلها مدير المشروع أو مالك المنتج
 * فيجد الخدمة التي يحتاجها الآن. هذا الملف هو المصدر الوحيد لما تعرضه الواجهة،
 * فإضافة خدمة تعني سطراً هنا لا تعديلاً في الصفحة.
 *
 * `soon` ليست وعداً بتاريخ. هي إعلان نيّة: الخانة محجوزة والاسم ثابت،
 * حتى لا يبني أحد نفس الشيء في مكان آخر.
 */

export type ServiceStatus = "live" | "soon";

export interface Service {
  id: string;
  /** اسم الخدمة كما يقرأه المستخدم. اسم، لا جملة تسويق. */
  name: string;
  /** الاسم بالإنجليزية، لواجهة اللغة الإنجليزية. */
  nameEn: string;
  /** الاسم اللاتيني بحروف كبيرة — تسمية صغيرة فوق العنوان، لا ترجمة. */
  eyebrow: string;
  /** سطر واحد يقول ما الذي تفعله الخدمة، بصيغة الخبر لا الوعد. */
  summary: string;
  /** الملخّص بالإنجليزية، بالمعنى لا بالحرف. */
  summaryEn: string;
  status: ServiceStatus;
  /** الوجهة عند الضغط. الخدمات القادمة بلا وجهة. */
  href?: string;
  /** خدمة تعيش خارج واف، على أصل آخر وبحساباتها هي. يُعلَّم ذلك في الواجهة. */
  external?: boolean;
  /**
   * مُعرّف الخدمة التي تُشتقّ منها هذه.
   *
   * سجلّ القرارات وتقرير الحالة يُقرآن من الاجتماعات ولا يملكان بياناً خاصاً
   * بهما؛ لو حُذفت الاجتماعات لم يبق لهما ما يعرضانه. فهما مخرجان لخدمة، لا
   * خدمتان. التمييز ليس تصنيفاً: من يقف على الباب يحتاج أن يعرف كم أداةً
   * مستقلّة عند واف، ومن دخل يحتاج أن يصل إلى كل صفحة.
   */
  partOf?: string;
}

export const SERVICES: readonly Service[] = [
  {
    id: "meetings",
    name: "خدمة الاجتماعات",
    nameEn: "Meetings",
    eyebrow: "MEETINGS",
    summary: "تُجهّز الاجتماع — الغرض وجدول الأعمال والحضور — ويبني واف صفحة العرض التي تظهر في الغرفة.",
    summaryEn: "Set up the meeting — purpose, agenda and attendees — and Waf builds the display page shown in the room.",
    status: "live",
    href: "/meetings",
  },
  {
    id: "time",
    name: "خدمة إدارة الوقت",
    nameEn: "Time management",
    eyebrow: "TIME MANAGEMENT",
    summary: "مصفوفة أيزنهاور: ترتّب مهامك بين المهم والعاجل، فيظهر ما يستحق وقتك اليوم وما يُفوَّض أو يُلغى.",
    summaryEn: "The Eisenhower matrix: sort tasks by importance and urgency to see what deserves your time today and what to delegate or drop.",
    status: "live",
    // انتقلت إلى داخل واف: مهمة واحدة تعبر الطرق الثلاث بلا نسخة ثانية،
    // وهو ما لا يتحقّق وهي على أصل آخر بقاعدة منفصلة. التطبيق القديم يبقى
    // شغّالاً على رابطه حتى تطمئنّ.
    // الباب إلى الخدمة واجهتها الرئيسية لا صفحة الطرق.
    href: "/time-management",
  },
  {
    id: "decisions",
    name: "سجلّ القرارات",
    nameEn: "Decision log",
    eyebrow: "DECISION LOG",
    summary: "كل قرار اتُّخذ في اجتماع، ومن يملكه ومتى — يُقرأ من الاجتماعات نفسها، فلا سجلّ ثانٍ يتباعد عنها.",
    summaryEn: "Every decision made in a meeting, with its owner and date — read from the meetings themselves, so no second log drifts out of sync.",
    status: "live",
    href: "/decisions",
    partOf: "meetings",
  },
  {
    id: "status",
    name: "تقرير الحالة الأسبوعي",
    nameEn: "Weekly status report",
    eyebrow: "STATUS REPORT",
    summary: "ما انعقد وما تقرّر وما يحتاج انتباهاً في فترة تختارها — صفحة واحدة مُشتقّة من الاجتماعات، تُرسَل كما هي.",
    summaryEn: "What was held, what was decided and what needs attention over a period you choose — one page derived from meetings, ready to send as is.",
    status: "live",
    href: "/status",
    partOf: "meetings",
  },
  {
    id: "directory",
    name: "أي خدمة",
    nameEn: "Service directory",
    eyebrow: "SERVICE DIRECTORY",
    summary: "دليل موحّد لمزوّدي الخدمة والشركاء: من تتواصل معه، وبأي قسم، وكيف. يعمل بحسابه الخاص.",
    summaryEn: "One directory of service providers and partners: who to contact, in which department, and how. Runs on its own account.",
    status: "live",
    // تطبيق مستقلّ بقاعدته ودخوله؛ يُنتقل إليه في اللسان نفسه، والدخول فيه منفصل عن واف إلى أن يُوحَّد.
    href: "https://projec3-nf.vercel.app",
    external: true,
  },
  {
    id: "risks",
    name: "سجلّ المخاطر",
    nameEn: "Risk register",
    eyebrow: "RISK REGISTER",
    summary: "المخاطر المفتوحة باحتمالها وأثرها ومالكها، ومراجعة دورية تُغلق ما انتهى.",
    summaryEn: "Open risks with their likelihood, impact and owner, and a regular review that closes what is done.",
    status: "soon",
  },
  {
    id: "stakeholders",
    name: "خريطة أصحاب المصلحة",
    nameEn: "Stakeholder map",
    eyebrow: "STAKEHOLDER MAP",
    summary: "من يقرّر ومن يُستشار ومن يُبلَّغ فقط، ودرجة تأثير كلٍّ منهم على المشروع.",
    summaryEn: "Who decides, who is consulted and who is only informed, and how much influence each has on the project.",
    status: "soon",
  },
  {
    id: "dependencies",
    name: "الافتراضات والاعتماديات",
    nameEn: "Assumptions and dependencies",
    eyebrow: "ASSUMPTIONS & DEPENDENCIES",
    summary: "ما يقوم عليه التخطيط وما ينتظر طرفاً آخر، وتاريخ التحقق من كل بند.",
    summaryEn: "What the plan rests on and what is waiting on someone else, with the date each item was last checked.",
    status: "soon",
  },
  {
    id: "capacity",
    name: "تخطيط السعة",
    nameEn: "Capacity planning",
    eyebrow: "CAPACITY PLANNING",
    summary: "الجهد المتاح للفريق مقابل الملتزَم به، فيظهر التحميل الزائد قبل أن يصير تأخيراً.",
    summaryEn: "The team's available effort against what is committed, so overload shows before it becomes delay.",
    status: "soon",
  },
] as const;

export const liveServices = () => SERVICES.filter((service) => service.status === "live");
export const upcomingServices = () => SERVICES.filter((service) => service.status === "soon");

/**
 * الخدمات المستقلّة: ما يملك بياناته ويقوم وحده.
 *
 * هذا هو العدد الذي يُعلَن على الباب. الوجه العام يشتقّه من هنا ولا يكتبه
 * بيده، فخدمة تُضاف إلى الكتالوج لا تختفي منه بصمت.
 */
export const rootServices = () =>
  SERVICES.filter((service) => service.status === "live" && !service.partOf);

/** ما تُنتجه خدمة بعينها من صفحات تُقرأ داخل المنصّة. */
export const derivedServices = (id: string) => SERVICES.filter((service) => service.partOf === id);
