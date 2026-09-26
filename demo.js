// Demo mode — an in-memory stand-in for the Supabase client, with made-up families.
// Loaded only on localhost with ?demo in the address (see DEMO in app.js); never touches the real database.
//   ?demo            → manager      ?demo=worker / ?demo=helper / ?demo=viewer → that role
//   window.demoOffline = true in the console → every call fails like a dropped connection.

let seed = 20260924;
const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const pick = a => a[Math.floor(rnd() * a.length)];
const int = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const uuid = () => "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => { const r = Math.floor(rnd() * 16); return (c === "x" ? r : (r & 3) | 8).toString(16); });
const pad = (n, l = 2) => String(n).padStart(l, "0");

const WOMEN = ["فاطمة","مروة","هبة","نادية","سعاد","أمل","إيمان","رشا","دعاء","منى","سماح","عبير","نجلاء","هالة","ياسمين","شيماء","آية","رحاب","وفاء","سلوى","نورا","إسراء","غادة","زينب","صفاء"];
const MEN = ["محمد","أحمد","محمود","علي","حسن","إبراهيم","مصطفى","سيد","عبدالله","خالد","عمرو","طارق","سامي","رمضان","جمال","فتحي","عادل","ياسر","حسين","صابر"];
const KIDS_B = ["يوسف","عمر","آدم","زياد","مالك","حمزة","كريم","مازن","أنس","سيف"];
const KIDS_G = ["جنى","ملك","مريم","حبيبة","رقية","لوجين","سلمى","فرح","نور","هنا"];
const AREAS = ["الأنفوشي","بحري","رأس التين","الجمرك","المنشية","كرموز"];
const SCHOOL = ["تحت السن","رياض اطفال","1 ابت","ثانية ابتدائي","الثالث الابتدائي","4 ابتدائي","خامسة ابتدائي","السادس الابتدائي","1 اع","ثانية اعدادي","3 اعدادي","اولى ثانوي","2 ث","3 ثانوي صناعي","اولى معهد تمريض","2 ك تربية","خارج التعليم"];
const HOUSING = ["إيجار","إيجار جديد","تمليك","مع الأهل","استضافة"];
const JOBS = ["لا تعمل","عاملة نظافة","بائعة","خياطة","ربة منزل","عاملة باليومية"];

function nid(y, m, d, female){
  const c = y >= 2000 ? "3" : "2";
  const g = int(0, 4) * 2 + (female ? 0 : 1);
  return c + pad(y % 100) + pad(m) + pad(d) + "02" + pad(int(100, 999), 3) + g + int(0, 9);
}
const dob = (minAge, maxAge) => { const y = 2026 - int(minAge, maxAge), m = int(1, 12), d = int(1, 28); return { y, m, d, iso: `${y}-${pad(m)}-${pad(d)}` }; };

