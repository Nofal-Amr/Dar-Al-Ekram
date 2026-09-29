// Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseNID, latinDigits, norm, cleanPhone, validPhone, phoneIssue, jpegsToPdf, assignKids, parseKidAge, age, mIdx, mLabel, toNumber } from "../core.js";

const today = new Date("2026-09-24T12:00:00");

test("national ID: valid male born 1990 in الدقهلية", () => {
  const r = parseNID("29001011201234", today);
  assert.equal(r.ok, true);
  assert.equal(r.birth, "1990-01-01");
  assert.equal(r.gender, "ذكر");
  assert.equal(r.governorate, "الدقهلية");
});

test("national ID: 2000s century and female", () => {
  const r = parseNID("31503150100028", today);
  assert.equal(r.ok, true);
  assert.equal(r.birth, "2015-03-15");
  assert.equal(r.gender, "أنثى");
});

test("national ID: Arabic-Indic digits and spaces are accepted", () => {
  assert.equal(parseNID("٢٩٠٠١٠١ ١٢٠١٢٣٤", today).birth, "1990-01-01");
});

test("national ID: rejects wrong length, century, date, governorate and future births", () => {
  assert.match(parseNID("2900101120123", today).error, /١٤ رقم/);
  assert.match(parseNID("19001011201234", today).error, /2 أو 3/);
  assert.match(parseNID("29002301201234", today).error, /مش صحيح/);      // 30 Feb
  assert.match(parseNID("29001019901234", today).error, /المحافظة/);
  assert.match(parseNID("33001011201234", today).error, /المستقبل/);    // 2030
  assert.equal(parseNID("", today).empty, true);
});

test("digits and Arabic normalisation", () => {
  assert.equal(latinDigits("٠١٢٣٤٥٦٧٨٩"), "0123456789");
  assert.equal(norm("أسماء  فاطمة"), norm("اسماء فاطمه"));
  assert.equal(norm("مُحَمَّد"), "محمد");
});

test("phones", () => {
  assert.equal(cleanPhone("+20 101 234 5678"), "01012345678");
  assert.equal(cleanPhone("١٠١٢٣٤٥٦٧٨"), "01012345678");
  assert.equal(validPhone("01012345678"), true);
  assert.equal(validPhone("0101234567"), false);
  assert.equal(validPhone("01312345678"), false);
});

test("age respects birthdays", () => {
  assert.equal(age("2008-09-25", today), 17);
  assert.equal(age("2008-09-24", today), 18);
  assert.equal(age("", today), "");
});

test("months", () => {
  assert.equal(mIdx("2026-01") - mIdx("2025-12"), 1);
  assert.equal(mLabel("2026-10"), "أكتوبر 2026");
});

test("toNumber reads messy money strings", () => {
  assert.equal(toNumber("1,500"), 1500);
  assert.equal(toNumber("٢٠٠ ج"), 200);
  assert.equal(toNumber("لا يوجد"), null);
});

import { normalizeStage, nextStage, inSchool, schoolYear, STAGES, famSize, shareFor, sortPool, planShares, minPin } from "../core.js";

test("school stages from the old sheets are read into the fixed list", () => {
  const cases = { "1 اع":"أولى إعدادي", "اول اعدادي":"أولى إعدادي", "ثاث اعدادي":"تالتة إعدادي", "4ابت":"رابعة ابتدائي", "السادس الابتددائي":"سادسة ابتدائي",
    "رابعه ابتدائى":"رابعة ابتدائي", "2 ث ص":"تانية ثانوي صناعي", "2ث ع":"تانية ثانوي عام", "2ث أز":"تانية ثانوي أزهري", "ثالثة ثانوي عام":"تالتة ثانوي عام", "3 ثانوي صناعي":"تالتة ثانوي صناعي",
    "الاول الثنوي":"أولى ثانوي عام", "اولى معهد تمريض":"أولى معهد", "2 ك تربية":"تانية جامعة", "تحت السن  يتيمة":"تحت السن", "ت السن":"تحت السن", "حاصلة على دبلوم":"خلص دبلوم",
    "خلصت كلية تجارة انتساب":"خلص جامعة", "خارج التعليم":"خارج التعليم", "أولى إعدادي":"أولى إعدادي" };
  for(const [raw, want] of Object.entries(cases)) assert.equal(normalizeStage(raw), want, raw);
  for(const raw of ["اولى ثانوي فني","معهد","-","متزوجة","كلة تربية نوعية"]) assert.equal(normalizeStage(raw), "", raw);
  for(const [raw] of Object.entries(cases)) assert.ok(!normalizeStage(raw) || STAGES.includes(normalizeStage(raw)));
});

