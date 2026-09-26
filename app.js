import { MONTHS, norm, cleanPhone, validPhone, latinDigits, parseNID, isoDay, mIdx, mLabel, dLabel, addDays, age as ageAt, num,
  STAGE_GROUPS, STAGES, normalizeStage, nextStage, inSchool, schoolYear, syLabel, famSize, shareFor, sortPool, planShares, PRIORITY, minPin } from "./core.js";
import { ic } from "./icons.js";

/* ================= config ================= */
export const VERSION = "1.3.0";
const SUPABASE_URL = "https://jvgxldhshbyyuftjgfrw.supabase.co";
const SUPABASE_KEY = "sb_publishable_yS3OzVszjySNzCaRAyWpQA_pmKoPZJT";
const DOMAIN = "daralekram.app";
const ORG = "جمعية دار الإكرام للخدمات الاجتماعية";
const ORG2 = "المشهرة برقم 1401 لسنة 2009";
// Demo mode: fake data, no network. Only ever on this computer (localhost) with ?demo in the address.
const DEMO = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) && new URLSearchParams(location.search).has("demo");
const CASE_TYPES = ["أيتام","مساعدات","مرضي","أيتام ومرضي","كفالات","غير محدد"];
const STATUSES = ["نشط","انتظار","موقوف","ملغي"];
const MARITAL = ["أرملة","مطلقة","متزوجة","مهجورة","آنسة","أرمل","متزوج","مطلق"];
const ROLE_AR = {manager:"مدير", worker:"موظف", helper:"عامل", viewer:"مشاهدة فقط", pending:"مستني تفعيل"};
const ROLE_DESC = {manager:"كل حاجة: يعتمد الكشوف ويحذف ويضيف موظفين", worker:"موظف مكتب: يضيف ويعدّل الحالات ويطبع ويشوف التقارير", helper:"شاشة بسيطة بزراير كبيرة: يسلّم ويتصل ويطبع بس", viewer:"يشوف بس من غير أي تعديل"};

const sb = DEMO ? (await import("./demo.js")).createDemoClient()
  : window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: true, autoRefreshToken: true } });

/* ================= state ================= */
let me = null;              // {id, full_name, username, role, active}
let role = "worker", realRole = "worker";
const B = new Map(), T = new Map(), K = new Map(), P = new Map(), C = new Map(), TK = new Map();   // beneficiaries, types, batches(with items), profiles, calls, tasks
let loaded = false, view = "home", peopleQ = "", peopleF = "all", peopleSort = "code", peopleLimit = 100;
const PAGE = 100;   // rows drawn at a time — keeps the Windows 7 PC responsive
const logCache = new Map();
/* Form drafts (localStorage). Wiped on save, on «إلغاء», and on logout. */
let draftTimer = null;
const saveDraft = (k, v) => { try{ localStorage.setItem(k, JSON.stringify({ ...v, at: new Date().toISOString() })); }catch(e){} };
const loadDraft = k => { try{ return JSON.parse(localStorage.getItem(k) || "null"); }catch(e){ return null; } };
const clearDraft = k => { try{ localStorage.removeItem(k); }catch(e){} };
const clearAllDrafts = () => { try{ Object.keys(localStorage).filter(k => k.startsWith("draft:")).forEach(k => localStorage.removeItem(k)); }catch(e){} };

/* ================= helpers ================= */
const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const now = new Date();
const today = isoDay(now);
const curMonth = today.slice(0,7);
const age = d => ageAt(d, now);
const gradeRank = g => ({A:0,B:1,C:2}[g] ?? 3);
const isMgr = () => role === "manager";
const canWrite = () => role === "manager" || role === "worker";
const simple = () => role === "helper";
const cleanUser = u => latinDigits(u).trim().toLowerCase().replace(/[^a-z0-9._-]/g,"");
const who = id => id ? (P.get(id)?.full_name || P.get(id)?.username || "مستخدم") : "";

function toast(msg){ document.querySelectorAll(".toast").forEach(t => t.remove()); const t = document.createElement("div"); t.className = "toast"; t.setAttribute("role","status"); t.textContent = msg; document.body.appendChild(t); setTimeout(() => t.remove(), 3200); }
const isNetErr = e => !navigator.onLine || /Failed to fetch|NetworkError|network|Load failed|fetch/i.test(String(e?.message || e || ""));
function errMsg(e){
  const m = String(e?.message || e || "");
  if(/row-level security|permission|not allowed|violates/i.test(m)) return "مش مسموحلك تعمل ده";
  if(/duplicate key.*national_id/i.test(m)) return "الرقم القومي ده متسجل لحالة تانية";
  if(/duplicate key.*code/i.test(m)) return "رقم الحالة ده مستخدم قبل كده";
  if(isNetErr(e)) return "مفيش إنترنت — جرّب تاني لما النت يرجع";
  return "حصلت مشكلة: " + m.slice(0,120);
}
/* In-app confirm (the browser's confirm() looks broken on Windows 7 and can't be styled).
   Resolves true/false; stacks above an open sheet without closing it. */
function ask(message, { ok = "تمام", cancel = "رجوع", danger = false, title = "" } = {}){
  return new Promise(resolve => {
    const prev = document.activeElement;
    const w = document.createElement("div"); w.className = "ask-scrim";
    w.innerHTML = `<div class="ask" role="alertdialog" aria-modal="true" aria-labelledby="askT" aria-describedby="askM">
      ${title ? `<h2 id="askT">${esc(title)}</h2>` : `<h2 id="askT" class="sr">تأكيد</h2>`}<p id="askM">${esc(message).replace(/\n/g,"<br>")}</p>
      <div class="bar"><button class="btn ${danger ? "danger-solid" : "pri"}" data-a="1">${esc(ok)}</button><button class="btn" data-a="0">${esc(cancel)}</button></div></div>`;
    const done = v => { w.remove(); document.removeEventListener("keydown", key, true); prev?.focus?.(); resolve(v); };
    const key = e => { if(e.key === "Escape"){ e.stopPropagation(); done(false); } };
    w.onclick = e => { const a = e.target.closest("[data-a]"); if(a) done(a.dataset.a === "1"); else if(e.target === w) done(false); };
    document.addEventListener("keydown", key, true);
    document.body.appendChild(w); w.querySelector(danger ? "[data-a='0']" : "[data-a='1']").focus();
  });
}
async function run(promise, okMsg){
  const { data, error } = await promise;
  if(error){ toast(errMsg(error)); return null; }
  if(okMsg) toast(okMsg);
  return data ?? true;
}
async function logIt(entity, id, text){ if(!canWrite() || !text) return; await sb.from("activity_log").insert({entity, entity_id:id, text}); logCache.delete(entity+id); }

/* ================= mapping ================= */
const fromB = r => ({ id:r.id, code:r.code, name:r.name, nationalId:r.national_id||"", phone:r.phone||"", phone2:r.phone2||"", birth:r.birth||"", caseType:r.case_type||"", grade:r.grade||"", score:r.score,
  project:r.project||"", area:r.area||"", address:r.address||"", marital:r.marital||"", job:r.job||"", income:r.income||"", pension:r.pension||"", housing:r.housing||"",
  familySize:r.family_size, status:r.status, lastReview:r.last_review||"", nextReview:r.next_review||"", notes:r.notes||"", children:r.children||[], source:r.source, createdAt:r.created_at, updatedAt:r.updated_at, archivedAt:r.archived_at||null, tags:r.tags||[], photos:r.photos||{} });
const toB = b => ({ code:b.code, name:b.name, national_id:b.nationalId||null, phone:b.phone||null, phone2:b.phone2||null, birth:b.birth||null, case_type:b.caseType||"", grade:b.grade||"", score:b.score ?? null,
  project:b.project||"", area:b.area||"", address:b.address||"", marital:b.marital||"", job:b.job||"", income:b.income||"", pension:b.pension||"", housing:b.housing||"",
  family_size:b.familySize ?? null, status:b.status, last_review:b.lastReview||null, next_review:b.nextReview||null, notes:b.notes||"", children:b.children||[], tags:b.tags||[] });
const fromT = r => ({ id:r.id, name:r.name, unit:r.unit, amount:+r.amount, caseTypes:r.case_types||[], cooldown:r.cooldown, template:r.template, order:r.sort, archivedAt:r.archived_at||null });
const fromK = (r, items) => ({ id:r.id, title:r.title, typeId:r.type_id, typeName:r.type_name, unit:r.unit, template:r.template, month:r.month, status:r.status, single:r.single, cooldown:r.cooldown,
  createdAt:r.created_at, createdBy:r.created_by, approvedAt:r.approved_at, approvedBy:r.approved_by, archivedAt:r.archived_at||null, week:r.week||null, donor:r.donor||"", basis:r.basis||null, items:(items||[]).sort((a,b)=>a.position-b.position).map(fromI) });
const fromI = r => ({ id:r.id, bid:r.beneficiary_id, code:r.code, name:r.name, nationalId:r.national_id||"", phone:r.phone||"", familySize:r.family_size||"", value:+r.value, reason:r.reason||"", received:r.received, receivedAt:r.received_at, receivedBy:r.received_by });
const fromC = r => ({ id:r.id, bid:r.beneficiary_id, batchId:r.batch_id||null, result:r.result, at:r.at, by:r.by });
const fromTk = r => ({ id:r.id, title:r.title, notes:r.notes||"", due:r.due||"", bid:r.beneficiary_id||null, assignee:r.assignee||null, doneAt:r.done_at||null, doneBy:r.done_by||null, createdAt:r.created_at, createdBy:r.created_by, archivedAt:r.archived_at||null });
const toI = (it, batchId, i) => ({ batch_id:batchId, beneficiary_id:it.bid||null, position:i, code:it.code, name:it.name, national_id:it.nationalId||null, phone:it.phone||null, family_size:+it.familySize||null, value:+it.value||0, reason:it.reason||"", received:!!it.received, received_at:it.received?new Date().toISOString():null });

/* ================= loading ================= */
async function fetchAll(table, select="*"){
  const out = []; let from = 0;
  for(;;){ const { data, error } = await sb.from(table).select(select).range(from, from+999); if(error) throw error; out.push(...data); if(data.length < 1000) break; from += 1000; }
  return out;
}
/* Everything the app knows lives in B/T/K/P. `dataVer` bumps on any change so derived lists
   (receipts etc.) are computed once per change, not once per call — the office PC is slow. */
let dataVer = 0, loadError = null, fromSnapshot = null;
const changed = () => { dataVer++; scheduleRender(); saveSnapshotSoon(); };
let renderTimer = null;
function scheduleRender(){ clearTimeout(renderTimer); renderTimer = setTimeout(() => { render(); refreshSheet(); }, 60); }
function memo(fn){ let v = -1, out; return () => { if(v !== dataVer){ out = fn(); v = dataVer; } return out; }; }

function setAll(bs, ts, ks, is, ps, cs = [], tk = []){
  B.clear(); bs.forEach(r => B.set(r.id, fromB(r)));
  T.clear(); ts.forEach(r => T.set(r.id, fromT(r)));
  const byBatch = {}; is.forEach(r => (byBatch[r.batch_id] ||= []).push(r));
  K.clear(); ks.forEach(r => K.set(r.id, fromK(r, byBatch[r.id])));
  P.clear(); ps.forEach(r => P.set(r.id, r));
  C.clear(); cs.forEach(r => C.set(r.id, fromC(r)));
  TK.clear(); tk.forEach(r => TK.set(r.id, fromTk(r)));
  overlayQueue();
}
let reloading = null;
async function reload(){
  if(reloading) return reloading;
  reloading = (async () => {
    try{
      const [bs, ts, ks, is, ps, cs, tk] = await Promise.all([fetchAll("beneficiaries"), fetchAll("aid_types"), fetchAll("batches"), fetchAll("batch_items"), fetchAll("profiles"), fetchAll("calls").catch(() => []), fetchAll("tasks").catch(() => [])]);
      setAll(bs, ts, ks, is, ps, cs, tk); snapRaw = { bs, ts, ks, is, ps, cs, tk };
      loaded = true; loadError = null; fromSnapshot = null; dataVer++; render(); refreshSheet(); saveSnapshotSoon();
    }catch(e){
      loadError = e;
      if(!loaded){ const snap = await readSnapshot(); if(snap && snap.uid === me?.id){ setAll(snap.bs, snap.ts, snap.ks, snap.is, snap.ps, snap.cs || [], snap.tk || []); snapRaw = snap; loaded = true; fromSnapshot = snap.at; dataVer++; } }
      render(); netBanner(); if(loaded) toast(errMsg(e));
    }
    finally{ reloading = null; }
  })();
  return reloading;
}
// Targeted refreshes after our own writes — one row instead of five whole tables.
async function refreshPerson(id){ const { data } = await sb.from("beneficiaries").select("*").eq("id", id).single(); if(data){ B.set(id, fromB(data)); upsertRaw("bs", data); changed(); } }
async function refreshBatch(id){
  const [{ data:k }, { data:items }] = await Promise.all([sb.from("batches").select("*").eq("id", id).single(), sb.from("batch_items").select("*").eq("batch_id", id)]);
  if(k){ K.set(id, fromK(k, items || [])); upsertRaw("ks", k); snapRaw && (snapRaw.is = snapRaw.is.filter(r => r.batch_id !== id).concat(items || [])); changed(); }
}
async function refreshTable(t){ const rows = await fetchAll(t).catch(() => null); if(!rows) return; if(t === "aid_types"){ T.clear(); rows.forEach(r => T.set(r.id, fromT(r))); if(snapRaw) snapRaw.ts = rows; } if(t === "profiles"){ P.clear(); rows.forEach(r => P.set(r.id, r)); if(snapRaw) snapRaw.ps = rows; } changed(); }

// Realtime: apply the changed row directly instead of refetching everything.
function applyChange(table, p){
  const row = p.new && Object.keys(p.new).length ? p.new : null, oldId = p.old?.id;
  if(table === "beneficiaries"){ if(row){ B.set(row.id, fromB(row)); upsertRaw("bs", row); } else if(oldId){ B.delete(oldId); } }
  else if(table === "aid_types"){ if(row){ T.set(row.id, fromT(row)); upsertRaw("ts", row); } else if(oldId) T.delete(oldId); }
  else if(table === "batches"){ if(row){ const prev = K.get(row.id); K.set(row.id, { ...fromK(row, []), items: prev?.items || [] }); upsertRaw("ks", row); } else if(oldId) K.delete(oldId); }
  else if(table === "batch_items"){
    if(row){ const k = K.get(row.batch_id); if(!k){ refreshBatch(row.batch_id); return; } const it = fromI(row), i = k.items.findIndex(x => x.id === it.id);
      if(i >= 0) k.items[i] = it; else { k.items.push(it); k.items.sort((a,b) => a.position - b.position); } upsertRaw("is", row); }
    else if(oldId){ for(const k of K.values()){ const i = k.items.findIndex(x => x.id === oldId); if(i >= 0){ k.items.splice(i,1); break; } } }
  }
  else if(table === "calls"){ if(row){ C.set(row.id, fromC(row)); upsertRaw("cs", row); } }
  else if(table === "tasks"){ if(row){ TK.set(row.id, fromTk(row)); upsertRaw("tk", row); } }
  overlayQueue(); logCache.clear(); changed();
}
let rt = null;
function subscribeRealtime(){
  if(rt) return;
  rt = sb.channel("all-changes");
  ["beneficiaries","batches","batch_items","aid_types","calls","tasks"].forEach(t => rt.on("postgres_changes", {event:"*", schema:"public", table:t}, p => applyChange(t, p)));
  rt.subscribe();
}

/* ---------- offline snapshot (IndexedDB) ----------
   The last good copy of the data, so the app still opens — read-only — when the internet drops.
   Stays on this device only and is wiped on logout. */
