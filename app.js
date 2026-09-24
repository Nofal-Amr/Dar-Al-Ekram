(() => {
/* ================= config ================= */
const SUPABASE_URL = "https://jvgxldhshbyyuftjgfrw.supabase.co";
const SUPABASE_KEY = "sb_publishable_yS3OzVszjySNzCaRAyWpQA_pmKoPZJT";
const DOMAIN = "daralekram.app";
const ORG = "جمعية دار الإكرام للخدمات الاجتماعية";
const ORG2 = "المشهرة برقم 1401 لسنة 2009";
const MONTHS = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
const CASE_TYPES = ["أيتام","مساعدات","مرضي","أيتام ومرضي","كفالات","غير محدد"];
const STATUSES = ["نشط","انتظار","موقوف","ملغي"];
const MARITAL = ["أرملة","مطلقة","متزوجة","مهجورة","آنسة","أرمل","متزوج","مطلق"];
const ROLE_AR = {manager:"مدير", worker:"موظف", helper:"عامل", viewer:"مشاهدة فقط", pending:"مستني تفعيل"};
const ROLE_DESC = {manager:"كل حاجة: يعتمد الكشوف ويحذف ويضيف موظفين", worker:"موظف مكتب: يضيف ويعدّل الحالات ويطبع ويشوف التقارير", helper:"شاشة بسيطة بزراير كبيرة: يسلّم ويتصل ويطبع بس", viewer:"يشوف بس من غير أي تعديل"};

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: true, autoRefreshToken: true } });

/* ================= state ================= */
let me = null;              // {id, full_name, username, role, active}
let role = "worker", realRole = "worker";
const B = new Map(), T = new Map(), K = new Map(), P = new Map();   // beneficiaries, types, batches(with items), profiles
let loaded = false, view = "home", peopleQ = "", peopleF = "all";
const logCache = new Map();

/* ================= helpers ================= */
const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const num = n => (+n || 0).toLocaleString("en-US");
const now = new Date();
const today = new Date(now.getTime() - now.getTimezoneOffset()*60000).toISOString().slice(0,10);
const curMonth = today.slice(0,7);
const mIdx = m => { const [y,mm] = m.split("-").map(Number); return y*12 + (mm-1); };
const mLabel = m => { if(!m) return ""; const [y,mm] = m.split("-").map(Number); return `${MONTHS[mm-1]} ${y}`; };
const dLabel = d => { if(!d) return "—"; const x = new Date(d); if(isNaN(x)) return d; return `${x.getDate()} ${MONTHS[x.getMonth()]} ${x.getFullYear()}`; };
const addDays = (d,n) => { const x = new Date(d); x.setDate(x.getDate()+n); return x.toISOString().slice(0,10); };
const age = d => { if(!d) return ""; const b = new Date(d); if(isNaN(b)) return ""; let a = now.getFullYear()-b.getFullYear(); if(now < new Date(now.getFullYear(), b.getMonth(), b.getDate())) a--; return a; };
const norm = s => String(s||"").replace(/[أإآ]/g,"ا").replace(/ى/g,"ي").replace(/ة/g,"ه").replace(/\s+/g," ").trim();
const gradeRank = g => ({A:0,B:1,C:2}[g] ?? 3);
const isMgr = () => role === "manager";
const canWrite = () => role === "manager" || role === "worker";
const simple = () => role === "helper";
const cleanPhone = p => { let d = String(p||"").replace(/\D/g,""); if(d.startsWith("20") && d.length===12) d = d.slice(1); if(d.length===10 && d.startsWith("1")) d = "0"+d; return d; };
const validPhone = p => /^01[0125]\d{8}$/.test(cleanPhone(p));
const cleanUser = u => String(u||"").trim().toLowerCase().replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d)).replace(/[^a-z0-9._-]/g,"");
const who = id => id ? (P.get(id)?.full_name || P.get(id)?.username || "مستخدم") : "";

function toast(msg){ const t = document.createElement("div"); t.className = "toast"; t.setAttribute("role","status"); t.textContent = msg; document.body.appendChild(t); setTimeout(() => t.remove(), 3200); }
function errMsg(e){
  const m = String(e?.message || e || "");
  if(/row-level security|permission|not allowed|violates/i.test(m)) return "مش مسموحلك تعمل ده";
  if(/duplicate key.*national_id/i.test(m)) return "الرقم القومي ده متسجل لحالة تانية";
  if(/duplicate key.*code/i.test(m)) return "رقم الحالة ده مستخدم قبل كده";
  if(/Failed to fetch|NetworkError|network/i.test(m)) return "مفيش إنترنت — جرّب تاني";
  return "حصلت مشكلة: " + m.slice(0,120);
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
  familySize:r.family_size, status:r.status, lastReview:r.last_review||"", nextReview:r.next_review||"", notes:r.notes||"", children:r.children||[], source:r.source, createdAt:r.created_at, updatedAt:r.updated_at });
const toB = b => ({ code:b.code, name:b.name, national_id:b.nationalId||null, phone:b.phone||null, phone2:b.phone2||null, birth:b.birth||null, case_type:b.caseType||"", grade:b.grade||"", score:b.score ?? null,
  project:b.project||"", area:b.area||"", address:b.address||"", marital:b.marital||"", job:b.job||"", income:b.income||"", pension:b.pension||"", housing:b.housing||"",
  family_size:b.familySize ?? null, status:b.status, last_review:b.lastReview||null, next_review:b.nextReview||null, notes:b.notes||"", children:b.children||[] });
const fromT = r => ({ id:r.id, name:r.name, unit:r.unit, amount:+r.amount, caseTypes:r.case_types||[], cooldown:r.cooldown, template:r.template, order:r.sort });
const fromK = (r, items) => ({ id:r.id, title:r.title, typeId:r.type_id, typeName:r.type_name, unit:r.unit, template:r.template, month:r.month, status:r.status, single:r.single, cooldown:r.cooldown,
  createdAt:r.created_at, createdBy:r.created_by, approvedAt:r.approved_at, approvedBy:r.approved_by, items:(items||[]).sort((a,b)=>a.position-b.position).map(fromI) });
const fromI = r => ({ id:r.id, bid:r.beneficiary_id, code:r.code, name:r.name, nationalId:r.national_id||"", phone:r.phone||"", familySize:r.family_size||"", value:+r.value, reason:r.reason||"", received:r.received, receivedAt:r.received_at, receivedBy:r.received_by });
const toI = (it, batchId, i) => ({ batch_id:batchId, beneficiary_id:it.bid||null, position:i, code:it.code, name:it.name, national_id:it.nationalId||null, phone:it.phone||null, family_size:+it.familySize||null, value:+it.value||0, reason:it.reason||"", received:!!it.received, received_at:it.received?new Date().toISOString():null });

/* ================= loading ================= */
async function fetchAll(table, select="*"){
  const out = []; let from = 0;
  for(;;){ const { data, error } = await sb.from(table).select(select).range(from, from+999); if(error) throw error; out.push(...data); if(data.length < 1000) break; from += 1000; }
  return out;
}
let reloading = null;
async function reload(){
  if(reloading) return reloading;
  reloading = (async () => {
    try{
      const [bs, ts, ks, is, ps] = await Promise.all([fetchAll("beneficiaries"), fetchAll("aid_types"), fetchAll("batches"), fetchAll("batch_items"), fetchAll("profiles")]);
      B.clear(); bs.forEach(r => B.set(r.id, fromB(r)));
      T.clear(); ts.forEach(r => T.set(r.id, fromT(r)));
      const byBatch = {}; is.forEach(r => (byBatch[r.batch_id] ||= []).push(r));
      K.clear(); ks.forEach(r => K.set(r.id, fromK(r, byBatch[r.id])));
      P.clear(); ps.forEach(r => P.set(r.id, r));
      loaded = true; render(); refreshSheet();
    }catch(e){ toast(errMsg(e)); }
    finally{ reloading = null; }
  })();
  return reloading;
}
let rt = null, rtTimer = null;
function subscribeRealtime(){
  if(rt) return;
  rt = sb.channel("all-changes");
  ["beneficiaries","batches","batch_items","aid_types"].forEach(t => rt.on("postgres_changes", {event:"*", schema:"public", table:t}, () => { clearTimeout(rtTimer); rtTimer = setTimeout(reload, 700); }));
  rt.subscribe();
}