function makeData(){
  const managerId = uuid(), workerId = uuid(), helperId = uuid();
  const profiles = [
    { id: managerId, full_name: "مدير تجريبي", username: "01000000001", role: "manager", active: true, created_at: "2026-01-01T09:00:00Z" },
    { id: workerId, full_name: "موظفة تجريبية", username: "01000000002", role: "worker", active: true, created_at: "2026-01-02T09:00:00Z" },
    { id: helperId, full_name: "مساعد تجريبي", username: "01000000003", role: "helper", active: true, created_at: "2026-01-03T09:00:00Z" },
    { id: uuid(), full_name: "حساب جديد", username: "01000000009", role: "pending", active: true, created_at: "2026-09-20T09:00:00Z" },
  ];
  const aid_types = [
    { id: "kafala", name: "كفالة أيتام", unit: "جنيه", amount: 200, case_types: ["أيتام","كفالات"], cooldown: 0, template: "cash", sort: 1 },
    { id: "iftar", name: "بدل إفطار صائم", unit: "جنيه", amount: 100, case_types: [], cooldown: 11, template: "cash", sort: 2 },
    { id: "eidia", name: "عيدية", unit: "جنيه", amount: 150, case_types: [], cooldown: 3, template: "cash", sort: 3 },
    { id: "ramadan", name: "شنطة رمضان", unit: "شنطة", amount: 1, case_types: [], cooldown: 11, template: "kind", sort: 4 },
    { id: "eggs", name: "بيض", unit: "بيضة", amount: 15, case_types: [], cooldown: 1, template: "kind", sort: 5 },
    { id: "meat", name: "لحوم", unit: "كجم", amount: 1, case_types: [], cooldown: 2, template: "kind", sort: 6 },
    { id: "school", name: "شنطة مدارس", unit: "شنطة", amount: 1, case_types: ["أيتام","كفالات"], cooldown: 11, template: "kind", sort: 7 },
  ];
  const beneficiaries = [];
  for(let i = 1; i <= 216; i++){
    const b = dob(24, 62), kidsN = int(0, 5), type = rnd() < 0.55 ? "" : pick(["أيتام","أيتام","أيتام","مساعدات","مساعدات","كفالات","مرضي"]);
    const children = [];
    if(rnd() < 0.3) for(let k = 0; k < kidsN; k++){ const g = rnd() < 0.5, c = dob(1, 20); children.push({ name: pick(g ? KIDS_G : KIDS_B), gender: g ? "بنت" : "ولد", birth: c.iso, school: pick(SCHOOL) }); }
    const scored = rnd() < 0.16, score = scored ? int(42, 84) : null;
    beneficiaries.push({
      id: uuid(), code: pad(i, 3), name: `${pick(WOMEN)} ${pick(MEN)} ${pick(MEN)} ${pick(MEN)}`, national_id: nid(b.y, b.m, b.d, true),
      phone: rnd() < 0.9 ? "01" + pick(["0","1","2","5"]) + String(int(10000000, 99999999)) : "", phone2: "",
      birth: b.iso, case_type: type, grade: scored ? (score >= 81 ? "A" : score >= 61 ? "B" : "C") : "", score,
      project: rnd() < 0.5 ? "مشروع المرأة المعيلة" : "", area: pick(AREAS), address: "", marital: pick(["أرملة","أرملة","مطلقة","متزوجة","مهجورة"]),
      job: pick(JOBS), income: rnd() < 0.5 ? String(int(3, 20) * 100) : "", pension: rnd() < 0.4 ? String(int(5, 30) * 100) : "", housing: pick(HOUSING),
      family_size: kidsN + 1 + (rnd() < 0.3 ? 1 : 0), status: rnd() < 0.88 ? "نشط" : pick(["انتظار","موقوف","ملغي"]),
      last_review: rnd() < 0.6 ? `2025-${pad(int(1, 12))}-${pad(int(1, 28))}` : null, next_review: null, notes: "",
      children, tags: rnd() < 0.7 ? [pick(["بنك الطعام موسمي","بنك الطعام شهري","مصر الخير","لحوم الأضاحي"])] : [], photos: {}, source: "بيانات تجريبية", created_at: "2026-01-01T09:00:00Z", updated_at: "2026-01-01T09:00:00Z", created_by: managerId, archived_at: null, archived_by: null,
    });
  }
  const batches = [], batch_items = [];
  const addBatch = (t, month, status, n, receivedShare) => {
    const id = uuid(); batches.push({ id, title: `كشف ${t.name} — ${month}`, type_id: t.id, type_name: t.name, unit: t.unit, template: t.template, month, status, single: false, cooldown: t.cooldown,
      created_at: `${month}-02T10:00:00Z`, created_by: managerId, approved_at: status !== "مسودة" ? `${month}-03T10:00:00Z` : null, approved_by: status !== "مسودة" ? managerId : null, paid_at: status === "مصروف" ? `${month}-20T10:00:00Z` : null, archived_at: null, archived_by: null });
    beneficiaries.filter(b => b.status === "نشط").sort(() => rnd() - 0.5).slice(0, n).forEach((b, i) => {
      const got = rnd() < receivedShare;
      batch_items.push({ id: uuid(), batch_id: id, beneficiary_id: b.id, position: i, code: b.code, name: b.name, national_id: b.national_id, phone: b.phone, family_size: b.family_size,
        value: t.template === "kind" && t.id === "eggs" ? b.family_size * 5 : t.amount, reason: "", received: got, received_at: got ? `${month}-10T10:00:00Z` : null, received_by: got ? helperId : null });
    });
  };
  addBatch(aid_types[0], "2026-07", "مصروف", 60, 0.97);
  addBatch(aid_types[2], "2026-06", "مصروف", 80, 0.92);
  addBatch(aid_types[4], "2026-08", "مصروف", 90, 0.85);
  addBatch(aid_types[0], "2026-09", "معتمد", 60, 0.4);
  addBatch(aid_types[5], "2026-09", "مسودة", 45, 0);
  const tasks = [
    { id: uuid(), title: "نتصل بمدرسة أولاد حالة 012 عشان شهادات القيد", notes: "", due: "2026-09-28", beneficiary_id: beneficiaries[11].id, assignee: workerId, done_at: null, done_by: null, created_at: "2026-09-20T09:00:00Z", created_by: managerId, archived_at: null },
    { id: uuid(), title: "نستلم كرتونة البيض من بنك الطعام", notes: "", due: "2026-09-22", beneficiary_id: null, assignee: null, done_at: null, done_by: null, created_at: "2026-09-18T09:00:00Z", created_by: managerId, archived_at: null },
  ];
  return { profiles, aid_types, beneficiaries, batches, batch_items, activity_log: [], calls: [], tasks, ids: { manager: managerId, worker: workerId, helper: helperId } };
}