test("next stage after the yearly certificate", () => {
  assert.equal(nextStage("تالتة ابتدائي"), "رابعة ابتدائي");
  assert.equal(nextStage("سادسة ابتدائي"), "أولى إعدادي");
  assert.equal(nextStage("تالتة إعدادي"), "");            // family picks the ثانوي track
  assert.equal(nextStage("تانية ثانوي تجاري"), "تالتة ثانوي تجاري");
  assert.equal(nextStage("تالتة ثانوي تجاري"), "");                 // تجاري: 3 سنين
  assert.equal(nextStage("تالتة ثانوي صناعي"), "رابعة ثانوي صناعي");  // صنايع: لحد 5 سنين
  assert.equal(nextStage("خامسة ثانوي صناعي"), "");
  assert.equal(normalizeStage("5 ثانوي صناعي"), "خامسة ثانوي صناعي");
  assert.equal(normalizeStage("4 ث ع"), "");
  assert.equal(nextStage("رياض أطفال ٢"), "أولى ابتدائي");
  assert.equal(nextStage("كلام قديم"), "");
  assert.equal(inSchool("أولى جامعة"), true);
  assert.equal(inSchool("تحت السن"), false);
  assert.equal(schoolYear(new Date("2026-09-26")), 2026);
  assert.equal(schoolYear(new Date("2027-05-01")), 2026);
});

test("shares: fixed, per member and tiers", () => {
  assert.equal(shareFor({ mode:"fixed", per:200 }, 5), 200);
  assert.equal(shareFor({ mode:"member", per:1 }, 4), 4);
  assert.equal(shareFor({ mode:"member", per:1 }, 0), 1);          // unknown size counts as 1
  assert.equal(shareFor({ mode:"tiers", cut:3, small:0.5, big:1 }, 3), 0.5);
  assert.equal(shareFor({ mode:"tiers", cut:3, small:0.5, big:1 }, 4), 1);
  assert.equal(famSize({ familySize:null, children:[{},{}] }), 3);
});

test("planning: the slide example — 10 kg, ≤3 members = ½ kg, bigger = 1 kg", () => {
  const fam = n => ({ b:{ code:String(n), familySize:n <= 15 ? 3 : 5, score:50 } });
  const pool = Array.from({ length:17 }, (_,i) => fam(i+1));
  const r = planShares(pool, { mode:"tiers", cut:3, small:0.5, big:1 }, { total:10 });
  assert.equal(r.used, 9.5); assert.equal(r.picked.length, 17); assert.equal(r.left, 0.5);
});

test("planning stops at the first family that doesn't fit (no queue jumping)", () => {
  const pool = [{ b:{code:"1",familySize:6} }, { b:{code:"2",familySize:5} }, { b:{code:"3",familySize:1} }];
  const r = planShares(pool, { mode:"member", per:1 }, { total:10 });
  assert.deepEqual(r.picked.map(x => x.b.code), ["1"]);
  assert.equal(r.rest.length, 2); assert.equal(r.members, 6);
});

test("priority orders", () => {
  const P = [{ b:{code:"1",score:50,familySize:2}, lm:"2026-08" }, { b:{code:"2",score:80,familySize:3} }, { b:{code:"3",score:null,familySize:7}, missed:true }];
  assert.deepEqual(sortPool(P,"score").map(x=>x.b.code), ["3","2","1"]);           // didn't come last time → first
  assert.deepEqual(sortPool(P,"score",false).map(x=>x.b.code), ["2","1","3"]);
  assert.deepEqual(sortPool(P,"family",false).map(x=>x.b.code), ["3","2","1"]);
  assert.deepEqual(sortPool(P,"wait",false).map(x=>x.b.code), ["2","3","1"]);
  assert.equal(minPin("manager"), 8); assert.equal(minPin("worker"), 6);
});

import { weekdaysOf, dayLabel } from "../core.js";
test("Saturdays of a month: 4 or 5, never a fixed 5", () => {
  assert.deepEqual(weekdaysOf("2026-08"), ["2026-08-01","2026-08-08","2026-08-15","2026-08-22","2026-08-29"]);
  assert.equal(weekdaysOf("2026-10").length, 5);
  assert.equal(weekdaysOf("2026-09").length, 4);
  assert.equal(weekdaysOf("2026-02").length, 4);
  assert.equal(dayLabel("2026-10-03"), "السبت 3 أكتوبر");
});