/* ================= domain ================= */
const types = () => [...T.values()].sort((a,b)=>(a.order??99)-(b.order??99));
const people = () => [...B.values()].sort((a,b)=>String(a.code).localeCompare(String(b.code),"en",{numeric:true}));
const batches = () => [...K.values()].sort((a,b)=>(b.month||"").localeCompare(a.month||"") || (b.createdAt||"").localeCompare(a.createdAt||""));
const counts = k => ["معتمد","مصروف"].includes(k.status);
function receipts(){ const out=[]; for(const k of K.values()){ if(!counts(k)) continue; for(const it of k.items) out.push({bid:it.bid,typeId:k.typeId,typeName:k.typeName,unit:k.unit,month:k.month,value:it.value,received:it.received,receivedAt:it.receivedAt,batchId:k.id}); } return out; }
function lastByType(typeId){ const m=new Map(); for(const r of receipts()) if(r.typeId===typeId && r.bid){ const p=m.get(r.bid); if(!p||r.month>p) m.set(r.bid,r.month);} return m; }
function eligible(t,b){ if(b.status!=="نشط") return false; if(!t.caseTypes||!t.caseTypes.length) return true; return t.caseTypes.includes(b.caseType||"غير محدد"); }
function reviewDue(b){ if(b.status!=="نشط"&&b.status!=="انتظار") return false; if(b.nextReview) return b.nextReview<=today; if(!b.lastReview) return true; return addDays(b.lastReview,365)<=today; }
function kidsTurning18(b){ return (b.children||[]).filter(k=>{ const a=age(k.birth); return a!==""&&a>=17&&a<18; }); }
const itemFor = (b,value,reason) => ({bid:b.id,code:b.code,name:b.name,nationalId:b.nationalId||"",phone:b.phone||"",familySize:b.familySize||"",value,received:false,reason});
function propose(t,month,count,cooldown){
  const last=lastByType(t.id); const taken=new Set();
  for(const k of K.values()) if(k.typeId===t.id&&k.month===month) k.items.forEach(i=>taken.add(i.bid));
  const pool=[]; let excludedRecent=0, excludedSame=0;
  for(const b of people()){
    if(!eligible(t,b)) continue;
    if(taken.has(b.id)){excludedSame++; continue;}
    const lm=last.get(b.id);
    if(lm&&cooldown>0&&(mIdx(month)-mIdx(lm))<=cooldown){excludedRecent++; continue;}
    pool.push({b,lm});
  }
  pool.sort((x,y)=>{
    if(!x.lm!==!y.lm) return x.lm?1:-1;
    if(x.lm&&y.lm&&x.lm!==y.lm) return x.lm.localeCompare(y.lm);
    const g=gradeRank(x.b.grade)-gradeRank(y.b.grade); if(g) return g;
    const s=(y.b.score??-1)-(x.b.score??-1); if(s) return s;
    return String(x.b.code).localeCompare(String(y.b.code),"en",{numeric:true});
  });
  const picked=pool.slice(0,count).map(({b,lm})=>itemFor(b,t.amount,(lm?`آخر ${t.name}: ${mLabel(lm)}`:`لم يستلم ${t.name} من قبل`)+(b.grade?` · تقدير ${b.grade}`:"")));
  return {picked,poolSize:pool.length,excludedRecent,excludedSame};
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
    <label class="f">رقم سري (6 أرقام أو أكتر)<input type="password" id="s_p" class="pin" inputmode="numeric" autocomplete="new-password" dir="ltr"></label>
    <button class="btn pri" id="s_go">إنشاء حساب المدير</button>`);
  $("#s_go").onclick = async () => {
    const n=$("#s_n").value.trim(), u=cleanUser($("#s_u").value), p=$("#s_p").value;
    if(!n||u.length<3||p.length<6){ toast("اكمل البيانات — الرقم السري 6 أرقام على الأقل"); return; }
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
  const { data:prof } = await sb.from("profiles").select("*").eq("id", session.user.id).single();
  me = prof;
  if(!me || !me.active || !["manager","worker","helper","viewer"].includes(me.role)){
    showAuth(`<h1>حسابك مش مفعّل</h1><p class="c">كلّم مدير الجمعية يفعّل حسابك.</p><button class="btn" id="lo">خروج</button>`);
    $("#lo").onclick = async () => { await sb.auth.signOut(); loginScreen(); };
    return;
  }
  role = realRole = me.role;
  $("#auth").hidden = true; $("#app").hidden = false;
  setWho(); render();
  await reload();
  subscribeRealtime();
}
function setWho(){
  $("#who").innerHTML = `<b style="background:${navigator.onLine?"#2E9E6B":"var(--red)"}"></b>${esc((me?.full_name||"").split(" ")[0])}<br>${ROLE_AR[role]}${realRole!==role?" (معاينة)":""}`;
  document.querySelectorAll("[data-mgr]").forEach(b => b.hidden = !isMgr());
}
function netBanner(){ $("#net").innerHTML = navigator.onLine ? "" : `<div class="offline">مفيش إنترنت — التعديلات مش هتتحفظ لحد ما النت يرجع</div>`; if(me) setWho(); }
window.addEventListener("online", () => { netBanner(); if(me) reload(); });
window.addEventListener("offline", netBanner);