let snapRaw = null, snapTimer = null;
function upsertRaw(key, row){ if(!snapRaw) return; const a = (snapRaw[key] ||= []), i = a.findIndex(r => r.id === row.id); if(i >= 0) a[i] = row; else a.push(row); }
function idb(){ return new Promise((res, rej) => { const r = indexedDB.open("dar-alekram", 1); r.onupgradeneeded = () => r.result.createObjectStore("kv"); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); }
async function idbSet(k, v){ try{ const db = await idb(); await new Promise((res, rej) => { const tx = db.transaction("kv","readwrite"); v === undefined ? tx.objectStore("kv").delete(k) : tx.objectStore("kv").put(v, k); tx.oncomplete = res; tx.onerror = () => rej(tx.error); }); }catch(e){} }
async function idbGet(k){ try{ const db = await idb(); return await new Promise((res, rej) => { const r = db.transaction("kv").objectStore("kv").get(k); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); }catch(e){ return null; } }
function saveSnapshotSoon(){ if(DEMO || !snapRaw || !me || fromSnapshot) return; clearTimeout(snapTimer); snapTimer = setTimeout(() => idbSet("snap", { ...snapRaw, uid: me.id, me, at: new Date().toISOString() }), 2000); }
const readSnapshot = () => DEMO ? null : idbGet("snap");
const clearSnapshot = () => idbSet("snap", undefined);

/* ---------- "received" queue ----------
   Marking someone as received must never be lost because the internet dropped at the distribution table.
   Failed marks wait in localStorage and are sent (in order) once the connection returns. */
const QKEY = "dar-rq";
const readQ = () => { try{ return JSON.parse(localStorage.getItem(QKEY) || "[]"); }catch(e){ return []; } };
const writeQ = q => { try{ localStorage.setItem(QKEY, JSON.stringify(q)); }catch(e){} };
// Marks still waiting to be sent win over whatever the server last said.
function overlayQueue(){ for(const x of readQ()){ const { it } = findItem(x.id); if(it){ it.received = x.v; it.receivedAt = x.at; it.pending = true; } } }
function findItem(id){ for(const k of K.values()){ const it = k.items.find(x => x.id === id); if(it) return { k, it }; } return {}; }
async function markReceived(it, v){
  it.received = v; it.receivedAt = v ? new Date().toISOString() : null; changed();
  const { error } = await sb.rpc("set_received", { item_id: it.id, is_received: v });
  if(!error){ it.pending = false; changed(); return "ok"; }
  if(isNetErr(error)){ writeQ(readQ().filter(x => x.id !== it.id).concat({ id: it.id, v, at: it.receivedAt })); it.pending = true; changed(); netBanner(); return "queued"; }
  it.received = !v; it.receivedAt = null; changed(); toast(errMsg(error)); return "error";
}
let flushing = false;
async function flushQueue(){
  if(flushing || !navigator.onLine || !me) return; const q = readQ(); if(!q.length) return;
  flushing = true; let sent = 0;
  try{
    for(const x of q){
      const { error } = await sb.rpc("set_received", { item_id: x.id, is_received: x.v });
      if(error && isNetErr(error)) break;
      writeQ(readQ().filter(y => y.id !== x.id)); sent++;
      const { it } = findItem(x.id); if(it){ it.pending = false; if(error){ it.received = !x.v; toast(errMsg(error)); } }
    }
  } finally { flushing = false; }
  if(sent){ changed(); netBanner(); toast(`اترفع ${num(sent)} تسليم كانوا مستنيين النت ✓`); }
}
setInterval(flushQueue, 30000);

/* ================= domain ================= */
// Archived records are hidden everywhere except the archive screen, and never count in history.
const byCode = (a,b)=>String(a.code).localeCompare(String(b.code),"en",{numeric:true});
const types = memo(() => [...T.values()].filter(t=>!t.archivedAt).sort((a,b)=>(a.order??99)-(b.order??99)));
const people = memo(() => [...B.values()].filter(b=>!b.archivedAt).sort(byCode));
const archivedPeople = memo(() => [...B.values()].filter(b=>b.archivedAt).sort(byCode));
const batches = memo(() => [...K.values()].filter(k=>!k.archivedAt).sort((a,b)=>(b.month||"").localeCompare(a.month||"") || (b.createdAt||"").localeCompare(a.createdAt||"")));
const counts = k => !k.archivedAt && ["معتمد","مصروف"].includes(k.status);
const receipts = memo(() => { const out=[]; for(const k of K.values()){ if(!counts(k)) continue; for(const it of k.items) out.push({bid:it.bid,typeId:k.typeId,typeName:k.typeName,unit:k.unit,month:k.month,value:it.value,received:it.received,receivedAt:it.receivedAt,batchId:k.id}); } return out; });
const lastAnyMap = memo(() => { const m=new Map(); for(const r of receipts()) if(r.bid){ const p=m.get(r.bid); if(!p||r.month>p) m.set(r.bid,r.month); } return m; });
const lastByTypeMemo = new Map();
function lastByType(typeId){ const c=lastByTypeMemo.get(typeId); if(c&&c.v===dataVer) return c.m; const m=new Map(); for(const r of receipts()) if(r.typeId===typeId && r.bid){ const p=m.get(r.bid); if(!p||r.month>p) m.set(r.bid,r.month);} lastByTypeMemo.set(typeId,{v:dataVer,m}); return m; }
function eligible(t,b){ if(b.status!=="نشط") return false; if(!t.caseTypes||!t.caseTypes.length) return true; return t.caseTypes.includes(b.caseType||"غير محدد"); }
function reviewDue(b){ if(b.status!=="نشط"&&b.status!=="انتظار") return false; if(b.nextReview) return b.nextReview<=today; if(!b.lastReview) return true; return addDays(b.lastReview,365)<=today; }
function kidsTurning18(b){ return (b.children||[]).filter(k=>{ const a=age(k.birth); return a!==""&&a>=17&&a<18; }); }
const itemFor = (b,value,reason) => ({bid:b.id,code:b.code,name:b.name,nationalId:b.nationalId||"",phone:b.phone||"",familySize:famSize(b)||"",value,received:false,reason});
/* ---------- the planner ----------
   Who can be in a new list, in which order, and how much each family gets. Nothing is hidden: families left out are
   returned with the reason, so the manager can see (and explain) every decision. */
const sameSlot = (k, month, week) => k.month===month && (!k.week || !week || k.week===week);
function candidates(t, { month, week, cooldown, caseTypes, tag }){
  const last=lastByType(t.id), taken=new Set(), out=[], excluded=[];
  for(const k of K.values()) if(!k.archivedAt && k.typeId===t.id && sameSlot(k,month,week)) k.items.forEach(i=>taken.add(i.bid));
  // didn't collect last time: in the latest approved/paid list of this type, not marked received
  const prev=[...K.values()].filter(k=>counts(k)&&k.typeId===t.id&&!k.single&&!sameSlot(k,month,week)).sort((x,y)=>(y.month||"").localeCompare(x.month||"")||(y.week||0)-(x.week||0))[0];
  const missed=new Set(prev?prev.items.filter(i=>!i.received).map(i=>i.bid):[]);
  for(const b of people()){
    if(b.status!=="نشط") continue;
    if(caseTypes.length && !caseTypes.includes(b.caseType||"غير محدد")) continue;
    if(tag && !(b.tags||[]).includes(tag)) continue;
    const lm=last.get(b.id);
    if(taken.has(b.id)){ excluded.push({b,why:"موجودة في كشف تاني لنفس "+(week?"الأسبوع":"الشهر")}); continue; }
    if(lm&&cooldown>0&&(mIdx(month)-mIdx(lm))<=cooldown){ excluded.push({b,why:`أخدت ${t.name} في ${mLabel(lm)}`}); continue; }
    out.push({b,lm,missed:missed.has(b.id)});
  }
  return { pool:out, excluded, prev };
}
function whyLine(x, t, unit){
  const p=[x.missed?"ماجاتش تستلم المرة اللي فاتت":"", x.b.score!=null?`الدرجة ${x.b.score}%`:x.b.grade?`تقدير ${x.b.grade}`:"", x.fam?`${x.fam} أفراد`:"عدد الأفراد مش متسجل", x.lm?`آخر ${t.name}: ${mLabel(x.lm)}`:`ماخدتش ${t.name} قبل كده`];
  return p.filter(Boolean).join(" · ");
}
/* ---------- calls ----------
   Every tap on «ردّت / ماردتش / رقم غلط» is one row in `calls`. The latest one colours the row. */
const CALL_RES = { "رد":{cls:"ok",label:"ردّت ✓"}, "مردش":{cls:"no",label:"ماردتش"}, "رقم غلط":{cls:"bad",label:"رقم غلط"} };
const callIndex = memo(() => { const m=new Map(); for(const c of C.values()){ for(const key of [c.bid+"|"+(c.batchId||""), c.bid+"|*"]){ const p=m.get(key); if(!p||c.at>p.at) m.set(key,c); } } return m; });
// Inside a list: the latest call for that list. Elsewhere: the latest call in the last 3 days.
function lastCall(bid, batchId){ const c=callIndex().get(bid+"|"+(batchId||"*")); if(!c) return null; if(!batchId && c.at<addDays(today,-3)) return null; return c; }
let dialed=null;   // {bid, batchId}: the row whose dialer we just opened — it shows the three answer buttons
function callCell(bid, phone, batchId, big){
  const ph=cleanPhone(phone), c=lastCall(bid,batchId), open=dialed&&dialed.bid===bid&&(dialed.batchId||"")===(batchId||"");
  const chip=c?`<span class="cchip ${CALL_RES[c.result].cls}">${CALL_RES[c.result].label}<small>${c.at.slice(0,10)===today?"النهارده":dLabel(c.at)}</small></span>`:"";
  if(!validPhone(ph)) return `<span class="ccell">${chip}<span class="sub">مفيش رقم</span></span>`;
  const canLog=role!=="viewer";
  return `<span class="ccell ${big?"big":""}">${open&&canLog?`<span class="cres" role="group" aria-label="نتيجة المكالمة">${Object.entries(CALL_RES).map(([r,v])=>`<button class="cr ${v.cls}" data-cres="${r}" data-cb="${bid}" data-cbatch="${batchId||""}">${v.label}</button>`).join("")}</span>`
    :chip?`<button class="cchipb" data-copen="${bid}" data-cbatch="${batchId||""}" ${canLog?"":"disabled"}>${chip}</button>`:""}
    <a class="cdial" href="tel:${ph}" data-dial="${bid}" data-cbatch="${batchId||""}" aria-label="اتصل ${ph}">${ic("phone")}${big?"اتصل":""}</a></span>`;
}
const rowCallCls = (bid,batchId) => { const c=lastCall(bid,batchId); return c?"c-"+CALL_RES[c.result].cls:""; };
function bindCalls(root, redraw){
  root.querySelectorAll("[data-dial]").forEach(a=>a.addEventListener("click",()=>{ dialed={bid:a.dataset.dial,batchId:a.dataset.cbatch||null}; setTimeout(redraw,400); }));
  root.querySelectorAll("[data-copen]").forEach(b=>b.onclick=()=>{ dialed={bid:b.dataset.copen,batchId:b.dataset.cbatch||null}; redraw(); });
  root.querySelectorAll("[data-cres]").forEach(b=>b.onclick=async()=>{
    b.disabled=true; const bid=b.dataset.cb, batchId=b.dataset.cbatch||null;
    const { data, error } = await sb.from("calls").insert({beneficiary_id:bid, batch_id:batchId, result:b.dataset.cres, by:me.id}).select().single();
    if(error){ b.disabled=false; toast(errMsg(error)); return; }
    C.set(data.id, fromC(data)); upsertRaw("cs", data); dialed=null; changed(); redraw();
  });
}
// Coming back from the phone app: redraw so the answer buttons show on the row that was called.
document.addEventListener("visibilitychange",()=>{ if(!document.hidden&&dialed){ render(); refreshSheet(); } });

/* ---------- school certificates ---------- */
const SY = schoolYear(now);
const stageOf = k => normalizeStage(k.school) || k.school || "";
const certDue = k => inSchool(stageOf(k)) && String(k.cert||"")!==String(SY) && (age(k.birth)===""||age(k.birth)<26);
const certList = memo(() => people().filter(b=>b.status==="نشط").flatMap(b=>(b.children||[]).map((k,i)=>({b,k,i})).filter(x=>certDue(x.k))));

/* ---------- tasks ----------
   Manual to-dos live in `tasks`. The rest are worked out from the data every time, so they tick themselves off. */
const openTasks = memo(() => [...TK.values()].filter(t=>!t.archivedAt&&!t.doneAt).sort((a,b)=>(a.due||"9999").localeCompare(b.due||"9999")||(a.createdAt||"").localeCompare(b.createdAt||"")));
const missingData = memo(() => people().filter(b=>b.status==="نشط"&&(!famSize(b)||!b.caseType||!validPhone(b.phone))));
function autoTasks(){
  const out=[], active=people().filter(b=>b.status==="نشط");
  if(isMgr()) batches().filter(k=>k.status==="مسودة").forEach(k=>out.push({ic:"list",tone:"red",t:`اعتمد «${k.title}»`,s:`${num(k.items.length)} حالة مستنية الاعتماد`,go:"batch:"+k.id}));
  batches().filter(k=>k.status==="معتمد").forEach(k=>{ const left=k.items.filter(i=>!i.received); if(!left.length) return;
    const notCalled=left.filter(i=>i.bid&&!lastCall(i.bid,k.id)).length;
    out.push({ic:"phone",tone:"",t:`«${k.title}»: فاضل ${num(left.length)} ماستلموش`,s:notCalled?`${num(notCalled)} لسه ماحدش كلّمهم`:"كلهم اتكلموا",go:"batch:"+k.id}); });
  const certs=certList(); if(certs.length) out.push({ic:"calendar",tone:"",t:`شهادات القيد ${syLabel(SY)}`,s:`${num(certs.length)} طفل في ${num(new Set(certs.map(x=>x.b.id)).size)} أسرة لسه ماجابوش الشهادة`,go:"certs"});
  const due=people().filter(reviewDue); if(due.length) out.push({ic:"search",tone:"",t:"مراجعة / بحث ميداني",s:`${num(due.length)} حالة ميعادها جه`,go:"due"});
  const turning=active.filter(b=>kidsTurning18(b).length); if(turning.length) out.push({ic:"cake",tone:"",t:"أبناء هيكملوا 18 سنة",s:`${num(turning.length)} أسرة`,go:"turning"});
  const miss=missingData(); if(miss.length&&canWrite()) out.push({ic:"edit",tone:"",t:"كمّل بيانات الحالات",s:`${num(miss.length)} حالة ناقصها عدد الأفراد أو النوع أو التليفون`,go:"missing"});
  return out;
}
function notReceived(t,months){
  const since=mIdx(curMonth)-months+1; const got=new Set(receipts().filter(r=>r.typeId===t.id&&mIdx(r.month)>=since).map(r=>r.bid)); const last=lastByType(t.id);
  return people().filter(b=>eligible(t,b)&&!got.has(b.id)).map(b=>({b,lm:last.get(b.id)}));
}
async function nextCode(){ let m=0; for(const b of B.values()){ const n=parseInt(b.code,10); if(n>m) m=n; } return String(m+1).padStart(3,"0"); }

/* ================= auth ================= */
function showAuth(html){ $("#app").hidden = true; const a = $("#auth"); a.hidden = false; a.innerHTML = `<div class="wrap"><div class="auth"><img class="mark" src="${$("#logoImg").src}" alt="">${html}</div></div>`; }
async function loginScreen(){
  let hasManager = true;
  try{ const { data } = await sb.functions.invoke("manage-users", { body:{action:"status"} }); hasManager = data?.hasManager !== false; }catch(e){}
  if(!hasManager) return setupScreen();
  showAuth(`<h1>دار الإكرام</h1><p class="c">سجّل دخولك</p>
    <form id="l_f" novalidate>
    <label class="f">رقم التليفون أو اسم المستخدم<input type="text" id="l_u" name="username" inputmode="text" autocomplete="username" autocapitalize="none" autocorrect="off" spellcheck="false" enterkeyhint="next" dir="ltr"></label>
    <label class="f">الرقم السري<input type="password" id="l_p" name="password" class="pin" inputmode="numeric" autocomplete="current-password" enterkeyhint="go" dir="ltr"></label>
    <button type="submit" class="btn pri" id="l_go">دخول</button>
    </form>
    <p class="sub" style="text-align:center;margin-top:14px">نسيت الرقم السري؟ كلّم مدير الجمعية يعملّك رقم جديد.</p>`);
  $("#l_f").onsubmit = async e => {
    e.preventDefault();
    const btn = $("#l_go"); if(btn.disabled) return;
    const u = cleanUser($("#l_u").value), p = $("#l_p").value;
    if(!u || !p){ toast("اكتب رقم التليفون والرقم السري"); return; }
    btn.disabled = true; btn.innerHTML = `<span class="spin" aria-hidden="true"></span>`; btn.setAttribute("aria-busy","true");
    const { error } = await sb.auth.signInWithPassword({ email:`${u}@${DOMAIN}`, password:p });
    if(error){ btn.disabled = false; btn.removeAttribute("aria-busy"); btn.textContent = "دخول"; toast(/Invalid login/i.test(error.message) ? "الرقم أو الرقم السري غلط" : errMsg(error)); return; }
    boot();
  };
}
function setupScreen(){
  showAuth(`<h1>أهلاً بيك</h1><p class="c">أول مرة؟ اعمل حساب مدير الجمعية.<br>الحساب ده بس اللي هيقدر يضيف الموظفين.</p>
    <label class="f">اسمك<input type="text" id="s_n"></label>
    <label class="f">رقم تليفونك (هتدخل بيه)<input type="tel" id="s_u" inputmode="tel" autocomplete="username" dir="ltr"></label>
    <label class="f">رقم سري (8 أرقام أو أكتر)<input type="password" id="s_p" class="pin" inputmode="numeric" autocomplete="new-password" dir="ltr"></label>
    <button class="btn pri" id="s_go">إنشاء حساب المدير</button>`);
  $("#s_go").onclick = async () => {
    const n=$("#s_n").value.trim(), u=cleanUser($("#s_u").value), p=$("#s_p").value;
    if(!n||u.length<3||p.length<minPin("manager")){ toast("اكمل البيانات — رقم المدير السري 8 أرقام على الأقل"); return; }
    $("#s_go").innerHTML=`<span class="spin"></span>`;
    const { data, error } = await sb.functions.invoke("manage-users", { body:{action:"bootstrap", full_name:n, username:u, password:p} });
    if(error || data?.error){ $("#s_go").textContent="إنشاء حساب المدير"; toast(data?.error==="already_setup"?"فيه مدير متسجل خلاص — سجّل دخول":errMsg(error||data.error)); if(data?.error==="already_setup") loginScreen(); return; }
    const r = await sb.auth.signInWithPassword({ email:`${u}@${DOMAIN}`, password:p });
    if(r.error){ toast(errMsg(r.error)); return loginScreen(); }
    boot();
  };
}
async function boot(){
  const { data:{ session } } = await sb.auth.getSession();
  if(!session) return loginScreen();
  const { data:prof, error } = await sb.from("profiles").select("*").eq("id", session.user.id).single();
  me = prof;
  if(!me && isNetErr(error)){ const snap = await readSnapshot(); if(snap?.me?.id === session.user.id) me = snap.me; }   // offline: last known profile
  if(!me || !me.active || !["manager","worker","helper","viewer"].includes(me.role)){
    showAuth(`<h1>حسابك مش مفعّل</h1><p class="c">كلّم مدير الجمعية يفعّل حسابك.</p><button class="btn" id="lo">خروج</button>`);
    $("#lo").onclick = async () => { await sb.auth.signOut(); loginScreen(); };
    return;
  }
  role = realRole = me.role;
  $("#auth").hidden = true; $("#app").hidden = false;
  setWho(); render();
  await reload();
  subscribeRealtime(); flushQueue();
  startGo(new URLSearchParams(location.search).get("go"));
}
// App-icon shortcuts (manifest "shortcuts") open ?go=give|search|add.
function startGo(to){
  if(!to) return;
  try{ const u=new URL(location.href); u.searchParams.delete("go"); history.replaceState(null,"",u); }catch(e){}
  if(["give","search","add"].includes(to)){
    const ready=batches().filter(k=>k.status==="معتمد");
    if(simple()){ sv={screen:to==="search"?"find":to==="give"?(ready.length===1?"gb:"+ready[0].id:"give"):"home"}; render(); if(to==="search") setTimeout(()=>$("#s_q")?.focus(),50); }
    else if(to!=="add"||canWrite()) go(to);
    return;
  }
  if(DEMO) demoGo(to);
}

/* ---------- install as an app ---------- */
let installEvt=null;
const isStandalone=()=>matchMedia("(display-mode: standalone)").matches||navigator.standalone===true;
const isIOS=()=>/iPhone|iPad|iPod/i.test(navigator.userAgent);
addEventListener("beforeinstallprompt",e=>{ e.preventDefault(); installEvt=e; if(view==="settings") render(); });
addEventListener("appinstalled",()=>{ installEvt=null; toast("التطبيق اتثبت ✓ هتلاقيه على الشاشة الرئيسية"); if(view==="settings") render(); });
async function installApp(){ if(!installEvt) return; installEvt.prompt(); const r=await installEvt.userChoice.catch(()=>null); installEvt=null; if(r?.outcome!=="accepted") render(); }
function installBlock(){
  if(isStandalone()) return `<div class="note green">${ic("check")} <span>إنت فاتح التطبيق المتثبت.</span></div>`;
  if(installEvt) return `<div class="bar"><button class="btn pri" id="installApp">${ic("download")}ثبّت التطبيق على الجهاز ده</button></div>
    <p class="sub">هيظهر بأيقونة الجمعية على الشاشة الرئيسية ويفتح زي أي أبلكيشن، ويشتغل حتى لو النت فصل.</p>`;
  if(isIOS()) return `<div class="note">على iPhone: افتح الموقع من <b>Safari</b> ← زرار المشاركة (المربع اللي فيه سهم) ← <b>«إضافة إلى الشاشة الرئيسية»</b>.</div>`;
  return `<div class="note">افتح الموقع من Chrome ← القايمة (⋮) ← <b>«تثبيت التطبيق»</b> أو «إضافة إلى الشاشة الرئيسية».</div>`;
}
// Demo only: ?demo&go=people|batches|reports|settings|batch|person|edit opens that screen (for screenshots and walkthroughs).
function demoGo(to){
  if(!to) return;
  if(["home","people","batches","reports","settings"].includes(to)){ view=to; render(); return; }
  if(to==="batch"){ const k=batches().find(x=>x.status==="معتمد"); if(k) openBatch(k.id); }
  if(to==="person"||to==="edit"){ const b=people().find(x=>(x.children||[]).length>1)||people()[0]; if(b) (to==="edit"?editPerson(b.id):viewPerson(b.id)); }
  if(to==="give"&&simple()){ const k=batches().find(x=>x.status==="معتمد"); if(k){ sv={screen:"gb:"+k.id}; render(); } }
}
function setWho(){
  $("#who").innerHTML = `<b style="background:${navigator.onLine?"#2E9E6B":"var(--red)"}"></b>${esc((me?.full_name||"").split(" ")[0])}<br>${ROLE_AR[role]}${realRole!==role?" (معاينة)":""}`;
  document.querySelectorAll("[data-mgr]").forEach(b => b.hidden = !isMgr());
}
function netBanner(){
  const q = readQ().length, off = !navigator.onLine;
  $("#net").innerHTML = (DEMO ? `<div class="offline demo">${ic("info")} وضع تجريبي — بيانات وهمية، مفيش أي حاجة بتتحفظ على السيرفر</div>` : "")
    + (off || fromSnapshot ? `<div class="offline" role="status">${ic("offline")} <span>مفيش إنترنت${fromSnapshot?` — بتشوف آخر نسخة محفوظة (${dLabel(fromSnapshot)})`:""}. التسليم بيتسجل ويترفع لوحده، وباقي التعديلات لما النت يرجع${q?` · <b>${num(q)}</b> تسليم مستني`:""}</span></div>`
    : q ? `<div class="offline sync" role="status">${ic("refresh")} <span>${num(q)} تسليم مستني يترفع…</span></div>` : "");
  if(me) setWho();
}
window.addEventListener("online", () => { netBanner(); if(me){ reload().then(flushQueue); } });
window.addEventListener("offline", netBanner);

/* ================= render ================= */
function render(){
  if(!me) return;
  document.body.classList.toggle("simple", simple());
  document.body.classList.toggle("wide", innerWidth>=900);
  document.querySelectorAll("#tabs button").forEach(b=>b.classList.toggle("act",b.dataset.v===view));
  const v=$("#view");
  if(!loaded){ v.innerHTML=loadError?`<div class="state">${ic("offline","big")}<h2>مقدرناش نحمّل البيانات</h2><p class="sub">${esc(errMsg(loadError))}</p><button class="btn pri" id="retry">${ic("refresh")}جرّب تاني</button></div>`:`<div class="empty" role="status"><span class="spin" aria-hidden="true"></span> جاري تحميل البيانات…</div>`; const r=$("#retry"); if(r) r.onclick=()=>{ loadError=null; render(); reload(); }; return; }
  if(simple()){ v.innerHTML=vSimple(); bindSimple(); return; }
  v.innerHTML = view==="home"?vDash(): view==="people"?vPeople(): view==="batches"?vBatches(): view==="reports"?vReports(): vSettings();
  bindView();
}
function batchRow(k){
  const total=k.items.reduce((s,i)=>s+(+i.value||0),0); const rec=k.items.filter(i=>i.received).length;
  return `<button class="item" data-batch="${k.id}"><span class="grow"><span class="nm">${esc(k.title||k.typeName)}</span><br>
    <span class="sub">${mLabel(k.month)}${k.week?` · أسبوع ${k.week}`:""} · ${num(k.items.length)} حالة · ${num(total)} ${esc(k.unit)}${counts(k)?` · استلم ${rec} من ${k.items.length}`:""}</span></span>${statusChip(k.status)}</button>`;
}
const statusChip = s => `<span class="chip ${s==="مسودة"?"grey":s==="معتمد"?"blue":"gold"}">${esc(s)}</span>`;
function filteredPeople(){
  const q=norm(peopleQ);
  const miss=new Set(missingData().map(b=>b.id));
  let list=people().filter(b=>peopleF==="all"?true: peopleF==="due"?reviewDue(b): peopleF==="missing"?miss.has(b.id): peopleF.startsWith("tag:")?(b.tags||[]).includes(peopleF.slice(4)): STATUSES.includes(peopleF)?b.status===peopleF:(b.caseType||"غير محدد")===peopleF);
  if(q) list=list.filter(b=>norm(b.name).includes(q)||(b.nationalId||"").includes(q)||(q.replace(/^0/,"").length>3&&cleanPhone(b.phone).includes(q.replace(/^0/,"")))||String(b.code)===q.padStart(3,"0")||String(b.code)===q);
  const S=PEOPLE_SORT[peopleSort]; if(S&&S.fn) list=[...list].sort((a,b)=>S.fn(a,b)||String(a.code).localeCompare(String(b.code),"en",{numeric:true}));
  return list;
}
const allTags = memo(() => [...new Set(people().flatMap(b=>b.tags||[]))].sort());
/* The cases list is ordered by what the dropdown says — nothing hidden. */
const PEOPLE_SORT = {
  code:{label:"رقم الحالة"},
  name:{label:"الاسم (أ ← ي)", fn:(a,b)=>norm(a.name).localeCompare(norm(b.name),"ar")},
  score:{label:"الدرجة (الأعلى الأول)", fn:(a,b)=>(b.score??-1)-(a.score??-1)||gradeRank(a.grade)-gradeRank(b.grade)},
  family:{label:"عدد الأفراد (الأكبر الأول)", fn:(a,b)=>famSize(b)-famSize(a)},
  last:{label:"آخر استلام (الأقدم الأول)", fn:(a,b)=>{ const m=lastAnyMap(); return (m.get(a.id)||"").localeCompare(m.get(b.id)||""); }},
};
function vPeople(){
  const all=people(); const list=filteredPeople();
  return `
  <div class="row" style="margin-bottom:10px">
    <input type="search" id="pq" placeholder="اكتب الاسم أو الرقم القومي أو التليفون" value="${esc(peopleQ)}" style="flex:1 1 220px">
    <select id="pf" style="width:auto;flex:0 0 auto" aria-label="تصفية">
      <option value="all">الكل (${num(all.length)})</option>
      <option value="due" ${peopleF==="due"?"selected":""}>محتاجة مراجعة</option>
      <option value="missing" ${peopleF==="missing"?"selected":""}>ناقصها بيانات</option>
      <optgroup label="الحالة">${STATUSES.map(s=>`<option ${peopleF===s?"selected":""}>${s}</option>`).join("")}</optgroup>
      <optgroup label="النوع">${CASE_TYPES.map(s=>`<option ${peopleF===s?"selected":""}>${s}</option>`).join("")}</optgroup>
      ${allTags().length?`<optgroup label="قايمة المتبرع">${allTags().map(t=>`<option value="tag:${esc(t)}" ${peopleF==="tag:"+t?"selected":""}>${esc(t)}</option>`).join("")}</optgroup>`:""}
    </select>
    <label class="sortl">مترتبة حسب <select id="ps" aria-label="الترتيب">${Object.entries(PEOPLE_SORT).map(([k,v])=>`<option value="${k}" ${peopleSort===k?"selected":""}>${v.label}</option>`).join("")}</select></label>
  </div>
  <div class="row" style="margin-bottom:8px"><span class="sub grow">${num(list.length)} حالة</span>
    <button class="btn sm" id="pPhones">${ic("phone")}أرقام القائمة دي</button>
    ${isMgr()?`<button class="btn sm" id="pX">تنزيل Excel</button>`:""}
    ${canWrite()?`<button class="btn sm pri" id="addP">${ic("plus")}حالة جديدة</button>`:""}
  </div>
  ${innerWidth>=900&&list.length?`<div class="tbl dt"><table><thead><tr><th>رقم</th><th>الاسم</th><th>الرقم القومي</th><th>التليفون</th><th>النوع</th><th>الحالة</th><th>أفراد</th><th>الدرجة</th><th>آخر مراجعة</th><th>آخر استلام</th></tr></thead><tbody>
    ${(()=>{ const lastAny=lastAnyMap(); return list.slice(0,peopleLimit).map(b=>`<tr data-open="${b.id}" tabindex="0"><td class="n">${esc(b.code)}</td><td><b>${esc(b.name)}</b></td><td class="n">${esc(b.nationalId)}</td><td class="n">${esc(cleanPhone(b.phone))}</td><td>${esc(b.caseType||"—")}</td><td><span class="chip ${b.status==="نشط"?"":b.status==="ملغي"?"red":"gold"}">${esc(b.status)}</span></td><td class="n">${famSize(b)||"—"}</td><td class="n">${b.score!=null?b.score+"%":b.grade||"—"}</td><td class="n">${reviewDue(b)?`<span class="chip red">${b.lastReview?dLabel(b.lastReview):"مفيش"}</span>`:dLabel(b.lastReview)}</td><td class="n">${lastAny.get(b.id)?mLabel(lastAny.get(b.id)):"—"}</td></tr>`).join(""); })()}
  </tbody></table></div>`:""}
  <div class="list" ${innerWidth>=900&&list.length?"hidden":""}>${list.length?list.slice(0,peopleLimit).map(b=>`
    <button class="item" data-open="${b.id}">
      <span class="code">${esc(b.code)}</span>
      <span class="grow"><span class="nm">${esc(b.name)}</span><br><span class="sub">${esc(b.nationalId||"بدون رقم قومي")}${famSize(b)?` · ${famSize(b)} أفراد`:""}${peopleSort==="score"&&b.score!=null?` · الدرجة ${b.score}%`:""}${peopleSort==="last"?` · آخر استلام ${lastAnyMap().get(b.id)?mLabel(lastAnyMap().get(b.id)):"—"}`:""}</span></span>
      ${reviewDue(b)?`<span class="chip red">مراجعة</span>`:""}
      ${b.caseType?`<span class="chip">${esc(b.caseType)}</span>`:""}
      ${b.status!=="نشط"?`<span class="chip ${b.status==="ملغي"?"red":"gold"}">${esc(b.status)}</span>`:""}
    </button>`).join(""):`<div class="empty">${all.length?"مفيش نتيجة — جرّب جزء من الاسم بس":"لا توجد حالات بعد"}</div>`}
  </div>
  ${list.length>peopleLimit?`<div class="more"><button class="btn" id="pMore">عرض ${num(Math.min(PAGE,list.length-peopleLimit))} كمان <span class="sub">(معروض ${num(peopleLimit)} من ${num(list.length)})</span></button></div>`:""}`;
}
function vBatches(){
  const list=batches();
  return `
  <div class="row" style="justify-content:space-between;margin-bottom:12px"><h2 style="margin:0">كشوف الصرف</h2>${isMgr()?`<button class="btn pri" id="newK">${ic("list")}كشف جديد</button>`:""}</div>
  <div class="list">${list.length?list.map(batchRow).join(""):`<div class="empty">${isMgr()?"لا توجد كشوف بعد. اضغط «كشف جديد».":"مفيش كشوف معتمدة لسه"}</div>`}</div>
  ${isMgr()?(()=>{ const n=[...K.values()].filter(k=>k.archivedAt).length; return `<div class="bar"><button class="btn sm" data-go="archive">${ic("archive")}الكشوف المؤرشفة (${num(n)})</button></div>`; })():""}`;
}
let rep={typeId:"",months:3,month:curMonth};
function vReports(){
  const ts=types(); if(!rep.typeId&&ts[0]) rep.typeId=ts[0].id; const t=T.get(rep.typeId);
  const rs=receipts(); const notList=t?notReceived(t,rep.months):[];
  const byType={}; rs.filter(r=>r.month===rep.month).forEach(r=>{const k=byType[r.typeName]||(byType[r.typeName]={n:0,total:0,unit:r.unit}); k.n++; k.total+=(+r.value||0);});
  const yr=curMonth.slice(0,4); const yT={};
  rs.filter(r=>r.month.startsWith(yr)).forEach(r=>{const k=yT[r.typeName]||(yT[r.typeName]={n:0,total:0,unit:r.unit,p:new Set()}); k.n++; k.total+=(+r.value||0); k.p.add(r.bid);});
  const st={}; people().forEach(b=>st[b.status]=(st[b.status]||0)+1);
  const due=people().filter(reviewDue);
  const turning=people().filter(b=>b.status==="نشط"&&kidsTurning18(b).length);
  return `
  <h2>التقارير</h2>
  <div class="facts">${STATUSES.map(s=>`<div><span>${s}</span><strong>${num(st[s]||0)}</strong></div>`).join("")}</div>
  <h3>مين ماخدش؟</h3>
  <div class="row" style="margin-bottom:10px">
    <select id="rT" style="flex:1 1 160px" aria-label="نوع المساعدة">${ts.map(x=>`<option value="${x.id}" ${x.id===rep.typeId?"selected":""}>${esc(x.name)}</option>`).join("")}</select>
    <select id="rN" style="flex:0 0 150px" aria-label="المدة">${[1,2,3,6,12].map(n=>`<option value="${n}" ${n===rep.months?"selected":""}>آخر ${n} شهر</option>`).join("")}</select>
  </div>
  <div class="row" style="margin-bottom:6px"><span class="sub grow">${num(notList.length)} حالة مؤهلة لم تستلم ${t?esc(t.name):""} خلال آخر ${rep.months} شهر</span>
    <button class="btn sm" id="rP" ${notList.length?"":"disabled"}>${ic("phone")}أرقامهم</button><button class="btn sm" id="rX" ${notList.length?"":"disabled"}>Excel</button></div>
  <div class="tbl" style="max-height:320px;overflow-y:auto"><table><thead><tr><th>رقم</th><th>الاسم</th><th>النوع</th><th>آخر استلام</th></tr></thead><tbody>
  ${notList.map(({b,lm})=>`<tr><td class="n">${esc(b.code)}</td><td><a href="#" data-open="${b.id}">${esc(b.name)}</a></td><td>${esc(b.caseType||"—")}</td><td class="n">${lm?mLabel(lm):"لم يستلم"}</td></tr>`).join("")||`<tr><td colspan="4" class="empty">لا يوجد</td></tr>`}
  </tbody></table></div>
  <h3>محتاجة مراجعة / بحث ميداني (${num(due.length)})</h3>
  <p class="sub" style="margin-top:0">حالة معادها جه، أو ماتراجعتش من أكتر من سنة، أو ماتسجلش لها تاريخ مراجعة.</p>
  <div class="row" style="margin-bottom:6px"><span class="grow"></span><button class="btn sm" id="dueP" ${due.length?"":"disabled"}>${ic("phone")}أرقامهم</button></div>
  <div class="tbl" style="max-height:280px;overflow-y:auto"><table><thead><tr><th>رقم</th><th>الاسم</th><th>آخر مراجعة</th><th>المراجعة القادمة</th></tr></thead><tbody>
  ${due.map(b=>`<tr><td class="n">${esc(b.code)}</td><td><a href="#" data-open="${b.id}">${esc(b.name)}</a></td><td class="n">${dLabel(b.lastReview)}</td><td class="n">${dLabel(b.nextReview)}</td></tr>`).join("")||`<tr><td colspan="4" class="empty">لا يوجد</td></tr>`}
  </tbody></table></div>
  <h3>أبناء هيكملوا 18 خلال سنة (${num(turning.length)})</h3>
  <div class="tbl"><table><thead><tr><th>الأسرة</th><th>الابن</th><th>تاريخ الميلاد</th></tr></thead><tbody>
  ${turning.flatMap(b=>kidsTurning18(b).map(k=>`<tr><td><a href="#" data-open="${b.id}">${esc(b.name)}</a></td><td>${esc(k.name)}</td><td class="n">${dLabel(k.birth)}</td></tr>`)).join("")||`<tr><td colspan="3" class="empty">لا يوجد</td></tr>`}
  </tbody></table></div>
  <h3>صرف شهر معيّن</h3>
  <div class="row" style="margin-bottom:10px"><input type="month" id="rM" value="${rep.month}" style="flex:0 0 200px" aria-label="الشهر"></div>
  <div class="tbl"><table><thead><tr><th>النوع</th><th>عدد الحالات</th><th>الإجمالي</th></tr></thead><tbody>
  ${Object.entries(byType).map(([n,v])=>`<tr><td>${esc(n)}</td><td class="n">${num(v.n)}</td><td class="n">${num(v.total)} ${esc(v.unit)}</td></tr>`).join("")||`<tr><td colspan="3" class="empty">لا يوجد صرف معتمد في ${mLabel(rep.month)}</td></tr>`}
  </tbody></table></div>
  <h3>إجمالي سنة ${yr}</h3>
  <div class="tbl"><table><thead><tr><th>النوع</th><th>مرات الصرف</th><th>حالات مختلفة</th><th>الإجمالي</th></tr></thead><tbody>
  ${Object.entries(yT).map(([n,v])=>`<tr><td>${esc(n)}</td><td class="n">${num(v.n)}</td><td class="n">${num(v.p.size)}</td><td class="n">${num(v.total)} ${esc(v.unit)}</td></tr>`).join("")||`<tr><td colspan="4" class="empty">لا يوجد صرف معتمد هذه السنة بعد</td></tr>`}
  </tbody></table></div>`;
}
function vSettings(){
  const users=[...P.values()].sort((a,b)=>(a.role==="pending"?-1:0)-(b.role==="pending"?-1:0));
  return `
  <h2>الإعدادات</h2>
  ${isMgr()?`
  <h3>المستخدمين</h3>
  <p class="sub" style="margin-top:0">كل موظف بيدخل برقم تليفونه ورقم سري. إنت اللي بتعمله الحساب من هنا.</p>
  <div class="list">${users.map(u=>`<button class="item" data-user="${u.id}"><span class="grow"><span class="nm">${esc(u.full_name||"بدون اسم")}${u.id===me.id?" (إنت)":""}</span><br><span class="sub" dir="ltr">${esc(u.username||"")}</span></span>
    <span class="chip ${u.role==="manager"?"plum":u.role==="pending"?"red":u.role==="viewer"?"grey":u.role==="helper"?"blue":""}">${ROLE_AR[u.role]}</span>${!u.active?`<span class="chip red">موقوف</span>`:""}</button>`).join("")}</div>
  <div class="bar"><button class="btn pri" id="newU">${ic("plus")}إضافة موظف</button></div>
  <div class="note green">${["manager","worker","helper","viewer"].map(r=>`• <b>${ROLE_AR[r]}</b>: ${ROLE_DESC[r]}`).join("<br>")}<br>الصلاحيات دي مقفولة من قاعدة البيانات نفسها.</div>
  <div class="bar"><button class="btn" data-preview="worker">${ic("eye")}شوف شاشة الموظف</button><button class="btn" data-preview="helper">${ic("eye")}شوف شاشة العامل</button></div>
  <h3>أنواع المساعدات</h3>
  <div class="list">${types().map(t=>`
    <button class="item" data-type="${t.id}"><span class="grow"><span class="nm">${esc(t.name)}</span><br>
      <span class="sub">${num(t.amount)} ${esc(t.unit)} للحالة · ${t.cooldown>0?`لا يتكرر خلال ${t.cooldown} شهر`:"بدون قيد تكرار"} · ${t.caseTypes?.length?esc(t.caseTypes.join("، ")):"كل الحالات النشطة"}</span></span>
      <span class="chip ${t.template==="cash"?"":"blue"}">${t.template==="cash"?"نقدي":"عيني"}</span></button>`).join("")}
  </div>
  <div class="bar"><button class="btn pri" id="newT">${ic("plus")}نوع مساعدة جديد</button></div>
  <h3>نسخة احتياطية</h3>
  <p class="sub" style="margin-top:0">نزّل كل الحالات وكل الصرف في ملف Excel واحد.</p>
  <div class="bar"><button class="btn" id="backup">${ic("download")}تنزيل نسخة احتياطية</button></div>`:(realRole==="manager"?`<div class="bar"><button class="btn" data-preview="manager">${ic("undo")}رجوع لشاشة المدير</button></div>`:"")}
  ${isMgr()?(()=>{ const arch=archivedPeople(), ak=[...K.values()].filter(k=>k.archivedAt).sort((a,b)=>b.archivedAt.localeCompare(a.archivedAt)), at=[...T.values()].filter(t=>t.archivedAt);
  const row=(title,sub,attr)=>`<div class="item"><span class="grow"><span class="nm">${esc(title)}</span><br><span class="sub">${esc(sub)}</span></span><button class="btn sm" ${attr}>${ic("restore")}رجّعه</button></div>`;
  return `<h3 id="archive">الأرشيف</h3>
  <p class="sub" style="margin-top:0">أي حاجة بتتأرشف بتيجي هنا: مش بتظهر في القوايم، بس كلها محفوظة وترجع بضغطة.</p>
  <h4>الحالات (${num(arch.length)})</h4>
  ${arch.length?`<div class="list">${arch.map(b=>`<div class="item"><span class="code">${esc(b.code)}</span><span class="grow"><span class="nm">${esc(b.name)}</span><br><span class="sub">اتأرشفت ${dLabel(b.archivedAt)}</span></span><button class="btn sm" data-restore="${b.id}">${ic("restore")}رجّعها</button></div>`).join("")}</div>`:`<div class="empty">مفيش</div>`}
  <h4>الكشوف (${num(ak.length)})</h4>
  ${ak.length?`<div class="list">${ak.map(k=>row(k.title,`${k.status} · ${num(k.items.length)} أسرة · اتأرشف ${dLabel(k.archivedAt)}`,`data-restorek="${k.id}"`)).join("")}</div>`:`<div class="empty">مفيش</div>`}
  <h4>أنواع المساعدات (${num(at.length)})</h4>
  ${at.length?`<div class="list">${at.map(t=>row(t.name,`اتأرشف ${dLabel(t.archivedAt)}`,`data-restoret="${t.id}"`)).join("")}</div>`:`<div class="empty">مفيش</div>`}`; })():""}
  <h3>التطبيق</h3>
  ${installBlock()}
  <h3>العرض</h3>
  <div class="bar"><button class="btn" id="bigText">${document.body.classList.contains("big")?"خط عادي":ic("text")+" تكبير الخط"}</button></div>
  <h3>الحساب</h3>
  <div class="bar"><button class="btn" id="myPin">${ic("key")}تغيير الرقم السري</button><button class="btn danger" id="logout">خروج</button></div>
  <p class="sub ver">الإصدار ${VERSION}</p>`;
}
function bindView(){
  const v=$("#view");
  v.querySelectorAll("[data-open]").forEach(el=>el.onclick=e=>{e.preventDefault(); viewPerson(el.dataset.open);});
  v.querySelectorAll("tr[data-open]").forEach(el=>el.onkeydown=e=>{ if(e.key==="Enter") viewPerson(el.dataset.open); });
  v.querySelectorAll("[data-batch]").forEach(el=>el.onclick=()=>openBatch(el.dataset.batch));
  v.querySelectorAll("[data-type]").forEach(el=>el.onclick=()=>openType(el.dataset.type));
  v.querySelectorAll("[data-user]").forEach(el=>el.onclick=()=>openUser(el.dataset.user));
  v.querySelectorAll("[data-go]").forEach(el=>el.onclick=()=>go(el.dataset.go));
  v.querySelectorAll("[data-task]").forEach(el=>el.onclick=()=>taskSheet(el.dataset.task));
  v.querySelectorAll("[data-done]").forEach(el=>el.onclick=()=>doneTask(el.dataset.done,el));
  const on=(id,ev,fn)=>{const el=$(id); if(el) el[ev]=fn;};
  on("#pq","oninput",e=>{ peopleQ=e.target.value; clearTimeout(searchTimer); searchTimer=setTimeout(()=>{ peopleLimit=PAGE; const pos=$("#pq")?.selectionStart; render(); const n=$("#pq"); if(n){ n.focus(); n.setSelectionRange(pos,pos); } },180); });
  on("#pf","onchange",e=>{peopleF=e.target.value; peopleLimit=PAGE; render();});
  on("#ps","onchange",e=>{peopleSort=e.target.value; peopleLimit=PAGE; render();});
  on("#pMore","onclick",()=>{ peopleLimit+=PAGE; render(); });
  on("#addP","onclick",()=>editPerson(null));
  on("#pPhones","onclick",()=>phoneSheet("الحالات المعروضة", filteredPeople().map(b=>({bid:b.id,name:b.name,phone:b.phone,code:b.code}))));
  on("#pX","onclick",()=>xlsx({"الحالات":peopleRows(filteredPeople())},"الحالات.xlsx"));
  on("#newK","onclick",()=>newBatch());
  on("#newT","onclick",()=>openType(null));
  on("#newU","onclick",()=>newUser());
  on("#rT","onchange",e=>{rep.typeId=e.target.value; render();});
  on("#rN","onchange",e=>{rep.months=+e.target.value; render();});
  on("#rM","onchange",e=>{ if(e.target.value){rep.month=e.target.value; render();} });
  on("#rP","onclick",()=>{const t=T.get(rep.typeId); phoneSheet(`لم يستلموا ${t.name} — آخر ${rep.months} شهر`, notReceived(t,rep.months).map(({b})=>({bid:b.id,name:b.name,phone:b.phone,code:b.code})));});
  on("#rX","onclick",()=>{const t=T.get(rep.typeId); const rows=[["م","رقم الحالة","الاسم","الرقم القومي","التليفون","النوع","آخر استلام"]]; notReceived(t,rep.months).forEach(({b,lm},i)=>rows.push([i+1,b.code,b.name,b.nationalId||"",cleanPhone(b.phone),b.caseType||"",lm?mLabel(lm):"لم يستلم"])); xlsx({"كشف":rows},`لم يستلموا ${t.name} - آخر ${rep.months} شهر.xlsx`);});
  on("#dueP","onclick",()=>phoneSheet("حالات محتاجة مراجعة", people().filter(reviewDue).map(b=>({bid:b.id,name:b.name,phone:b.phone,code:b.code}))));
  v.querySelectorAll("[data-preview]").forEach(el=>el.onclick=()=>setPreview(el.dataset.preview));
  on("#bigText","onclick",()=>{ document.body.classList.toggle("big"); try{localStorage.setItem("big",document.body.classList.contains("big")?"1":"");}catch(e){} render(); });
  on("#backup","onclick",backup);
  on("#qaSearch","onclick",()=>go("search"));
  on("#logout","onclick",logout);
  on("#myPin","onclick",changeMyPin);
  on("#installApp","onclick",installApp);
  v.querySelectorAll("[data-restorek]").forEach(el=>el.onclick=async()=>{ const id=el.dataset.restorek; el.disabled=true;
    if(await run(sb.from("batches").update({archived_at:null,archived_by:null}).eq("id",id),"الكشف رجع ✓")){ await logIt("batch",id,"إرجاع من الأرشيف"); refreshBatch(id); } else el.disabled=false; });
  v.querySelectorAll("[data-restoret]").forEach(el=>el.onclick=async()=>{ el.disabled=true;
    if(await run(sb.from("aid_types").update({archived_at:null}).eq("id",el.dataset.restoret),"رجع ✓")) refreshTable("aid_types"); else el.disabled=false; });
  v.querySelectorAll("[data-restore]").forEach(el=>el.onclick=async()=>{ const id=el.dataset.restore; el.disabled=true;
    if(await run(sb.from("beneficiaries").update({archived_at:null,archived_by:null}).eq("id",id),"رجعت ✓")){ await logIt("beneficiary",id,"إرجاع من الأرشيف"); refreshPerson(id); } else el.disabled=false; });
}
let searchTimer=null;
function go(what){
  if(what==="search"){ view="people"; render(); setTimeout(()=>$("#pq")?.focus(),50); }
  else if(what==="add") editPerson(null);
  else if(what==="newbatch") newBatch();
  else if(what==="batches"){ view="batches"; render(); }
  else if(what==="users"){ view="settings"; render(); }
  else if(what==="due"){ view="people"; peopleF="due"; render(); }
  else if(what==="missing"){ view="people"; peopleF="missing"; render(); }
  else if(what==="certs") certsSheet();
  else if(what==="archive"){ view="settings"; render(); setTimeout(()=>$("#archive")?.scrollIntoView(),60); }
  else if(what==="newtask") taskSheet(null);
  else if(what.startsWith("batch:")) openBatch(what.slice(6));
  else if(what==="people-active"){ view="people"; peopleF="نشط"; render(); }
  else if(what==="turning"){ view="reports"; render(); }
  else if(what==="give"||what==="print"){
    const list=batches().filter(k=>k.status==="معتمد"||(what==="print"&&k.status==="مصروف"));
    if(what==="give"&&list.length===1){ openBatch(list[0].id,true); return; }   // one open list on distribution day: skip the chooser
    sheet(what==="give"?"اختار الكشف اللي بتسلّمه":"اختار الكشف اللي هتطبعه", list.length?`<div class="list">${list.map(batchRow).join("")}</div>`:`<div class="empty">مفيش كشوف معتمدة لسه. المدير لازم يعتمد الكشف الأول.</div>`, s=>{
      s.querySelectorAll("[data-batch]").forEach(el=>el.onclick=()=>openBatch(el.dataset.batch, what==="give"));
    });
  }
  else if(what==="phones") phoneChooser();
}

async function logout(){
  const q=readQ().length;
  if(q&&!await ask(`فيه ${num(q)} تسليم لسه ماترفعوش لأن النت كان فاصل.
لو خرجت دلوقتي هيضيعوا. استنى لما النت يرجع الأول.`,{title:"استنى شوية",ok:"اخرج برضو",cancel:"استنى",danger:true})) return;
  if(!q&&!await ask("تخرج من الحساب؟",{ok:"خروج"})) return;
  await sb.auth.signOut(); await clearSnapshot(); writeQ([]); clearAllDrafts(); me=null; loaded=false; snapRaw=null; if(rt){ sb.removeChannel(rt); rt=null; } loginScreen();
}

/* ================= preview (manager sees other roles' screens) ================= */
function setPreview(r){
  role = r; closeSheet(); view = "home"; sv = {screen:"home"}; setWho(); render(); window.scrollTo(0,0);
  if(r!==realRole) toast(`دي الشاشة اللي ${ROLE_AR[r]==="عامل"?"العامل":"الموظف"} بيشوفها`); else toast("رجعت لشاشتك");
}

/* ================= full dashboard (manager / staff) ================= */
function vDash(){
  const all=people(); const active=all.filter(b=>b.status==="نشط");
  const approved=batches().filter(k=>k.status==="معتمد");
  const drafts=batches().filter(k=>k.status==="مسودة");
  const due=all.filter(reviewDue);
  const turning=active.filter(b=>kidsTurning18(b).length);
  const pending=[...P.values()].filter(p=>p.role==="pending"&&p.active);
  const rs=receipts().filter(r=>r.month===curMonth);
  const cashMonth=rs.filter(r=>r.unit==="جنيه").reduce((s,r)=>s+(+r.value||0),0);
  const famMonth=new Set(rs.map(r=>r.bid)).size;
  const waiting=all.filter(b=>b.status==="انتظار").length;
  const pct=(a,b)=>b?Math.round(a/b*100):0;
  return `
  <div class="dash-head"><div><h2 style="margin:0">أهلاً ${esc((me.full_name||"").split(" ")[0])}</h2><p class="sub" style="margin:2px 0 0">${dLabel(today)} · ${ROLE_AR[role]}</p></div>
    <div class="qa">
      <button class="btn" id="qaSearch">${ic("search")}بحث</button>
      ${canWrite()?`<button class="btn" data-go="add">${ic("plus")}حالة جديدة</button>`:""}
      ${isMgr()?`<button class="btn pri" data-go="newbatch">${ic("list")}كشف صرف جديد</button>`:""}
      <button class="btn" data-go="phones">${ic("phone")}قائمة أرقام</button>
    </div></div>
  <div class="kpis">
    <button class="kpi" data-go="people-active"><span>حالات نشطة</span><strong>${num(active.length)}</strong><small>من ${num(all.length)} · ${num(waiting)} انتظار</small></button>
    <button class="kpi ${due.length?"warn":""}" data-go="due"><span>محتاجة مراجعة</span><strong>${num(due.length)}</strong><small>ميعادها جه أو من غير تاريخ</small></button>
    <div class="kpi"><span>صرف ${MONTHS[now.getMonth()]}</span><strong>${num(cashMonth)} <em>ج</em></strong><small>${num(famMonth)} أسرة استفادت</small></div>
    ${isMgr()?`<button class="kpi ${drafts.length?"warn":""}" data-go="batches"><span>مسودات مستنية اعتماد</span><strong>${num(drafts.length)}</strong><small>${num(approved.length)} كشف معتمد شغال</small></button>`:`<div class="kpi"><span>كشوف شغالة</span><strong>${num(approved.length)}</strong><small>معتمدة ولسه بتتسلّم</small></div>`}
  </div>
  ${pending.length&&isMgr()?`<button class="alert" data-go="users"><span>${ic("user")}</span><span class="grow">${num(pending.length)} حساب مستني تفعيل</span><span>‹</span></button>`:""}
  <div class="dash-grid">
    <section>
      <div class="row" style="justify-content:space-between;margin:20px 0 8px"><h3 style="margin:0">المطلوب النهارده</h3>${canWrite()?`<button class="btn sm" data-go="newtask">${ic("plus")}مهمة</button>`:""}</div>
      ${tasksBoard()}
    </section>
    <section>
      <h3>كشوف شغالة</h3>
      <div class="list">${approved.length?approved.map(k=>{ const rec=k.items.filter(i=>i.received).length; return `
        <button class="item" data-batch="${k.id}"><span class="grow"><span class="nm">${esc(k.title)}</span>
          <span class="prog" aria-label="نسبة التسليم"><i style="width:${pct(rec,k.items.length)}%"></i></span>
          <span class="sub">استلم ${num(rec)} من ${num(k.items.length)} · ${pct(rec,k.items.length)}%</span></span>${statusChip(k.status)}</button>`;}).join(""):`<div class="empty">مفيش كشوف معتمدة حالياً</div>`}</div>
    </section>
  </div>`;
}
function tasksBoard(){
  const mine=openTasks(), auto=autoTasks();
  const tRow=t=>{ const late=t.due&&t.due<today, b=t.bid?B.get(t.bid):null;
    return `<div class="task ${late?"late":""}"><button class="tick" data-done="${t.id}" aria-label="خلصت: ${esc(t.title)}" ${canWrite()||t.assignee===me.id?"":"disabled"}></button>
      <button class="grow tbody" data-task="${t.id}"><span class="nm">${esc(t.title)}</span><br><span class="sub">${[t.due?(late?"متأخرة — ":"")+dLabel(t.due):"",b?b.name:"",t.assignee?"لـ "+who(t.assignee):""].filter(Boolean).map(esc).join(" · ")}</span></button></div>`; };
  const aRow=x=>`<button class="task auto" data-go="${x.go}"><span class="aic ${x.tone}">${ic(x.ic)}</span><span class="grow"><span class="nm">${esc(x.t)}</span><br><span class="sub">${esc(x.s)}</span></span><span aria-hidden="true">‹</span></button>`;
  if(!mine.length&&!auto.length) return `<div class="list"><div class="empty">${ic("smile")} مفيش حاجة مستنياك النهارده</div></div>`;
  return `<div class="list tasks">${mine.map(tRow).join("")}${auto.map(aRow).join("")}</div>`;
}

/* ================= simple UI (helpers / non-literate staff) ================= */
let sv={screen:"home"}, sq="";
function vSimple(){
  const back=`<button class="s-back" data-s="home">→ رجوع</button>`;
  const ready=batches().filter(k=>k.status==="معتمد");
  const bCard=(k,to)=>{ const rec=k.items.filter(i=>i.received).length; return `<button class="s-card" data-s="${to}:${k.id}"><span class="s-ic">${ic(k.template==="cash"?"cash":"box")}</span><span class="grow"><b>${esc(k.typeName)}</b><small>${mLabel(k.month)}</small>
    <span class="prog big"><i style="width:${k.items.length?Math.round(rec/k.items.length*100):0}%"></i></span><small>استلم ${num(rec)} من ${num(k.items.length)}</small></span></button>`; };
  const noBatches=`<div class="s-empty">${ic("smile")}<br>مفيش حاجة تتسلّم دلوقتي</div>`;
  const [scr,id]=String(sv.screen).split(":");
  if(scr==="home") return `
    <div class="s-hello">أهلاً ${esc((me.full_name||"").split(" ")[0])}</div>
    <div class="s-tiles">
      <button class="s-tile g" data-s="give"><span class="ic">${ic("give")}</span>تسليم</button>
      <button class="s-tile b" data-s="find"><span class="ic">${ic("search")}</span>دوّر على اسم</button>
      <button class="s-tile r" data-s="call"><span class="ic">${ic("phone")}</span>اتصل</button>
      <button class="s-tile p" data-s="print"><span class="ic">${ic("printer")}</span>اطبع</button>
    </div>
    <div class="s-foot">
      ${realRole==="manager"?`<button class="btn" data-preview="manager">${ic("undo")}رجوع لشاشة المدير</button>`:""}
      <button class="btn" id="s_big">${ic("text")}${document.body.classList.contains("big")?"خط أصغر":"خط أكبر"}</button>
      <button class="btn" id="s_out">خروج</button>
    </div>`;
  if(scr==="give"||scr==="print"||scr==="call") return `${back}<h2 class="s-title">${scr==="give"?ic("give")+" اختار الكشف":scr==="print"?ic("printer")+" اختار الكشف اللي هتطبعه":ic("phone")+" اختار الكشف"}</h2>
    <div class="s-list">${ready.length?ready.map(k=>bCard(k, scr==="give"?"gb":scr==="print"?"pr":"cb")).join(""):noBatches}</div>`;
  if(scr==="gb"){
    const k=K.get(id); if(!k) return back+noBatches;
    const qq=norm(sq); const rec=k.items.filter(i=>i.received).length;
    const items=k.items.filter(it=>!qq||norm(it.name).includes(qq)||String(it.code)===qq).sort((a,b)=>(a.received?1:0)-(b.received?1:0));
    return `<button class="s-back" data-s="give">→ رجوع</button>
      <h2 class="s-title">${esc(k.typeName)} <small>${mLabel(k.month)}</small></h2>
      <div class="s-count"><span class="prog big"><i style="width:${k.items.length?Math.round(rec/k.items.length*100):0}%"></i></span>استلم <b>${num(rec)}</b> من <b>${num(k.items.length)}</b></div>
      <input type="search" class="s-search" id="s_q" placeholder="اكتب الاسم" value="${esc(sq)}">
      <div class="s-list">${items.map(it=>`<div class="s-row ${it.received?"done":""}"><span class="grow"><b>${esc(it.name)}</b><small>رقم ${esc(it.code)} · ${num(it.value)} ${esc(k.unit)}</small></span>
        ${it.received?`<span class="s-ok">✓ استلم${it.pending?`<small class="pend">${ic("refresh")}مستني النت</small>`:""}</span>`:`<button class="s-give" data-give="${it.id}">سلّم</button>`}</div>`).join("")||`<div class="s-empty">مفيش الاسم ده في الكشف</div>`}</div>`;
  }
  if(scr==="cb"){
    const k=K.get(id); if(!k) return back+noBatches;
    const left=k.items.filter(i=>!i.received);
    return `<button class="s-back" data-s="call">→ رجوع</button>
      <h2 class="s-title">${ic("phone")}لسه ما استلموش <small>${num(left.length)}</small></h2>
      <p class="s-hint">اضغط «اتصل»، ولما تخلص المكالمة اختار: ردّت / ماردتش / رقم غلط.</p>
      <div class="s-list">${left.map(it=>{ const ph=cleanPhone(it.phone||B.get(it.bid)?.phone); return `<div class="s-row ${it.bid?rowCallCls(it.bid,k.id):""}"><span class="grow"><b>${esc(it.name)}</b><small dir="ltr">${esc(ph||"مفيش رقم")}</small></span>
        ${it.bid?callCell(it.bid,ph,k.id,true):validPhone(ph)?`<a class="s-call" href="tel:${ph}">${ic("phone")}اتصل</a>`:""}</div>`;}).join("")||`<div class="s-empty">كله استلم ✓</div>`}</div>`;
  }
  if(scr==="find"){
    const qq=norm(sq);
    const res=qq.length>=2?people().filter(b=>norm(b.name).includes(qq)||String(b.code)===qq.padStart(3,"0")||(b.nationalId||"").includes(qq)).slice(0,30):[];
    return `${back}<h2 class="s-title">${ic("search")}دوّر على اسم</h2>
      <input type="search" class="s-search" id="s_q" placeholder="اكتب الاسم أو رقم الحالة" value="${esc(sq)}">
      <div class="s-list">${qq.length<2?`<div class="s-empty">اكتب أول حرفين من الاسم</div>`:res.map(b=>`<button class="s-card" data-s="ps:${b.id}"><span class="s-ic">${ic("user")}</span><span class="grow"><b>${esc(b.name)}</b><small>رقم ${esc(b.code)}${b.familySize?` · ${b.familySize} أفراد`:""}</small></span></button>`).join("")||`<div class="s-empty">مفيش حد بالاسم ده</div>`}</div>`;
  }
  if(scr==="ps"){
    const b=B.get(id); if(!b) return back;
    const hist=receipts().filter(r=>r.bid===id).sort((a,c)=>c.month.localeCompare(a.month)).slice(0,8);
    const ph=cleanPhone(b.phone);
    return `<button class="s-back" data-s="find">→ رجوع</button>
      <div class="s-person"><div class="s-ic big">${ic("user")}</div><h2>${esc(b.name)}</h2><p>رقم الحالة <b>${esc(b.code)}</b>${b.familySize?` · <b>${b.familySize}</b> أفراد`:""}${(b.children||[]).length?` · <b>${b.children.length}</b> أطفال`:""}</p>
        ${b.status!=="نشط"?`<p class="s-warn">${ic("alert")}الحالة دي ${esc(b.status)}</p>`:""}
        <div style="margin-top:10px">${callCell(b.id,b.phone,null,true)}</div></div>
      <h3 class="s-title">خدت إيه قبل كده؟</h3>
      <div class="s-list">${hist.map(r=>`<div class="s-row ${r.received?"done":""}"><span class="grow"><b>${esc(r.typeName)}</b><small>${mLabel(r.month)}</small></span><span class="s-ok ${r.received?"":"muted"}">${r.received?"✓ استلم":"لسه"}</span></div>`).join("")||`<div class="s-empty">لسه ما خدتش حاجة</div>`}</div>`;
  }
  return back;
}
function bindSimple(){
  const v=$("#view");
  v.querySelectorAll("[data-s]").forEach(el=>el.onclick=()=>{
    const to=el.dataset.s;
    if(to.startsWith("pr:")){ const k=K.get(to.slice(3)); if(k) doPrint(batchHTML(k)); return; }
    if(!to.startsWith("ps:")&&!(sv.screen.startsWith("ps:")&&to==="find")) sq="";
    const ready=batches().filter(k=>k.status==="معتمد");
    sv={screen:to==="give"&&ready.length===1&&sv.screen==="home"?"gb:"+ready[0].id:to}; render(); window.scrollTo(0,0);
    if(to==="find") setTimeout(()=>$("#s_q")?.focus(),50);
  });
  v.querySelectorAll("[data-preview]").forEach(el=>el.onclick=()=>setPreview(el.dataset.preview));
  bindCalls(v, render);
  const q=$("#s_q"); if(q) q.oninput=()=>{ sq=q.value; const pos=q.selectionStart; render(); const n=$("#s_q"); n.focus(); n.setSelectionRange(pos,pos); };
  v.querySelectorAll("[data-give]").forEach(el=>el.onclick=async()=>{
    const bid=sv.screen.split(":")[1]; const k=K.get(bid); const it=k?.items.find(x=>x.id===el.dataset.give); if(!it) return;
    el.disabled=true; el.innerHTML=`<span class="spin" aria-hidden="true"></span>`;
    const r=await markReceived(it,true);
    if(r==="error"){ el.disabled=false; el.textContent="سلّم"; return; }
    if(navigator.vibrate) navigator.vibrate(40);
    toast(r==="queued"?`${it.name} — اتسجل، وهيترفع لما النت يرجع`:`✓ ${it.name} استلم`);
  });
  const big=$("#s_big"); if(big) big.onclick=()=>{ document.body.classList.toggle("big"); try{localStorage.setItem("big",document.body.classList.contains("big")?"1":"");}catch(e){} render(); };
  const out=$("#s_out"); if(out) out.onclick=logout;
}
let wasWide=innerWidth>=900;
addEventListener("resize",()=>{ const w=innerWidth>=900; if(w!==wasWide){ wasWide=w; render(); } });

/* ================= sheet ================= */
let sheetRefresh=null, sheetSeq=0;   // sheetSeq: late async redraws must not paint over a newer sheet
function sheet(title,body,onMount,refresh){
  closeSheet(); sheetSeq++;
  const s=document.createElement("div"); s.className="scrim"; s.id="scrim";
  s.innerHTML=`<div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="sh-head"><h2>${esc(title)}</h2><button class="x" aria-label="إغلاق">×</button></div><div class="sh-body">${body}</div></div>`;
  s.onclick=e=>{ if(e.target===s) closeSheet(); };
  s.querySelector(".x").onclick=closeSheet;
  document.body.appendChild(s); document.body.style.overflow="hidden";
  sheetRefresh=refresh||null; onMount&&onMount(s); return s;
}
function closeSheet(){ const s=$("#scrim"); if(s) s.remove(); document.body.style.overflow=""; sheetRefresh=null; }
function refreshSheet(){ if(sheetRefresh&&$("#scrim")){ const sc=$("#scrim .sh-body")?.scrollTop||0; sheetRefresh(); const b=$("#scrim .sh-body"); if(b) b.scrollTop=sc; } }
document.addEventListener("keydown",e=>{ if(e.key==="Escape") closeSheet(); });

/* ================= case file ================= */
async function loadLog(entity,id){
  const key=entity+id; if(logCache.has(key)) return logCache.get(key);
  const { data } = await sb.from("activity_log").select("*").eq("entity",entity).eq("entity_id",id).order("at",{ascending:false}).limit(40);
  logCache.set(key, data||[]); return data||[];
}
async function editPerson(id){
  if(!canWrite()) return;
  const draftKey=`draft:person:${id||"new"}`;
  const b=id?{...B.get(id)}:{code:await nextCode(),name:"",nationalId:"",phone:"",phone2:"",birth:"",caseType:"",grade:"",score:null,project:"",area:"",address:"",marital:"",job:"",income:"",housing:"",pension:"",notes:"",familySize:null,children:[],tags:[],status:"انتظار",lastReview:"",nextReview:""};
  b.tags=[...(b.tags||[])];
  b.children=[...(b.children||[])].map(k=>({...k}));
  const projects=[...new Set(people().map(p=>p.project).filter(Boolean))];
  sheet(id?`تعديل: ${b.name}`:"حالة جديدة",`
    <div id="p_draft"></div>
    <div class="grid2">
      <label class="f">رقم الحالة<input type="text" id="p_code" value="${esc(b.code)}"></label>
      <label class="f">الحالة<select id="p_status">${STATUSES.map(s=>`<option ${b.status===s?"selected":""}>${s}</option>`).join("")}</select></label>
    </div>
    <label class="f">الاسم رباعي<input type="text" id="p_name" value="${esc(b.name)}"></label>
    <div class="grid2">
      <label class="f">الرقم القومي<input type="text" inputmode="numeric" id="p_nid" value="${esc(b.nationalId)}" dir="ltr" maxlength="20" autocomplete="off" aria-describedby="p_nidHint"><span class="hint" id="p_nidHint" aria-live="polite"></span></label>
      <label class="f">تاريخ الميلاد (بيتحسب من الرقم القومي)<input type="date" id="p_birth" value="${esc(b.birth)}"></label>
      <label class="f">التليفون<input type="text" inputmode="tel" id="p_phone" value="${esc(b.phone)}" dir="ltr"></label>
      <label class="f">تليفون تاني<input type="text" inputmode="tel" id="p_phone2" value="${esc(b.phone2)}" dir="ltr"></label>
      <label class="f">نوع الحالة<select id="p_type"><option value="">غير محدد</option>${CASE_TYPES.filter(c=>c!=="غير محدد").map(c=>`<option ${b.caseType===c?"selected":""}>${c}</option>`).join("")}</select></label>
      <label class="f">الحالة الاجتماعية<select id="p_marital"><option value=""></option>${MARITAL.map(c=>`<option ${b.marital===c?"selected":""}>${c}</option>`).join("")}</select></label>
      <label class="f">المشروع<input type="text" id="p_project" list="projs" value="${esc(b.project)}"><datalist id="projs">${projects.map(p=>`<option value="${esc(p)}">`).join("")}</datalist></label>
      <label class="f">المنطقة<input type="text" id="p_area" value="${esc(b.area)}"></label>
    </div>
    <label class="f">العنوان بالتفصيل<input type="text" id="p_address" value="${esc(b.address)}"></label>
    <div class="grid2">
      <label class="f">العمل<input type="text" id="p_job" value="${esc(b.job)}"></label>
      <label class="f">الدخل الشهري<input type="text" id="p_income" value="${esc(b.income)}"></label>
      <label class="f">المعاش<input type="text" id="p_pension" value="${esc(b.pension)}"></label>
      <label class="f">نوع السكن<input type="text" id="p_housing" value="${esc(b.housing)}" placeholder="إيجار / تمليك / مع الأهل"></label>
      <label class="f">إجمالي أفراد الأسرة<input type="number" id="p_fam" value="${b.familySize??""}"></label>
      <label class="f">التقدير<select id="p_grade"><option value="">—</option>${["A","B","C"].map(g=>`<option ${b.grade===g?"selected":""}>${g}</option>`).join("")}</select></label>
      <label class="f">تاريخ آخر مراجعة / بحث<input type="date" id="p_last" value="${esc(b.lastReview)}"></label>
      <label class="f">ميعاد المراجعة الجاية<input type="date" id="p_next" value="${esc(b.nextReview)}"></label>
    </div>
    <label class="f">ملاحظات<textarea id="p_notes">${esc(b.notes)}</textarea></label>
    <div class="sub">قوايم المتبرعين اللي الحالة عليها</div>
    <div class="checks" id="p_tags">${[...new Set([...allTags(),...b.tags])].map(t=>`<label><input type="checkbox" value="${esc(t)}" ${b.tags.includes(t)?"checked":""}> ${esc(t)}</label>`).join("")}</div>
    <label class="f">قايمة جديدة (اختياري)<input type="text" id="p_newtag" placeholder="مثال: مصر الخير"></label>
    <h3>الأبناء</h3><div id="kids"></div>
    <button class="btn sm" id="addKid">${ic("plus")}إضافة ابن / ابنة</button>
    <label class="f" style="margin-top:14px">سبب التعديل (اختياري — بيتسجل في سجل الحالة)<input type="text" id="p_why" placeholder="مثال: بحث ميداني جديد، تغيير رقم التليفون"></label>
    <div class="bar"><button class="btn pri" id="saveP">${ic("save")}حفظ</button><button class="btn" id="cancelP">إلغاء</button></div>`, s=>{
    const q=x=>s.querySelector(x);
    // Autosave: a dropped connection or a closed tab never loses what the researcher typed.
    const fields=[...s.querySelectorAll("input[id^='p_'],select[id^='p_'],textarea[id^='p_']")];
    const saved=loadDraft(draftKey);
    if(saved){
      fields.forEach(el=>{ if(el.id in saved.f) el.value=saved.f[el.id]; }); b.children=saved.children||b.children;
      q("#p_draft").innerHTML=`<div class="note">${ic("info")} <span class="grow">رجّعنالك اللي كنت كاتبه ومتحفظش (${dLabel(saved.at)}).</span> <button class="btn sm" id="p_dropDraft">ابدأ من جديد</button></div>`;
      q("#p_dropDraft").onclick=()=>{ clearDraft(draftKey); editPerson(id); };
    }
    const keep=()=>{ clearTimeout(draftTimer); draftTimer=setTimeout(()=>saveDraft(draftKey,{f:Object.fromEntries(fields.map(el=>[el.id,el.value])),children:b.children}),400); };
    s.addEventListener("input",keep); s.addEventListener("change",keep);
    const nidHint=()=>{ const r=parseNID(q("#p_nid").value); const h=q("#p_nidHint");
      if(r.empty){ h.textContent=""; h.className="hint"; return; }
      if(r.ok){ h.textContent=`${r.gender} · مواليد ${dLabel(r.birth)} · ${r.governorate}`; h.className="hint ok"; if(q("#p_birth").value!==r.birth) q("#p_birth").value=r.birth;
        const dup=[...B.values()].find(x=>x.id!==id&&x.nationalId===r.nid); if(dup){ h.innerHTML=`${ic("alert")} الرقم ده متسجل لحالة رقم ${esc(dup.code)} — ${esc(dup.name)}${dup.archivedAt?" (في الأرشيف)":""}`; h.className="hint bad"; } }
      else { h.textContent=r.error; h.className="hint bad"; } };
    q("#p_nid").oninput=nidHint; nidHint();
    q("#p_nid").onblur=()=>{ const r=parseNID(q("#p_nid").value); if(r.ok&&q("#p_nid").value!==r.nid) q("#p_nid").value=r.nid; };
    const drawKids=()=>{
      q("#kids").innerHTML=b.children.length?`<div class="tbl" style="margin-bottom:8px"><table><thead><tr><th>الاسم</th><th>الرقم القومي</th><th>النوع</th><th>الميلاد</th><th>المرحلة الدراسية</th><th></th></tr></thead><tbody>${b.children.map((k,i)=>`<tr>
        <td><input type="text" data-k="${i}" data-f="name" value="${esc(k.name)}" style="min-width:110px" aria-label="اسم الابن"></td>
        <td><input type="text" inputmode="numeric" dir="ltr" data-k="${i}" data-f="nid" value="${esc(k.nid||"")}" style="min-width:150px" maxlength="20" aria-label="الرقم القومي للابن"></td>
        <td><select data-k="${i}" data-f="gender" style="min-width:70px" aria-label="النوع"><option></option><option ${k.gender==="ولد"?"selected":""}>ولد</option><option ${k.gender==="بنت"?"selected":""}>بنت</option></select></td>
        <td><input type="date" data-k="${i}" data-f="birth" value="${esc(k.birth)}" aria-label="تاريخ الميلاد"></td>
        <td>${stageSelect("", k.school, `data-k="${i}" data-f="school" style="min-width:150px"`)}</td>
        <td><button class="btn sm danger" data-rk="${i}" aria-label="حذف">×</button></td></tr>`).join("")}</tbody></table></div>`:`<p class="sub">لا يوجد أبناء مسجلين</p>`;
      s.querySelectorAll("[data-k]").forEach(el=>el.onchange=()=>{ const k=b.children[+el.dataset.k]; k[el.dataset.f]=el.value;
        // a child's national ID fills in the birth date and gender, like the mother's
        if(el.dataset.f==="nid"){ const r=parseNID(el.value); if(r.ok){ k.nid=r.nid; k.birth=r.birth; k.gender=r.gender==="ذكر"?"ولد":"بنت"; drawKids(); } else if(el.value.trim()) toast(r.error); } });
      s.querySelectorAll("[data-rk]").forEach(el=>el.onclick=()=>{ b.children.splice(+el.dataset.rk,1); drawKids(); });
    };
    drawKids();
    q("#addKid").onclick=()=>{ b.children.push({name:"",gender:"",birth:"",school:"",nid:""}); drawKids(); };
    q("#cancelP").onclick=()=>{ clearDraft(draftKey); id?viewPerson(id):closeSheet(); };
    q("#saveP").onclick=async()=>{
      const g=x=>q(x).value.trim(); const prev=id?B.get(id):null;
      const rec={...b, code:g("#p_code"), status:g("#p_status"), name:g("#p_name"), nationalId:g("#p_nid"), birth:g("#p_birth"), phone:g("#p_phone"), phone2:g("#p_phone2"), caseType:g("#p_type"), marital:g("#p_marital"), project:g("#p_project"), area:g("#p_area"), address:g("#p_address"), job:g("#p_job"), income:g("#p_income"), pension:g("#p_pension"), housing:g("#p_housing"), familySize:g("#p_fam")?+g("#p_fam"):null, grade:g("#p_grade"), lastReview:g("#p_last"), nextReview:g("#p_next"), notes:g("#p_notes"), children:b.children.filter(k=>k.name),
        tags:[...new Set([...[...s.querySelectorAll("#p_tags input:checked")].map(i=>i.value), g("#p_newtag")].filter(Boolean))]};
      if(!rec.name){ toast("اكتب الاسم الأول"); q("#p_name").focus(); return; }
      const nid=parseNID(rec.nationalId); if(nid.ok) rec.nationalId=nid.nid;
      if(rec.nationalId&&!nid.ok&&!await ask(`${nid.error}.\nتحفظ كده برضو؟`,{title:"الرقم القومي شكله غلط",ok:"احفظ برضو",cancel:"أصلّحه"})){ q("#p_nid").focus(); return; }
      const changes=[];
      if(prev){ if(prev.status!==rec.status) changes.push(`الحالة: ${prev.status} ← ${rec.status}`); if((prev.familySize??"")!==(rec.familySize??"")) changes.push(`أفراد الأسرة: ${prev.familySize||"—"} ← ${rec.familySize||"—"}`); if((prev.phone||"")!==rec.phone) changes.push("تغيير التليفون"); if((prev.lastReview||"")!==rec.lastReview&&rec.lastReview) changes.push(`مراجعة بتاريخ ${dLabel(rec.lastReview)}`); if((prev.children||[]).length!==rec.children.length) changes.push(`عدد الأبناء: ${(prev.children||[]).length} ← ${rec.children.length}`); }
      q("#saveP").disabled=true;
      let newId=id;
      if(id){ if(!await run(sb.from("beneficiaries").update(toB(rec)).eq("id",id))){ q("#saveP").disabled=false; return; } }
      else { const d=await run(sb.from("beneficiaries").insert({...toB(rec), created_by:me.id}).select("id").single()); if(!d){ q("#saveP").disabled=false; return; } newId=d.id; }
      await logIt("beneficiary",newId, prev?[g("#p_why"),...changes].filter(Boolean).join(" · ")||"تعديل بيانات":"تسجيل الحالة");
      clearDraft(draftKey); toast("تم الحفظ ✓"); await refreshPerson(newId); viewPerson(newId);
    };
  });
}
function viewPerson(id){
  let logs=null;
  const draw=()=>{
    const b=B.get(id); if(!b) return "";
    const hist=receipts().filter(r=>r.bid===id).sort((a,c)=>c.month.localeCompare(a.month));
    const cash=hist.filter(r=>r.unit==="جنيه").reduce((s,r)=>s+(+r.value||0),0);
    const f=(l,v)=>v||v===0?`<div><span>${l}</span><strong>${esc(v)}</strong></div>`:"";
    return `
    <div class="row" style="margin-bottom:12px">
      <span class="chip ${b.status==="نشط"?"":b.status==="ملغي"?"red":"gold"}">${esc(b.status)}</span><span class="chip">${esc(b.caseType||"غير محدد")}</span>
      ${b.grade?`<span class="chip gold">تقدير ${esc(b.grade)}</span>`:""}${reviewDue(b)?`<span class="chip red">محتاجة مراجعة</span>`:""}
      ${(b.tags||[]).map(t=>`<span class="chip blue">${esc(t)}</span>`).join("")}
    </div>
    <div class="callbar">${callCell(b.id,b.phone,null,true)}${validPhone(b.phone2)?callCell(b.id,b.phone2,null,true):""}</div>
    <div class="bar">
      ${canWrite()?`<button class="btn pri" id="v_edit">${ic("edit")}تعديل</button><button class="btn" id="v_rev">${ic("calendar")}تسجيل مراجعة</button>`:""}
      ${isMgr()?`<button class="btn gold" id="v_single">${ic("cash")}صرف فردي</button>`:""}
      <button class="btn" id="v_print">${ic("printer")}طباعة الملف</button>
      ${canWrite()?`<button class="btn" id="v_task">${ic("check")}مهمة للحالة دي</button>`:""}
    </div>
    ${(()=>{ const ts=openTasks().filter(t=>t.bid===b.id); return ts.length?`<div class="list tasks" style="margin-bottom:12px">${ts.map(t=>`<div class="task ${t.due&&t.due<today?"late":""}"><button class="tick" data-done="${t.id}" aria-label="خلصت"></button><button class="grow tbody" data-task="${t.id}"><span class="nm">${esc(t.title)}</span><br><span class="sub">${t.due?dLabel(t.due):""}</span></button></div>`).join("")}</div>`:""; })()}
    <div class="facts">
      ${f("رقم الحالة",b.code)}${f("الرقم القومي",b.nationalId)}${f("السن",age(b.birth))}${f("التليفون",cleanPhone(b.phone)||b.phone)}${f("تليفون تاني",b.phone2)}
      ${f("الحالة الاجتماعية",b.marital)}${f("أفراد الأسرة",b.familySize||(famSize(b)?famSize(b)+" (من عدد الأبناء)":""))}${f("عدد الأبناء",(b.children||[]).length||"")}
      ${f("المشروع",b.project)}${f("المنطقة",b.area)}${f("العمل",b.job)}${f("الدخل",b.income)}${f("المعاش",b.pension)}${f("السكن",b.housing)}
      ${f("آخر مراجعة",b.lastReview&&dLabel(b.lastReview))}${f("المراجعة الجاية",b.nextReview&&dLabel(b.nextReview))}${f("الدرجة",b.score!=null?b.score+"%":"")}
    </div>
    ${b.address?`<p><span class="sub">العنوان:</span> ${esc(b.address)}</p>`:""}
    ${b.notes?`<div class="note">${esc(b.notes)}</div>`:""}
    <h3>الصور</h3>
    <div class="photos">${photoTile(b.id,"mother","الأم")}${photoTile(b.id,"idcard","البطاقة")}${(b.children||[]).map((k,i)=>photoTile(b.id,"k"+i,k.name||"ابن / ابنة")).join("")}</div>
    <h3>الأبناء</h3>
    ${(b.children||[]).length?`<div class="tbl"><table><thead><tr><th>الاسم</th><th>السن</th><th>المرحلة الدراسية</th><th>شهادة القيد ${syLabel(SY)}</th></tr></thead><tbody>${b.children.map((k,i)=>{const a=age(k.birth), st=stageOf(k); return `<tr><td>${esc(k.name)}${k.nid?`<div class="why" dir="ltr" style="text-align:end">${esc(k.nid)}</div>`:""}</td><td class="n">${a===""?"—":a}${a!==""&&a>=18?` <span class="chip red">فوق 18</span>`:a!==""&&a>=17?` <span class="chip gold">قرب 18</span>`:""}</td>
      <td>${esc(st||"—")}${st&&!STAGES.includes(st)?` <span class="chip gold" title="اختارها من القايمة في «تعديل»">مكتوبة بإيد</span>`:""}</td>
      <td>${!inSchool(st)?`<span class="sub">—</span>`:String(k.cert||"")===String(SY)?`<span class="chip">✓ وصلت</span>`:canWrite()?`<button class="btn sm" data-cert="${i}">${ic("check")}وصلت</button>`:`<span class="chip red">لسه</span>`}</td></tr>`;}).join("")}</tbody></table></div>`:`<p class="sub">لا يوجد أبناء مسجلين</p>`}
    <h3>سجل المساعدات</h3>
    <div class="tbl"><table><thead><tr><th>الشهر</th><th>النوع</th><th>القيمة</th><th>استلم</th></tr></thead><tbody>
    ${hist.map(r=>`<tr><td class="n">${mLabel(r.month)}</td><td>${esc(r.typeName)}</td><td class="n">${num(r.value)} ${esc(r.unit)}</td><td>${r.received?"✓ "+(r.receivedAt?dLabel(r.receivedAt):""):"—"}</td></tr>`).join("")||`<tr><td colspan="4" class="empty">لم تستلم أي مساعدة معتمدة بعد</td></tr>`}
    </tbody></table></div>
    ${hist.length?`<p class="sub">${hist.length} مرة · إجمالي نقدي ${num(cash)} جنيه</p>`:""}
    <h3>سجل التغييرات</h3>
    ${logs===null?`<p class="sub"><span class="spin"></span></p>`:logs.length?`<ul class="log">${logs.map(l=>`<li><b>${dLabel(l.at)}</b> — ${esc(l.text)}${l.by?` <span>(${esc(who(l.by))})</span>`:""}</li>`).join("")}</ul>`:`<p class="sub">مستوردة من شيت ${esc(b.source||"Excel")} — لا توجد تغييرات بعد</p>`}
    ${isMgr()?`<div class="bar" style="margin-top:20px"><button class="btn danger" id="v_del">${ic("archive")}أرشفة الحالة</button></div>`:""}`;
  };
  const mount=s=>{
    const q=x=>s.querySelector(x);
    if(q("#v_edit")) q("#v_edit").onclick=()=>editPerson(id);
    if(q("#v_rev")) q("#v_rev").onclick=()=>reviewSheet(id);
    if(q("#v_single")) q("#v_single").onclick=()=>singleGive(id);
    q("#v_print").onclick=()=>doPrint(caseHTML(B.get(id),logs||[]), `ملف ${B.get(id).code} ${B.get(id).name}`);
    if(q("#v_task")) q("#v_task").onclick=()=>taskSheet(null,id);
    s.querySelectorAll("[data-task]").forEach(el=>el.onclick=()=>taskSheet(el.dataset.task));
    s.querySelectorAll("[data-done]").forEach(el=>el.onclick=()=>doneTask(el.dataset.done,el));
    s.querySelectorAll("[data-cert]").forEach(el=>el.onclick=()=>certDialog(id,+el.dataset.cert));
    bindCalls(s, redraw); bindPhotos(s, id, redraw);
    if(q("#v_del")) q("#v_del").onclick=async()=>{
      if(!await ask("الحالة هتختفي من القوائم والكشوف الجديدة، بس سجلها وكل اللي صرفته يفضل محفوظ.\nتقدر ترجّعها في أي وقت من «الإعدادات ← الأرشيف».",{title:"أرشفة الحالة؟",ok:"أرشفة"})) return;
      if(await run(sb.from("beneficiaries").update({archived_at:new Date().toISOString(),archived_by:me.id}).eq("id",id),"اتأرشفت ✓")){ await logIt("beneficiary",id,"أرشفة الحالة"); closeSheet(); refreshPerson(id); }
    };
  };
  if(!B.get(id)) return;
  let mine=-1;
  const redraw=()=>{ const body=$("#scrim .sh-body"); if(body&&B.get(id)&&sheetSeq===mine){ body.innerHTML=draw(); mount($("#scrim")); } };
  sheet(B.get(id).name, draw(), mount, redraw); mine=sheetSeq;
  loadLog("beneficiary",id).then(l=>{ logs=l; redraw(); });
}
function reviewSheet(id){
  const b=B.get(id);
  sheet(`تسجيل مراجعة — ${b.name}`,`
    <div class="grid2">
      <label class="f">تاريخ المراجعة<input type="date" id="r_d" value="${today}"></label>
      <label class="f">المراجعة الجاية بعد<select id="r_n"><option value="3">3 شهور</option><option value="6">6 شهور</option><option value="12" selected>سنة</option></select></label>
      <label class="f">أفراد الأسرة دلوقتي<input type="number" id="r_f" value="${b.familySize??""}"></label>
      <label class="f">الحالة بعد المراجعة<select id="r_s">${STATUSES.map(s=>`<option ${b.status===s?"selected":""}>${s}</option>`).join("")}</select></label>
      <label class="f">التقدير<select id="r_g"><option value="">—</option>${["A","B","C"].map(g=>`<option ${b.grade===g?"selected":""}>${g}</option>`).join("")}</select></label>
      <label class="f">القائم بالبحث<input type="text" id="r_by" value="${esc(me.full_name)}"></label>
    </div>
    <label class="f">نتيجة المراجعة<textarea id="r_t" placeholder="مثال: الأسرة لسه محتاجة، البنت الكبيرة اتجوزت"></textarea></label>
    <div class="bar"><button class="btn pri" id="r_go">${ic("save")}حفظ المراجعة</button></div>`, s=>{
    const q=x=>s.querySelector(x);
    q("#r_go").onclick=async()=>{
      const d=q("#r_d").value||today; const nx=new Date(d); nx.setMonth(nx.getMonth()+ +q("#r_n").value);
      const cur=B.get(id); const fam=q("#r_f").value?+q("#r_f").value:null;
      const parts=["مراجعة ميدانية", q("#r_by").value.trim()&&`بواسطة ${q("#r_by").value.trim()}`, cur.status!==q("#r_s").value&&`الحالة: ${cur.status} ← ${q("#r_s").value}`, (cur.familySize??null)!==fam&&`أفراد الأسرة: ${cur.familySize||"—"} ← ${fam||"—"}`, q("#r_t").value.trim()].filter(Boolean);
      q("#r_go").disabled=true;
      if(await run(sb.from("beneficiaries").update({last_review:d, next_review:nx.toISOString().slice(0,10), family_size:fam, status:q("#r_s").value, grade:q("#r_g").value}).eq("id",id))){
        await logIt("beneficiary",id,parts.join(" · ")); toast("تم تسجيل المراجعة ✓"); await refreshPerson(id); viewPerson(id);
      } else q("#r_go").disabled=false;
    };
  });
}
function singleGive(bid){
  const b=B.get(bid); const ts=types();
  sheet(`صرف فردي — ${b.name}`,`
    <label class="f">نوع المساعدة<select id="s_t">${ts.map(t=>`<option value="${t.id}">${esc(t.name)}</option>`).join("")}</select></label>
    <div class="grid2"><label class="f">الشهر<input type="month" id="s_m" value="${curMonth}"></label><label class="f">القيمة<input type="number" id="s_v" value="${ts[0]?.amount??""}"></label></div>
    <label class="f">سبب الصرف<input type="text" id="s_r" placeholder="مثال: علاج، إيجار، مصروفات مدرسة"></label>
    <div class="bar"><button class="btn pri" id="s_go">تسجيل الصرف</button></div>`, s=>{
    s.querySelector("#s_t").onchange=e=>{ s.querySelector("#s_v").value=T.get(e.target.value).amount; };
    s.querySelector("#s_go").onclick=async()=>{
      const t=T.get(s.querySelector("#s_t").value); const m=s.querySelector("#s_m").value||curMonth;
      s.querySelector("#s_go").disabled=true;
      const k=await run(sb.from("batches").insert({title:`صرف فردي ${t.name} — ${b.name}`,type_id:t.id,type_name:t.name,unit:t.unit,template:t.template,month:m,status:"مصروف",single:true,created_by:me.id,approved_at:new Date().toISOString(),approved_by:me.id,paid_at:new Date().toISOString()}).select("id").single());
      if(!k){ s.querySelector("#s_go").disabled=false; return; }
      const it={...itemFor(b,+s.querySelector("#s_v").value||0,s.querySelector("#s_r").value||"صرف فردي"),received:true};
      await run(sb.from("batch_items").insert({...toI(it,k.id,0), received_by:me.id}));
      await logIt("batch",k.id,"صرف فردي"); await logIt("beneficiary",bid,`صرف فردي: ${t.name} ${it.value} ${t.unit}`);
      toast("تم تسجيل الصرف ✓"); await refreshBatch(k.id); viewPerson(bid);
    };
  });
}

/* ================= photos =================
   Private bucket «photos». Every picture is shrunk on the device first (~100 KB) so 1 GB holds thousands of them,
   and it's fetched as a blob so it never needs a public link. Replacing a photo keeps the old file (no deleting). */
const photoURL = new Map();   // path → blob: URL
const photoPath = (b, slot) => slot.startsWith("k") ? (b.children||[])[+slot.slice(1)]?.photo : b.photos?.[slot];
function photoTile(bid, slot, label){
  const b=B.get(bid), path=photoPath(b,slot), url=path&&photoURL.get(path);
  if(path&&!url) loadPhoto(path);
  return `<figure class="ph"><button class="phb" data-ph="${slot}" ${path?"":"disabled"} aria-label="صورة ${esc(label)}">${url?`<img src="${url}" alt="">`:path?`<span class="spin"></span>`:ic("user")}</button>
    <figcaption>${esc(label)}</figcaption>${canWrite()?`<label class="btn sm phup">${ic(path?"refresh":"plus")}${path?"غيّر":"صورة"}<input type="file" accept="image/*" data-up="${slot}" hidden></label>`:""}</figure>`;
}
const photoLoading = new Set();
async function loadPhoto(path){
  if(photoLoading.has(path)) return; photoLoading.add(path);
  const { data, error } = await sb.storage.from("photos").download(path);
  photoLoading.delete(path);
  if(error||!data) return;
  photoURL.set(path, URL.createObjectURL(data)); refreshSheet();
}
function shrink(file, max=1100, q=0.72){
  return new Promise((res, rej)=>{ const img=new Image(), u=URL.createObjectURL(file);
    img.onload=()=>{ const r=Math.min(1, max/Math.max(img.width,img.height)); const c=document.createElement("canvas"); c.width=Math.round(img.width*r); c.height=Math.round(img.height*r);
      c.getContext("2d").drawImage(img,0,0,c.width,c.height); URL.revokeObjectURL(u); c.toBlob(b=>b?res(b):rej(new Error("image")),"image/jpeg",q); };
    img.onerror=()=>{ URL.revokeObjectURL(u); rej(new Error("image")); }; img.src=u; });
}
function bindPhotos(root, bid, redraw){
  root.querySelectorAll("[data-ph]").forEach(el=>el.onclick=()=>{ const path=photoPath(B.get(bid),el.dataset.ph), url=photoURL.get(path); if(!url) return;
    const w=document.createElement("div"); w.className="ask-scrim"; w.innerHTML=`<img class="ph-big" src="${url}" alt="">`; w.onclick=()=>w.remove(); document.body.appendChild(w); });
  root.querySelectorAll("[data-up]").forEach(inp=>inp.onchange=async()=>{
    const f=inp.files?.[0]; if(!f) return; const slot=inp.dataset.up;
    toast("بنرفع الصورة…");
    let blob; try{ blob=await shrink(f); }catch(e){ toast("الملف ده مش صورة"); return; }
    const path=`${bid}/${slot}-${Date.now()}.jpg`;
    const up=await sb.storage.from("photos").upload(path, blob, { contentType:"image/jpeg" });
    if(up.error){ toast(errMsg(up.error)); return; }
    photoURL.set(path, URL.createObjectURL(blob));
    const b=B.get(bid); let patch;
    if(slot.startsWith("k")){ const kids=(b.children||[]).map(x=>({...x})); kids[+slot.slice(1)].photo=path; patch={children:kids}; }
    else patch={photos:{...(b.photos||{}), [slot]:path}};
    if(await run(sb.from("beneficiaries").update(patch).eq("id",bid),"الصورة اتحفظت ✓")){ await logIt("beneficiary",bid,"رفع صورة"); await refreshPerson(bid); redraw(); }
  });
}

/* ================= tasks ================= */
function taskSheet(id, forBid){
  const t=id?{...TK.get(id)}:{title:"",notes:"",due:today,bid:forBid||null,assignee:null};
  const staff=[...P.values()].filter(u=>u.active&&["manager","worker","helper"].includes(u.role));
  const ro=!canWrite();
  sheet(id?"مهمة":"مهمة جديدة",`
    <label class="f">المطلوب<input type="text" id="k_t" value="${esc(t.title)}" placeholder="مثال: نجيب شهادة القيد من مدرسة يوسف" ${ro?"readonly":""}></label>
    <div class="grid2">
      <label class="f">ميعادها<input type="date" id="k_d" value="${esc(t.due)}" ${ro?"readonly":""}></label>
      <label class="f">مين هيعملها<select id="k_a" ${ro?"disabled":""}><option value="">أي حد</option>${staff.map(u=>`<option value="${u.id}" ${t.assignee===u.id?"selected":""}>${esc(u.full_name||u.username)}</option>`).join("")}</select></label>
    </div>
    <label class="f">الحالة (اختياري)<input type="search" id="k_bq" value="${esc(t.bid?B.get(t.bid)?.name||"":"")}" placeholder="اكتب اسم الحالة" autocomplete="off" ${ro?"readonly":""}></label><div id="k_bs"></div>
    <label class="f">ملاحظات<textarea id="k_n" ${ro?"readonly":""}>${esc(t.notes)}</textarea></label>
    ${t.doneAt?`<div class="note green">${ic("check")} خلصت ${dLabel(t.doneAt)}${t.doneBy?" — "+esc(who(t.doneBy)):""}</div>`:""}
    <div class="bar">${ro?"":`<button class="btn pri" id="k_s">${ic("save")}حفظ</button>`}
      ${id&&!t.doneAt?`<button class="btn" id="k_done">${ic("check")}خلصت</button>`:""}
      ${id&&canWrite()?`<button class="btn danger" id="k_x">${ic("archive")}شيلها</button>`:""}</div>`, s=>{
    const q=x=>s.querySelector(x); let bid=t.bid;
    const bq=q("#k_bq"); bq.oninput=()=>{ bid=null; const qq=norm(bq.value); if(!qq){ q("#k_bs").innerHTML=""; return; }
      const res=people().filter(b=>norm(b.name).includes(qq)||b.code===qq.padStart(3,"0")).slice(0,5);
      q("#k_bs").innerHTML=`<div class="list" style="margin:-4px 0 10px">${res.map(b=>`<button class="item" data-pick="${b.id}"><span class="code">${esc(b.code)}</span><span class="grow nm">${esc(b.name)}</span></button>`).join("")||`<div class="empty">مفيش</div>`}</div>`;
      q("#k_bs").querySelectorAll("[data-pick]").forEach(el=>el.onclick=()=>{ bid=el.dataset.pick; bq.value=B.get(bid).name; q("#k_bs").innerHTML=""; }); };
    if(q("#k_s")) q("#k_s").onclick=async()=>{
      const rec={title:q("#k_t").value.trim(), due:q("#k_d").value||null, assignee:q("#k_a").value||null, beneficiary_id:bid||null, notes:q("#k_n").value.trim()};
      if(!rec.title){ toast("اكتب المطلوب"); q("#k_t").focus(); return; }
      q("#k_s").disabled=true;
      const { data, error } = id ? await sb.from("tasks").update(rec).eq("id",id).select().single() : await sb.from("tasks").insert({...rec, created_by:me.id}).select().single();
      if(error){ q("#k_s").disabled=false; toast(errMsg(error)); return; }
      TK.set(data.id, fromTk(data)); upsertRaw("tk",data); changed(); toast("اتحفظت ✓"); forBid?viewPerson(forBid):closeSheet();
    };
    if(q("#k_done")) q("#k_done").onclick=()=>doneTask(id).then(()=>closeSheet());
    if(q("#k_x")) q("#k_x").onclick=async()=>{ const { data, error } = await sb.from("tasks").update({archived_at:new Date().toISOString()}).eq("id",id).select().single(); if(error){ toast(errMsg(error)); return; } TK.set(id, fromTk(data)); changed(); closeSheet(); toast("اتشالت"); };
  });
}
async function doneTask(id, el){
  if(el) el.disabled=true;
  const { data, error } = await sb.from("tasks").update({done_at:new Date().toISOString(), done_by:me.id}).eq("id",id).select().single();
  if(error){ if(el) el.disabled=false; toast(errMsg(error)); return; }
  TK.set(id, fromTk(data)); upsertRaw("tk",data); changed(); toast("برافو ✓ "+data.title);
}

/* ================= school certificates (شهادة القيد) =================
   Once a year every child in school brings a certificate. Recording it moves the child to next year's stage. */
function certsSheet(){
  const draw=()=>{ const list=certList(); const fams=[...new Set(list.map(x=>x.b.id))];
    return `<p class="sub" style="margin-top:0">السنة الدراسية ${syLabel(SY)}. أول ما الأسرة تجيب شهادة القيد، اضغط «وصلت» — الطفل بينتقل للسنة الجاية لوحده.</p>
      <div class="note">${num(list.length)} طفل في ${num(fams.length)} أسرة لسه</div>
      <div class="bar"><button class="btn" id="c_ph">${ic("phone")}أرقام الأسر دي</button></div>
      <div class="list">${fams.map(id=>{ const b=B.get(id); const kids=list.filter(x=>x.b.id===id);
        return `<div class="item col"><div class="row" style="width:100%"><span class="code">${esc(b.code)}</span><button class="grow nm linkish" data-open="${b.id}">${esc(b.name)}</button>${callCell(b.id,b.phone,null)}</div>
          ${kids.map(x=>`<div class="row kidrow"><span class="grow">${esc(x.k.name||"بدون اسم")} <span class="sub">· ${esc(stageOf(x.k))}</span></span>${canWrite()?`<button class="btn sm" data-cert="${b.id}:${x.i}">${ic("check")}وصلت</button>`:""}</div>`).join("")}</div>`; }).join("")||`<div class="empty">كل الشهادات وصلت ✓</div>`}</div>`; };
  const mount=s=>{
    s.querySelectorAll("[data-open]").forEach(el=>el.onclick=()=>viewPerson(el.dataset.open));
    s.querySelectorAll("[data-cert]").forEach(el=>el.onclick=()=>{ const [bid,i]=el.dataset.cert.split(":"); certDialog(bid,+i); });
    const ph=s.querySelector("#c_ph"); if(ph) ph.onclick=()=>phoneSheet("شهادات القيد", [...new Set(certList().map(x=>x.b.id))].map(id=>B.get(id)).map(b=>({bid:b.id,name:b.name,phone:b.phone,code:b.code})));
    bindCalls(s, redraw);
  };
  let mine=-1; const redraw=()=>{ const body=$("#scrim .sh-body"); if(body&&sheetSeq===mine){ body.innerHTML=draw(); mount($("#scrim")); } };
  sheet("شهادات القيد", draw(), mount, redraw); mine=sheetSeq;
}
function certDialog(bid, i, back){
  const b=B.get(bid), k=(b.children||[])[i]; if(!k) return;
  const cur=stageOf(k), nx=nextStage(cur);
  return new Promise(resolve=>{
    const w=document.createElement("div"); w.className="ask-scrim";
    w.innerHTML=`<div class="ask" role="alertdialog" aria-modal="true"><h2>شهادة قيد ${esc(k.name||"")} — ${syLabel(SY)}</h2>
      <p>السنة اللي فاتت: <b>${esc(cur||"مش متسجلة")}</b>. السنة دي بقى في إيه؟</p>
      <label class="f">${stageSelect("cd_s", nx||cur)}</label>
      <div class="bar"><button class="btn pri" data-a="1">${ic("save")}حفظ</button><button class="btn" data-a="0">رجوع</button></div></div>`;
    document.body.appendChild(w);
    const done=async ok=>{ if(!ok){ w.remove(); resolve(false); return; }
      const st=w.querySelector("#cd_s").value; const kids=(B.get(bid).children||[]).map(x=>({...x})); kids[i]={...kids[i], school:st, cert:String(SY)};
      if(await run(sb.from("beneficiaries").update({children:kids}).eq("id",bid),"اتسجلت ✓")){ await logIt("beneficiary",bid,`شهادة قيد ${kids[i].name} ${syLabel(SY)}: ${st}`); await refreshPerson(bid); }
      w.remove(); resolve(true); if(back) back(); };
    w.onclick=e=>{ const a=e.target.closest("[data-a]"); if(a) done(a.dataset.a==="1"); };
  });
}
// One dropdown for every stage. An old free-text value that isn't in the list is kept as its own option.
function stageSelect(id, value, attrs=""){
  const v=normalizeStage(value)||value||"";
  return `<select ${id?`id="${id}"`:""} ${attrs} aria-label="المرحلة الدراسية"><option value=""></option>${v&&!STAGES.includes(v)?`<option selected>${esc(v)}</option>`:""}
    ${STAGE_GROUPS.map(g=>`<optgroup label="${esc(g.g)}">${g.list.map(x=>`<option ${x===v?"selected":""}>${x}</option>`).join("")}</optgroup>`).join("")}</select>`;
}

/* ================= types ================= */
function openType(id){
  const t=id?{...T.get(id)}:{name:"",unit:"جنيه",amount:0,caseTypes:[],cooldown:1,template:"cash",order:types().length+1};
  sheet(id?t.name:"نوع مساعدة جديد",`
    <label class="f">الاسم<input type="text" id="t_name" value="${esc(t.name)}"></label>
    <div class="grid2">
      <label class="f">الوحدة<input type="text" id="t_unit" value="${esc(t.unit)}" list="units"><datalist id="units"><option value="جنيه"><option value="شنطة"><option value="كجم"><option value="قطعة"><option value="وجبة"></datalist></label>
      <label class="f">القيمة الافتراضية للحالة<input type="number" id="t_amt" value="${t.amount}"></label>
      <label class="f">لا يتكرر لنفس الحالة خلال (شهر)<input type="number" min="0" id="t_cd" value="${t.cooldown}"></label>
      <label class="f">شكل الكشف<select id="t_tpl"><option value="cash" ${t.template==="cash"?"selected":""}>نقدي: رقم قومي + مبلغ + توقيع</option><option value="kind" ${t.template==="kind"?"selected":""}>عيني: أفراد الأسرة + كمية + توقيع</option></select></label>
    </div>
    <div class="sub">مين يدخل في النوع ده؟ (لو ما اخترتش حاجة، كل الحالات النشطة)</div>
    <div class="checks">${CASE_TYPES.map(c=>`<label><input type="checkbox" value="${c}" ${t.caseTypes?.includes(c)?"checked":""}> ${c}</label>`).join("")}</div>
    <p class="sub">مثال: «لا يتكرر خلال 1 شهر» يعني اللي أخد في سبتمبر مش هيدخل كشف أكتوبر، ويرجع يدخل من نوفمبر.</p>
    <div class="bar"><button class="btn pri" id="t_save">${ic("save")}حفظ</button>${id?`<button class="btn danger" id="t_del">${ic("archive")}أرشفة النوع</button>`:""}</div>`, s=>{
    s.querySelector("#t_save").onclick=async()=>{
      const name=s.querySelector("#t_name").value.trim(); if(!name){toast("اكتب اسم النوع"); return;}
      const rec={id:id||("t"+Date.now().toString(36)),name,unit:s.querySelector("#t_unit").value.trim()||"جنيه",amount:+s.querySelector("#t_amt").value||0,cooldown:Math.max(0,+s.querySelector("#t_cd").value||0),template:s.querySelector("#t_tpl").value,case_types:[...s.querySelectorAll(".checks input:checked")].map(i=>i.value),sort:t.order??99};
      if(await run(sb.from("aid_types").upsert(rec),"تم الحفظ ✓")){ closeSheet(); refreshTable("aid_types"); }
    };
    const d=s.querySelector("#t_del"); if(d) d.onclick=async()=>{ if(await ask("النوع هيختفي من الكشوف الجديدة، والكشوف القديمة بتاعته تفضل زي ما هي.",{title:"أرشفة نوع المساعدة؟",ok:"أرشفة"})&&await run(sb.from("aid_types").update({archived_at:new Date().toISOString()}).eq("id",id),"اتأرشف ✓")){ closeSheet(); refreshTable("aid_types"); } };
  });
}

/* ================= users ================= */
function newUser(){
  sheet("إضافة موظف",`
    <label class="f">الاسم<input type="text" id="u_n"></label>
    <label class="f">رقم التليفون (هيدخل بيه)<input type="text" id="u_u" inputmode="tel" dir="ltr"></label>
    <label class="f">رقم سري (6 أرقام، والمدير 8)<input type="text" id="u_p" class="pin" inputmode="numeric" dir="ltr" value="${String(Math.floor(100000+Math.random()*900000))}"></label>
    <div class="sub" style="margin-bottom:6px">نوع الحساب</div><div class="roles">${["helper","worker","manager","viewer"].map((r,i)=>`<label class="rolec"><input type="radio" name="u_r" value="${r}" ${i===0?"checked":""}><span><b>${ROLE_AR[r]}</b><small>${ROLE_DESC[r]}</small></span></label>`).join("")}</div>
    <div class="note">ابعت للموظف رقم التليفون والرقم السري ولينك الموقع، وقوله يضيفه على الشاشة الرئيسية.</div>
    <div class="bar"><button class="btn pri" id="u_go">إنشاء الحساب</button></div>`, s=>{
    const q=x=>s.querySelector(x);
    s.querySelectorAll("input[name=u_r]").forEach(r=>r.onchange=()=>{ const n=minPin(r.value); if(q("#u_p").value.length!==n) q("#u_p").value=String(Math.floor(10**(n-1)+Math.random()*9*10**(n-1))); });
    q("#u_go").onclick=async()=>{
      const n=q("#u_n").value.trim(), u=cleanUser(q("#u_u").value), p=q("#u_p").value.trim(), r=s.querySelector("input[name=u_r]:checked").value;
      if(!n||u.length<3||p.length<minPin(r)){ toast(`اكمل البيانات — الرقم السري ${minPin(r)} أرقام على الأقل${r==="manager"?" للمدير":""}`); return; }
      q("#u_go").disabled=true;
      const { data, error } = await sb.functions.invoke("manage-users",{ body:{action:"create", full_name:n, username:u, password:p, role:s.querySelector("input[name=u_r]:checked").value} });
      if(error||data?.error){ q("#u_go").disabled=false; toast(data?.error==="exists"?"الرقم ده عليه حساب فعلاً":errMsg(error||data.error)); return; }
      const msg=`أهلاً ${n}\nده حسابك على نظام جمعية دار الإكرام:\nالرابط: ${location.origin}\nرقم الدخول: ${u}\nالرقم السري: ${p}`;
      sheet("تم إنشاء الحساب ✓",`<textarea class="phones" readonly style="min-height:150px">${esc(msg)}</textarea>
        <div class="bar"><a class="btn pri" target="_blank" rel="noopener" style="text-decoration:none;display:inline-flex;align-items:center" href="https://wa.me/${u.startsWith("01")?"2"+u:""}?text=${encodeURIComponent(msg)}">${ic("chat")}ابعتها واتساب</a></div>`);
      refreshTable("profiles");
    };
  });
}
function openUser(uid){
  const u=P.get(uid); if(!u) return; const self=uid===me.id;
  sheet(u.full_name||u.username,`
    <p class="sub" dir="ltr" style="text-align:end">${esc(u.username||"")}</p>
    <label class="f">الاسم<input type="text" id="e_n" value="${esc(u.full_name)}"></label>
    <label class="f">الصلاحية<select id="e_r" ${self?"disabled":""}>${["helper","worker","manager","viewer","pending"].map(r=>`<option value="${r}" ${u.role===r?"selected":""}>${ROLE_AR[r]}${ROLE_DESC[r]?" — "+ROLE_DESC[r]:""}</option>`).join("")}</select></label>
    <label style="display:flex;gap:8px;align-items:center;margin:6px 0 14px"><input type="checkbox" id="e_a" ${u.active?"checked":""} ${self?"disabled":""} style="width:20px;height:20px"> الحساب شغال</label>
    <div class="bar"><button class="btn pri" id="e_s">${ic("save")}حفظ</button><button class="btn" id="e_pin">${ic("key")}رقم سري جديد</button></div>
    ${self?`<p class="sub">مينفعش تغيّر صلاحية حسابك أو توقفه بنفسك.</p>`:""}`, s=>{
    const q=x=>s.querySelector(x);
    q("#e_s").onclick=async()=>{ if(await run(sb.from("profiles").update({full_name:q("#e_n").value.trim(), ...(self?{}:{role:q("#e_r").value, active:q("#e_a").checked})}).eq("id",uid),"تم الحفظ ✓")){ closeSheet(); refreshTable("profiles"); } };
    q("#e_pin").onclick=async()=>{
      const p=u.role==="manager"?String(Math.floor(10000000+Math.random()*90000000)):String(Math.floor(100000+Math.random()*900000));
      if(!await ask("هيتعمل رقم سري جديد للحساب ده، والقديم مش هيشتغل تاني.",{title:"رقم سري جديد؟",ok:"اعمل رقم جديد"})) return;
      const { data, error } = await sb.functions.invoke("manage-users",{ body:{action:"reset_password", user_id:uid, password:p} });
      if(error||data?.error){ toast(errMsg(error||data.error)); return; }
      const msg=`الرقم السري الجديد لحسابك على نظام دار الإكرام: ${p}`;
      sheet("تم ✓",`<p>الرقم السري الجديد: <b dir="ltr" style="font-size:22px">${p}</b></p><div class="bar"><a class="btn pri" target="_blank" rel="noopener" style="text-decoration:none;display:inline-flex;align-items:center" href="https://wa.me/${(u.username||"").startsWith("01")?"2"+u.username:""}?text=${encodeURIComponent(msg)}">${ic("chat")}ابعته واتساب</a></div>`);
    };
  });
}
function changeMyPin(){
  sheet("تغيير الرقم السري",`<label class="f">الرقم السري الجديد (${minPin(realRole)} أرقام أو أكتر)<input type="password" id="m_p" class="pin" inputmode="numeric" autocomplete="new-password" dir="ltr"></label>
    <label class="f">اكتبه تاني<input type="password" id="m_p2" class="pin" inputmode="numeric" autocomplete="new-password" dir="ltr"></label><div class="bar"><button class="btn pri" id="m_go">حفظ</button></div>`, s=>{
    s.querySelector("#m_go").onclick=async()=>{ const a=s.querySelector("#m_p").value,b=s.querySelector("#m_p2").value; if(a.length<minPin(realRole)){toast(`${minPin(realRole)} أرقام على الأقل`);return;} if(a!==b){toast("الرقمين مش زي بعض");return;}
      const { error } = await sb.auth.updateUser({password:a}); if(error){ toast(errMsg(error)); return; } closeSheet(); toast("اتغيّر ✓"); };
  });
}

/* ================= new batch (the planner) =================
   Everything recalculates as you type: who's in, how much each family gets, how far the quantity goes, and why. */
const DONORS = ["مصر الخير","بنك الطعام","أهل الخير","صدقات","إسلام زوهير","أبلة لبنى"];
function newBatch(){
  if(!isMgr()) return;
  const ts=types(); if(!ts.length){ toast("أضف نوع مساعدة الأول من الإعدادات"); return; }
  const t0=ts[0];
  const st={ typeId:t0.id, month:curMonth, week:"", donor:"", cooldown:0, caseTypes:[...(t0.caseTypes||[])], tag:"",
    mode:t0.template==="kind"&&t0.unit==="وجبة"?"member":"fixed", per:t0.amount||1, cut:3, small:0.5, big:1, total:"", count:"", by:"score", missedFirst:true,
    removed:new Set(), added:[], values:{}, showRest:false, showOut:false };
  const donors=[...new Set([...DONORS, ...batches().map(k=>k.donor).filter(Boolean)])];
  sheet("كشف جديد",`
    <div class="grid2">
      <label class="f">نوع المساعدة<select id="n_t">${ts.map(t=>`<option value="${t.id}">${esc(t.name)} (${esc(t.unit)})</option>`).join("")}</select></label>
      <label class="f">الجهة المتبرعة<input type="text" id="n_d" list="n_dl" placeholder="مثال: مصر الخير"><datalist id="n_dl">${donors.map(d=>`<option value="${esc(d)}">`).join("")}</datalist></label>
      <label class="f">عن شهر<input type="month" id="n_m" value="${st.month}"></label>
      <label class="f">الأسبوع<select id="n_w"><option value="">كل الشهر</option>${[1,2,3,4,5].map(w=>`<option value="${w}">الأسبوع ${w}</option>`).join("")}</select></label>
    </div>
    <h3 style="margin-top:6px">مين يدخل؟</h3>
    <div class="sub">نوع الحالة (لو ما اخترتش حاجة: كل الحالات النشطة)</div>
    <div class="checks" id="n_ct">${CASE_TYPES.map(c=>`<label><input type="checkbox" value="${c}"> ${c}</label>`).join("")}</div>
    <div class="grid2">
      <label class="f">من قايمة متبرع معيّن<select id="n_tag"><option value="">كل القوايم</option>${allTags().map(t=>`<option>${esc(t)}</option>`).join("")}</select></label>
      <label class="f">استبعاد اللي أخد قريب<select id="n_cd"><option value="0">مفيش استبعاد — الكل يدخل</option>${[1,2,3,6,12].map(n=>`<option value="${n}">اللي أخد نفس النوع خلال آخر ${n} شهر</option>`).join("")}</select></label>
    </div>
    <h3>كل أسرة تاخد كام؟</h3>
    <div class="modes" role="radiogroup">
      <label class="rolec"><input type="radio" name="n_mode" value="fixed"><span><b>نفس الكمية لكل أسرة</b><small><input type="number" id="n_per_f" min="0" step="any" class="mini"> <span class="u"></span> لكل أسرة</small></span></label>
      <label class="rolec"><input type="radio" name="n_mode" value="member"><span><b>حسب عدد الأفراد</b><small><input type="number" id="n_per_m" min="0" step="any" class="mini"> <span class="u"></span> لكل فرد — مثال: وجبة لكل فرد</small></span></label>
      <label class="rolec"><input type="radio" name="n_mode" value="tiers"><span><b>شرائح</b><small>لحد <input type="number" id="n_cut" min="1" class="mini"> أفراد = <input type="number" id="n_small" min="0" step="any" class="mini"> <span class="u"></span>، وأكتر = <input type="number" id="n_big" min="0" step="any" class="mini"> <span class="u"></span></small></span></label>
    </div>
    <div class="grid2">
      <label class="f">الكمية المتاحة (فاضي = يكفي الكل)<input type="number" id="n_total" min="0" step="any" placeholder="مثال: 300"></label>
      <label class="f">أو أقصى عدد أسر (اختياري)<input type="number" id="n_count" min="1" placeholder="مثال: 50"></label>
      <label class="f">لو مش هتكفي، مين الأول؟<select id="n_by">${Object.entries(PRIORITY).map(([k,v])=>`<option value="${k}">${v}</option>`).join("")}</select></label>
      <label class="f" style="display:flex;gap:8px;align-items:center;margin-top:22px"><input type="checkbox" id="n_missed" checked style="width:20px;height:20px"> اللي ماجاش يستلم المرة اللي فاتت ياخد أولوية</label>
    </div>
    <div id="n_res"></div>`, s=>{
    const q=x=>s.querySelector(x);
    const fillType=()=>{ const t=T.get(st.typeId); s.querySelectorAll(".u").forEach(u=>u.textContent=t.unit); s.querySelectorAll("#n_ct input").forEach(i=>i.checked=st.caseTypes.includes(i.value)); };
    const put=()=>{ q("#n_t").value=st.typeId; q("#n_m").value=st.month; q("#n_w").value=st.week; q("#n_d").value=st.donor; q("#n_cd").value=st.cooldown; q("#n_tag").value=st.tag;
      s.querySelector(`input[name=n_mode][value=${st.mode}]`).checked=true; q("#n_per_f").value=st.per; q("#n_per_m").value=st.per; q("#n_cut").value=st.cut; q("#n_small").value=st.small; q("#n_big").value=st.big;
      q("#n_total").value=st.total; q("#n_count").value=st.count; q("#n_by").value=st.by; q("#n_missed").checked=st.missedFirst; fillType(); };
    const read=()=>{ const prevType=st.typeId; st.typeId=q("#n_t").value; st.month=q("#n_m").value||curMonth; st.week=q("#n_w").value; st.donor=q("#n_d").value.trim(); st.cooldown=+q("#n_cd").value||0; st.tag=q("#n_tag").value;
      st.mode=s.querySelector("input[name=n_mode]:checked")?.value||"fixed"; st.per=+(st.mode==="member"?q("#n_per_m"):q("#n_per_f")).value||0; st.cut=+q("#n_cut").value||3; st.small=+q("#n_small").value||0; st.big=+q("#n_big").value||0;
      st.total=q("#n_total").value; st.count=q("#n_count").value; st.by=q("#n_by").value; st.missedFirst=q("#n_missed").checked;
      st.caseTypes=[...s.querySelectorAll("#n_ct input:checked")].map(i=>i.value);
      if(prevType!==st.typeId){ const t=T.get(st.typeId); st.per=t.amount||1; st.caseTypes=[...(t.caseTypes||[])]; st.removed.clear(); st.added=[]; st.values={}; put(); } };
    put();
    let tm=null; s.addEventListener("input",e=>{ if(e.target.closest("#n_res")) return; clearTimeout(tm); tm=setTimeout(()=>{ read(); draw(); },150); });
    // Text boxes already redraw on "input"; redrawing again on their "change" (fired on blur) would swap out the button being clicked.
    s.addEventListener("change",e=>{ if(e.target.closest("#n_res")||/^(text|number|search|month)$/.test(e.target.type)) return; read(); draw(); });
    let plan=null;
    function compute(){
      const t=T.get(st.typeId), basis={mode:st.mode, per:st.per, cut:st.cut, small:st.small, big:st.big};
      const c=candidates(t,{month:st.month, week:+st.week||null, cooldown:st.cooldown, caseTypes:st.caseTypes, tag:st.tag});
      const sorted=sortPool(c.pool.filter(x=>!st.removed.has(x.b.id)), st.by, st.missedFirst);
      const r=planShares(sorted, basis, { total:st.total===""?null:+st.total, count:st.count===""?null:+st.count });
      const added=st.added.map(id=>B.get(id)).filter(Boolean).map(b=>({b, lm:lastByType(t.id).get(b.id), fam:famSize(b), value:shareFor(basis,famSize(b)), manual:true}));
      const picked=[...r.picked, ...added].map(x=>({...x, value:st.values[x.b.id]??x.value}));
      return { t, basis, c, r, picked, all:c.pool.length };
    }
    function draw(){
      plan=compute(); const { t, c, r, picked }=plan, u=esc(t.unit);
      const used=picked.reduce((a,x)=>a+(+x.value||0),0), mem=picked.reduce((a,x)=>a+(x.fam||1),0);
      const noSize=picked.filter(x=>!x.fam).length, need=c.pool.reduce((a,x)=>a+shareFor(plan.basis,famSize(x.b)),0);
      const sizes=[1,2,3,4,5,6].map(n=>c.pool.filter(x=>n<6?famSize(x.b)===n:famSize(x.b)>=6).length), unknown=c.pool.filter(x=>!famSize(x.b)).length;
      const rule=`الترتيب: ${st.missedFirst?"اللي ماجاش يستلم المرة اللي فاتت، بعدين ":""}${PRIORITY[st.by]}${st.by==="score"?" (ولو الدرجة زي بعض: الأسرة الأكبر)":""}.`;
      q("#n_res").innerHTML=`
        <div class="plan">
          <div class="plan-big"><div><span>هتكفي</span><strong>${num(picked.length)}</strong><small>أسرة</small></div><div><span>يعني</span><strong>${num(mem)}</strong><small>فرد</small></div><div><span>المطلوب</span><strong>${num(Math.round(used*100)/100)}</strong><small>${u}</small></div>${st.total!==""?`<div class="${+st.total-used<0?"neg":""}"><span>يفضل</span><strong>${num(Math.round((+st.total-used)*100)/100)}</strong><small>${u}</small></div>`:""}</div>
          <p>المؤهلين <b>${num(c.pool.length)}</b> أسرة${st.total!==""||st.count!==""?` — لو كلهم هيحتاجوا ${num(Math.round(need*100)/100)} ${u}`:""}.${r.rest.length?` <b>${num(r.rest.length)}</b> أسرة مش هيلحقوا المرة دي.`:""}${c.excluded.length?` واتستبعد ${num(c.excluded.length)} (تحت).`:""}</p>
          <p class="sub">${esc(rule)}${noSize?` · ${num(noSize)} أسرة عدد أفرادها مش متسجل واتحسبت فرد واحد.`:""}</p>
          <table class="sizes"><thead><tr><th>عدد الأفراد</th>${["1","2","3","4","5","6+"].map(x=>`<th>${x}</th>`).join("")}${unknown?"<th>مش متسجل</th>":""}</tr></thead><tbody><tr><td>عدد الأسر</td>${sizes.map(n=>`<td>${num(n)}</td>`).join("")}${unknown?`<td>${num(unknown)}</td>`:""}</tr></tbody></table>
        </div>
        <input type="search" id="n_add" placeholder="ضيف حالة بإيدك بالاسم أو الرقم"><div id="n_sugg" style="margin-top:8px"></div>
        <div class="tbl"><table><thead><tr><th>م</th><th>الاسم</th><th>ليه هنا</th><th>أفراد</th><th>${u}</th><th></th></tr></thead><tbody>
        ${picked.map((x,i)=>`<tr><td class="n">${i+1}</td><td>${esc(x.b.name)}<div class="sub">${esc(x.b.code)}</div></td><td class="why">${x.manual?"إضافة بإيدك · ":""}${esc(whyLine(x,t))}</td><td class="n">${x.fam||"؟"}</td>
          <td><input type="number" step="any" data-v="${x.b.id}" value="${x.value}" class="mini" aria-label="الكمية"></td><td><button class="btn sm danger" data-rm="${x.b.id}" aria-label="شيل">×</button></td></tr>`).join("")||`<tr><td colspan="6" class="empty">مفيش حد — غيّر الشروط اللي فوق</td></tr>`}
        </tbody></table></div>
        ${r.rest.length?`<button class="btn sm" id="n_restT" style="margin-top:10px">${st.showRest?"اخفي":"اعرض"} اللي مش هيلحقوا (${num(r.rest.length)})</button>${st.showRest?`<div class="list" style="margin-top:8px">${r.rest.map(x=>`<div class="item"><span class="code">${esc(x.b.code)}</span><span class="grow">${esc(x.b.name)}<br><span class="sub">${esc(whyLine({...x,fam:famSize(x.b)},t))} · نصيبها ${num(x.value)} ${u}</span></span><button class="btn sm" data-addr="${x.b.id}">ضيف</button></div>`).join("")}</div>`:""}`:""}
        ${c.excluded.length?`<button class="btn sm" id="n_outT" style="margin-top:10px">${st.showOut?"اخفي":"اعرض"} المستبعدين (${num(c.excluded.length)})</button>${st.showOut?`<div class="list" style="margin-top:8px">${c.excluded.map(x=>`<div class="item"><span class="code">${esc(x.b.code)}</span><span class="grow">${esc(x.b.name)}<br><span class="sub">${esc(x.why)}</span></span><button class="btn sm" data-addr="${x.b.id}">ضيف</button></div>`).join("")}</div>`:""}`:""}
        <div class="bar" style="margin-top:16px"><button class="btn pri" id="n_save" ${picked.length?"":"disabled"}>${ic("save")}حفظ كمسودة (${num(picked.length)} أسرة)</button></div>`;
      const R=q("#n_res");
      R.querySelectorAll("[data-rm]").forEach(el=>el.onclick=()=>{ const id=el.dataset.rm; st.added=st.added.filter(x=>x!==id); st.removed.add(id); draw(); });
      R.querySelectorAll("[data-v]").forEach(el=>el.onchange=()=>{ st.values[el.dataset.v]=+el.value||0; draw(); });
      R.querySelectorAll("[data-addr]").forEach(el=>el.onclick=()=>{ const id=el.dataset.addr; st.removed.delete(id); if(!st.added.includes(id)) st.added.push(id); draw(); });
      const rt=q("#n_restT"); if(rt) rt.onclick=()=>{ st.showRest=!st.showRest; draw(); };
      const ot=q("#n_outT"); if(ot) ot.onclick=()=>{ st.showOut=!st.showOut; draw(); };
      const add=q("#n_add"); add.oninput=()=>{
        const qq=norm(add.value); if(!qq){ q("#n_sugg").innerHTML=""; return; }
        const inIds=new Set(plan.picked.map(x=>x.b.id));
        const res=people().filter(b=>!inIds.has(b.id)&&(norm(b.name).includes(qq)||(b.nationalId||"").includes(qq)||b.code===qq.padStart(3,"0"))).slice(0,6);
        q("#n_sugg").innerHTML=`<div class="list" style="margin-bottom:10px">${res.map(b=>`<button class="item" data-addr="${b.id}"><span class="code">${esc(b.code)}</span><span class="grow nm">${esc(b.name)}</span>${b.status!=="نشط"?`<span class="chip red">${esc(b.status)}</span>`:""}</button>`).join("")||`<div class="empty">لا نتائج</div>`}</div>`;
        q("#n_sugg").querySelectorAll("[data-addr]").forEach(el=>el.onclick=()=>{ const id=el.dataset.addr; st.removed.delete(id); if(!st.added.includes(id)) st.added.push(id); draw(); });
      };
      q("#n_save").onclick=async()=>{
        const sv=q("#n_save"); sv.disabled=true; sv.innerHTML=`<span class="spin"></span>`;
        const week=+st.week||null;
        const title=`كشف ${t.name}${st.donor?` (${st.donor})`:""} — ${mLabel(st.month)}${week?` · الأسبوع ${week}`:""}`;
        const k=await run(sb.from("batches").insert({title,type_id:t.id,type_name:t.name,unit:t.unit,template:t.template,month:st.month,week,donor:st.donor,status:"مسودة",cooldown:st.cooldown,
          basis:{...plan.basis, total:st.total===""?null:+st.total, by:st.by, missedFirst:st.missedFirst}, created_by:me.id}).select("id").single());
        if(!k){ sv.disabled=false; draw(); return; }
        const rows=plan.picked.map((x,i)=>toI(itemFor(x.b,+x.value||0,(x.manual?"إضافة بإيدك · ":"")+whyLine(x,t)),k.id,i));
        for(let i=0;i<rows.length;i+=500){ if(!await run(sb.from("batch_items").insert(rows.slice(i,i+500)))) break; }
        await logIt("batch",k.id,`إنشاء الكشف (${rows.length} أسرة · ${num(rows.reduce((a,r)=>a+r.value,0))} ${t.unit}) — ${rule}`);
        toast("تم حفظ الكشف كمسودة ✓"); view="batches"; await refreshBatch(k.id); openBatch(k.id);
      };
    }
    draw();
  });
}

/* ================= batch detail ================= */
function basisText(k){
  const b=k.basis||{}, u=k.unit;
  const how=b.mode==="member"?`${num(b.per)} ${u} لكل فرد`:b.mode==="tiers"?`لحد ${b.cut} أفراد ${num(b.small)} ${u}، وأكتر ${num(b.big)} ${u}`:b.mode==="fixed"?`${num(b.per)} ${u} لكل أسرة`:"";
  return [how&&"النصيب: "+how, b.total!=null&&b.total!==undefined?`من ${num(b.total)} ${u} متاحين`:"", b.by&&"الأولوية: "+(b.missedFirst?"اللي ماجاش المرة اللي فاتت، بعدين ":"")+(PRIORITY[b.by]||"")].filter(Boolean).join(" · ");
}
function openBatch(id, giveMode){
  let q_="", logs=null, only="all";
  const draw=()=>{
    const k=K.get(id); if(!k) return "";
    const items=k.items; const total=items.reduce((s,i)=>s+(+i.value||0),0); const rec=items.filter(i=>i.received).length; const draft=k.status==="مسودة";
    const qq=norm(q_); const shown=items.map((it,i)=>({it,i})).filter(({it})=>!qq||norm(it.name).includes(qq)||String(it.code)===qq||(it.nationalId||"").includes(qq))
      .filter(({it})=>only==="all"||(only==="left"?!it.received:only==="nocall"?!it.received&&!(it.bid&&lastCall(it.bid,k.id)):true));
    const members=items.reduce((a,i)=>a+(+i.familySize||1),0);
    return `
    <div class="row" style="margin-bottom:10px">${statusChip(k.status)}<span class="sub">${mLabel(k.month)}${k.week?` · الأسبوع ${k.week}`:""}${k.donor?` · ${esc(k.donor)}`:""} · ${num(items.length)} أسرة (${num(members)} فرد) · ${num(total)} ${esc(k.unit)}${!draft?` · <b>استلم ${rec} من ${items.length}</b>`:""}</span></div>
    ${k.basis?`<p class="sub" style="margin-top:-4px">${esc(basisText(k))}</p>`:""}
    ${draft?`<div class="note">المسودة مش بتتحسب في سجل المساعدات، والموظفين مش شايفينها. راجع الأسماء واضغط «اعتماد».</div>`:""}
    <div class="bar">
      ${draft&&isMgr()?`<button class="btn pri" id="b_ok">${ic("check")}اعتماد الكشف</button>`:""}
      ${k.status==="معتمد"&&isMgr()?`<button class="btn gold" id="b_paid">تم الصرف بالكامل</button><button class="btn" id="b_back">إرجاع لمسودة</button>`:""}
      <button class="btn" id="b_print">${ic("printer")}طباعة</button><button class="btn" id="b_phones">${ic("phone")}أرقام</button><button class="btn" id="b_xlsx">Excel</button>
      ${isMgr()?`<button class="btn danger" id="b_del">${ic("archive")}أرشفة</button>`:""}
    </div>
    <input type="search" id="b_q" placeholder="دوّر في الكشف بالاسم أو الرقم" value="${esc(q_)}" style="margin-bottom:10px">
    ${!draft?`<div class="seg" role="group" aria-label="عرض">${[["all","الكل"],["left",`ماستلموش (${num(items.length-rec)})`],["nocall","ماحدش كلّمهم"]].map(([v,l])=>`<button class="${only===v?"on":""}" data-only="${v}">${l}</button>`).join("")}</div>`:""}
    ${!draft?`<div class="list">${shown.map(({it,i})=>`
      <div class="give ${it.received?"done":rowCallCls(it.bid,k.id)}"><span class="code">${i+1}</span><span class="grow"><span class="nm">${esc(it.name)}</span><br><span class="sub">${esc(it.code)} · ${esc(k.template==="cash"?it.nationalId:(it.familySize?it.familySize+" أفراد":""))} · ${num(it.value)} ${esc(k.unit)}</span></span>
      ${!it.received&&it.bid?callCell(it.bid,it.phone||B.get(it.bid)?.phone,k.id):""}
      ${canWrite()?`${it.pending?`<small class="pend">${ic("refresh")}مستني النت</small>`:""}<button class="gb" data-rc="${it.id}" aria-pressed="${it.received}">${it.received?"استلم ✓":"سلّم"}</button>`:it.received?`<span class="chip">استلم</span>`:""}</div>`).join("")||`<div class="empty">مفيش نتيجة</div>`}</div>`
    :`<div class="tbl"><table><thead><tr><th>م</th><th>الاسم</th><th>${k.template==="cash"?"الرقم القومي":"أفراد"}</th><th>${k.template==="cash"?"المبلغ":"الكمية"}</th><th></th></tr></thead><tbody>
      ${shown.map(({it,i})=>`<tr><td class="n">${i+1}</td><td>${esc(it.name)}<div class="why">${esc(it.code)} · ${esc(it.reason||"")}</div></td><td class="n">${esc(k.template==="cash"?it.nationalId:it.familySize)}</td><td class="n">${num(it.value)}</td><td>${isMgr()?`<button class="btn sm danger" data-rm="${it.id}" aria-label="استبعاد">×</button>`:""}</td></tr>`).join("")}
    </tbody></table></div>`}
    ${logs&&logs.length?`<h3>سجل الكشف</h3><ul class="log">${logs.slice(0,20).map(l=>`<li><b>${dLabel(l.at)}</b> — ${esc(l.text)}${l.by?` (${esc(who(l.by))})`:""}</li>`).join("")}</ul>`:""}`;
  };
  const upd=async(patch,text,okMsg)=>{ if(await run(sb.from("batches").update(patch).eq("id",id),okMsg)){ await logIt("batch",id,text); logs=await loadLog("batch",id); await refreshBatch(id); } };
  const mount=s=>{
    const q=x=>s.querySelector(x);
    if(q("#b_ok")) q("#b_ok").onclick=()=>upd({status:"معتمد",approved_at:new Date().toISOString(),approved_by:me.id},"اعتماد الكشف","اتعتمد ✓");
    if(q("#b_paid")) q("#b_paid").onclick=()=>upd({status:"مصروف",paid_at:new Date().toISOString()},"إغلاق الكشف — تم الصرف","تمام ✓");
    if(q("#b_back")) q("#b_back").onclick=()=>upd({status:"مسودة"},"إرجاع لمسودة");
    s.querySelectorAll("[data-only]").forEach(el=>el.onclick=()=>{ only=el.dataset.only; refreshSheet(); });
    bindCalls(s, ()=>refreshSheet());
    if(q("#b_del")) q("#b_del").onclick=async()=>{ const kk=K.get(id); if(await ask(kk.status==="مسودة"?"المسودة هتختفي من القوايم، وتفضل محفوظة في الأرشيف.":"الكشف هيختفي من القوايم، وماحدش هيتحسب إنه استلمه منه لحد ما ترجّعه.\nتلاقيه في «الإعدادات ← الأرشيف» وترجّعه في أي وقت.",{title:"أرشفة الكشف؟",ok:"أرشفة"})&&await run(sb.from("batches").update({archived_at:new Date().toISOString(),archived_by:me.id}).eq("id",id),"اتأرشف ✓")){ await logIt("batch",id,"أرشفة الكشف"); closeSheet(); refreshBatch(id); } };
    s.querySelectorAll("[data-rm]").forEach(el=>el.onclick=async()=>{ const it=K.get(id).items.find(x=>x.id===el.dataset.rm); if(await run(sb.from("batch_items").delete().eq("id",it.id))){ await logIt("batch",id,`استبعاد ${it.name}`); refreshBatch(id); } });
    s.querySelectorAll("[data-rc]").forEach(el=>el.onclick=async()=>{
      const it=K.get(id).items.find(x=>x.id===el.dataset.rc); const v=!it.received;
      if(!v&&!await ask(`${it.name} هيرجع «ماستلمش».`,{title:"إلغاء الاستلام؟",ok:"إلغاء الاستلام",danger:true})) return;
      const r=await markReceived(it,v);
      if(r==="ok"&&v) toast(`${it.name} — استلم ✓`); if(r==="queued") toast(`${it.name} — اتسجل، وهيترفع لما النت يرجع`); logCache.delete("batch"+id);
    });
    const bq=q("#b_q"); bq.oninput=()=>{ q_=bq.value; const pos=bq.selectionStart; refreshSheet(); const n=$("#b_q"); if(n){n.focus(); n.setSelectionRange(pos,pos);} };
    q("#b_print").onclick=()=>doPrint(batchHTML(K.get(id)),K.get(id).title);
    q("#b_phones").onclick=()=>{ const k=K.get(id); phoneSheet(k.title,k.items.map(it=>({bid:it.bid,name:it.name,phone:it.phone||B.get(it.bid)?.phone,code:it.code,done:it.received})),counts(k),k.id); };
    q("#b_xlsx").onclick=()=>batchXlsx(K.get(id));
  };
  if(!K.get(id)) return;
  let mine=-1;
  const redraw=()=>{ const body=$("#scrim .sh-body"); if(body&&K.get(id)&&sheetSeq===mine){ body.innerHTML=draw(); mount($("#scrim")); } };
  sheet(K.get(id).title, draw(), mount, redraw); mine=sheetSeq;
  if(giveMode) setTimeout(()=>$("#b_q")?.focus(),60);
  loadLog("batch",id).then(l=>{ logs=l; redraw(); });
}

/* ================= phone lists ================= */
function phoneChooser(){
  const ts=types();
  sheet("قائمة أرقام — لمين؟",`
    <p class="sub" style="margin-top:0">اختار المجموعة، وهيطلعلك الأسماء والأرقام تبعتها واتساب أو تنزلها على الموبايل.</p>
    <div class="list">
      <button class="item" data-ph="active"><span class="grow nm">كل الحالات النشطة</span></button>
      ${CASE_TYPES.filter(c=>c!=="غير محدد").map(c=>`<button class="item" data-ph="type:${c}"><span class="grow nm">حالات ${c}</span></button>`).join("")}
      <button class="item" data-ph="waiting"><span class="grow nm">حالات الانتظار</span></button>
      <button class="item" data-ph="due"><span class="grow nm">محتاجة مراجعة / بحث ميداني</span></button>
      ${batches().filter(counts).slice(0,8).map(k=>`<button class="item" data-ph="batch:${k.id}"><span class="grow"><span class="nm">${esc(k.title)}</span><br><span class="sub">اللي في الكشف ده</span></span></button>`).join("")}
      ${ts.map(t=>`<button class="item" data-ph="not:${t.id}"><span class="grow nm">لم يستلموا ${esc(t.name)} آخر 3 شهور</span></button>`).join("")}
    </div>`, s=>{
    s.querySelectorAll("[data-ph]").forEach(el=>el.onclick=()=>{
      const [kind,arg]=el.dataset.ph.split(/:(.*)/s); const Pm=b=>({bid:b.id,name:b.name,phone:b.phone,code:b.code});
      if(kind==="active") phoneSheet("كل الحالات النشطة", people().filter(b=>b.status==="نشط").map(Pm));
      if(kind==="type") phoneSheet(`حالات ${arg}`, people().filter(b=>b.status==="نشط"&&b.caseType===arg).map(Pm));
      if(kind==="waiting") phoneSheet("حالات الانتظار", people().filter(b=>b.status==="انتظار").map(Pm));
      if(kind==="due") phoneSheet("محتاجة مراجعة", people().filter(reviewDue).map(Pm));
      if(kind==="batch"){ const k=K.get(arg); phoneSheet(k.title,k.items.map(it=>({bid:it.bid,name:it.name,phone:it.phone||B.get(it.bid)?.phone,code:it.code,done:it.received})),true,k.id); }
      if(kind==="not"){ const t=T.get(arg); phoneSheet(`لم يستلموا ${t.name}`, notReceived(t,3).map(({b})=>Pm(b))); }
    });
  });
}
function phoneSheet(title, rows, hasDone, batchId){
  let onlyPending=!!hasDone;
  const build=()=>{ const list=rows.filter(r=>!onlyPending||!r.done); const ok=list.filter(r=>validPhone(r.phone)); const bad=list.filter(r=>!validPhone(r.phone)); return {ok,bad,text:`${title}\n\n`+ok.map((r,i)=>`${i+1}- ${r.name}: ${cleanPhone(r.phone)}`).join("\n")}; };
  const draw=()=>{ const {ok,bad,text}=build(); return `
    <div class="note green">${num(ok.length)} رقم صالح${bad.length?` · <b>${num(bad.length)}</b> بدون رقم أو رقم غلط (تحت)`:""}</div>
    ${hasDone?`<label style="display:flex;gap:8px;align-items:center;margin-bottom:10px"><input type="checkbox" id="ph_p" ${onlyPending?"checked":""} style="width:20px;height:20px"> اللي لسه ما استلموش بس</label>`:""}
    <p class="sub" style="margin-top:0">اضغط ${ic("phone")} يفتحلك الاتصال على طول — مش محتاج تسجّل الأرقام. لما تخلص اختار: ردّت / ماردتش / رقم غلط، والصف بيتلوّن.</p>
    <div class="list calls">${ok.map(r=>`<div class="item ${r.bid?rowCallCls(r.bid,batchId):""}"><span class="code">${esc(r.code)}</span><span class="grow"><span class="nm">${esc(r.name)}</span><br><span class="sub" dir="ltr" style="text-align:end;display:block">${esc(cleanPhone(r.phone))}</span></span>${r.bid?callCell(r.bid,r.phone,batchId):`<a class="cdial" href="tel:${cleanPhone(r.phone)}">${ic("phone")}</a>`}</div>`).join("")||`<div class="empty">مفيش أرقام</div>`}</div>
    <details style="margin-top:14px"><summary class="sub">نسخ القائمة / واتساب / Excel / تسجيل الأرقام على الموبايل</summary>
    <div class="bar">
      <button class="btn" id="ph_copy">${ic("copy")} نسخ القائمة</button>
      <a class="btn" id="ph_wa" target="_blank" rel="noopener" style="text-decoration:none;display:inline-flex;align-items:center">${ic("chat")}إرسال واتساب</a>
      <button class="btn" id="ph_vcf">${ic("user")}تسجيل الأرقام على الموبايل (.vcf)</button>
      <button class="btn" id="ph_x">Excel</button>
    </div>
    <textarea class="phones" id="ph_t" readonly aria-label="القائمة">${esc(text)}</textarea></details>
    ${bad.length?`<h3>من غير رقم صالح</h3><div class="list">${bad.map(r=>`<div class="item"><span class="code">${esc(r.code)}</span><span class="grow">${esc(r.name)}</span><span class="sub">${esc(r.phone||"لا يوجد")}</span></div>`).join("")}</div>`:""}`; };
  const mount=s=>{
    const q=x=>s.querySelector(x); const {ok,text}=build();
    if(q("#ph_p")) q("#ph_p").onchange=e=>{ onlyPending=e.target.checked; q(".sh-body").innerHTML=draw(); mount(s); };
    bindCalls(s, ()=>{ const b=q(".sh-body"); if(b){ const sc=b.scrollTop; b.innerHTML=draw(); mount(s); b.scrollTop=sc; } });
    q("#ph_wa").href="https://wa.me/?text="+encodeURIComponent(text.length>6000?text.slice(0,6000)+"\n…":text);
    q("#ph_copy").onclick=async()=>{ try{ await navigator.clipboard.writeText(text); toast("اتنسخت ✓ الصقها في واتساب"); }catch(e){ const ta=q("#ph_t"); ta.focus(); ta.select(); try{ document.execCommand("copy"); toast("اتنسخت ✓"); }catch(_){ toast("علّم النص واضغط نسخ"); } } };
    q("#ph_vcf").onclick=()=>{ const v=ok.map(r=>`BEGIN:VCARD\r\nVERSION:3.0\r\nFN:دار الإكرام - ${r.name}\r\nN:${r.name};دار الإكرام;;;\r\nTEL;TYPE=CELL:${cleanPhone(r.phone)}\r\nNOTE:حالة رقم ${r.code}\r\nEND:VCARD`).join("\r\n"); saveFile(`${title}.vcf`, new Blob([v],{type:"text/vcard"})); };
    q("#ph_x").onclick=()=>{ const rs=[["م","رقم الحالة","الاسم","التليفون"]]; ok.forEach((r,i)=>rs.push([i+1,r.code,r.name,cleanPhone(r.phone)])); xlsx({"أرقام":rs},`أرقام ${title}.xlsx`,[5,10,32,16]); };
  };
  sheet(title, draw(), mount);
}

/* ================= printing ================= */
const PRINT_CSS=`
.ps{font-family:"Baloo Bhaijaan 2",Tahoma,sans-serif;color:#000;direction:rtl;font-size:12.5px}
.ps .hd{display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #962A25;padding-bottom:8px;margin-bottom:10px}
.ps .orgw{display:flex;align-items:center;gap:10px}.ps .orgw img{width:62px;height:auto}
.ps .org{font-family:"Baloo Bhaijaan 2",Tahoma,sans-serif;font-size:20px;font-weight:800;line-height:1.3;color:#962A25}
.ps .org small{display:block;font-family:"Baloo Bhaijaan 2",Tahoma,sans-serif;font-size:12px;font-weight:400;color:#000}
.ps h1{text-align:center;font-size:17px;margin:6px 0 2px}.ps .mo{text-align:center;margin-bottom:10px}
.ps table{width:100%;border-collapse:collapse;margin-bottom:10px}
.ps th,.ps td{border:1px solid #000;padding:5px 6px;text-align:center}.ps th{background:#eee}
.ps td.nm,.ps td.l{text-align:right}.ps .sig{height:26px;min-width:90px}
.ps .tot{margin-top:10px;display:flex;gap:30px;font-weight:600}
.ps .signs{display:flex;justify-content:space-between;gap:16px;margin-top:26px;page-break-inside:avoid}.ps .signs div{text-align:center;flex:1;font-weight:700}
.ps .signs span{display:block;height:34px}.ps .signs em{display:flex;align-items:flex-end;gap:6px;font-style:normal;font-weight:400;margin-top:10px}
.ps .signs em i{flex:1;border-bottom:1px solid #000;height:1em}
.ps h1 small{font-size:13px;font-weight:400}.ps tfoot td{font-weight:700;background:#f3f3f3}
.ps h2{font-size:14px;margin:14px 0 6px;border-bottom:1px solid #000}
.ps .kv td:nth-child(odd){background:#f3f3f3;font-weight:600;width:18%}
@page{size:A4;margin:12mm}
thead{display:table-header-group} tr{page-break-inside:avoid}`;
(()=>{ const st=document.createElement("style"); st.textContent="@media print{"+PRINT_CSS+"}"; document.head.appendChild(st); })();
const hdr=()=>{ const d=new Date(); return `<div class="hd"><div class="orgw"><img src="${$("#logoImg").src}" alt=""><div class="org">${ORG}<small>${ORG2}</small></div></div><div>التاريخ: ${d.getDate()}/${d.getMonth()+1}/${d.getFullYear()}</div></div>`; };
// Same layout as the office's Excel lists: م · الاسم · الرقم القومي · عدد · الكمية · التوقيع, then the committee's signatures.
const SIGNERS = ["لجنة التوزيع","أمين الصندوق","مجلس الإدارة"];
const signsHTML = () => `<div class="signs">${SIGNERS.map(x=>`<div>${x}<span></span><em>الاسم: <i></i></em><em>التوقيع: <i></i></em></div>`).join("")}</div>`;
function batchHTML(k){
  const cash=k.template==="cash"; const total=k.items.reduce((s,i)=>s+(+i.value||0),0); const mem=k.items.reduce((s,i)=>s+(+i.familySize||0),0);
  return `<div class="ps">${hdr()}<h1>${k.single?"إيصال صرف":"كشف صرف"} ${esc(k.typeName)}${k.donor?` <small>(${esc(k.donor)})</small>`:""}</h1><div class="mo">عن شهر ${mLabel(k.month)}${k.week?` — الأسبوع ${k.week}`:""}</div>
    <table><thead><tr><th>م</th><th>رقم الحالة</th><th>الاسم</th><th>الرقم القومي</th><th>عدد الأفراد</th><th>${cash?"المبلغ بالجنيه":"الكمية ("+esc(k.unit)+")"}</th><th>التوقيع</th></tr></thead><tbody>
    ${k.items.map((it,i)=>`<tr><td>${i+1}</td><td>${esc(it.code)}</td><td class="nm">${esc(it.name)}</td><td>${esc(it.nationalId)}</td><td>${esc(it.familySize)}</td><td>${num(it.value)}</td><td class="sig"></td></tr>`).join("")}
    </tbody><tfoot><tr><td colspan="4">الإجمالي: ${num(k.items.length)} أسرة</td><td>${num(mem)}</td><td>${num(total)}</td><td></td></tr></tfoot></table>
    ${signsHTML()}</div>`;
}
function caseHTML(b,logs){
  const hist=receipts().filter(r=>r.bid===b.id).sort((a,c)=>c.month.localeCompare(a.month));
  const kv=pairs=>`<table class="kv"><tbody>${pairs.reduce((rows,p,i)=>{ if(i%2===0) rows.push([p]); else rows[rows.length-1].push(p); return rows; },[]).map(r=>`<tr>${r.map(([l,v])=>`<td>${l}</td><td class="l">${esc(v??"")}</td>`).join("")}${r.length<2?"<td></td><td></td>":""}</tr>`).join("")}</tbody></table>`;
  return `<div class="ps">${hdr()}<h1>ملف حالة رقم ${esc(b.code)}</h1><div class="mo">${esc(b.status)} · ${esc(b.caseType||"غير محدد")}</div>
    <h2>البيانات الأساسية</h2>
    ${kv([["الاسم",b.name],["الرقم القومي",b.nationalId],["تاريخ الميلاد",b.birth],["السن",age(b.birth)],["التليفون",cleanPhone(b.phone)],["تليفون تاني",b.phone2],["الحالة الاجتماعية",b.marital],["المشروع",b.project],["العمل",b.job],["الدخل",b.income],["المعاش",b.pension],["السكن",b.housing],["أفراد الأسرة",b.familySize],["التقدير",b.grade],["آخر مراجعة",b.lastReview],["المراجعة الجاية",b.nextReview]])}
    ${kv([["العنوان",b.address||b.area],["ملاحظات",b.notes]])}
    <h2>الأبناء</h2><table><thead><tr><th>م</th><th>الاسم</th><th>النوع</th><th>تاريخ الميلاد</th><th>السن</th><th>المرحلة الدراسية</th></tr></thead><tbody>
    ${(b.children||[]).map((k,i)=>`<tr><td>${i+1}</td><td class="nm">${esc(k.name)}</td><td>${esc(k.gender)}</td><td>${esc(k.birth)}</td><td>${age(k.birth)}</td><td>${esc(k.school)}</td></tr>`).join("")||`<tr><td colspan="6">لا يوجد</td></tr>`}</tbody></table>
    <h2>سجل المساعدات</h2><table><thead><tr><th>الشهر</th><th>النوع</th><th>القيمة</th><th>استلم</th></tr></thead><tbody>
    ${hist.map(r=>`<tr><td>${mLabel(r.month)}</td><td>${esc(r.typeName)}</td><td>${num(r.value)} ${esc(r.unit)}</td><td>${r.received?"✓":""}</td></tr>`).join("")||`<tr><td colspan="4">لا يوجد</td></tr>`}</tbody></table>
    <h2>سجل التغييرات</h2><table><tbody>${logs.slice(0,20).map(l=>`<tr><td style="width:22%">${dLabel(l.at)}</td><td class="l">${esc(l.text)}</td></tr>`).join("")||`<tr><td>لا يوجد</td></tr>`}</tbody></table>
    <div class="signs"><div>الباحث الاجتماعي<span></span></div><div>مجلس الإدارة<span></span></div></div></div>`;
}
function doPrint(html){ $("#print").innerHTML=html; setTimeout(()=>window.print(),50); }

/* ================= excel / files ================= */
function batchXlsx(k){
  const cash=k.template==="cash";
  const rows=[[ORG],[ORG2],[`${k.single?"إيصال صرف":"كشف صرف"} ${k.typeName}${k.donor?` (${k.donor})`:""}`],[`عن شهر ${mLabel(k.month)}${k.week?` — الأسبوع ${k.week}`:""}`],[],["م","رقم الحالة","الاسم","الرقم القومي","عدد الأفراد",cash?"المبلغ بالجنيه":"الكمية","التليفون","استلم","سبب الإدراج","التوقيع"]];
  k.items.forEach((it,i)=>rows.push([i+1,it.code,it.name,it.nationalId,+it.familySize||"",+it.value||0,cleanPhone(it.phone),it.received?"✓":"",it.reason||"",""]));
  rows.push(["الإجمالي","",`${k.items.length} أسرة`,"",k.items.reduce((s,i)=>s+(+i.familySize||0),0),k.items.reduce((s,i)=>s+(+i.value||0),0)],[],SIGNERS.flatMap(x=>[x,"",""]),SIGNERS.flatMap(()=>["التوقيع: ..........","",""]));
  xlsx({"كشف":rows},`${k.title||k.typeName}.xlsx`,[5,10,30,18,10,12,14,7,30,16]);
}
function peopleRows(list){
  const rows=[["رقم الحالة","الاسم","الرقم القومي","تاريخ الميلاد","السن","التليفون","تليفون 2","نوع الحالة","الحالة","الحالة الاجتماعية","المشروع","المنطقة","العنوان","العمل","الدخل","المعاش","السكن","أفراد الأسرة","عدد الأبناء","التقدير","آخر مراجعة","المراجعة الجاية","ملاحظات"]];
  list.forEach(b=>rows.push([b.code,b.name,b.nationalId||"",b.birth||"",age(b.birth),cleanPhone(b.phone),b.phone2||"",b.caseType||"",b.status,b.marital||"",b.project||"",b.area||"",b.address||"",b.job||"",b.income||"",b.pension||"",b.housing||"",b.familySize??"",(b.children||[]).length||"",b.grade||"",b.lastReview||"",b.nextReview||"",b.notes||""]));
  return rows;
}
function backup(){
  const kids=[["رقم الحالة","الأم / المستفيد","اسم الابن","النوع","تاريخ الميلاد","السن","الدراسة"]];
  people().forEach(b=>(b.children||[]).forEach(k=>kids.push([b.code,b.name,k.name,k.gender,k.birth,age(k.birth),k.school])));
  const give=[["الشهر","النوع","الكشف","الحالة","رقم الحالة","الاسم","القيمة","الوحدة","استلم","تاريخ الاستلام"]];
  batches().forEach(k=>k.items.forEach(it=>give.push([k.month,k.typeName,k.title,k.status,it.code,it.name,+it.value||0,k.unit,it.received?"✓":"",it.receivedAt?it.receivedAt.slice(0,10):""])));
  xlsx({"الحالات":peopleRows(people()),"الأبناء":kids,"سجل الصرف":give},`نسخة احتياطية دار الإكرام ${today}.xlsx`);
}
// The Excel library is ~900 KB — loaded on first export only, not on every page load.
let xlsxLoading=null;
const loadXlsx=()=>window.XLSX?Promise.resolve():(xlsxLoading||=new Promise((res,rej)=>{ const sc=document.createElement("script"); sc.src="vendor/xlsx.full.min.js"; sc.onload=res; sc.onerror=()=>{ xlsxLoading=null; rej(new Error("xlsx")); }; document.head.appendChild(sc); }));
async function xlsx(sheets,filename,widths){
  try{ if(!window.XLSX){ toast("بنجهّز ملف Excel…"); await loadXlsx(); } }catch(e){ toast("مقدرناش نجهّز Excel — جرّب تاني"); return; }
  const wb=XLSX.utils.book_new(); wb.Workbook={Views:[{RTL:true}]};
  for(const [name,rows] of Object.entries(sheets)){ const ws=XLSX.utils.aoa_to_sheet(rows); ws["!cols"]=(widths||rows[0].map(()=>16)).map(w=>({wch:w})); XLSX.utils.book_append_sheet(wb,ws,name); }
  saveFile(filename, new Blob([XLSX.write(wb,{bookType:"xlsx",type:"array"})],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}));
}
async function saveFile(filename,blob){
  filename=filename.replace(/[\\/:*?"<>|]/g,"-");
  const file=new File([blob],filename,{type:blob.type});
  if(/Android|iPhone|iPad/i.test(navigator.userAgent) && navigator.canShare?.({files:[file]})){ try{ await navigator.share({files:[file],title:filename}); return; }catch(e){ if(e.name==="AbortError") return; } }
  const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download=filename; document.body.appendChild(a); a.click(); setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); },1500);
}

/* ================= boot ================= */
try{ if(localStorage.getItem("big")) document.body.classList.add("big"); }catch(e){}
document.querySelectorAll("#tabs button").forEach(b=>b.onclick=()=>{ view=b.dataset.v; window.scrollTo(0,0); render(); });
if("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(()=>{});
sb.auth.onAuthStateChange((ev)=>{ if(ev==="SIGNED_OUT"){ me=null; } });
netBanner();
boot();
