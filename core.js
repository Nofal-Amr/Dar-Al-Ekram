// Pure domain logic — no DOM, no network. Imported by app.js and by tests/ (node --test).

export const MONTHS = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];

/* ---------- text & digits ---------- */
// Staff type on Arabic keyboards, so ٠-٩ and ۰-۹ must behave exactly like 0-9.
export const latinDigits = s => String(s ?? "").replace(/[٠-٩]/g, d => d.charCodeAt(0) - 0x0660).replace(/[۰-۹]/g, d => d.charCodeAt(0) - 0x06F0);
export const norm = s => latinDigits(s).replace(/[أإآ]/g,"ا").replace(/ى/g,"ي").replace(/ة/g,"ه").replace(/[ً-ْـ]/g,"").replace(/\s+/g," ").trim();

/* ---------- phones ---------- */
export const cleanPhone = p => { let d = latinDigits(p).replace(/\D/g,""); if(d.startsWith("20") && d.length===12) d = d.slice(1); if(d.length===10 && d.startsWith("1")) d = "0"+d; return d; };
export const validPhone = p => /^01[0125]\d{8}$/.test(cleanPhone(p));

/* ---------- Egyptian national ID ----------
   14 digits: C YY MM DD GG SSS G X
   C = century (2 → 1900s, 3 → 2000s), GG = governorate of birth registration,
   the 13th digit is odd for males and even for females. */
export const GOVERNORATES = { "01":"القاهرة","02":"الإسكندرية","03":"بورسعيد","04":"السويس","11":"دمياط","12":"الدقهلية","13":"الشرقية","14":"القليوبية","15":"كفر الشيخ","16":"الغربية","17":"المنوفية","18":"البحيرة","19":"الإسماعيلية","21":"الجيزة","22":"بني سويف","23":"الفيوم","24":"المنيا","25":"أسيوط","26":"سوهاج","27":"قنا","28":"أسوان","29":"الأقصر","31":"البحر الأحمر","32":"الوادي الجديد","33":"مطروح","34":"شمال سيناء","35":"جنوب سيناء","88":"خارج الجمهورية" };
export function parseNID(raw, today = new Date()){
  const n = latinDigits(raw).replace(/\D/g,"");
  if(!n) return { ok:false, empty:true, error:"" };
  if(n.length !== 14) return { ok:false, nid:n, error:`الرقم القومي ١٤ رقم — المكتوب ${n.length}` };
  const c = n[0]; if(c !== "2" && c !== "3") return { ok:false, nid:n, error:"أول رقم لازم يكون 2 أو 3" };
  const y = (c === "2" ? 1900 : 2000) + +n.slice(1,3), m = +n.slice(3,5), d = +n.slice(5,7);
  const dt = new Date(Date.UTC(y, m-1, d));
  if(m < 1 || m > 12 || dt.getUTCDate() !== d || dt.getUTCMonth() !== m-1) return { ok:false, nid:n, error:"تاريخ الميلاد اللي جوه الرقم مش صحيح" };
  if(dt > today) return { ok:false, nid:n, error:"تاريخ الميلاد اللي جوه الرقم في المستقبل" };
  const gov = n.slice(7,9); if(!GOVERNORATES[gov]) return { ok:false, nid:n, error:"كود المحافظة في الرقم مش معروف" };
  return { ok:true, nid:n, birth:`${y}-${String(m).padStart(2,"0")}-${String(d).padStart(2,"0")}`, gender: (+n[12] % 2) ? "ذكر" : "أنثى", governorate: GOVERNORATES[gov] };
}