/* ================= render ================= */
function render(){
  if(!me) return;
  document.body.classList.toggle("simple", simple());
  document.body.classList.toggle("wide", innerWidth>=900);
  document.querySelectorAll("#tabs button").forEach(b=>b.classList.toggle("act",b.dataset.v===view));
  const v=$("#view");
  if(!loaded){ v.innerHTML=`<div class="empty"><span class="spin"></span> جاري تحميل البيانات…</div>`; return; }
  if(simple()){ v.innerHTML=vSimple(); bindSimple(); return; }
  v.innerHTML = view==="home"?vDash(): view==="people"?vPeople(): view==="batches"?vBatches(): view==="reports"?vReports(): vSettings();
  bindView();
}
function vHome(){
  const approved=batches().filter(k=>k.status==="معتمد");
  const drafts=batches().filter(k=>k.status==="مسودة");
  const due=people().filter(reviewDue);
  const turning=people().filter(b=>b.status==="نشط"&&kidsTurning18(b).length);
  const pending=[...P.values()].filter(p=>p.role==="pending"&&p.active);
  return `
  <h2>أهلاً ${esc((me.full_name||"").split(" ")[0])} — تحب تعمل إيه؟</h2>
  <div class="tiles">
    <button class="tile pri" data-go="search"><span class="ic">🔍</span><strong>ابحث عن حالة</strong><small>بالاسم أو الرقم القومي</small></button>
    <button class="tile" data-go="give"><span class="ic">✅</span><strong>تسليم مساعدة</strong><small>علّم مين استلم</small></button>
    <button class="tile" data-go="print"><span class="ic">🖨️</span><strong>اطبع كشف</strong><small>كشوف جاهزة للطباعة</small></button>
    <button class="tile" data-go="phones"><span class="ic">📞</span><strong>قائمة أرقام</strong><small>تبعتها لحد يتصل</small></button>
    ${canWrite()?`<button class="tile" data-go="add"><span class="ic">➕</span><strong>حالة جديدة</strong><small>تسجيل أسرة جديدة</small></button>`:""}
    ${isMgr()?`<button class="tile" data-go="newbatch"><span class="ic">📋</span><strong>كشف صرف جديد</strong><small>النظام يختار الأسماء</small></button>`:""}
  </div>
  ${isMgr()?`
    ${pending.length?`<button class="alert" data-go="users"><span>👤</span><span class="grow">${num(pending.length)} حساب مستني تفعيل</span><span>‹</span></button>`:""}
    ${drafts.length?`<button class="alert" data-go="batches"><span>📝</span><span class="grow">${num(drafts.length)} كشف مسودة مستني اعتمادك</span><span>‹</span></button>`:""}
    ${due.length?`<button class="alert red" data-go="due"><span>📅</span><span class="grow">${num(due.length)} حالة محتاجة مراجعة / بحث ميداني</span><span>‹</span></button>`:""}
    ${turning.length?`<button class="alert" data-go="turning"><span>🎂</span><span class="grow">${num(turning.length)} أسرة فيها ابن هيكمل 18 سنة خلال السنة</span><span>‹</span></button>`:""}
  `:""}
  <h3>كشوف جاهزة للصرف</h3>
  <div class="list">${approved.length?approved.map(batchRow).join(""):`<div class="empty">مفيش كشوف معتمدة حالياً</div>`}</div>`;
}
function batchRow(k){
  const total=k.items.reduce((s,i)=>s+(+i.value||0),0); const rec=k.items.filter(i=>i.received).length;
  return `<button class="item" data-batch="${k.id}"><span class="grow"><span class="nm">${esc(k.title||k.typeName)}</span><br>
    <span class="sub">${mLabel(k.month)} · ${num(k.items.length)} حالة · ${num(total)} ${esc(k.unit)}${counts(k)?` · استلم ${rec} من ${k.items.length}`:""}</span></span>${statusChip(k.status)}</button>`;
}
const statusChip = s => `<span class="chip ${s==="مسودة"?"grey":s==="معتمد"?"blue":"gold"}">${esc(s)}</span>`;
function filteredPeople(){
  const q=norm(peopleQ);
  let list=people().filter(b=>peopleF==="all"?true: peopleF==="due"?reviewDue(b): STATUSES.includes(peopleF)?b.status===peopleF:(b.caseType||"غير محدد")===peopleF);
  if(q) list=list.filter(b=>norm(b.name).includes(q)||(b.nationalId||"").includes(q)||(q.replace(/^0/,"").length>3&&cleanPhone(b.phone).includes(q.replace(/^0/,"")))||String(b.code)===q.padStart(3,"0")||String(b.code)===q);
  return list;
}
function vPeople(){
  const all=people(); const list=filteredPeople();
  return `
  <div class="row" style="margin-bottom:10px">
    <input type="search" id="pq" placeholder="🔍 اكتب الاسم أو الرقم القومي أو التليفون" value="${esc(peopleQ)}" style="flex:1 1 220px">
    <select id="pf" style="width:auto;flex:0 0 auto" aria-label="تصفية">
      <option value="all">الكل (${num(all.length)})</option>
      <option value="due" ${peopleF==="due"?"selected":""}>محتاجة مراجعة</option>
      <optgroup label="الحالة">${STATUSES.map(s=>`<option ${peopleF===s?"selected":""}>${s}</option>`).join("")}</optgroup>
      <optgroup label="النوع">${CASE_TYPES.map(s=>`<option ${peopleF===s?"selected":""}>${s}</option>`).join("")}</optgroup>
    </select>
  </div>
  <div class="row" style="margin-bottom:8px"><span class="sub grow">${num(list.length)} حالة</span>
    <button class="btn sm" id="pPhones">📞 أرقام القائمة دي</button>
    ${isMgr()?`<button class="btn sm" id="pX">تنزيل Excel</button>`:""}
    ${canWrite()?`<button class="btn sm pri" id="addP">➕ حالة جديدة</button>`:""}
  </div>
  ${innerWidth>=900&&list.length?`<div class="tbl dt"><table><thead><tr><th>رقم</th><th>الاسم</th><th>الرقم القومي</th><th>التليفون</th><th>النوع</th><th>الحالة</th><th>أفراد</th><th>آخر مراجعة</th><th>آخر استلام</th></tr></thead><tbody>
    ${(()=>{ const lastAny=new Map(); receipts().forEach(r=>{ const p=lastAny.get(r.bid); if(!p||r.month>p) lastAny.set(r.bid,r.month); }); return list.slice(0,800).map(b=>`<tr data-open="${b.id}" tabindex="0"><td class="n">${esc(b.code)}</td><td><b>${esc(b.name)}</b></td><td class="n">${esc(b.nationalId)}</td><td class="n">${esc(cleanPhone(b.phone))}</td><td>${esc(b.caseType||"—")}</td><td><span class="chip ${b.status==="نشط"?"":b.status==="ملغي"?"red":"gold"}">${esc(b.status)}</span></td><td class="n">${b.familySize??"—"}</td><td class="n">${reviewDue(b)?`<span class="chip red">${b.lastReview?dLabel(b.lastReview):"مفيش"}</span>`:dLabel(b.lastReview)}</td><td class="n">${lastAny.get(b.id)?mLabel(lastAny.get(b.id)):"—"}</td></tr>`).join(""); })()}
  </tbody></table></div>`:""}
  <div class="list" ${innerWidth>=900&&list.length?"hidden":""}>${list.length?list.slice(0,500).map(b=>`
    <button class="item" data-open="${b.id}">
      <span class="code">${esc(b.code)}</span>
      <span class="grow"><span class="nm">${esc(b.name)}</span><br><span class="sub">${esc(b.nationalId||"بدون رقم قومي")}${b.familySize?` · ${b.familySize} أفراد`:""}</span></span>
      ${reviewDue(b)?`<span class="chip red">مراجعة</span>`:""}
      ${b.caseType?`<span class="chip">${esc(b.caseType)}</span>`:""}
      ${b.status!=="نشط"?`<span class="chip ${b.status==="ملغي"?"red":"gold"}">${esc(b.status)}</span>`:""}
    </button>`).join(""):`<div class="empty">${all.length?"مفيش نتيجة — جرّب جزء من الاسم بس":"لا توجد حالات بعد"}</div>`}
  </div>`;
}
function vBatches(){
  const list=batches();
  return `
  <div class="row" style="justify-content:space-between;margin-bottom:12px"><h2 style="margin:0">كشوف الصرف</h2>${isMgr()?`<button class="btn pri" id="newK">📋 كشف جديد</button>`:""}</div>
  <div class="list">${list.length?list.map(batchRow).join(""):`<div class="empty">${isMgr()?"لا توجد كشوف بعد. اضغط «كشف جديد».":"مفيش كشوف معتمدة لسه"}</div>`}</div>`;
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
    <button class="btn sm" id="rP" ${notList.length?"":"disabled"}>📞 أرقامهم</button><button class="btn sm" id="rX" ${notList.length?"":"disabled"}>Excel</button></div>
  <div class="tbl" style="max-height:320px;overflow-y:auto"><table><thead><tr><th>رقم</th><th>الاسم</th><th>النوع</th><th>آخر استلام</th></tr></thead><tbody>
  ${notList.map(({b,lm})=>`<tr><td class="n">${esc(b.code)}</td><td><a href="#" data-open="${b.id}">${esc(b.name)}</a></td><td>${esc(b.caseType||"—")}</td><td class="n">${lm?mLabel(lm):"لم يستلم"}</td></tr>`).join("")||`<tr><td colspan="4" class="empty">لا يوجد</td></tr>`}
  </tbody></table></div>
  <h3>محتاجة مراجعة / بحث ميداني (${num(due.length)})</h3>
  <p class="sub" style="margin-top:0">حالة معادها جه، أو ماتراجعتش من أكتر من سنة، أو ماتسجلش لها تاريخ مراجعة.</p>
  <div class="row" style="margin-bottom:6px"><span class="grow"></span><button class="btn sm" id="dueP" ${due.length?"":"disabled"}>📞 أرقامهم</button></div>
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
  <div class="bar"><button class="btn pri" id="newU">➕ إضافة موظف</button></div>
  <div class="note green">${["manager","worker","helper","viewer"].map(r=>`• <b>${ROLE_AR[r]}</b>: ${ROLE_DESC[r]}`).join("<br>")}<br>الصلاحيات دي مقفولة من قاعدة البيانات نفسها.</div>
  <div class="bar"><button class="btn" data-preview="worker">👁️ شوف شاشة الموظف</button><button class="btn" data-preview="helper">👁️ شوف شاشة العامل</button></div>
  <h3>أنواع المساعدات</h3>
  <div class="list">${types().map(t=>`
    <button class="item" data-type="${t.id}"><span class="grow"><span class="nm">${esc(t.name)}</span><br>
      <span class="sub">${num(t.amount)} ${esc(t.unit)} للحالة · ${t.cooldown>0?`لا يتكرر خلال ${t.cooldown} شهر`:"بدون قيد تكرار"} · ${t.caseTypes?.length?esc(t.caseTypes.join("، ")):"كل الحالات النشطة"}</span></span>
      <span class="chip ${t.template==="cash"?"":"blue"}">${t.template==="cash"?"نقدي":"عيني"}</span></button>`).join("")}
  </div>
  <div class="bar"><button class="btn pri" id="newT">➕ نوع مساعدة جديد</button></div>
  <h3>نسخة احتياطية</h3>
  <p class="sub" style="margin-top:0">نزّل كل الحالات وكل الصرف في ملف Excel واحد.</p>
  <div class="bar"><button class="btn" id="backup">⬇️ تنزيل نسخة احتياطية</button></div>`:(realRole==="manager"?`<div class="bar"><button class="btn" data-preview="manager">↩️ رجوع لشاشة المدير</button></div>`:"")}
  <h3>التطبيق على الموبايل</h3>
  <div class="note">افتح الموقع من Chrome على الموبايل ← القايمة (⋮) ← <b>«إضافة إلى الشاشة الرئيسية»</b> أو «تثبيت التطبيق». هيظهر أيقونة الجمعية زي أي أبلكيشن.<br>على iPhone: من Safari ← زرار المشاركة ← «إضافة إلى الشاشة الرئيسية».</div>
  <h3>العرض</h3>
  <div class="bar"><button class="btn" id="bigText">${document.body.classList.contains("big")?"خط عادي":"🔠 تكبير الخط"}</button></div>
  <h3>الحساب</h3>
  <div class="bar"><button class="btn" id="myPin">🔑 تغيير الرقم السري</button><button class="btn danger" id="logout">خروج</button></div>`;
}
function bindView(){
  const v=$("#view");
  v.querySelectorAll("[data-open]").forEach(el=>el.onclick=e=>{e.preventDefault(); viewPerson(el.dataset.open);});
  v.querySelectorAll("tr[data-open]").forEach(el=>el.onkeydown=e=>{ if(e.key==="Enter") viewPerson(el.dataset.open); });
  v.querySelectorAll("[data-batch]").forEach(el=>el.onclick=()=>openBatch(el.dataset.batch));
  v.querySelectorAll("[data-type]").forEach(el=>el.onclick=()=>openType(el.dataset.type));
  v.querySelectorAll("[data-user]").forEach(el=>el.onclick=()=>openUser(el.dataset.user));
  v.querySelectorAll("[data-go]").forEach(el=>el.onclick=()=>go(el.dataset.go));
  const on=(id,ev,fn)=>{const el=$(id); if(el) el[ev]=fn;};
  on("#pq","oninput",e=>{peopleQ=e.target.value; const pos=e.target.selectionStart; render(); const n=$("#pq"); n.focus(); n.setSelectionRange(pos,pos);});
  on("#pf","onchange",e=>{peopleF=e.target.value; render();});
  on("#addP","onclick",()=>editPerson(null));
  on("#pPhones","onclick",()=>phoneSheet("الحالات المعروضة", filteredPeople().map(b=>({name:b.name,phone:b.phone,code:b.code}))));
  on("#pX","onclick",()=>xlsx({"الحالات":peopleRows(filteredPeople())},"الحالات.xlsx"));
  on("#newK","onclick",()=>newBatch());
  on("#newT","onclick",()=>openType(null));
  on("#newU","onclick",()=>newUser());
  on("#rT","onchange",e=>{rep.typeId=e.target.value; render();});
  on("#rN","onchange",e=>{rep.months=+e.target.value; render();});
  on("#rM","onchange",e=>{ if(e.target.value){rep.month=e.target.value; render();} });
  on("#rP","onclick",()=>{const t=T.get(rep.typeId); phoneSheet(`لم يستلموا ${t.name} — آخر ${rep.months} شهر`, notReceived(t,rep.months).map(({b})=>({name:b.name,phone:b.phone,code:b.code})));});
  on("#rX","onclick",()=>{const t=T.get(rep.typeId); const rows=[["م","رقم الحالة","الاسم","الرقم القومي","التليفون","النوع","آخر استلام"]]; notReceived(t,rep.months).forEach(({b,lm},i)=>rows.push([i+1,b.code,b.name,b.nationalId||"",cleanPhone(b.phone),b.caseType||"",lm?mLabel(lm):"لم يستلم"])); xlsx({"كشف":rows},`لم يستلموا ${t.name} - آخر ${rep.months} شهر.xlsx`);});
  on("#dueP","onclick",()=>phoneSheet("حالات محتاجة مراجعة", people().filter(reviewDue).map(b=>({name:b.name,phone:b.phone,code:b.code}))));
  v.querySelectorAll("[data-preview]").forEach(el=>el.onclick=()=>setPreview(el.dataset.preview));
  on("#bigText","onclick",()=>{ document.body.classList.toggle("big"); try{localStorage.setItem("big",document.body.classList.contains("big")?"1":"");}catch(e){} render(); });
  on("#backup","onclick",backup);
  on("#qaSearch","onclick",()=>go("search"));
  on("#logout","onclick",async()=>{ if(!confirm("تخرج من الحساب؟")) return; await sb.auth.signOut(); me=null; loaded=false; if(rt){ sb.removeChannel(rt); rt=null; } loginScreen(); });
  on("#myPin","onclick",changeMyPin);
}
function go(what){
  if(what==="search"){ view="people"; render(); setTimeout(()=>$("#pq")?.focus(),50); }
  else if(what==="add") editPerson(null);
  else if(what==="newbatch") newBatch();
  else if(what==="batches"){ view="batches"; render(); }
  else if(what==="users"){ view="settings"; render(); }
  else if(what==="due"){ view="people"; peopleF="due"; render(); }
  else if(what==="people-active"){ view="people"; peopleF="نشط"; render(); }
  else if(what==="turning"){ view="reports"; render(); }
  else if(what==="give"||what==="print"){
    const list=batches().filter(k=>k.status==="معتمد"||(what==="print"&&k.status==="مصروف"));
    sheet(what==="give"?"اختار الكشف اللي بتسلّمه":"اختار الكشف اللي هتطبعه", list.length?`<div class="list">${list.map(batchRow).join("")}</div>`:`<div class="empty">مفيش كشوف معتمدة لسه. المدير لازم يعتمد الكشف الأول.</div>`, s=>{
      s.querySelectorAll("[data-batch]").forEach(el=>el.onclick=()=>openBatch(el.dataset.batch, what==="give"));
    });
  }
  else if(what==="phones") phoneChooser();
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
      <button class="btn" id="qaSearch">🔍 بحث</button>
      ${canWrite()?`<button class="btn" data-go="add">➕ حالة جديدة</button>`:""}
      ${isMgr()?`<button class="btn pri" data-go="newbatch">📋 كشف صرف جديد</button>`:""}
      <button class="btn" data-go="phones">📞 قائمة أرقام</button>
    </div></div>
  <div class="kpis">
    <button class="kpi" data-go="people-active"><span>حالات نشطة</span><strong>${num(active.length)}</strong><small>من ${num(all.length)} · ${num(waiting)} انتظار</small></button>
    <button class="kpi ${due.length?"warn":""}" data-go="due"><span>محتاجة مراجعة</span><strong>${num(due.length)}</strong><small>ميعادها جه أو من غير تاريخ</small></button>
    <div class="kpi"><span>صرف ${MONTHS[now.getMonth()]}</span><strong>${num(cashMonth)} <em>ج</em></strong><small>${num(famMonth)} أسرة استفادت</small></div>
    ${isMgr()?`<button class="kpi ${drafts.length?"warn":""}" data-go="batches"><span>مسودات مستنية اعتماد</span><strong>${num(drafts.length)}</strong><small>${num(approved.length)} كشف معتمد شغال</small></button>`:`<div class="kpi"><span>كشوف شغالة</span><strong>${num(approved.length)}</strong><small>معتمدة ولسه بتتسلّم</small></div>`}
  </div>
  ${pending.length&&isMgr()?`<button class="alert" data-go="users"><span>👤</span><span class="grow">${num(pending.length)} حساب مستني تفعيل</span><span>‹</span></button>`:""}
  ${turning.length?`<button class="alert" data-go="turning"><span>🎂</span><span class="grow">${num(turning.length)} أسرة فيها ابن هيكمل 18 سنة خلال السنة</span><span>‹</span></button>`:""}
  <div class="dash-grid">
    <section>
      <h3>كشوف شغالة</h3>
      <div class="list">${approved.length?approved.map(k=>{ const rec=k.items.filter(i=>i.received).length; return `
        <button class="item" data-batch="${k.id}"><span class="grow"><span class="nm">${esc(k.title)}</span>
          <span class="prog" aria-label="نسبة التسليم"><i style="width:${pct(rec,k.items.length)}%"></i></span>
          <span class="sub">استلم ${num(rec)} من ${num(k.items.length)} · ${pct(rec,k.items.length)}%</span></span>${statusChip(k.status)}</button>`;}).join(""):`<div class="empty">مفيش كشوف معتمدة حالياً</div>`}</div>
    </section>
    <section>
      <h3>محتاجة مراجعة قريب</h3>
      <div class="list">${due.slice(0,6).map(b=>`<button class="item" data-open="${b.id}"><span class="code">${esc(b.code)}</span><span class="grow"><span class="nm">${esc(b.name)}</span><br><span class="sub">آخر مراجعة: ${dLabel(b.lastReview)}</span></span></button>`).join("")||`<div class="empty">كله متراجع ✓</div>`}
      ${due.length>6?`<button class="item" data-go="due"><span class="grow sub">عرض الكل (${num(due.length)}) ‹</span></button>`:""}</div>
    </section>
  </div>`;
}

/* ================= simple UI (helpers / non-literate staff) ================= */
let sv={screen:"home"}, sq="";
function vSimple(){
  const back=`<button class="s-back" data-s="home">→ رجوع</button>`;
  const ready=batches().filter(k=>k.status==="معتمد");
  const bCard=(k,to)=>{ const rec=k.items.filter(i=>i.received).length; return `<button class="s-card" data-s="${to}:${k.id}"><span class="s-ic">${k.template==="cash"?"💵":"📦"}</span><span class="grow"><b>${esc(k.typeName)}</b><small>${mLabel(k.month)}</small>
    <span class="prog big"><i style="width:${k.items.length?Math.round(rec/k.items.length*100):0}%"></i></span><small>استلم ${num(rec)} من ${num(k.items.length)}</small></span></button>`; };
  const noBatches=`<div class="s-empty">😊<br>مفيش حاجة تتسلّم دلوقتي</div>`;
  const [scr,id]=String(sv.screen).split(":");
  if(scr==="home") return `
    <div class="s-hello">أهلاً ${esc((me.full_name||"").split(" ")[0])} 👋</div>
    <div class="s-tiles">
      <button class="s-tile g" data-s="give"><span class="ic">✅</span>تسليم</button>
      <button class="s-tile b" data-s="find"><span class="ic">🔍</span>دوّر على اسم</button>
      <button class="s-tile r" data-s="call"><span class="ic">📞</span>اتصل</button>
      <button class="s-tile p" data-s="print"><span class="ic">🖨️</span>اطبع</button>
    </div>
    <div class="s-foot">
      ${realRole==="manager"?`<button class="btn" data-preview="manager">↩️ رجوع لشاشة المدير</button>`:""}
      <button class="btn" id="s_big">🔠 ${document.body.classList.contains("big")?"خط أصغر":"خط أكبر"}</button>
      <button class="btn" id="s_out">خروج</button>
    </div>`;
  if(scr==="give"||scr==="print"||scr==="call") return `${back}<h2 class="s-title">${scr==="give"?"✅ اختار الكشف":scr==="print"?"🖨️ اختار الكشف اللي هتطبعه":"📞 اختار الكشف"}</h2>
    <div class="s-list">${ready.length?ready.map(k=>bCard(k, scr==="give"?"gb":scr==="print"?"pr":"cb")).join(""):noBatches}</div>`;
  if(scr==="gb"){
    const k=K.get(id); if(!k) return back+noBatches;
    const qq=norm(sq); const rec=k.items.filter(i=>i.received).length;
    const items=k.items.filter(it=>!qq||norm(it.name).includes(qq)||String(it.code)===qq).sort((a,b)=>(a.received?1:0)-(b.received?1:0));
    return `<button class="s-back" data-s="give">→ رجوع</button>
      <h2 class="s-title">${esc(k.typeName)} <small>${mLabel(k.month)}</small></h2>
      <div class="s-count"><span class="prog big"><i style="width:${k.items.length?Math.round(rec/k.items.length*100):0}%"></i></span>استلم <b>${num(rec)}</b> من <b>${num(k.items.length)}</b></div>
      <input type="search" class="s-search" id="s_q" placeholder="🔍 اكتب الاسم" value="${esc(sq)}">
      <div class="s-list">${items.map(it=>`<div class="s-row ${it.received?"done":""}"><span class="grow"><b>${esc(it.name)}</b><small>رقم ${esc(it.code)} · ${num(it.value)} ${esc(k.unit)}</small></span>
        ${it.received?`<span class="s-ok">✓ استلم</span>`:`<button class="s-give" data-give="${it.id}">سلّم</button>`}</div>`).join("")||`<div class="s-empty">مفيش الاسم ده في الكشف</div>`}</div>`;
  }
  if(scr==="cb"){
    const k=K.get(id); if(!k) return back+noBatches;
    const left=k.items.filter(i=>!i.received);
    return `<button class="s-back" data-s="call">→ رجوع</button>
      <h2 class="s-title">📞 لسه ما استلموش <small>${num(left.length)}</small></h2>
      <div class="s-list">${left.map(it=>{ const ph=cleanPhone(it.phone||B.get(it.bid)?.phone); return `<div class="s-row"><span class="grow"><b>${esc(it.name)}</b><small dir="ltr">${esc(ph||"مفيش رقم")}</small></span>
        ${validPhone(ph)?`<a class="s-call" href="tel:${ph}">📞 اتصل</a>`:`<span class="s-ok muted">—</span>`}</div>`;}).join("")||`<div class="s-empty">كله استلم ✓</div>`}</div>`;
  }
  if(scr==="find"){
    const qq=norm(sq);
    const res=qq.length>=2?people().filter(b=>norm(b.name).includes(qq)||String(b.code)===qq.padStart(3,"0")||(b.nationalId||"").includes(qq)).slice(0,30):[];
    return `${back}<h2 class="s-title">🔍 دوّر على اسم</h2>
      <input type="search" class="s-search" id="s_q" placeholder="اكتب الاسم أو رقم الحالة" value="${esc(sq)}">
      <div class="s-list">${qq.length<2?`<div class="s-empty">اكتب أول حرفين من الاسم</div>`:res.map(b=>`<button class="s-card" data-s="ps:${b.id}"><span class="s-ic">👤</span><span class="grow"><b>${esc(b.name)}</b><small>رقم ${esc(b.code)}${b.familySize?` · ${b.familySize} أفراد`:""}</small></span></button>`).join("")||`<div class="s-empty">مفيش حد بالاسم ده</div>`}</div>`;
  }
  if(scr==="ps"){
    const b=B.get(id); if(!b) return back;
    const hist=receipts().filter(r=>r.bid===id).sort((a,c)=>c.month.localeCompare(a.month)).slice(0,8);
    const ph=cleanPhone(b.phone);
    return `<button class="s-back" data-s="find">→ رجوع</button>
      <div class="s-person"><div class="s-ic big">👤</div><h2>${esc(b.name)}</h2><p>رقم الحالة <b>${esc(b.code)}</b>${b.familySize?` · <b>${b.familySize}</b> أفراد`:""}${(b.children||[]).length?` · <b>${b.children.length}</b> أطفال`:""}</p>
        ${b.status!=="نشط"?`<p class="s-warn">⚠️ الحالة دي ${esc(b.status)}</p>`:""}
        ${validPhone(ph)?`<a class="s-call wide" href="tel:${ph}">📞 اتصل بيها <span dir="ltr">${ph}</span></a>`:`<p class="sub">مفيش رقم تليفون</p>`}</div>
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
    sv={screen:to}; render(); window.scrollTo(0,0);
    if(to==="find") setTimeout(()=>$("#s_q")?.focus(),50);
  });
  v.querySelectorAll("[data-preview]").forEach(el=>el.onclick=()=>setPreview(el.dataset.preview));
  const q=$("#s_q"); if(q) q.oninput=()=>{ sq=q.value; const pos=q.selectionStart; render(); const n=$("#s_q"); n.focus(); n.setSelectionRange(pos,pos); };
  v.querySelectorAll("[data-give]").forEach(el=>el.onclick=async()=>{
    const bid=sv.screen.split(":")[1]; const k=K.get(bid); const it=k?.items.find(x=>x.id===el.dataset.give); if(!it) return;
    el.disabled=true; el.innerHTML=`<span class="spin"></span>`;
    const { error } = await sb.rpc("set_received",{item_id:it.id, is_received:true});
    if(error){ el.disabled=false; el.textContent="سلّم"; toast(errMsg(error)); return; }
    it.received=true; it.receivedAt=new Date().toISOString();
    if(navigator.vibrate) navigator.vibrate(40);
    toast(`✓ ${it.name} استلم`); render();
  });
  const big=$("#s_big"); if(big) big.onclick=()=>{ document.body.classList.toggle("big"); try{localStorage.setItem("big",document.body.classList.contains("big")?"1":"");}catch(e){} render(); };
  const out=$("#s_out"); if(out) out.onclick=async()=>{ if(!confirm("تخرج؟")) return; await sb.auth.signOut(); me=null; loaded=false; if(rt){ sb.removeChannel(rt); rt=null; } loginScreen(); };
}
let wasWide=innerWidth>=900;
addEventListener("resize",()=>{ const w=innerWidth>=900; if(w!==wasWide){ wasWide=w; render(); } });

