// Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseNID, latinDigits, norm, cleanPhone, validPhone, age, mIdx, mLabel, toNumber } from "../core.js";

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