/* ---------- dates ---------- */
export const isoDay = (d = new Date()) => new Date(d.getTime() - d.getTimezoneOffset()*60000).toISOString().slice(0,10);
export const mIdx = m => { const [y,mm] = String(m).split("-").map(Number); return y*12 + (mm-1); };
export const mLabel = m => { if(!m) return ""; const [y,mm] = String(m).split("-").map(Number); return `${MONTHS[mm-1]} ${y}`; };
export const dLabel = d => { if(!d) return "—"; const x = new Date(d); if(isNaN(x)) return String(d); return `${x.getDate()} ${MONTHS[x.getMonth()]} ${x.getFullYear()}`; };
export const addDays = (d,n) => { const x = new Date(d); x.setDate(x.getDate()+n); return x.toISOString().slice(0,10); };
export function age(birth, today = new Date()){
  if(!birth) return ""; const b = new Date(birth); if(isNaN(b)) return "";
  let a = today.getFullYear() - b.getFullYear();
  if(today < new Date(today.getFullYear(), b.getMonth(), b.getDate())) a--;
  return a;
}

/* ---------- numbers ---------- */
export const num = n => (+n || 0).toLocaleString("en-US");
// Parses "1,500", "١٥٠٠", " 200 ج" → number, or null when there is no number at all.
export const toNumber = v => { const s = latinDigits(v).replace(/[,،\s]/g,"").match(/-?\d+(\.\d+)?/); return s ? +s[0] : null; };

/* ---------- school stages ----------
   One fixed list so every child's stage is spelled the same way (the old sheets had "1 اع", "اولى اعدادي", "اول اعدادي"…).
   Each year the family brings a شهادة قيد; recording it moves the child to the next stage. */