/* ================= sheet ================= */
let sheetRefresh=null;
function sheet(title,body,onMount,refresh){
  closeSheet();
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
  const b=id?{...B.get(id)}:{code:await nextCode(),name:"",nationalId:"",phone:"",phone2:"",birth:"",caseType:"",grade:"",score:null,project:"",area:"",address:"",marital:"",job:"",income:"",housing:"",pension:"",notes:"",familySize:null,children:[],status:"انتظار",lastReview:"",nextReview:""};
  b.children=[...(b.children||[])].map(k=>({...k}));
  const projects=[...new Set(people().map(p=>p.project).filter(Boolean))];
  sheet(id?`تعديل: ${b.name}`:"حالة جديدة",`
    <div class="grid2">
      <label class="f">رقم الحالة<input type="text" id="p_code" value="${esc(b.code)}"></label>
      <label class="f">الحالة<select id="p_status">${STATUSES.map(s=>`<option ${b.status===s?"selected":""}>${s}</option>`).join("")}</select></label>
    </div>
    <label class="f">الاسم رباعي<input type="text" id="p_name" value="${esc(b.name)}"></label>
    <div class="grid2">
      <label class="f">الرقم القومي<input type="text" inputmode="numeric" id="p_nid" value="${esc(b.nationalId)}" dir="ltr"></label>
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
    <h3>الأبناء</h3><div id="kids"></div>
    <button class="btn sm" id="addKid">➕ إضافة ابن / ابنة</button>
    <label class="f" style="margin-top:14px">سبب التعديل (اختياري — بيتسجل في سجل الحالة)<input type="text" id="p_why" placeholder="مثال: بحث ميداني جديد، تغيير رقم التليفون"></label>
    <div class="bar"><button class="btn pri" id="saveP">💾 حفظ</button><button class="btn" id="cancelP">إلغاء</button></div>`, s=>{
    const q=x=>s.querySelector(x);
    q("#p_nid").onchange=()=>{ const n=q("#p_nid").value.trim(); if(/^[23]\d{13}$/.test(n)&&!q("#p_birth").value){ const c=n[0]==="2"?1900:2000; q("#p_birth").value=`${c+ +n.slice(1,3)}-${n.slice(3,5)}-${n.slice(5,7)}`; } };
    const drawKids=()=>{
      q("#kids").innerHTML=b.children.length?`<div class="tbl" style="margin-bottom:8px"><table><thead><tr><th>الاسم</th><th>النوع</th><th>الميلاد</th><th>الدراسة</th><th></th></tr></thead><tbody>${b.children.map((k,i)=>`<tr>
        <td><input type="text" data-k="${i}" data-f="name" value="${esc(k.name)}" style="min-width:110px" aria-label="اسم الابن"></td>
        <td><select data-k="${i}" data-f="gender" style="min-width:70px" aria-label="النوع"><option></option><option ${k.gender==="ولد"?"selected":""}>ولد</option><option ${k.gender==="بنت"?"selected":""}>بنت</option></select></td>
        <td><input type="date" data-k="${i}" data-f="birth" value="${esc(k.birth)}" aria-label="تاريخ الميلاد"></td>
        <td><input type="text" data-k="${i}" data-f="school" value="${esc(k.school)}" style="min-width:110px" aria-label="المرحلة الدراسية"></td>
        <td><button class="btn sm danger" data-rk="${i}" aria-label="حذف">×</button></td></tr>`).join("")}</tbody></table></div>`:`<p class="sub">لا يوجد أبناء مسجلين</p>`;
      s.querySelectorAll("[data-k]").forEach(el=>el.onchange=()=>{ b.children[+el.dataset.k][el.dataset.f]=el.value; });
      s.querySelectorAll("[data-rk]").forEach(el=>el.onclick=()=>{ b.children.splice(+el.dataset.rk,1); drawKids(); });
    };
    drawKids();
    q("#addKid").onclick=()=>{ b.children.push({name:"",gender:"",birth:"",school:""}); drawKids(); };
    q("#cancelP").onclick=()=> id?viewPerson(id):closeSheet();
    q("#saveP").onclick=async()=>{
      const g=x=>q(x).value.trim(); const prev=id?B.get(id):null;
      const rec={...b, code:g("#p_code"), status:g("#p_status"), name:g("#p_name"), nationalId:g("#p_nid"), birth:g("#p_birth"), phone:g("#p_phone"), phone2:g("#p_phone2"), caseType:g("#p_type"), marital:g("#p_marital"), project:g("#p_project"), area:g("#p_area"), address:g("#p_address"), job:g("#p_job"), income:g("#p_income"), pension:g("#p_pension"), housing:g("#p_housing"), familySize:g("#p_fam")?+g("#p_fam"):null, grade:g("#p_grade"), lastReview:g("#p_last"), nextReview:g("#p_next"), notes:g("#p_notes"), children:b.children.filter(k=>k.name)};
      if(!rec.name){ toast("اكتب الاسم الأول"); q("#p_name").focus(); return; }
      if(rec.nationalId&&!/^[23]\d{13}$/.test(rec.nationalId)&&!confirm("الرقم القومي لازم يكون 14 رقم. تحفظ كده برضو؟")) return;
      const changes=[];
      if(prev){ if(prev.status!==rec.status) changes.push(`الحالة: ${prev.status} ← ${rec.status}`); if((prev.familySize??"")!==(rec.familySize??"")) changes.push(`أفراد الأسرة: ${prev.familySize||"—"} ← ${rec.familySize||"—"}`); if((prev.phone||"")!==rec.phone) changes.push("تغيير التليفون"); if((prev.lastReview||"")!==rec.lastReview&&rec.lastReview) changes.push(`مراجعة بتاريخ ${dLabel(rec.lastReview)}`); if((prev.children||[]).length!==rec.children.length) changes.push(`عدد الأبناء: ${(prev.children||[]).length} ← ${rec.children.length}`); }
      q("#saveP").disabled=true;
      let newId=id;
      if(id){ if(!await run(sb.from("beneficiaries").update(toB(rec)).eq("id",id))){ q("#saveP").disabled=false; return; } }
      else { const d=await run(sb.from("beneficiaries").insert({...toB(rec), created_by:me.id}).select("id").single()); if(!d){ q("#saveP").disabled=false; return; } newId=d.id; }
      await logIt("beneficiary",newId, prev?[g("#p_why"),...changes].filter(Boolean).join(" · ")||"تعديل بيانات":"تسجيل الحالة");
      toast("تم الحفظ ✓"); await reload(); viewPerson(newId);
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
    </div>
    <div class="bar">
      ${canWrite()?`<button class="btn pri" id="v_edit">✏️ تعديل</button><button class="btn" id="v_rev">📅 تسجيل مراجعة</button>`:""}
      ${isMgr()?`<button class="btn gold" id="v_single">💵 صرف فردي</button>`:""}
      <button class="btn" id="v_print">🖨️ طباعة الملف</button>
      ${validPhone(b.phone)?`<a class="btn" href="tel:${cleanPhone(b.phone)}" style="text-decoration:none;display:inline-flex;align-items:center">📞 اتصال</a>`:""}
    </div>
    <div class="facts">
      ${f("رقم الحالة",b.code)}${f("الرقم القومي",b.nationalId)}${f("السن",age(b.birth))}${f("التليفون",cleanPhone(b.phone)||b.phone)}${f("تليفون تاني",b.phone2)}
      ${f("الحالة الاجتماعية",b.marital)}${f("أفراد الأسرة",b.familySize)}${f("عدد الأبناء",(b.children||[]).length||"")}
      ${f("المشروع",b.project)}${f("المنطقة",b.area)}${f("العمل",b.job)}${f("الدخل",b.income)}${f("المعاش",b.pension)}${f("السكن",b.housing)}
      ${f("آخر مراجعة",b.lastReview&&dLabel(b.lastReview))}${f("المراجعة الجاية",b.nextReview&&dLabel(b.nextReview))}${f("الدرجة",b.score!=null?b.score+"%":"")}
    </div>
    ${b.address?`<p><span class="sub">العنوان:</span> ${esc(b.address)}</p>`:""}
    ${b.notes?`<div class="note">${esc(b.notes)}</div>`:""}
    <h3>الأبناء</h3>
    ${(b.children||[]).length?`<div class="tbl"><table><thead><tr><th>الاسم</th><th>النوع</th><th>السن</th><th>الدراسة</th></tr></thead><tbody>${b.children.map(k=>{const a=age(k.birth); return `<tr><td>${esc(k.name)}</td><td>${esc(k.gender)}</td><td class="n">${a===""?"—":a}${a!==""&&a>=18?` <span class="chip red">فوق 18</span>`:a!==""&&a>=17?` <span class="chip gold">قرب 18</span>`:""}</td><td>${esc(k.school)}</td></tr>`;}).join("")}</tbody></table></div>`:`<p class="sub">لا يوجد أبناء مسجلين</p>`}
    <h3>سجل المساعدات</h3>
    <div class="tbl"><table><thead><tr><th>الشهر</th><th>النوع</th><th>القيمة</th><th>استلم</th></tr></thead><tbody>
    ${hist.map(r=>`<tr><td class="n">${mLabel(r.month)}</td><td>${esc(r.typeName)}</td><td class="n">${num(r.value)} ${esc(r.unit)}</td><td>${r.received?"✓ "+(r.receivedAt?dLabel(r.receivedAt):""):"—"}</td></tr>`).join("")||`<tr><td colspan="4" class="empty">لم تستلم أي مساعدة معتمدة بعد</td></tr>`}
    </tbody></table></div>
    ${hist.length?`<p class="sub">${hist.length} مرة · إجمالي نقدي ${num(cash)} جنيه</p>`:""}
    <h3>سجل التغييرات</h3>
    ${logs===null?`<p class="sub"><span class="spin"></span></p>`:logs.length?`<ul class="log">${logs.map(l=>`<li><b>${dLabel(l.at)}</b> — ${esc(l.text)}${l.by?` <span>(${esc(who(l.by))})</span>`:""}</li>`).join("")}</ul>`:`<p class="sub">مستوردة من شيت ${esc(b.source||"Excel")} — لا توجد تغييرات بعد</p>`}
    ${isMgr()?`<div class="bar" style="margin-top:20px"><button class="btn danger" id="v_del">🗑️ حذف الحالة نهائياً</button></div>`:""}`;
  };
  const mount=s=>{
    const q=x=>s.querySelector(x);
    if(q("#v_edit")) q("#v_edit").onclick=()=>editPerson(id);
    if(q("#v_rev")) q("#v_rev").onclick=()=>reviewSheet(id);
    if(q("#v_single")) q("#v_single").onclick=()=>singleGive(id);
    q("#v_print").onclick=()=>doPrint(caseHTML(B.get(id),logs||[]), `ملف ${B.get(id).code} ${B.get(id).name}`);
    if(q("#v_del")) q("#v_del").onclick=async()=>{ if(confirm("حذف الحالة نهائياً؟\nالأفضل تغيير حالتها إلى «ملغي» عشان سجلها يفضل موجود.")){ if(await run(sb.from("beneficiaries").delete().eq("id",id),"تم الحذف")){ closeSheet(); reload(); } } };
  };
  if(!B.get(id)) return;
  const redraw=()=>{ const body=$("#scrim .sh-body"); if(body&&B.get(id)){ body.innerHTML=draw(); mount($("#scrim")); } };
  sheet(B.get(id).name, draw(), mount, redraw);
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
    <div class="bar"><button class="btn pri" id="r_go">💾 حفظ المراجعة</button></div>`, s=>{
    const q=x=>s.querySelector(x);
    q("#r_go").onclick=async()=>{
      const d=q("#r_d").value||today; const nx=new Date(d); nx.setMonth(nx.getMonth()+ +q("#r_n").value);
      const cur=B.get(id); const fam=q("#r_f").value?+q("#r_f").value:null;
      const parts=["مراجعة ميدانية", q("#r_by").value.trim()&&`بواسطة ${q("#r_by").value.trim()}`, cur.status!==q("#r_s").value&&`الحالة: ${cur.status} ← ${q("#r_s").value}`, (cur.familySize??null)!==fam&&`أفراد الأسرة: ${cur.familySize||"—"} ← ${fam||"—"}`, q("#r_t").value.trim()].filter(Boolean);
      q("#r_go").disabled=true;
      if(await run(sb.from("beneficiaries").update({last_review:d, next_review:nx.toISOString().slice(0,10), family_size:fam, status:q("#r_s").value, grade:q("#r_g").value}).eq("id",id))){
        await logIt("beneficiary",id,parts.join(" · ")); toast("تم تسجيل المراجعة ✓"); await reload(); viewPerson(id);
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
      toast("تم تسجيل الصرف ✓"); await reload(); viewPerson(bid);
    };
  });
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
    <div class="bar"><button class="btn pri" id="t_save">💾 حفظ</button>${id?`<button class="btn danger" id="t_del">حذف النوع</button>`:""}</div>`, s=>{
    s.querySelector("#t_save").onclick=async()=>{
      const name=s.querySelector("#t_name").value.trim(); if(!name){toast("اكتب اسم النوع"); return;}
      const rec={id:id||("t"+Date.now().toString(36)),name,unit:s.querySelector("#t_unit").value.trim()||"جنيه",amount:+s.querySelector("#t_amt").value||0,cooldown:Math.max(0,+s.querySelector("#t_cd").value||0),template:s.querySelector("#t_tpl").value,case_types:[...s.querySelectorAll(".checks input:checked")].map(i=>i.value),sort:t.order??99};
      if(await run(sb.from("aid_types").upsert(rec),"تم الحفظ ✓")){ closeSheet(); reload(); }
    };
    const d=s.querySelector("#t_del"); if(d) d.onclick=async()=>{ if([...K.values()].some(k=>k.typeId===id)){ toast("النوع مستخدم في كشوف — مينفعش يتحذف"); return; } if(confirm("حذف النوع؟")&&await run(sb.from("aid_types").delete().eq("id",id))){ closeSheet(); reload(); } };
  });
}

/* ================= users ================= */
function newUser(){
  sheet("إضافة موظف",`
    <label class="f">الاسم<input type="text" id="u_n"></label>
    <label class="f">رقم التليفون (هيدخل بيه)<input type="text" id="u_u" inputmode="tel" dir="ltr"></label>
    <label class="f">رقم سري (6 أرقام أو أكتر)<input type="text" id="u_p" class="pin" inputmode="numeric" dir="ltr" value="${String(Math.floor(100000+Math.random()*900000))}"></label>
    <div class="sub" style="margin-bottom:6px">نوع الحساب</div><div class="roles">${["helper","worker","manager","viewer"].map((r,i)=>`<label class="rolec"><input type="radio" name="u_r" value="${r}" ${i===0?"checked":""}><span><b>${ROLE_AR[r]}</b><small>${ROLE_DESC[r]}</small></span></label>`).join("")}</div>
    <div class="note">ابعت للموظف رقم التليفون والرقم السري ولينك الموقع، وقوله يضيفه على الشاشة الرئيسية.</div>
    <div class="bar"><button class="btn pri" id="u_go">إنشاء الحساب</button></div>`, s=>{
    const q=x=>s.querySelector(x);
    q("#u_go").onclick=async()=>{
      const n=q("#u_n").value.trim(), u=cleanUser(q("#u_u").value), p=q("#u_p").value.trim();
      if(!n||u.length<3||p.length<6){ toast("اكمل البيانات — الرقم السري 6 أرقام على الأقل"); return; }
      q("#u_go").disabled=true;
      const { data, error } = await sb.functions.invoke("manage-users",{ body:{action:"create", full_name:n, username:u, password:p, role:s.querySelector("input[name=u_r]:checked").value} });
      if(error||data?.error){ q("#u_go").disabled=false; toast(data?.error==="exists"?"الرقم ده عليه حساب فعلاً":errMsg(error||data.error)); return; }
      const msg=`أهلاً ${n}\nده حسابك على نظام جمعية دار الإكرام:\nالرابط: ${location.origin}\nرقم الدخول: ${u}\nالرقم السري: ${p}`;
      sheet("تم إنشاء الحساب ✓",`<textarea class="phones" readonly style="min-height:150px">${esc(msg)}</textarea>
        <div class="bar"><a class="btn pri" target="_blank" rel="noopener" style="text-decoration:none;display:inline-flex;align-items:center" href="https://wa.me/${u.startsWith("01")?"2"+u:""}?text=${encodeURIComponent(msg)}">💬 ابعتها واتساب</a></div>`);
      reload();
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
    <div class="bar"><button class="btn pri" id="e_s">💾 حفظ</button><button class="btn" id="e_pin">🔑 رقم سري جديد</button></div>
    ${self?`<p class="sub">مينفعش تغيّر صلاحية حسابك أو توقفه بنفسك.</p>`:""}`, s=>{
    const q=x=>s.querySelector(x);
    q("#e_s").onclick=async()=>{ if(await run(sb.from("profiles").update({full_name:q("#e_n").value.trim(), ...(self?{}:{role:q("#e_r").value, active:q("#e_a").checked})}).eq("id",uid),"تم الحفظ ✓")){ closeSheet(); reload(); } };
    q("#e_pin").onclick=async()=>{
      const p=String(Math.floor(100000+Math.random()*900000));
      if(!confirm(`هيتعمل رقم سري جديد: ${p}\nموافق؟`)) return;
      const { data, error } = await sb.functions.invoke("manage-users",{ body:{action:"reset_password", user_id:uid, password:p} });
      if(error||data?.error){ toast(errMsg(error||data.error)); return; }
      const msg=`الرقم السري الجديد لحسابك على نظام دار الإكرام: ${p}`;
      sheet("تم ✓",`<p>الرقم السري الجديد: <b dir="ltr" style="font-size:22px">${p}</b></p><div class="bar"><a class="btn pri" target="_blank" rel="noopener" style="text-decoration:none;display:inline-flex;align-items:center" href="https://wa.me/${(u.username||"").startsWith("01")?"2"+u.username:""}?text=${encodeURIComponent(msg)}">💬 ابعته واتساب</a></div>`);
    };
  });
}
function changeMyPin(){
  sheet("تغيير الرقم السري",`<label class="f">الرقم السري الجديد (6 أرقام أو أكتر)<input type="password" id="m_p" class="pin" inputmode="numeric" autocomplete="new-password" dir="ltr"></label>
    <label class="f">اكتبه تاني<input type="password" id="m_p2" class="pin" inputmode="numeric" autocomplete="new-password" dir="ltr"></label><div class="bar"><button class="btn pri" id="m_go">حفظ</button></div>`, s=>{
    s.querySelector("#m_go").onclick=async()=>{ const a=s.querySelector("#m_p").value,b=s.querySelector("#m_p2").value; if(a.length<6){toast("6 أرقام على الأقل");return;} if(a!==b){toast("الرقمين مش زي بعض");return;}
      const { error } = await sb.auth.updateUser({password:a}); if(error){ toast(errMsg(error)); return; } closeSheet(); toast("اتغيّر ✓"); };
  });
}

/* ================= new batch ================= */
function newBatch(){
  if(!isMgr()) return;
  const ts=types(); if(!ts.length){ toast("أضف نوع مساعدة الأول من الإعدادات"); return; }
  const st={typeId:ts[0].id,month:curMonth,count:50,value:ts[0].amount,cooldown:ts[0].cooldown,picked:null,info:null};
  sheet("كشف صرف جديد",`
    <div class="pill-steps"><span class="on">١ الإعدادات</span>›<span id="st2">٢ مراجعة الأسماء</span>›<span>٣ حفظ كمسودة</span></div>
    <div class="grid2">
      <label class="f">نوع المساعدة<select id="n_t">${ts.map(t=>`<option value="${t.id}">${esc(t.name)}</option>`).join("")}</select></label>
      <label class="f">عن شهر<input type="month" id="n_m" value="${st.month}"></label>
      <label class="f">عدد الحالات المطلوب<input type="number" id="n_c" value="${st.count}" min="1"></label>
      <label class="f">القيمة لكل حالة<input type="number" id="n_v" value="${st.value}"></label>
    </div>
    <label class="f">استبعد اللي أخد نفس النوع خلال آخر (شهر)<input type="number" id="n_cd" min="0" value="${st.cooldown}"></label>
    <button class="btn pri" id="n_go">اقترح الأسماء</button><div id="n_res"></div>`, s=>{
    const q=x=>s.querySelector(x);
    q("#n_t").onchange=e=>{ const t=T.get(e.target.value); q("#n_v").value=t.amount; q("#n_cd").value=t.cooldown; };
    q("#n_go").onclick=()=>{
      st.typeId=q("#n_t").value; st.month=q("#n_m").value||curMonth; st.count=Math.max(1,+q("#n_c").value||1); st.value=+q("#n_v").value||0; st.cooldown=Math.max(0,+q("#n_cd").value||0);
      const r=propose({...T.get(st.typeId),amount:st.value},st.month,st.count,st.cooldown); st.picked=r.picked; st.info=r; drawRes();
    };
    function drawRes(){
      const t=T.get(st.typeId); q("#st2").className="on"; const short=st.info.poolSize<st.count;
      q("#n_res").innerHTML=`
        <h3>${esc(t.name)} — ${mLabel(st.month)}</h3>
        <div class="note ${short?"red":""}">المؤهلين: ${num(st.info.poolSize)} حالة. اتستبعد ${num(st.info.excludedRecent)} لأنهم أخدوا خلال آخر ${st.cooldown} شهر${st.info.excludedSame?`، و${num(st.info.excludedSame)} موجودين في كشف تاني لنفس الشهر`:""}.${short?` العدد المتاح أقل من المطلوب (${st.count}).`:""}<br>الترتيب: اللي ما أخدش خالص الأول، بعدين الأقدم في آخر استلام، بعدين التقدير.</div>
        <input type="search" id="n_add" placeholder="➕ إضافة حالة بإيدك بالاسم أو الرقم"><div id="n_sugg" style="margin-top:8px"></div>
        <div class="tbl"><table><thead><tr><th>م</th><th>الاسم</th><th>سبب الإدراج</th><th>القيمة</th><th></th></tr></thead><tbody>
        ${st.picked.map((p,i)=>`<tr><td class="n">${i+1}</td><td>${esc(p.name)}<div class="sub">${esc(p.code)}</div></td><td class="why">${esc(p.reason)}</td><td><input type="number" data-v="${i}" value="${p.value}" style="width:90px;min-height:36px;padding:4px 8px" aria-label="القيمة"></td><td><button class="btn sm danger" data-rm="${i}" aria-label="استبعاد">×</button></td></tr>`).join("")||`<tr><td colspan="5" class="empty">لا توجد حالات مؤهلة</td></tr>`}
        </tbody></table></div>
        <p class="sub">الإجمالي: ${num(st.picked.length)} حالة · ${num(st.picked.reduce((s,p)=>s+(+p.value||0),0))} ${esc(t.unit)}</p>
        <div class="bar"><button class="btn pri" id="n_save" ${st.picked.length?"":"disabled"}>💾 حفظ كمسودة</button></div>`;
      q("#n_res").querySelectorAll("[data-rm]").forEach(el=>el.onclick=()=>{ st.picked.splice(+el.dataset.rm,1); drawRes(); });
      q("#n_res").querySelectorAll("[data-v]").forEach(el=>el.onchange=()=>{ st.picked[+el.dataset.v].value=+el.value||0; drawRes(); });
      const add=q("#n_add"); add.oninput=()=>{
        const qq=norm(add.value); if(!qq){ q("#n_sugg").innerHTML=""; return; }
        const inIds=new Set(st.picked.map(p=>p.bid));
        const res=people().filter(b=>!inIds.has(b.id)&&(norm(b.name).includes(qq)||(b.nationalId||"").includes(qq)||b.code===qq.padStart(3,"0"))).slice(0,6);
        q("#n_sugg").innerHTML=`<div class="list" style="margin-bottom:10px">${res.map(b=>`<button class="item" data-add="${b.id}"><span class="code">${esc(b.code)}</span><span class="grow nm">${esc(b.name)}</span>${b.status!=="نشط"?`<span class="chip red">${esc(b.status)}</span>`:""}</button>`).join("")||`<div class="empty">لا نتائج</div>`}</div>`;
        q("#n_sugg").querySelectorAll("[data-add]").forEach(el=>el.onclick=()=>{ const b=B.get(el.dataset.add); const lm=lastByType(st.typeId).get(b.id); st.picked.push(itemFor(b,st.value,"إضافة يدوية"+(lm?` · آخر استلام ${mLabel(lm)}`:""))); drawRes(); });
      };
      const sv=q("#n_save"); if(sv) sv.onclick=async()=>{
        sv.disabled=true; sv.innerHTML=`<span class="spin"></span>`;
        const k=await run(sb.from("batches").insert({title:`كشف ${t.name} — ${mLabel(st.month)}`,type_id:t.id,type_name:t.name,unit:t.unit,template:t.template,month:st.month,status:"مسودة",cooldown:st.cooldown,created_by:me.id}).select("id").single());
        if(!k){ sv.disabled=false; sv.textContent="💾 حفظ كمسودة"; return; }
        const rows=st.picked.map((it,i)=>toI(it,k.id,i));
        for(let i=0;i<rows.length;i+=500){ if(!await run(sb.from("batch_items").insert(rows.slice(i,i+500)))) break; }
        await logIt("batch",k.id,`إنشاء الكشف (${rows.length} حالة)`);
        toast("تم حفظ الكشف كمسودة ✓"); view="batches"; await reload(); openBatch(k.id);
      };
    }
  });
}

/* ================= batch detail ================= */
function openBatch(id, giveMode){
  let q_="", logs=null;
  const draw=()=>{
    const k=K.get(id); if(!k) return "";
    const items=k.items; const total=items.reduce((s,i)=>s+(+i.value||0),0); const rec=items.filter(i=>i.received).length; const draft=k.status==="مسودة";
    const qq=norm(q_); const shown=items.map((it,i)=>({it,i})).filter(({it})=>!qq||norm(it.name).includes(qq)||String(it.code)===qq||(it.nationalId||"").includes(qq));
    return `
    <div class="row" style="margin-bottom:10px">${statusChip(k.status)}<span class="sub">${mLabel(k.month)} · ${num(items.length)} حالة · ${num(total)} ${esc(k.unit)}${!draft?` · <b>استلم ${rec} من ${items.length}</b>`:""}</span></div>
    ${draft?`<div class="note">المسودة مش بتتحسب في سجل المساعدات، والموظفين مش شايفينها. راجع الأسماء واضغط «اعتماد».</div>`:""}
    <div class="bar">
      ${draft&&isMgr()?`<button class="btn pri" id="b_ok">✔️ اعتماد الكشف</button>`:""}
      ${k.status==="معتمد"&&isMgr()?`<button class="btn gold" id="b_paid">تم الصرف بالكامل</button><button class="btn" id="b_back">إرجاع لمسودة</button>`:""}
      <button class="btn" id="b_print">🖨️ طباعة</button><button class="btn" id="b_phones">📞 أرقام</button><button class="btn" id="b_xlsx">Excel</button>
      ${isMgr()&&(draft||k.single)?`<button class="btn danger" id="b_del">حذف</button>`:""}
    </div>
    <input type="search" id="b_q" placeholder="🔍 دوّر في الكشف بالاسم أو الرقم" value="${esc(q_)}" style="margin-bottom:10px">
    ${!draft?`<div class="list">${shown.map(({it,i})=>`
      <div class="give ${it.received?"done":""}"><span class="code">${i+1}</span><span class="grow"><span class="nm">${esc(it.name)}</span><br><span class="sub">${esc(it.code)} · ${esc(k.template==="cash"?it.nationalId:(it.familySize?it.familySize+" أفراد":""))} · ${num(it.value)} ${esc(k.unit)}</span></span>
      ${canWrite()?`<button class="gb" data-rc="${it.id}" aria-pressed="${it.received}">${it.received?"استلم ✓":"سلّم"}</button>`:it.received?`<span class="chip">استلم</span>`:""}</div>`).join("")||`<div class="empty">مفيش نتيجة</div>`}</div>`
    :`<div class="tbl"><table><thead><tr><th>م</th><th>الاسم</th><th>${k.template==="cash"?"الرقم القومي":"أفراد"}</th><th>${k.template==="cash"?"المبلغ":"الكمية"}</th><th></th></tr></thead><tbody>
      ${shown.map(({it,i})=>`<tr><td class="n">${i+1}</td><td>${esc(it.name)}<div class="why">${esc(it.code)} · ${esc(it.reason||"")}</div></td><td class="n">${esc(k.template==="cash"?it.nationalId:it.familySize)}</td><td class="n">${num(it.value)}</td><td>${isMgr()?`<button class="btn sm danger" data-rm="${it.id}" aria-label="استبعاد">×</button>`:""}</td></tr>`).join("")}
    </tbody></table></div>`}
    ${logs&&logs.length?`<h3>سجل الكشف</h3><ul class="log">${logs.slice(0,20).map(l=>`<li><b>${dLabel(l.at)}</b> — ${esc(l.text)}${l.by?` (${esc(who(l.by))})`:""}</li>`).join("")}</ul>`:""}`;
  };
  const upd=async(patch,text,okMsg)=>{ if(await run(sb.from("batches").update(patch).eq("id",id),okMsg)){ await logIt("batch",id,text); logs=await loadLog("batch",id); await reload(); } };
  const mount=s=>{
    const q=x=>s.querySelector(x);
    if(q("#b_ok")) q("#b_ok").onclick=()=>upd({status:"معتمد",approved_at:new Date().toISOString(),approved_by:me.id},"اعتماد الكشف","اتعتمد ✓");
    if(q("#b_paid")) q("#b_paid").onclick=()=>upd({status:"مصروف",paid_at:new Date().toISOString()},"إغلاق الكشف — تم الصرف","تمام ✓");
    if(q("#b_back")) q("#b_back").onclick=()=>upd({status:"مسودة"},"إرجاع لمسودة");
    if(q("#b_del")) q("#b_del").onclick=async()=>{ if(confirm("حذف الكشف؟")&&await run(sb.from("batches").delete().eq("id",id),"اتحذف")){ closeSheet(); reload(); } };
    s.querySelectorAll("[data-rm]").forEach(el=>el.onclick=async()=>{ const it=K.get(id).items.find(x=>x.id===el.dataset.rm); if(await run(sb.from("batch_items").delete().eq("id",it.id))){ await logIt("batch",id,`استبعاد ${it.name}`); reload(); } });
    s.querySelectorAll("[data-rc]").forEach(el=>el.onclick=async()=>{
      const it=K.get(id).items.find(x=>x.id===el.dataset.rc); const v=!it.received;
      if(!v&&!confirm(`إلغاء استلام ${it.name}؟`)) return;
      it.received=v; it.receivedAt=v?new Date().toISOString():null; refreshSheet();   // optimistic
      const { error } = await sb.rpc("set_received",{item_id:it.id, is_received:v});
      if(error){ it.received=!v; refreshSheet(); toast(errMsg(error)); return; }
      if(v) toast(`${it.name} — استلم ✓`); logCache.delete("batch"+id);
    });
    const bq=q("#b_q"); bq.oninput=()=>{ q_=bq.value; const pos=bq.selectionStart; refreshSheet(); const n=$("#b_q"); if(n){n.focus(); n.setSelectionRange(pos,pos);} };
    q("#b_print").onclick=()=>doPrint(batchHTML(K.get(id)),K.get(id).title);
    q("#b_phones").onclick=()=>{ const k=K.get(id); phoneSheet(k.title,k.items.map(it=>({name:it.name,phone:it.phone||B.get(it.bid)?.phone,code:it.code,done:it.received})),counts(k)); };
    q("#b_xlsx").onclick=()=>batchXlsx(K.get(id));
  };
  if(!K.get(id)) return;
  const redraw=()=>{ const body=$("#scrim .sh-body"); if(body&&K.get(id)){ body.innerHTML=draw(); mount($("#scrim")); } };
  sheet(K.get(id).title, draw(), mount, redraw);
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
      const [kind,arg]=el.dataset.ph.split(/:(.*)/s); const Pm=b=>({name:b.name,phone:b.phone,code:b.code});
      if(kind==="active") phoneSheet("كل الحالات النشطة", people().filter(b=>b.status==="نشط").map(Pm));
      if(kind==="type") phoneSheet(`حالات ${arg}`, people().filter(b=>b.status==="نشط"&&b.caseType===arg).map(Pm));
      if(kind==="waiting") phoneSheet("حالات الانتظار", people().filter(b=>b.status==="انتظار").map(Pm));
      if(kind==="due") phoneSheet("محتاجة مراجعة", people().filter(reviewDue).map(Pm));
      if(kind==="batch"){ const k=K.get(arg); phoneSheet(k.title,k.items.map(it=>({name:it.name,phone:it.phone||B.get(it.bid)?.phone,code:it.code,done:it.received})),true); }
      if(kind==="not"){ const t=T.get(arg); phoneSheet(`لم يستلموا ${t.name}`, notReceived(t,3).map(({b})=>Pm(b))); }
    });
  });
}
function phoneSheet(title, rows, hasDone){
  let onlyPending=false;
  const build=()=>{ const list=rows.filter(r=>!onlyPending||!r.done); const ok=list.filter(r=>validPhone(r.phone)); const bad=list.filter(r=>!validPhone(r.phone)); return {ok,bad,text:`${title}\n\n`+ok.map((r,i)=>`${i+1}- ${r.name}: ${cleanPhone(r.phone)}`).join("\n")}; };
  const draw=()=>{ const {ok,bad,text}=build(); return `
    <div class="note green">${num(ok.length)} رقم صالح${bad.length?` · <b>${num(bad.length)}</b> بدون رقم أو رقم غلط (تحت)`:""}</div>
    ${hasDone?`<label style="display:flex;gap:8px;align-items:center;margin-bottom:10px"><input type="checkbox" id="ph_p" ${onlyPending?"checked":""} style="width:20px;height:20px"> اللي لسه ما استلموش بس</label>`:""}
    <div class="bar">
      <button class="btn pri" id="ph_copy">📋 نسخ القائمة</button>
      <a class="btn" id="ph_wa" target="_blank" rel="noopener" style="text-decoration:none;display:inline-flex;align-items:center">💬 إرسال واتساب</a>
      <button class="btn gold" id="ph_vcf">👤 تنزيل الأرقام للموبايل (.vcf)</button>
      <button class="btn" id="ph_x">Excel</button>
    </div>
    <textarea class="phones" id="ph_t" readonly aria-label="القائمة">${esc(text)}</textarea>
    <p class="sub">ملف .vcf: افتحه على الموبايل وهيسألك «استيراد جهات الاتصال» — كل الأرقام بتتسجل مرة واحدة باسم «دار الإكرام - …».</p>
    ${bad.length?`<h3>من غير رقم صالح</h3><div class="list">${bad.map(r=>`<div class="item"><span class="code">${esc(r.code)}</span><span class="grow">${esc(r.name)}</span><span class="sub">${esc(r.phone||"لا يوجد")}</span></div>`).join("")}</div>`:""}`; };
  const mount=s=>{
    const q=x=>s.querySelector(x); const {ok,text}=build();
    if(q("#ph_p")) q("#ph_p").onchange=e=>{ onlyPending=e.target.checked; q(".sh-body").innerHTML=draw(); mount(s); };
    q("#ph_wa").href="https://wa.me/?text="+encodeURIComponent(text.length>6000?text.slice(0,6000)+"\n…":text);
    q("#ph_copy").onclick=async()=>{ try{ await navigator.clipboard.writeText(text); toast("اتنسخت ✓ الصقها في واتساب"); }catch(e){ const ta=q("#ph_t"); ta.focus(); ta.select(); try{ document.execCommand("copy"); toast("اتنسخت ✓"); }catch(_){ toast("علّم النص واضغط نسخ"); } } };
    q("#ph_vcf").onclick=()=>{ const v=ok.map(r=>`BEGIN:VCARD\r\nVERSION:3.0\r\nFN:دار الإكرام - ${r.name}\r\nN:${r.name};دار الإكرام;;;\r\nTEL;TYPE=CELL:${cleanPhone(r.phone)}\r\nNOTE:حالة رقم ${r.code}\r\nEND:VCARD`).join("\r\n"); saveFile(`${title}.vcf`, new Blob([v],{type:"text/vcard"})); };
    q("#ph_x").onclick=()=>{ const rs=[["م","رقم الحالة","الاسم","التليفون"]]; ok.forEach((r,i)=>rs.push([i+1,r.code,r.name,cleanPhone(r.phone)])); xlsx({"أرقام":rs},`أرقام ${title}.xlsx`,[5,10,32,16]); };
  };
  sheet(`📞 ${title}`, draw(), mount);
}

