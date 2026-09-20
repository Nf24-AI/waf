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
    href: "https://eisenhower-matrix-black-six.vercel.app",
    external: true,
  },
  {
    id: "decisions",
    name: "سجلّ القرارات",
    eyebrow: "DECISION LOG",
    summary: "كل قرار اتُّخذ في اجتماع، ومن يملكه ومتى — يُقرأ من الاجتماعات نفسها، فلا سجلّ ثانٍ يتباعد عنها.",
    status: "live",
    href: "/decisions",
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
    id: "status",
    name: "تقرير الحالة الأسبوعي",
    eyebrow: "STATUS REPORT",
    summary: "ما أُنجز وما تعطّل وما يحتاج قراراً، في صفحة واحدة تُرسَل كما هي.",
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
