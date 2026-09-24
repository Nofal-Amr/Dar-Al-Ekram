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
