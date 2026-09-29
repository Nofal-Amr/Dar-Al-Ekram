// Pure domain logic — no DOM, no network. Imported by app.js and by tests/ (node --test).

export const MONTHS = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];

/* ---------- text & digits ---------- */
// Staff type on Arabic keyboards, so ٠-٩ and ۰-۹ must behave exactly like 0-9.
export const latinDigits = s => String(s ?? "").replace(/[٠-٩]/g, d => d.charCodeAt(0) - 0x0660).replace(/[۰-۹]/g, d => d.charCodeAt(0) - 0x06F0);
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
  const picked = [], rest = [], zero = []; let used = 0, members = 0;
  for(const x of sorted){
    const fam = famSize(x.b), v = shareFor(basis, fam, x.students);
    if(basis?.mode === "student" && !(v > 0)){ zero.push({ ...x, fam, value:0 }); continue; }   // per-student shares: no students → not on the list at all
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
export function countStudents(children, today = new Date()){
  return (children || []).filter(k => {
    const st = normalizeStage(k.school);
    if(st) return inSchool(st);
    if(String(k.school || "").trim() && !/^[-\s]*$/.test(k.school)) return false;   // written but unclear (e.g. «تأجيل») → not counted
    const a = age(k.birth, today); return a !== "" && a >= 6 && a <= 17;
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
  for(const g of groups.values()) g.sort((x, y) => (x.a ?? 99) - (y.a ?? 99));
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
