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