import { daysText } from "../core.js";
test("days of a list read naturally", () => {
  assert.equal(daysText(["2026-09-26"]), "السبت 26 سبتمبر");
  assert.equal(daysText(["2026-10-03","2026-09-26"]), "السبت 26 سبتمبر و3 أكتوبر");
  assert.equal(daysText(["2026-10-03","2026-10-10","2026-10-17"]), "السبت 3، 10 و17 أكتوبر");
  assert.equal(daysText([]), "");
});

import { countStudents } from "../core.js";
test("students in a family", () => {
  const t = new Date("2026-09-26");
  assert.equal(countStudents([{school:"تحت السن",birth:"2023-08-26"},{school:"رياض اطفال",birth:"2020-06-04"},{school:"ثالثة ابتدائي",birth:"2017-06-20"}], t), 1);
  assert.equal(countStudents([{school:"حاصله على دبلوم"},{school:"الاول الثنوي"},{school:"الاول الاعدادي"},{school:"الخامس الابتدائي"}], t), 3);
  assert.equal(countStudents([{school:"",birth:"2015-09-05"},{school:"-",birth:"2022-09-18"}], t), 1);   // no stage: counted by age
  assert.equal(countStudents([], t), 0);
});

test("per-student shares: a family with no students gets nothing", () => {
  assert.equal(shareFor({ mode:"student", per:1 }, 5, 0), 0);
  assert.equal(shareFor({ mode:"student", per:2 }, 5, 3), 6);
  const r = planShares([{ b:{code:"1",familySize:4}, students:2 }, { b:{code:"2",familySize:3}, students:0 }], { mode:"student", per:1 });
  assert.equal(r.used, 2);
});

import { rowsFromSheet, matchPerson } from "../core.js";
test("reads an office Excel list and matches people", () => {
  const aoa = [["جمعيه دار الاكرام"],["المسجله تحت رقم 1401 لسنه 2009"],["كشف صرف وجبات مدرسية"],["عن شهر سبتمبر / 2026"],[],
    ["م","الاســــــــم","الــرقم القـــومي","التوقيع","عدد"],
    [1,"نـــورا عرفه سليمان عبدالنــعيم","29903201401304","",3],
    [2,"سحر السيد رزق مصطفي","","",4],
    [3,"فلانة مش موجودة خالص","29001011201234","",2],
    ["الاجمــــالي","","","",9],["تم الصرف بمعرفه","أمين الصندوق","رئيس الجمعيه"]];
  const rows = rowsFromSheet(aoa);
  assert.deepEqual(rows.map(r => [r.name, r.nid, r.count]), [["نورا عرفه سليمان عبدالنعيم","29903201401304",3],["سحر السيد رزق مصطفي","",4],["فلانة مش موجودة خالص","29001011201234",2]]);
  const P = [{ name:"نورا عرفه سليمان", nationalId:"29903201401304" }, { name:"سحر السيد رزق مصطفى", nationalId:"28307071402286" }];
  assert.equal(matchPerson(rows[0], P).how, "nid");
  assert.equal(matchPerson(rows[1], P).how, "name");           // ي/ى spelled differently still matches
  assert.equal(matchPerson(rows[2], P).b, null);
  // no header row at all: any 14 digits = ID, longest Arabic text = name
  assert.deepEqual(rowsFromSheet([["", "هبه محمد عبده السيد", "29601311400145"]]).map(r => r.nid), ["29601311400145"]);
});

import { crossCheck } from "../core.js";
test("PDF cross-check against the case on the site", () => {
  const b = { name:"نورا عرفه سليمان", nationalId:"29903201401304", phone:"01098945258", phone2:"", whatsapp:"01098945258", familySize:4,
    children:[{ name:"رودينا ياسر", nid:"31706200200021" }, { name:"فريدة ياسر", nid:"" }] };
  const text = `نموذج انضمام   إسم الأم رباعي: نورا عرفه سليمان عبدالنعيم   رقم البطاقة : ٢٩٩٠٣٢٠١٤٠١٣٠٤
    رقم التليفون : 01098945258 / 01123456789   اجمالي عدد أفراد الأسرة : 5
    أسماء الأطفال: رودينا ياسر 31706200200021 ، معاذ ياسر 32308260200015`;
  const r = crossCheck(text, b, new Date("2026-09-26"));
  assert.ok(r.readable);
  assert.ok(r.ok.some(x => x.includes("29903201401304")));
  assert.ok(r.ok.some(x => x.includes("الاسم")));
  assert.ok(r.ok.some(x => x.includes("رودينا")));
  assert.ok(r.diff.some(x => x.includes("عدد الأفراد: الملف 5")));
  assert.ok(r.diff.some(x => x.includes("فريدة")));                // on the site, not in the file
  assert.ok(r.extra.some(x => x.includes("01123456789")));
  assert.ok(r.extra.some(x => x.includes("32308260200015")));       // a child in the file, not on the site
  assert.equal(crossCheck("   ", b).readable, false);               // a scanned image has no text
});