export function createDemoClient(){
  const db = makeData();
  const roleParam = new URLSearchParams(location.search).get("demo");
  const asId = db.ids[roleParam] || (roleParam === "viewer" ? (db.profiles[1].role = "viewer", db.ids.worker) : db.ids.manager);
  let session = { user: { id: asId } };
  const netFail = () => window.demoOffline ? { data: null, error: { message: "Failed to fetch" } } : null;
  const delay = v => new Promise(r => setTimeout(() => r(v), 60 + Math.random() * 120));

  function query(table){
    const st = { op: "select", filters: [], order: null, range: null, limit: null, single: false, payload: null, returning: false };
    const rows = () => db[table];
    const match = r => st.filters.every(([c, v]) => r[c] === v);
    const run = () => {
      const f = netFail(); if(f) return f;
      const now = new Date().toISOString();
      if(st.op === "insert" || st.op === "upsert"){
        const list = (Array.isArray(st.payload) ? st.payload : [st.payload]).map(r => ({ ...r }));
        const out = list.map(r => {
          if(table === "beneficiaries" && r.national_id && rows().some(x => x.national_id === r.national_id && x.id !== r.id)) throw { message: "duplicate key value violates unique constraint national_id" };
          const i = r.id ? rows().findIndex(x => x.id === r.id) : -1;
          if(i >= 0){ Object.assign(rows()[i], r); return rows()[i]; }
          const row = { id: r.id || (table === "activity_log" ? rows().length + 1 : uuid()), created_at: now, ...(table === "activity_log" || table === "calls" ? { at: now, by: session.user.id } : {}), ...(table === "beneficiaries" ? { archived_at: null, tags: [], photos: {} } : {}), ...r };
          rows().push(row); return row;
        });
        return { data: st.single ? out[0] : out, error: null };
      }
      let found = rows().filter(match);
      if(st.op === "update"){ found.forEach(r => Object.assign(r, st.payload, table === "beneficiaries" ? { updated_at: now } : {})); const copy = found.map(r => JSON.parse(JSON.stringify(r))); return { data: st.single ? copy[0] : copy, error: null }; }
      if(st.op === "delete"){ db[table] = rows().filter(r => !match(r)); return { data: found, error: null }; }
      if(st.order){ const [c, asc] = st.order; found = [...found].sort((a, b) => (a[c] > b[c] ? 1 : a[c] < b[c] ? -1 : 0) * (asc ? 1 : -1)); }
      if(st.range) found = found.slice(st.range[0], st.range[1] + 1);
      if(st.limit != null) found = found.slice(0, st.limit);
      found = found.map(r => JSON.parse(JSON.stringify(r)));
      if(st.single) return found.length ? { data: found[0], error: null } : { data: null, error: { message: "no rows" } };
      return { data: found, error: null };
    };
    const b = {
      select(){ if(st.op !== "select") st.returning = true; return b; },
      insert(p){ st.op = "insert"; st.payload = p; return b; }, upsert(p){ st.op = "upsert"; st.payload = p; return b; },
      update(p){ st.op = "update"; st.payload = p; return b; }, delete(){ st.op = "delete"; return b; },
      eq(c, v){ st.filters.push([c, v]); return b; }, order(c, o = {}){ st.order = [c, o.ascending !== false]; return b; },
      range(a, z){ st.range = [a, z]; return b; }, limit(n){ st.limit = n; return b; }, single(){ st.single = true; return b; },
      then(res, rej){ let out; try{ out = run(); }catch(e){ out = { data: null, error: e }; } return delay(out).then(res, rej); },
    };
    return b;
  }
  const listeners = [], photos = new Map();
  return {
    demo: true,
    auth: {
      getSession: async () => ({ data: { session } }),
      signInWithPassword: async () => { session = { user: { id: asId } }; return { data: { session }, error: null }; },
      signOut: async () => { session = null; listeners.forEach(f => f("SIGNED_OUT")); return { error: null }; },
      onAuthStateChange: f => { listeners.push(f); return { data: { subscription: { unsubscribe(){} } } }; },
      updateUser: async () => ({ data: {}, error: null }),
    },
    from: query,
    // Photos stay in this tab's memory only.
    storage: { from: () => ({
      upload: async (path, blob) => { await delay(); const f = netFail(); if(f) return f; photos.set(path, blob); return { data: { path }, error: null }; },
      download: async path => { await delay(); return photos.has(path) ? { data: photos.get(path), error: null } : { data: null, error: { message: "not found" } }; },
    }) },
    rpc: async (fn, args) => {
      await delay(); const f = netFail(); if(f) return f;
      if(fn === "set_received"){ const it = db.batch_items.find(x => x.id === args.item_id); if(!it) return { error: { message: "not found" } };
        it.received = args.is_received; it.received_at = args.is_received ? new Date().toISOString() : null; it.received_by = args.is_received ? session.user.id : null; return { data: null, error: null }; }
      return { data: null, error: { message: "unknown rpc" } };
    },
    functions: { invoke: async (name, { body }) => { await delay(); if(body.action === "status") return { data: { hasManager: true }, error: null };
      if(body.action === "create"){ db.profiles.push({ id: uuid(), full_name: body.full_name, username: body.username, role: body.role, active: true, created_at: new Date().toISOString() }); return { data: { ok: true }, error: null }; }
      return { data: { ok: true }, error: null }; } },
    channel: () => { const c = { on: () => c, subscribe: () => c }; return c; },
    removeChannel: () => {},
  };
}
