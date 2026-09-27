/**
 * فحص ما نُشر فعلاً — يُلصق في وحدة تحكّم المتصفّح على الموقع الحيّ.
 *
 * كُتب لأن عطلاً بصرياً مرّ إلى الإنتاج ولم يكتشفه إلا المستخدم: نافذة إضافة
 * مهمة كانت تُرسم خارج `.tp-frame` فتسقط إلى سمة الجذر السماوية — زرّ أخضر
 * مزرقّ في منتج أزرق. قياسه سطرٌ واحد، ولم يُقس.
 *
 * اللقطة قد تفشل على هذا الجهاز، لكن `getComputedStyle` لا يفشل. فما لا
 * يُرى يُقاس.
 *
 * الاستعمال: افتح الصفحة المعنيّة وسجّل دخولك، ثم الصق هذا الملفّ كاملاً.
 */

(async () => {
  const cs = (el, pseudo) => (el ? getComputedStyle(el, pseudo ?? null) : null);
  const box = el => (el ? el.getBoundingClientRect() : null);
  const results = [];
  const check = (name, pass, detail) => results.push({ name, pass: pass === true, detail });

  // ---- الإطار والخلفية ----
  const frame = document.querySelector(".tp-frame");
  if (frame) {
    const layer = cs(frame, "::before");
    check("الخلفية ثابتة خلف التطبيق", layer.position === "fixed", layer.position);
    check("صورة الجبل محمَّلة", (layer.backgroundImage || "").includes("night-mountains"), layer.backgroundImage.slice(0, 60));
  }

  // ---- الشريط الجانبي ----
  const side = document.querySelector(".tp-side");
  if (side && cs(side).display !== "none") {
    const b = box(side);
    // شريط التمرير يُحسب في innerWidth ولا يُحسب في الصندوق: هامش ٢٠ بكسل
    // يمنع إنذاراً كاذباً رأيناه مرّة.
    check("الشريط مثبَّت", cs(side).position === "fixed", cs(side).position);
    check("الشريط بارتفاع الشاشة", Math.round(b.height) >= innerHeight - 2, `${Math.round(b.height)}/${innerHeight}`);
    check("الشريط على حافة البداية", Math.round(b.right) >= innerWidth - 20, `right=${Math.round(b.right)} vw=${innerWidth}`);
    const out = [...side.querySelectorAll("button")].find(x => x.textContent.includes("تسجيل الخروج"));
    if (out) check("الحساب في أسفل الشريط", box(out).bottom > innerHeight * 0.7, Math.round(box(out).bottom));
  }

  // ---- اللون: المنتج أزرق، والسماويّ يعني تسرّباً من سمة الجذر ----
  for (const [label, el] of [["الإطار", frame], ["النافذة", document.querySelector(".ntk-scrim")]]) {
    if (!el) continue;
    const accent = cs(el).getPropertyValue("--accent").trim().toLowerCase();
    check(`لون ${label} أزرق لا سماويّ`, accent.startsWith("#4c82f7"), accent);
  }

  // ---- نافذة إضافة مهمة ----
  const modal = document.querySelector(".ntk");
  if (modal) {
    const quads = [...modal.querySelectorAll(".ntk-quad")];
    const tones = new Set(quads.map(q => cs(q).color));
    check("لكل ربع لونه قبل الاختيار", tones.size === quads.length, `${tones.size}/${quads.length}`);

    const first = quads[0];
    if (first) {
      const icon = box(first.querySelector("svg"));
      const radio = box(first.querySelector(".ntk-radio"));
      check("الأيقونة يمين النصّ", icon.left > radio.left, `icon=${Math.round(icon.left)} radio=${Math.round(radio.left)}`);
    }

    const acts = box(modal.querySelector(".ntk-acts"));
    const hint = box(modal.querySelector(".ntk-hint"));
    if (acts && hint) check("الأزرار يمين التلميح", acts.left > hint.left, `acts=${Math.round(acts.left)} hint=${Math.round(hint.left)}`);

    const photo = modal.querySelector(".ntk-head img");
    if (photo) check("صورة الترويسة ظاهرة", Number(cs(photo).opacity) >= 0.8, cs(photo).opacity);
  }

  // ---- ما لا يُقبل في أي حال ----
  check("لا فيض أفقي", document.documentElement.scrollWidth <= innerWidth + 2, `${document.documentElement.scrollWidth}/${innerWidth}`);
  const raw = document.body.innerText.match(/Supabase \d{3}|invalid input syntax|does not exist/);
  check("لا نصّ قاعدة بيانات على الشاشة", !raw, raw ? raw[0] : "نظيف");

  const failed = results.filter(r => !r.pass);
  console.table(results);
  console.log(failed.length ? `✗ فشل ${failed.length} من ${results.length}` : `✓ ${results.length} كلّها سليمة`);
  return { failed: failed.length, total: results.length, failures: failed };
})();