import { matchFileName } from "../core.js";
test("which case a file is for, from its name", () => {
  const P = [{ code:"161", name:"نورا عرفه سليمان", nationalId:"29903201401304" }, { code:"045", name:"سحر السيد رزق مصطفى", nationalId:"28307071402286" }, { code:"046", name:"سحر عطا عبدالخالق", nationalId:"" }];
  assert.equal(matchFileName("29903201401304.pdf", P).b.code, "161");
  assert.equal(matchFileName("ملف نورا عرفه سليمان.pdf", P).b.code, "161");
  assert.equal(matchFileName("نورا_عرفه.pdf", P).b.code, "161");              // part of the name is enough when only one case fits
  assert.equal(matchFileName("045.pdf", P).b.code, "045");
  assert.equal(matchFileName("45 سحر.pdf", P).b.code, "045");                  // «سحر» alone fits two cases → falls back to the case number
  assert.equal(matchFileName("سحر.pdf", P).b, null);
  assert.equal(matchFileName("scan0001.pdf", P).b, null);
});

test("phoneIssue flags missing and broken numbers", () => {
  assert.equal(phoneIssue("01012345678"), "");
  assert.equal(phoneIssue("+20 101 234 5678"), "");
  assert.equal(phoneIssue("٠١١٢٣٤٥٦٧٨٩"), "");
  assert.equal(phoneIssue("0224567890"), "");
  assert.equal(phoneIssue(""), "none");
  assert.equal(phoneIssue(null), "none");
  assert.equal(phoneIssue("0101234567"), "bad");
  assert.equal(phoneIssue("010123456789"), "bad");
  assert.equal(phoneIssue("01812345678"), "bad");
});

test("jpegsToPdf builds a PDF whose xref points at every object", () => {
  const jpeg = new Uint8Array([0xFF,0xD8,0xFF,0xD9]);
  const pdf = jpegsToPdf([{ jpeg, w:10, h:20, pw:595.28, ph:841.89 }, { jpeg, w:5, h:5, pw:100, ph:100 }]);
  const txt = Buffer.from(pdf).toString("latin1");
  assert.ok(txt.startsWith("%PDF-1.4"));
  assert.ok(txt.trimEnd().endsWith("%%EOF"));
  assert.match(txt, /\/Count 2/);
  const startx = +/startxref\n(\d+)/.exec(txt)[1];
  assert.equal(txt.slice(startx, startx + 4), "xref");
  const offs = [...txt.slice(startx).matchAll(/^(\d{10}) 00000 n $/gm)].map(m => +m[1]);
  assert.equal(offs.length, 8);
  offs.forEach((o, i) => assert.equal(txt.slice(o, o + String(i + 1).length + 6), `${i + 1} 0 obj`));
});

test("assignKids splits kids by sex and age range, balanced, siblings together", () => {
  const kids = [
    { id:"1", fam:"A", a:5, sex:"ولد" }, { id:"2", fam:"A", a:7, sex:"ولد" }, { id:"3", fam:"B", a:6, sex:"ولد" }, { id:"4", fam:"C", a:8, sex:"ولد" },
    { id:"5", fam:"B", a:9, sex:"بنت" }, { id:"6", fam:"D", a:12, sex:"بنت" }, { id:"7", fam:"E", a:null, sex:"بنت" }, { id:"8", fam:"F", a:4, sex:null },
    { id:"9", fam:"G", a:15, sex:"ولد" },
  ];
  const sups = [ { id:"m1", takes:"ولاد", min:0, max:10 }, { id:"m2", takes:"ولاد", min:0, max:10 }, { id:"w1", takes:"بنات", min:"", max:"" } ];
  const { groups, left } = assignKids(kids, sups);
  const ids = s => groups.get(s).map(k => k.id);
  assert.equal(ids("m1").length + ids("m2").length, 4);                 // the four boys up to 10
  assert.ok(Math.abs(ids("m1").length - ids("m2").length) <= 1);         // balanced
  const withA = ["m1","m2"].find(s => ids(s).includes("1"));
  assert.ok(ids(withA).includes("2"));                                    // brothers together
  assert.deepEqual(ids("w1").sort(), ["5","6","7"]);                       // girls, any age (even unknown)
  assert.deepEqual(left.map(x => x.kid.id).sort(), ["8","9"]);
  assert.equal(left.find(x => x.kid.id === "8").why, "مش محدد ولد ولا بنت");
  assert.match(left.find(x => x.kid.id === "9").why, /مفيش مشرف ولاد لسن 15/);
  assert.deepEqual(groups.get("w1").map(k => k.a), [9, 12, null]);        // sorted by age, unknown last
});
test("assignKids: no supervisors → everyone left with a reason", () => {
  const { left } = assignKids([{ id:"1", fam:"A", a:3, sex:"ولد" }], []);
  assert.equal(left[0].why, "مفيش مشرفين لسه");
});