const ORD = ["أولى","تانية","تالتة","رابعة","خامسة","سادسة"];
const SEC = ["عام","تجاري","صناعي","زراعي","فندقي","أزهري"];
export const STAGE_GROUPS = [
  { g:"قبل المدرسة", list:["تحت السن","حضانة","رياض أطفال ١","رياض أطفال ٢"] },
  { g:"ابتدائي", list:ORD.map(o => `${o} ابتدائي`) },
  { g:"إعدادي", list:ORD.slice(0,3).map(o => `${o} إعدادي`) },
  // الصنايع فيها نظام ٥ سنين؛ اللي نظامه ٣ سنين بيختار «خلص دبلوم» بعد التالتة.
  ...SEC.map(t => ({ g:`ثانوي ${t}`, list:ORD.slice(0, t === "صناعي" ? 5 : 3).map(o => `${o} ثانوي ${t}`) })),
  { g:"معهد / دبلوم بعد الإعدادي", list:ORD.slice(0,5).map(o => `${o} معهد`) },
  { g:"جامعة", list:ORD.map(o => `${o} جامعة`) },
  { g:"مش بيدرس", list:["خلص دبلوم","خلص جامعة","خارج التعليم"] },
];
export const STAGES = STAGE_GROUPS.flatMap(x => x.list);
const groupOf = s => STAGE_GROUPS.find(x => x.list.includes(s));
// Stages that need a yearly شهادة قيد (primary school up to university).
export const inSchool = s => { const g = groupOf(s)?.g || ""; return /^(ابتدائي|إعدادي|ثانوي|معهد|جامعة)/.test(g); };
// Next year's stage, or "" when the family has to choose (after إعدادي: which ثانوي; after the last year: graduated).
export function nextStage(s){
  const x = groupOf(s); if(!x) return "";
  const i = x.list.indexOf(s);
  if(i < x.list.length - 1) return x.g === "قبل المدرسة" && i < 1 ? "" : x.list[i+1];
  if(x.g === "قبل المدرسة") return "أولى ابتدائي";
  if(x.g === "ابتدائي") return "أولى إعدادي";
  return "";
}
const LEVEL = [[/^(1|١|ا?ول[يىه]?|أول[يىه]?|الاول[يىه]?|الأول[يىه]?)$/,0],[/^(2|٢|ثان[يىه]?|ثاني[هة]|تاني[هة]?|تان[يىه]|الثاني[هة]?)$/,1],[/^(3|٣|ثالث[هة]?|تالت[هة]?|الثالث[هة]?|ثاث)$/,2],[/^(4|٤|رابع[هة]?|الرابع[هة]?)$/,3],[/^(5|٥|خامس[هة]?|الخامس[هة]?)$/,4],[/^(6|٦|سادس[هة]?|السادس[هة]?)$/,5]];
// Reads the free-text stages from the old sheets. Returns a stage from STAGES, or "" when unsure (the old text is then kept as is).
export function normalizeStage(raw){
  const s0 = String(raw ?? "").trim(); if(!s0) return "";
  if(STAGES.includes(s0)) return s0;
  const s = norm(s0).replace(/([0-9])([^0-9\s])/g,"$1 $2");
  if(/(^|\s)(تحت|ت) السن/.test(s)) return "تحت السن";
  if(/خارج التعليم|متسرب/.test(s)) return "خارج التعليم";
  if(/حاصل[هة]? علي دبلوم|خلصت? دبلوم/.test(s)) return "خلص دبلوم";
  if(/خلصت? (كليه|جامعه)|تخرج/.test(s)) return "خلص جامعة";
  const words = s.split(" "); let lv = -1;
  for(const w of words){ const m = LEVEL.find(([re]) => re.test(w)); if(m){ lv = m[1]; break; } }
  if(lv < 0) return "";
  const has = re => words.some(w => re.test(w));
  if(has(/^(ابت|ابتدائي|الابتدائي|ابتدائ[يى]|الابتددائي|الايتدائي|ابتدايي)$/)) return lv < 6 ? `${ORD[lv]} ابتدائي` : "";
  if(has(/^(اع|اعدادي|الاعدادي|اعدادى)$/)) return lv < 3 ? `${ORD[lv]} إعدادي` : "";
  if(has(/^(ث|ثانوي|الثانوي|الثنوي|ثانوى)$/)){
    const tr0 = has(/^(ص|صناعي)$/);
    if(lv > (tr0 ? 4 : 2)) return "";
    const tr = has(/^(ص|صناعي)$/) ? "صناعي" : has(/^(تجاري|تجارى)$/) ? "تجاري" : has(/^(از|ازهر|ازهري)$/) ? "أزهري" : has(/^(زراعي)$/) ? "زراعي" : has(/^(فندقي)$/) ? "فندقي" : has(/^(فني)$/) ? "" : "عام";
    return tr ? `${ORD[lv]} ثانوي ${tr}` : "";
  }
  if(has(/^معهد$/)) return lv < 5 ? `${ORD[lv]} معهد` : "";
  if(has(/^(ك|كليه|جامعه)$/)) return `${ORD[lv]} جامعة`;
  return "";
}
// School year that a date falls in, named by the year it started (Sept 2026 → 2026, i.e. 2026/2027).
export const schoolYear = (d = new Date()) => { const x = new Date(d); return x.getMonth() >= 8 ? x.getFullYear() : x.getFullYear() - 1; };
export const syLabel = y => `${y}/${+y + 1}`;

/* ---------- distribution planning ----------
   basis.mode: "fixed" (same for every family) · "member" (per × family size) · "tiers" (≤ cut members → small, more → big) */
export const famSize = b => +b?.familySize || ((b?.children || []).length ? b.children.length + 1 : 0);
export function shareFor(basis, fam){
  const f = +fam || 1, per = +basis?.per || 0;
  if(basis?.mode === "member") return per * f;
  if(basis?.mode === "tiers") return f <= (+basis.cut || 3) ? +basis.small || 0 : +basis.big || 0;
  return per;
}
const gradeRank = g => ({A:0,B:1,C:2}[g] ?? 3);
const byCodeNum = (a,b) => String(a.b.code).localeCompare(String(b.b.code),"en",{numeric:true});
/* Priority order of the pool. Entries: { b, lm (last month got this type, or undefined), missed (didn't collect last time) }.
   "score": highest الدرجة first · "family": biggest family first · "wait": longest without this aid first · "code": by case number */
