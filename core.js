// Pure domain logic — no DOM, no network. Imported by app.js and by tests/ (node --test).

export const MONTHS = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];

/* ---------- text & digits ---------- */
// Staff type on Arabic keyboards, so ٠-٩ and ۰-۹ must behave exactly like 0-9.
export const latinDigits = s => String(s ?? "").replace(/[٠-٩]/g, d => d.charCodeAt(0) - 0x0660).replace(/[۰-۹]/g, d => d.charCodeAt(0) - 0x06F0);
// Arabic alphabetical order (أحمد = احمد, ة = ه), names first; empty names last.
const sortKey = s => norm(s || "").replace(/ی/g, "ي").replace(/ک/g, "ك").replace(/ /g, "");   // Persian ی / ک typed by mistake sort as Arabic
export const byName = (a, b) => { const x = sortKey(a), y = sortKey(b); return !x !== !y ? (x ? -1 : 1) : x < y ? -1 : x > y ? 1 : 0; };
export const norm = s => latinDigits(s).replace(/[أإآ]/g,"ا").replace(/ى/g,"ي").replace(/ة/g,"ه").replace(/[ً-ْـ]/g,"").replace(/\s+/g," ").trim();

/* ---------- phones ---------- */
export const cleanPhone = p => { let d = latinDigits(p).replace(/\D/g,""); if(d.startsWith("20") && d.length===12) d = d.slice(1); if(d.length===10 && d.startsWith("1")) d = "0"+d; return d; };
// "" = looks fine (mobile 01x + 8 digits, or a landline), "none" = empty, "bad" = too short/long or not a phone.
export const phoneIssue = p => { const d = cleanPhone(p || ""); if(!d) return "none"; return /^01[0125]\d{8}$/.test(d) || /^0[2-9]\d{7,8}$/.test(d) ? "" : "bad"; };
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
// Calendar maths on "YYYY-MM-DD" is done in UTC: local-time setDate() + toISOString() slips a day around Egypt's DST switch.
const ymd = d => String(d).slice(0,10).split("-").map(Number);
export const addDays = (d,n) => { const [y,m,dd] = ymd(d); return new Date(Date.UTC(y, m-1, dd+n)).toISOString().slice(0,10); };
// A date typed by hand → "YYYY-MM-DD", or "" if it isn't a real date. Accepts 1980-05-01, 1/5/1980, 01-05-1980, ١/٥/١٩٨٠ (day first).
export function parseDate(raw, today = new Date()){
  const t = latinDigits(raw).trim(); let y, m, d, x;
  if((x = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(t))) [, y, m, d] = x.map(Number);
  else if((x = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(t))) [, d, m, y] = x.map(Number);
  else return "";
  const dt = new Date(Date.UTC(y, m-1, d));
  if(dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m-1 || dt.getUTCDate() !== d || y < 1900 || dt > today) return "";
  return dt.toISOString().slice(0,10);
}
// Same day n months later, clamped to the month's last day (31 Aug + 6 months → 28/29 Feb, not 3 Mar).
export const addMonths = (d,n) => { const [y,m,dd] = ymd(d); const last = new Date(Date.UTC(y, m-1+n+1, 0)).getUTCDate(); return new Date(Date.UTC(y, m-1+n, Math.min(dd, last))).toISOString().slice(0,10); };
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
  // «١ ع» = أولى إعدادي — but in «٢ ث ع» the ع means عام (ثانوي عام), so a lone ع only counts when there's no ث
  const sec = has(/^(ث|ثانوي|الثانوي|الثنوي|ثانوى)$/);
  if(has(/^(اع|اعدادي|الاعدادي|اعدادى)$/) || (!sec && has(/^ع$/))) return lv < 3 ? `${ORD[lv]} إعدادي` : "";
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
export function shareFor(basis, fam, students = 0){
  const f = +fam || 1, per = +basis?.per || 0;
  if(basis?.mode === "student") return per * (+students || 0);   // no students → nothing (unlike family size, 0 is a real count)
  if(basis?.mode === "member") return per * f;
  // group: «per for every `every` members (or students)»; a part-group counts as a whole one unless round is "down"
  if(basis?.mode === "group"){ const n = basis.tierBy === "students" ? (+students || 0) : f, ev = +basis.every || 1, g = basis.round === "down" ? Math.floor(n / ev) : Math.ceil(n / ev); return g * per; }
  // tiers: «up to cut → small, more → big», counted by family members, or by students (tierBy: "students")
  if(basis?.mode === "tiers"){ const n = basis.tierBy === "students" ? (+students || 0) : f; return n <= (+basis.cut || (basis.tierBy === "students" ? 2 : 3)) ? +basis.small || 0 : +basis.big || 0; }
  return per;
}
const gradeRank = g => ({A:0,B:1,C:2}[g] ?? 3);
const byCodeNum = (a,b) => String(a.b.code).localeCompare(String(b.b.code),"en",{numeric:true});
/* Priority order of the pool. Entries: { b, lm (last month got this type, or undefined), missed (didn't collect last time) }.
   "score": highest الدرجة first · "family": biggest family first · "wait": longest without this aid first · "code": by case number */