test("parseKidAge reads a number or a school year", () => {
  assert.deepEqual(parseKidAge("9"), { age:9, stage:null });
  assert.deepEqual(parseKidAge("١٢"), { age:12, stage:null });
  assert.deepEqual(parseKidAge("3 ثانوي"), { age:17, stage:"تالتة ثانوي عام" });
  assert.deepEqual(parseKidAge("تانية ابتدائي"), { age:7, stage:"تانية ابتدائي" });
  assert.deepEqual(parseKidAge("1 اع"), { age:12, stage:"أولى إعدادي" });
  assert.deepEqual(parseKidAge("KG2"), { age:5, stage:"رياض أطفال ٢" });
  assert.deepEqual(parseKidAge("حضانة"), { age:4, stage:"حضانة" });
  assert.deepEqual(parseKidAge("مش عارفة"), { age:null, stage:"مش عارفة" });
  assert.deepEqual(parseKidAge(""), { age:null, stage:null });
});

/* ---------- regressions fixed in the v1.3.33 review ---------- */
import { addDays, addMonths, parseDate } from "../core.js";

test("date maths is calendar-exact (no DST slip), months clamp to the month's end", () => {
  assert.equal(addDays("2026-04-20", 10), "2026-04-30");      // across Egypt's spring DST switch
  assert.equal(addDays("2026-03-01", -1), "2026-02-28");
  assert.equal(addMonths("2026-01-15", 6), "2026-07-15");
  assert.equal(addMonths("2026-08-31", 6), "2027-02-28");
  assert.equal(addMonths("2026-12-10", 1), "2027-01-10");
});

test("hand-typed dates", () => {
  assert.equal(parseDate("1/5/1980", today), "1980-05-01");
  assert.equal(parseDate("١٥/٣/٢٠١٢", today), "2012-03-15");
  assert.equal(parseDate("2012-03-15", today), "2012-03-15");
  assert.equal(parseDate("31/2/2012", today), "");
  assert.equal(parseDate("1/1/2030", today), "");             // future
  assert.equal(parseDate("مش عارفة", today), "");
});

test("trip ages written with a word", () => {
  assert.equal(parseKidAge("9 سنين").age, 9);
  assert.equal(parseKidAge("٩ سنه").age, 9);
  assert.equal(parseKidAge("12 سنة").age, 12);
  assert.equal(parseKidAge("7").age, 7);
});

test("PDF check never glues two numbers together", () => {
  const b = { name:"نورا عرفه سليمان عبدالنعيم", nationalId:"29903201401304", phone:"01123456789" };
  const r = crossCheck("الاسم نورا عرفه سليمان عبدالنعيم التليفون 01098945258 01123456789 الرقم 2 9 9 0 3 2 0 1 4 0 1 3 0 4 وكلام كفاية", b, today);
  assert.equal(r.diff.length, 0);
  assert.ok(r.ok.some(x => x.includes("01123456789")));
  assert.ok(r.ok.some(x => x.includes("29903201401304")));
});

test("per-student shares: families with no students are left out, not listed with 0", () => {
  const r = planShares([{ b:{code:"1",familySize:4}, students:2 }, { b:{code:"2",familySize:3}, students:0 }], { mode:"student", per:1 });
  assert.deepEqual(r.picked.map(x => x.b.code), ["1"]);
  assert.equal(r.zero.length, 1);
});

test("Excel: a national ID stored as a number keeps all 14 digits", () => {
  const rows = rowsFromSheet([["م","الاسم","الرقم القومي"],[1,"نورا عرفه سليمان",29903201401304]]);
  assert.equal(rows[0].nid, "29903201401304");
});