/* ================= printing ================= */
const PRINT_CSS=`
.ps{font-family:"Readex Pro",Tahoma,sans-serif;color:#000;direction:rtl;font-size:12.5px}
.ps .hd{display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #A3282A;padding-bottom:8px;margin-bottom:10px}
.ps .orgw{display:flex;align-items:center;gap:10px}.ps .orgw img{width:62px;height:auto}
.ps .org{font-family:"Amiri","Traditional Arabic",serif;font-size:20px;font-weight:700;line-height:1.2;color:#A3282A}
.ps .org small{display:block;font-family:"Readex Pro",Tahoma,sans-serif;font-size:12px;font-weight:400;color:#000}
.ps h1{text-align:center;font-size:17px;margin:6px 0 2px}.ps .mo{text-align:center;margin-bottom:10px}
.ps table{width:100%;border-collapse:collapse;margin-bottom:10px}
.ps th,.ps td{border:1px solid #000;padding:5px 6px;text-align:center}.ps th{background:#eee}
.ps td.nm,.ps td.l{text-align:right}.ps .sig{height:26px;min-width:90px}
.ps .tot{margin-top:10px;display:flex;gap:30px;font-weight:600}
.ps .signs{display:flex;justify-content:space-between;margin-top:34px}.ps .signs div{text-align:center;min-width:140px}
.ps .signs span{display:block;border-top:1px dotted #000;margin-top:34px}
.ps h2{font-size:14px;margin:14px 0 6px;border-bottom:1px solid #000}
.ps .kv td:nth-child(odd){background:#f3f3f3;font-weight:600;width:18%}
@page{size:A4;margin:12mm}
thead{display:table-header-group} tr{page-break-inside:avoid}`;
(()=>{ const st=document.createElement("style"); st.textContent="@media print{"+PRINT_CSS+"}"; document.head.appendChild(st); })();
const hdr=()=>{ const d=new Date(); return `<div class="hd"><div class="orgw"><img src="${$("#logoImg").src}" alt=""><div class="org">${ORG}<small>${ORG2}</small></div></div><div>التاريخ: ${d.getDate()}/${d.getMonth()+1}/${d.getFullYear()}</div></div>`; };
function batchHTML(k){
  const cash=k.template==="cash"; const total=k.items.reduce((s,i)=>s+(+i.value||0),0);
  return `<div class="ps">${hdr()}<h1>${k.single?"إيصال صرف":"كشف "+(cash?"صرف":"توزيع")} ${esc(k.typeName)}</h1><div class="mo">عن شهر: ${mLabel(k.month)}</div>
    <table><thead><tr><th>م</th><th>رقم الحالة</th><th>اسم المستفيد</th>${cash?"<th>الرقم القومي</th><th>المبلغ</th>":"<th>عدد أفراد الأسرة</th><th>الكمية</th>"}<th>التوقيع</th></tr></thead><tbody>
    ${k.items.map((it,i)=>`<tr><td>${i+1}</td><td>${esc(it.code)}</td><td class="nm">${esc(it.name)}</td>${cash?`<td>${esc(it.nationalId)}</td>`:`<td>${esc(it.familySize)}</td>`}<td>${num(it.value)}</td><td class="sig"></td></tr>`).join("")}
    </tbody></table>
    <div class="tot"><span>إجمالي عدد الحالات: ${num(k.items.length)}</span><span>الإجمالي: ${num(total)} ${esc(k.unit)}</span></div>
    <div class="signs"><div>إعداد<span></span></div><div>مراجعة<span></span></div><div>اعتماد<span></span></div></div></div>`;
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
    <div class="signs"><div>الباحث الاجتماعي<span></span></div><div>مدير الجمعية<span></span></div></div></div>`;
}
function doPrint(html){ $("#print").innerHTML=html; setTimeout(()=>window.print(),50); }

/* ================= excel / files ================= */
function batchXlsx(k){
  const cash=k.template==="cash";
  const rows=[[ORG],[`${k.single?"إيصال صرف":"كشف "+(cash?"صرف":"توزيع")} ${k.typeName} — عن شهر ${mLabel(k.month)}`],[],["م","رقم الحالة","اسم المستفيد",cash?"الرقم القومي":"عدد أفراد الأسرة","التليفون",cash?"المبلغ":"الكمية","استلم","سبب الإدراج","التوقيع"]];
  k.items.forEach((it,i)=>rows.push([i+1,it.code,it.name,cash?it.nationalId:it.familySize,cleanPhone(it.phone),+it.value||0,it.received?"✓":"",it.reason||"",""]));
  rows.push([],["","","إجمالي عدد الحالات",k.items.length,"","الإجمالي",k.items.reduce((s,i)=>s+(+i.value||0),0)],[],["إعداد: ..........","","مراجعة: ..........","","اعتماد: .........."]);
  xlsx({"كشف":rows},`${k.title||k.typeName}.xlsx`,[5,10,30,18,14,10,7,30,16]);
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
function xlsx(sheets,filename,widths){
  if(!window.XLSX){ toast("مكتبة Excel لسه ما حمّلتش، جرّب كمان شوية"); return; }
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
})();