export const PRIORITY = { score:"الدرجة الأعلى الأول", family:"الأسرة الأكبر الأول", wait:"اللي بقاله أكتر من غير ما ياخد", group:"المجموعات بالأولوية (مرضي ← كفالات ← مساعدات)، وجوه كل مجموعة أبجدي", name:"أبجدي (أ ← ي)", code:"برقم الحالة" };

/* ---------- family groups & codes ----------
   Groups (in priority order) have a letter and the case types in them; they decide who comes first when there isn't
   enough. The family code (from the evaluation form) is: grade + group letter + "-" + number in the association + number
   in the group — «AK-4738» = grade A, Kafalat, case 47, 38th in Kafalat. It becomes official only after approval. */
export const DEFAULT_GROUPS = [
  { name:"مرضي", letter:"S", types:["مرضي","أيتام ومرضي"] },
  { name:"كفالات", letter:"K", types:["كفالات","أيتام","أيتام ومرضي"] },
  { name:"مساعدات", letter:"M", types:["مساعدات"] },
];
const ctOf = t => t || "غير محدد";
export const groupsOf = (caseType, groups = DEFAULT_GROUPS) => groups.filter(g => (g.types || []).includes(ctOf(caseType)));
export const groupRank = (caseType, groups = DEFAULT_GROUPS) => { const i = groups.findIndex(g => (g.types || []).includes(ctOf(caseType))); return i < 0 ? groups.length : i; };
export const famLetters = (caseType, groups = DEFAULT_GROUPS) => groupsOf(caseType, groups).map(g => g.letter || "").join("");
export const famCode = (code, caseType, groups = DEFAULT_GROUPS) => { const l = famLetters(caseType, groups); return l ? `${l}-${code}` : String(code ?? ""); };
export const suggestCode = (code, grade, letter, no) => `${(grade || "").trim().toUpperCase()}${letter}-${+code || code}${no}`;
export function sortPool(pool, by = "score", missedFirst = true, groups = DEFAULT_GROUPS){
  const sc = x => x.b.score ?? -1, fm = x => famSize(x.b);
  const keys = {
    group: (x,y) => groupRank(x.b.caseType, groups) - groupRank(y.b.caseType, groups) || byName(x.b.name, y.b.name),
    name: (x,y) => byName(x.b.name, y.b.name),
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
  const picked = [], rest = [], zero = []; let used = 0, members = 0;
  for(const x of sorted){
    const fam = famSize(x.b), v = shareFor(basis, fam, x.students);
    if((basis?.mode === "student" || (basis?.mode === "group" && basis.tierBy === "students")) && !(v > 0)){ zero.push({ ...x, fam, value:0 }); continue; }   // per-student shares: no students → not on the list at all
    const full = (count != null && picked.length >= count) || (total != null && used + v > total + 1e-9) || rest.length;
    if(full){ rest.push({ ...x, fam, value:v }); continue; }
    picked.push({ ...x, fam, value:v }); used += v; members += fam || 1;
  }
  return { picked, rest, zero, used, members, left: total != null ? total - used : null };
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
// levels (optional): which stages count, e.g. ["ابتدائي","إعدادي","ثانوي"] for school meals (no university / institute).
// A child with no stage written counts by age 6–17, which is school age (ابتدائي / إعدادي / ثانوي).
export const STU_LEVELS = ["ابتدائي","إعدادي","ثانوي","معهد","جامعة"];
export const levelOf = s => { const g = groupOf(s)?.g || ""; return STU_LEVELS.find(l => g.startsWith(l)) || ""; };
export function countStudents(children, today = new Date(), levels = null){
  const want = l => !levels || !levels.length || levels.includes(l);
  return (children || []).filter(k => {
    const st = normalizeStage(k.school);
    if(st) return inSchool(st) && want(levelOf(st));
    if(String(k.school || "").trim() && !/^[-\s]*$/.test(k.school)) return false;   // written but unclear (e.g. «تأجيل») → not counted
    const a = age(k.birth, today); return a !== "" && a >= 6 && a <= 17 && (want("ابتدائي") || want("إعدادي") || want("ثانوي"));
  }).length;
}

/* ---------- reading names out of an Excel list ----------
   Works on the office's sheets as they are: finds the header row («الاسم», «الرقم القومي», «عدد») if there is one,
   otherwise takes any 14-digit number as the national ID and the longest Arabic text as the name.
   Titles, totals and signature lines are skipped. */
const SKIP_ROW = /اجمال|تم الصرف|نموذج|جمعي[هة]|المسجل[هة]|^كشف|كشف (صرف|توزيع)|عن شهر|امين الصندوق|رئيس|التوقيع|^الاسم$/;
export function rowsFromSheet(aoa){
  // Cells may arrive as real numbers (sheet read with raw:true): a national ID typed into a General cell is
  // the number 29903201401304 — String() keeps every digit, whereas the sheet's own text is "2.99032E+13".
  const cell = c => typeof c === "number" ? (Number.isInteger(c) ? c.toFixed(0) : String(c)) : String(c ?? "").trim();
  const rows = (aoa || []).map(r => (r || []).map(cell));
  let head = -1, cName = -1, cNid = -1, cCount = -1;
  for(let i = 0; i < Math.min(rows.length, 20) && head < 0; i++){
    rows[i].forEach((c, j) => { const n = norm(c); if(/^الاس+م|اسم المستفيد/.test(n)) cName = j; if(/القوم/.test(n)) cNid = j; if(/^(عدد|العدد)/.test(n)) cCount = j; });
    if(cName >= 0) head = i; else { cNid = -1; cCount = -1; }
  }
  const out = [];
  for(let i = head + 1; i < rows.length; i++){
    const r = rows[i]; if(!r.some(Boolean)) continue;
    const nidCell = cNid >= 0 ? latinDigits(r[cNid]).replace(/\D/g,"") : "";
    const nid = nidCell.length === 14 ? nidCell : (r.map(c => latinDigits(c).replace(/\D/g,"")).find(d => d.length === 14) || "");
    let name = cName >= 0 ? r[cName] : "";
    if(!name || !/[؀-ۿ]/.test(name)) name = r.filter(c => /[؀-ۿ]{2}/.test(c)).sort((a,b) => b.length - a.length)[0] || "";
    name = name.replace(/ـ+/g,"").replace(/\s+/g," ").trim();
    if(!name || SKIP_ROW.test(norm(name))) continue;
    if(!nid && name.split(" ").length < 2) continue;
    const count = cCount >= 0 ? toNumber(r[cCount]) : null;
    out.push({ name, nid, count, sheetNid: nidCell && nidCell.length !== 14 ? nidCell : "" });
  }
  return out;
}
// Finds the family for a row: national ID first, then the exact name, then the first three names if only one family has them.
export function matchPerson(row, people){
  if(row.nid){ const b = people.find(p => p.nationalId === row.nid); if(b) return { b, how:"nid" }; }
  const n = norm(row.name); if(!n) return { b:null, how:"" };
  const exact = people.filter(p => norm(p.name) === n); if(exact.length === 1) return { b:exact[0], how:"name" };
  const k3 = n.split(" ").slice(0,3).join(" ");
  if(k3.split(" ").length === 3){ const m = people.filter(p => norm(p.name).split(" ").slice(0,3).join(" ") === k3); if(m.length === 1) return { b:m[0], how:"name3" }; }
  return { b:null, how:"" };
}
/* A list typed off a handwritten paper: case numbers («4 18 ١٥٦»), national IDs, or one name per line.
   A short number is a case number only if a case has it; anything not found comes back so it can be fixed. */
// codes:false for text read out of a printed PDF, where short numbers are row numbers and counts, not case numbers.
export function pickFromText(text, people, { codes = true } = {}){
  const found = [], unknown = [], seen = new Set();
  const add = (b, how, token) => { if(seen.has(b.id)) return; seen.add(b.id); found.push({ b, how, token }); };
  for(const line of latinDigits(text).split(/[\n،,;]+/)){
    const nums = line.match(/\d+/g) || [];
    for(const t of nums){
      if(t.length === 14){ const b = people.find(p => p.nationalId === t); b ? add(b, "nid", t) : unknown.push(t); }
      else if(codes && t.length <= 4){ const b = people.find(p => /^\d+$/.test(String(p.code)) && +p.code === +t); b ? add(b, "code", t) : unknown.push(t); }
    }
    const name = line.replace(/[\d.\-–_/\\()]+/g, " ").replace(/\s+/g, " ").trim();
    if(name.split(" ").length >= 2){ const m = matchPerson({ name }, people); m.b ? add(m.b, m.how, name) : !nums.length && unknown.push(name); }
  }
  return { found, unknown };
}

/* ---------- checking a case's PDF against the site ----------
   Takes the text read out of the PDF and the case as it is on the site; reports what matches, what's different,
   and what's in the file but not on the site (e.g. a child's national ID that was never entered). */
export function crossCheck(text, b, today = new Date()){
  text = String(text || "").normalize("NFKC");
  const t = latinDigits(text), n = norm(text);
  // «2 9 9 0 3 …» typed one digit per box: join only runs of single digits, never two whole numbers side by side
  const digits = t.replace(/\b\d(?:[  ]\d\b){3,}/g, m => m.replace(/[  ]/g, ""));
  const nids = [...new Set((digits.match(/\d{14}/g) || []).filter(x => parseNID(x, today).ok))];
  const phones = [...new Set((digits.match(/(?:^|\D)(0?1[0125]\d{8})(?!\d)/g) || []).map(x => cleanPhone(x.replace(/^\D/,""))))].filter(validPhone);
  const has = s => s && n.includes(norm(s));
  const out = { ok:[], diff:[], extra:[], readable: n.replace(/\s/g,"").length > 30 };
  if(!out.readable) return out;
  // the case herself
  if(b.nationalId){ if(nids.includes(b.nationalId)) out.ok.push(`الرقم القومي ${b.nationalId}`); else out.diff.push(`الرقم القومي اللي على الموقع (${b.nationalId}) مش موجود في الملف`); }
  const words = norm(b.name).split(" ").filter(w => w.length > 1), found = words.filter(w => n.includes(w));
  if(words.length){ if(found.length === words.length) out.ok.push(`الاسم «${b.name}»`); else out.diff.push(`الاسم: في الملف لقيت ${found.length} من ${words.length} أسامي («${words.filter(w => !found.includes(w)).join(" ")}» مش موجود)`); }
  const sitePhones = [...new Set([b.phone, b.phone2, b.whatsapp].map(cleanPhone).filter(validPhone))];
  sitePhones.forEach(p => phones.includes(p) ? out.ok.push(`التليفون ${p}`) : out.diff.push(`التليفون ${p} اللي على الموقع مش موجود في الملف`));
  phones.filter(p => !sitePhones.includes(p)).forEach(p => out.extra.push(`تليفون في الملف مش على الموقع: ${p}`));
  const fm = /اجمال[يى]\s*عدد\s*(?:افراد\s*)?الاسر[هة]\s*:?\s*(\d{1,2})/.exec(latinDigits(n));
  if(fm){ const f = +fm[1]; if(+b.familySize === f) out.ok.push(`عدد الأفراد ${f}`); else out.diff.push(`عدد الأفراد: الملف ${f} — الموقع ${b.familySize || "مش متسجل"}`); }
  // children
  const kids = b.children || [], kidNids = kids.map(k => k.nid).filter(Boolean);
  kids.forEach(k => {
    if(k.nid){ nids.includes(k.nid) ? out.ok.push(`رقم ${k.name}`) : out.diff.push(`رقم ${k.name} القومي (${k.nid}) مش موجود في الملف`); }
    else if(k.name && !has(norm(k.name).split(" ")[0])) out.diff.push(`${k.name} (ابن/بنت على الموقع) مش مذكور في الملف`);
  });
  nids.filter(x => x !== b.nationalId && !kidNids.includes(x)).forEach(x => { const p = parseNID(x, today);
    out.extra.push(`رقم قومي في الملف مش على الموقع: ${x} — ${p.gender}، مواليد ${p.birth}`); });
  return out;
}
// Which case is a file for, from its file name: «29903201401304.pdf», «161 نورا عرفه.pdf», «ملف نورا عرفه سليمان.pdf».
export function matchFileName(fileName, people){
  const base = latinDigits(String(fileName || "").replace(/\.[a-z0-9]{2,5}$/i, "")).replace(/[_\-.]+/g, " ").trim();
  const nid = (base.match(/\d{14}/) || [""])[0];
  if(nid){ const b = people.find(p => p.nationalId === nid); if(b) return { b, how:"nid" }; }
  const NOISE = new Set(["ملف","حاله","الحاله","نموذج","انضمام","بحث","ميداني","scan","img","pdf","page"]);   // compared after norm() (ة→ه)
  const words = base.replace(/\d+/g, " ").split(/\s+/).filter(w => w && !NOISE.has(norm(w).toLowerCase())).join(" ");
  if(words.split(" ").length >= 2){ const m = matchPerson({ name:words, nid:"" }, people); if(m.b) return m;
    // the file name may carry only part of the name («نورا عرفه»): all its words in one case's name, and only one such case
    const w = norm(words).split(" "), hits = people.filter(p => { const pn = norm(p.name).split(" "); return w.every(x => pn.includes(x)); });
    if(hits.length === 1) return { b:hits[0], how:"name" }; }
  const code = (base.match(/(?:^|\s)(\d{1,4})(?=\s|$)/) || [])[1];
  if(code){ const b = people.find(p => String(p.code) === code.padStart(3, "0") || String(p.code) === code); if(b) return { b, how:"code" }; }
  return { b:null, how:"" };
}

/* A minimal PDF made of one JPEG per page (used to shrink big scans before upload).
   pages: [{ jpeg:Uint8Array, w, h (pixels), pw, ph (page size in points) }] → Uint8Array */
export function jpegsToPdf(pages){
  const enc = new TextEncoder(), parts = [], offs = []; let len = 0;
  const put = x => { const b = typeof x === "string" ? enc.encode(x) : x; parts.push(b); len += b.length; };
  const obj = (n, body, stream) => { offs[n] = len; put(`${n} 0 obj\n${body}\n`); if(stream){ put("stream\n"); put(stream); put("\nendstream\n"); } put("endobj\n"); };
  const n = pages.length, kids = pages.map((_, i) => `${3 + i*3} 0 R`).join(" ");
  put("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n");
  obj(1, "<< /Type /Catalog /Pages 2 0 R >>");
  obj(2, `<< /Type /Pages /Kids [${kids}] /Count ${n} >>`);
  pages.forEach((p, i) => {
    const pg = 3 + i*3, im = pg + 1, ct = pg + 2, pw = +p.pw.toFixed(2), ph = +p.ph.toFixed(2);
    const content = enc.encode(`q ${pw} 0 0 ${ph} 0 0 cm /Im0 Do Q`);
    obj(pg, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pw} ${ph}] /Resources << /XObject << /Im0 ${im} 0 R >> >> /Contents ${ct} 0 R >>`);
    obj(im, `<< /Type /XObject /Subtype /Image /Width ${p.w} /Height ${p.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.jpeg.length} >>`, p.jpeg);
    obj(ct, `<< /Length ${content.length} >>`, content);
  });
  const total = 3 + n*3, xref = len;
  put(`xref\n0 ${total}\n0000000000 65535 f \n` + offs.slice(1, total).map(o => String(o).padStart(10, "0") + " 00000 n \n").join(""));
  put(`trailer\n<< /Size ${total} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  const out = new Uint8Array(len); let at = 0; for(const b of parts){ out.set(b, at); at += b.length; } return out;
}

/* Trip groups: split the coming kids between the supervisors.
   kids: [{ id, fam, a (age or null), sex ("ولد" | "بنت" | null) }]
   sups: [{ id, takes: "ولاد" | "بنات" | "الكل", min?, max? }]
   A kid only goes to a supervisor who fits (boys / girls, age range). Hardest-to-place kids go first, the least
   loaded supervisor gets the next one, and brothers & sisters stay with one supervisor unless that unbalances things.
   → { groups: Map(supId → kids sorted by age), left: [{ kid, why }] } */
export function assignKids(kids, sups){
  const groups = new Map(sups.map(s => [s.id, []])), left = [];
  const has = v => v !== null && v !== undefined && v !== "";
  const fits = (s, k) => !(s.takes === "ولاد" && k.sex !== "ولد") && !(s.takes === "بنات" && k.sex !== "بنت")
    && !(has(s.min) && (!has(k.a) || k.a < +s.min)) && !(has(s.max) && (!has(k.a) || k.a > +s.max));
  const why = k => {
    if(!sups.length) return "مفيش مشرفين لسه";
    if(!has(k.sex) && sups.every(s => s.takes !== "الكل")) return "مش محدد ولد ولا بنت";
    if(!has(k.a) && sups.filter(s => s.takes === "الكل" || s.takes === (k.sex === "ولد" ? "ولاد" : "بنات")).every(s => has(s.min) || has(s.max))) return "سنه مش مكتوب";
    return `مفيش مشرف ${k.sex === "بنت" ? "بنات" : k.sex === "ولد" ? "ولاد" : ""} لسن ${has(k.a) ? k.a : "؟"}`.replace(/\s+/g, " ");
  };
  const order = kids.map(k => ({ k, el: sups.filter(s => fits(s, k)) }))
    .sort((x, y) => x.el.length - y.el.length || String(x.k.fam).localeCompare(String(y.k.fam)) || (y.k.a ?? -1) - (x.k.a ?? -1));
  for(const { k, el } of order){
    if(!el.length){ left.push({ kid: k, why: why(k) }); continue; }
    const n = s => groups.get(s.id).length, min = Math.min(...el.map(n));
    const sib = el.find(s => groups.get(s.id).some(x => x.fam === k.fam) && n(s) <= min + 1);
    groups.get((sib || el.reduce((b, s) => n(s) < n(b) ? s : b)).id).push(k);
  }
  for(const g of groups.values()) g.sort((x, y) => byName(x.name, y.name) || (x.a ?? 99) - (y.a ?? 99));
  return { groups, left };
}

/* What was typed in a trip's age box: a number ("9"), or a school year ("3 ثانوي", "تانية ابتدائي", "KG2").
   → { age: number | null, stage: text | null } — a school year gives the usual age for it. */
export function stageAge(stage){
  const st = normalizeStage(stage) || stage; if(!st) return null;
  const pre = { "تحت السن":3, "حضانة":4, "رياض أطفال ١":4, "رياض أطفال ٢":5 }; if(st in pre) return pre[st];
  const lv = ORD.indexOf(st.split(" ")[0]); if(lv < 0) return null;
  return /ابتدائي/.test(st) ? 6 + lv : /إعدادي/.test(st) ? 12 + lv : /ثانوي|معهد/.test(st) ? 15 + lv : /جامعة/.test(st) ? 18 + lv : null;
}
export function parseKidAge(raw){
  const t = latinDigits(String(raw ?? "")).trim(); if(!t) return { age: null, stage: null };
  const yrs = /^(\d{1,2})\s*(سنة|سنه|سنين|سنوات|سنتين|س)?$/.exec(t);   // «9», «9 سنين», «٩ سنه», «12 سنة»
  if(yrs) return { age: Math.min(+yrs[1], 25), stage: null };
  const kg = /^(kg|كي ?جي)\s*([12])$/i.exec(t);
  const stage = kg ? `رياض أطفال ${kg[2] === "1" ? "١" : "٢"}` : normalizeStage(t);
  return stage ? { age: stageAge(stage), stage } : { age: null, stage: t };
}

// Three-way merge of a list of {id,…} objects: start from `theirs` (the newest copy), then apply what changed from
// `base` to `mine` — items added, removed or edited by id. Changes made by someone else to other items are kept.
export function mergeById(base, mine, theirs){
  const key = x => JSON.stringify(x);
  const b = new Map((base || []).map(x => [x.id, x])), m = new Map((mine || []).map(x => [x.id, x]));
  const out = (theirs || []).filter(x => !(b.has(x.id) && !m.has(x.id)))                       // removed here
    .map(x => m.has(x.id) && (!b.has(x.id) || key(b.get(x.id)) !== key(m.get(x.id))) ? m.get(x.id) : x);   // edited here
  const have = new Set(out.map(x => x.id));
  for(const x of mine || []) if(!have.has(x.id) && !b.has(x.id)) out.push(x);                     // added here
  return out;
}

/* ---------- case evaluation form (استمارة تقييم الحالات — REV 7, 27/07/2024) ----------
   8 items, 53 points in all. The result is a percentage and a grade: A ≥ 81%, B 61–80%, C 50–60%, below 50% not accepted.
   Each item has its options with their points; «none» (0) is there for items that may not apply. */
export const EVAL_REV = "REV 7 — 27/07/2024";
export const EVAL_FORM = [
  { key:"age", name:"السن", max:4, opts:[["lt30","أقل من 30",3],["31_50","من 31 لـ 50",1.5],["gt51","أكبر من 51",4]] },
  { key:"marital", name:"الحالة الاجتماعية", max:5, opts:[["married","متزوجة",2],["divorced","مطلقة",3],["abandoned","هجر",5],["widow","أرملة",4]] },
  { key:"job", name:"نوع الوظيفة", max:7, opts:[["works","العائل يعمل",3,"متوسط أكثر من 1500 شهري"],["casual","يعمل عامل / غير دائم",5,"متوسط أقل من 1500 شهري"],["none","لا يعمل",7,"مريض مزمن حرج لا يقدر على العمل"]] },
  { key:"debt", name:"إجمالي الدين", max:7, opts:[["0","مفيش دين",0],["lt500","أقل من 500",1],["501_800","501 – 800",2],["801_1100","801 – 1100",3],["1101_1500","1101 – 1500",5],["gt1501","أكتر من 1501",7]] },
  { key:"housing", name:"نوع السكن", max:6, opts:[["own","ملك",0,"بيت دور واحد شقة واحدة بحد أقصى 100 م²"],["family","مشاركة الأسرة",3,"استضافة"],["rent","إيجار",6,"إيجار جديد"]] },
  { key:"illness", name:"المرض / إعاقة مرضية", max:9, opts:[["0","مفيش",0],["dependents","التابعين",3],["provider_critical","العائل مزمن حرج",7,"أورام - شلل - ذوي همم - معاق - قلب مفتوح - تليف كبدي"],["provider_works","العائل مزمن ويعمل",5],["family","الأسرة",9,"العائل وأحد الأبناء على الأقل"]] },
  { key:"education", name:"مراحل التعليم", max:8, opts:[["0","مفيش أبناء في التعليم",0],["primary","ابتدائي",2],["prep","إعدادي - فني",4],["secondary","ثانوي",8],["university","جامعي",7]] },
  { key:"kids", name:"عدد الأبناء", max:7, opts:[["0","مفيش",0],["1","ابن واحد",2],["2_3","من 2 لـ 3",5],["4","4 فأكتر",7,"البنات حتى الزواج والأولاد حتى إتمام التعليم"]] },
];
export const EVAL_BANDS = { A:81, B:61, C:50 };
// The form can be edited from the site (a new REV): { rev, bands, items }. An item's maximum is its highest option.
export const DEFAULT_EVAL = { rev: EVAL_REV, bands: EVAL_BANDS, items: EVAL_FORM };
export const itemMax = it => Math.max(0, ...(it.opts || []).map(o => +o[2] || 0));
export const evalMax = (form = DEFAULT_EVAL) => (form.items || []).reduce((s, it) => s + itemMax(it), 0);
export const EVAL_MAX = evalMax();   // 53
export const gradeOf = (pct, bands = EVAL_BANDS) => pct == null || pct === "" ? "" : pct >= bands.A ? "A" : pct >= bands.B ? "B" : pct >= bands.C ? "C" : "";
export function scoreEval(answers = {}, form = DEFAULT_EVAL){
  let total = 0; const missing = [], max = evalMax(form);
  for(const it of form.items || []){ const o = (it.opts || []).find(x => x[0] === answers[it.key]); if(o) total += +o[2] || 0; else missing.push(it.name); }
  const pct = max ? Math.round(total / max * 100) : 0;
  return { total, pct, grade: gradeOf(pct, form.bands || EVAL_BANDS), missing, max };
}
// A starting point from what's on the case file (everything stays editable): age, marital status, housing, children, school stages.
export function suggestEval({ age: a = "", marital = "", housing = "", job = "", kids = 0, stages = [] } = {}){
  const s = {};
  if(a !== "" && a != null) s.age = a <= 30 ? "lt30" : a <= 50 ? "31_50" : "gt51";
  const m = String(marital || "");
  s.marital = /أرمل/.test(m) ? "widow" : /مطلق/.test(m) ? "divorced" : /مهجور|هجر/.test(m) ? "abandoned" : /متزوج/.test(m) ? "married" : undefined;
  const h = String(housing || "");
  s.housing = /إيجار|ايجار/.test(h) ? "rent" : /أهل|اهل|مشارك|استضاف/.test(h) ? "family" : /ملك|تمليك/.test(h) ? "own" : undefined;
  const j = String(job || "");
  s.job = !j.trim() ? undefined : /لا يعمل|لاتعمل|لا تعمل|بدون|مفيش|ربة منزل|ربه منزل/.test(j) ? "none" : /عامل|يومي|اليومية|غير دائم|أرزقي|ارزقي/.test(j) ? "casual" : "works";
  s.kids = kids >= 4 ? "4" : kids >= 2 ? "2_3" : kids === 1 ? "1" : "0";
  const g = stages.map(x => String(x || ""));
  s.education = g.some(x => /ثانوي/.test(x)) ? "secondary" : g.some(x => /جامعة|معهد/.test(x)) ? "university" : g.some(x => /إعدادي|اعدادي|فني/.test(x)) ? "prep" : g.some(x => /ابتدائي/.test(x)) ? "primary" : "0";
  for(const k of Object.keys(s)) if(s[k] === undefined) delete s[k];
  return s;
}