export const PRIORITY = { score:"الدرجة الأعلى الأول", family:"الأسرة الأكبر الأول", wait:"اللي بقاله أكتر من غير ما ياخد", code:"برقم الحالة" };
export function sortPool(pool, by = "score", missedFirst = true){
  const sc = x => x.b.score ?? -1, fm = x => famSize(x.b);
  const keys = {
    score: (x,y) => sc(y) - sc(x) || gradeRank(x.b.grade) - gradeRank(y.b.grade) || fm(y) - fm(x),
    family: (x,y) => fm(y) - fm(x) || sc(y) - sc(x),
    wait: (x,y) => (!x.lm !== !y.lm ? (x.lm ? 1 : -1) : x.lm && y.lm && x.lm !== y.lm ? x.lm.localeCompare(y.lm) : 0) || sc(y) - sc(x),
    code: () => 0,
  };
  const k = keys[by] || keys.score;
  return [...pool].sort((x,y) => (missedFirst ? (y.missed ? 1 : 0) - (x.missed ? 1 : 0) : 0) || k(x,y) || byCodeNum(x,y));
}
/* Walks the sorted pool and gives each family its share until the available quantity (total) or the family count runs out.
   Stops at the first family that doesn't fit, so nobody jumps the queue. */
export function planShares(sorted, basis, { total = null, count = null } = {}){
  const picked = [], rest = []; let used = 0, members = 0;
  for(const x of sorted){
    const fam = famSize(x.b), v = shareFor(basis, fam);
    const full = (count != null && picked.length >= count) || (total != null && used + v > total + 1e-9) || rest.length;
    if(full){ rest.push({ ...x, fam, value:v }); continue; }
    picked.push({ ...x, fam, value:v }); used += v; members += fam || 1;
  }
  return { picked, rest, used, members, left: total != null ? total - used : null };
}

/* ---------- passwords ---------- */
export const minPin = role => role === "manager" ? 8 : 6;

/* ---------- distribution days ----------
   Lists can be for a single day of the month (e.g. every Saturday). A month has 4 or 5 of each weekday. */
export const DAYS = ["الأحد","الاتنين","التلات","الأربع","الخميس","الجمعة","السبت"];
export function weekdaysOf(month, dow = 6){
  const [y, m] = String(month).split("-").map(Number); const out = [];
  for(let d = 1; d <= 31; d++){ const x = new Date(Date.UTC(y, m-1, d)); if(x.getUTCMonth() !== m-1) break; if(x.getUTCDay() === dow) out.push(x.toISOString().slice(0,10)); }
  return out;
}
export const dayLabel = iso => { if(!iso) return ""; const x = new Date(iso + "T00:00:00Z"); return `${DAYS[x.getUTCDay()]} ${x.getUTCDate()} ${MONTHS[x.getUTCMonth()]}`; };
// "السبت 26 سبتمبر و3 أكتوبر" — several days of one list, the weekday said once when they share it.
export function daysText(days){
  const ds = [...(days || [])].filter(Boolean).sort(); if(!ds.length) return "";
  const p = ds.map(d => new Date(d + "T00:00:00Z"));
  const same = p.every(x => x.getUTCDay() === p[0].getUTCDay());
  const part = (x, i) => `${same && i ? "" : DAYS[x.getUTCDay()] + " "}${x.getUTCDate()}${i < p.length - 1 && p[i+1].getUTCMonth() === x.getUTCMonth() ? "" : " " + MONTHS[x.getUTCMonth()]}`;
  const out = p.map(part);
  return out.length === 1 ? out[0] : out.slice(0, -1).join("، ") + " و" + out[out.length - 1];
}

/* ---------- students ----------
   A child counts as a student when their stage is a school stage, or when no stage is written but they're of school age (6–17). */
export function countStudents(children, today = new Date()){
  return (children || []).filter(k => {
    const st = normalizeStage(k.school);
    if(st) return inSchool(st);
    if(String(k.school || "").trim() && !/^[-\s]*$/.test(k.school)) return false;   // written but unclear (e.g. «تأجيل») → not counted
    const a = age(k.birth, today); return a !== "" && a >= 6 && a <= 17;
  }).length;
}
