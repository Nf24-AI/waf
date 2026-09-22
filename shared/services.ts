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
  /** الاسم اللاتيني بحروف كبيرة — تسمية صغيرة فوق العنوان، لا ترجمة. */
  eyebrow: string;
  /** سطر واحد يقول ما الذي تفعله الخدمة، بصيغة الخبر لا الوعد. */
  summary: string;
  status: ServiceStatus;
  /** الوجهة عند الضغط. الخدمات القادمة بلا وجهة. */
  href?: string;
  /** خدمة تعيش خارج واف: تُفتح في لسان جديد ويُعلَّم ذلك في الواجهة. */
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
    eyebrow: "MEETINGS",
    summary: "تُجهّز الاجتماع — الغرض وجدول الأعمال والحضور — ويبني واف صفحة العرض التي تظهر في الغرفة.",
    status: "live",
    href: "/meetings",
  },
  {
    id: "time",
    name: "خدمة إدارة الوقت",
    eyebrow: "TIME MANAGEMENT",
    summary: "مصفوفة أيزنهاور: ترتّب مهامك بين المهم والعاجل، فيظهر ما يستحق وقتك اليوم وما يُفوَّض أو يُلغى.",
    status: "live",
    // انتقلت إلى داخل واف: مهمة واحدة تعبر الطرق الثلاث بلا نسخة ثانية،
    // وهو ما لا يتحقّق وهي على أصل آخر بقاعدة منفصلة. التطبيق القديم يبقى
    // شغّالاً على رابطه حتى تطمئنّ.
    href: "/time-management",
  },
  {
    id: "decisions",
    name: "سجلّ القرارات",
    eyebrow: "DECISION LOG",
    summary: "كل قرار اتُّخذ في اجتماع، ومن يملكه ومتى — يُقرأ من الاجتماعات نفسها، فلا سجلّ ثانٍ يتباعد عنها.",
    status: "live",
    href: "/decisions",
    partOf: "meetings",
  },
  {
    id: "status",
    name: "تقرير الحالة الأسبوعي",
    eyebrow: "STATUS REPORT",
    summary: "ما انعقد وما تقرّر وما يحتاج انتباهاً في فترة تختارها — صفحة واحدة مُشتقّة من الاجتماعات، تُرسَل كما هي.",
    status: "live",
    href: "/status",
    partOf: "meetings",
  },
  {
    id: "risks",
    name: "سجلّ المخاطر",
    eyebrow: "RISK REGISTER",
    summary: "المخاطر المفتوحة باحتمالها وأثرها ومالكها، ومراجعة دورية تُغلق ما انتهى.",
    status: "soon",
  },
  {
    id: "stakeholders",
    name: "خريطة أصحاب المصلحة",
    eyebrow: "STAKEHOLDER MAP",
    summary: "من يقرّر ومن يُستشار ومن يُبلَّغ فقط، ودرجة تأثير كلٍّ منهم على المشروع.",
    status: "soon",
  },
  {
    id: "dependencies",
    name: "الافتراضات والاعتماديات",
    eyebrow: "ASSUMPTIONS & DEPENDENCIES",
    summary: "ما يقوم عليه التخطيط وما ينتظر طرفاً آخر، وتاريخ التحقق من كل بند.",
    status: "soon",
  },
  {
    id: "capacity",
    name: "تخطيط السعة",
    eyebrow: "CAPACITY PLANNING",
    summary: "الجهد المتاح للفريق مقابل الملتزَم به، فيظهر التحميل الزائد قبل أن يصير تأخيراً.",
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
export const rootServices = () => SERVICES.filter((service) => service.status === "live" && !service.partOf);

/** ما تُنتجه خدمة بعينها من صفحات تُقرأ داخل المنصّة. */
export const derivedServices = (id: string) => SERVICES.filter((service) => service.partOf === id);
