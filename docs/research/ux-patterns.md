# UX patterns for Dar El Ekram: intake, distribution planning, scoring, donor reporting

Researched 2026-09-24 from official docs, help centres and published guidance. **[unverified]** marks a claim I could only see in a search-result snippet or secondary source because the primary page was blocked (403/502) or would not load.

## Summary

- Mature aid tools all use the same basic model. There is a **household (parent)** with **members (children)**, an **intervention or program**, a **distribution cycle**, a **distribution list**, and a **per-household record of whether they collected**. Dar El Ekram's planned features (a)–(d) already follow this model, so the job is mostly naming and simplification.
- WFP SCOPE has a built-in setting called **"Tiered transfer value"**, where the household-size bracket sets the amount. That is the same idea as our "≤3 members = 0.5 kg, ≥4 = 1 kg" tiers, so the tiers feature follows an established pattern.
- Food-bank tools (Link2Feed, Oasis, PantryTrak) all make staff **search before creating** a new client. They show a **household summary** (size by age group, recent visits, eligibility) before any action, and they **grey out** actions a household isn't eligible for.
- Oasis explicitly supports **printed rosters with checkmarks, entered later in bulk**. This fits the office PC and paper كشوفات exactly.
- IFRC targeting guidance recommends **simple scorecards that non-technical staff can adjust**, a **cut-off threshold**, **field verification of at least 10% of households**, and a **complaints channel**. Our 53-point form with A/B/C grades fits this.
- Egyptian Food Bank publishes a public "Right to Know" portal: beneficiaries, families, spending by program, and administrative-cost %. That structure is worth copying at small scale for donor reports.

---

## 1. Case intake and household-member entry (feature a)

**1.1 Search before create (بحث قبل الإضافة).** Link2Feed guides say "Always search for a client before clicking 'Add New Client'". The search accepts name, ID, date of birth, address, phone or barcode, and shows matches in a dropdown with name and birthdate ([CAFB Link2Feed guide](https://www.capitalareafoodbank.org/wp-content/uploads/2019/11/NEW-CAFB-L2F-User-Guide.pdf)). Primero's "NEW CASE" button also opens a search modal first ([Primero CPIMS User Guide](https://github.com/primeroIMS/PrimeroCPIMSUserGuide/blob/master/UsersGuide.md)).
*Adopt:* the "إضافة حالة" button opens a single box: «اكتب الرقم القومي أو الاسم أو الموبايل — لو الحالة موجودة هتظهر هنا». Only show «مش لاقيها؟ ضيف حالة جديدة» after a search.
*Why:* with ~210 families, the search can run on data already loaded in the browser, which is instant even on Chrome 109.

**1.2 Search by the strongest identifier first.** Oasis tells staff to "ALWAYS search a client by DATE OF BIRTH", because name spellings vary ([FBNN Oasis guide](https://www.fbnn.org/wp-content/uploads/2023/02/Oasis-User-Guide.pdf)). In Egypt the equivalent is the **14-digit national ID**. It encodes century, birth date (YYMMDD), governorate code, a serial whose second-to-last digit gives gender (odd = male), and a check digit ([Wikipedia](https://en.wikipedia.org/wiki/Egyptian_National_Identity_Card); [community decoder](https://github.com/sekkena/egypt-id-decode)).
*Adopt:* when the ID is typed, auto-fill تاريخ الميلاد, السن and النوع, and show them for confirmation: «المولود ١٢/٣/٢٠١٤ — ولد — ١٢ سنة. صح؟».
**[unverified]** No official public spec for the check-digit algorithm was found. On a checksum failure, show a warning and allow saving; don't hard-block.

**1.3 Duplicate warning while typing.** Link2Feed warns about possible duplicates once first and last name are entered and tells staff to click "View/See More" before continuing ([CAFB guide](https://www.capitalareafoodbank.org/wp-content/uploads/2019/11/NEW-CAFB-L2F-User-Guide.pdf)). Primero ranks duplicates as "Possible" or "Likely" ([Primero guide](https://github.com/primeroIMS/PrimeroCPIMSUserGuide/blob/master/UsersGuide.md)).
*Adopt:* two levels:
- «الرقم القومي ده متسجل قبل كده في أسرة (...)» blocks saving, because one person can't be in two households.
- «في اسم شبه ده في أسرة تانية» is only a warning.

**1.4 Members as repeating rows under the household.** KoboToolbox uses a "repeat group" to ask the same questions for each household member, with dynamic labels such as "Child 1, Child 2" via `position(..)` and totals via `count()` ([Kobo XLSForm repeats](https://support.kobotoolbox.org/repeat_groups_xls.html), [Formbuilder](https://support.kobotoolbox.org/group_repeat.html)). CommCare creates a child case per household member from a repeat group, linked to the parent case (per the official help page [Child Cases](https://dimagi.atlassian.net/wiki/display/commcarepublic/Child+Cases), **[unverified]**: page body didn't render, snippet only). Oasis has "Add Another Household Member" and "Save Household Members" buttons ([FBNN guide](https://www.fbnn.org/wp-content/uploads/2023/02/Oasis-User-Guide.pdf)).
*Adopt:* the household card holds a compact member table (الاسم، الرقم القومي، صلة القرابة، السن، المرحلة الدراسية) and one «+ ضيف فرد» button that adds a blank row inline. The header shows the live count: «أفراد الأسرة (٥) — منهم ٣ في المدارس».
*Why:* one screen, no modal stacking, cheap to render on a weak PC.

**1.5 Active vs inactive members.** PantryTrak staff must "be aware of Active vs Inactive household members, as it affects household size" ([MOFC PantryTrak compliance card](https://mofc.org/wp-content/uploads/2025/05/PantryTrak-Compliance-card.pdf)).
*Adopt:* never delete a member. Mark them «مش مقيم دلوقتي» (moved out, married, deceased) with a date. Household size and the planner's statistics count active members only.

**1.6 Show what's missing, don't block.** PantryTrak highlights missing information in yellow/pink boxes, to be completed "with client present" ([MOFC card](https://mofc.org/wp-content/uploads/2025/05/PantryTrak-Compliance-card.pdf)). Primero shows a red number next to each form section with the count of unfilled required fields, and marks required fields with a red star ([Primero guide](https://github.com/primeroIMS/PrimeroCPIMSUserGuide/blob/master/UsersGuide.md)).
*Adopt:* the case list shows a small badge «ناقص ٣ بيانات». The household page highlights empty fields in soft yellow. Save is allowed; only the national ID and the head of household are mandatory.

**1.7 Stage of schooling as a field, not free text.** The planner filters by "children in school stage X", so store a fixed dropdown per member: «مش في سن الدراسة / حضانة / ابتدائي / إعدادي / ثانوي / جامعة / متسرب». *(Design recommendation; no product source.)*

**1.8 Alert notes shown on open.** When a client is opened, Oasis lands on the "Alerts" page first if the client has any alerts ([FBNN guide](https://www.fbnn.org/wp-content/uploads/2023/02/Oasis-User-Guide.pdf)). Link2Feed separates alert notes from private notes ([CAFB guide](https://www.capitalareafoodbank.org/wp-content/uploads/2019/11/NEW-CAFB-L2F-User-Guide.pdf)). Primero has case "flags", and only the person who flagged can unflag ([Primero guide](https://github.com/primeroIMS/PrimeroCPIMSUserGuide/blob/master/UsersGuide.md)).
*Adopt:* one «تنبيه» field shown as a red strip at the top of the household card and next to the name on printed lists, for example «الاستلام بالتوكيل للجدة».

---

## 2. Distribution planning and collection tracking (feature b)

**2.1 Use cycle + list + entitlement as the data model.** In WFP SCOPE you schedule a "distribution cycle" for an intervention, create a "distribution list" deciding "which beneficiaries will receive entitlements during a distribution cycle", then **verify the distribution list** ([SCOPE manual: Distribution](https://usermanual.scope.wfp.org/cash-accounts/content/intros_to_sections/distribution_section.htm)). Salesforce Nonprofit Cloud models this as Benefit → Benefit Assignment (eligibility) → Benefit Disbursement ("when it was provided and how much was given… time, money, goods") ([Trailhead](https://trailhead.salesforce.com/content/learn/modules/attendance-and-benefit-tracking-in-nonprofit-cloud-for-programs/get-to-know-enrollments-and-deliveries)).
*Adopt:* three tables:
- `distributions` (الصنف، الكمية المتاحة، المتبرع، التاريخ)
- `distribution_households` (the frozen list with computed entitlement)
- a `collected_at` / status field.

Once printed, the list is **frozen**; later case edits don't change it.

**2.2 Tiered entitlement by household size, with a named precedent.** SCOPE's "Transfer household dependency" setting has these options ([SCOPE intervention fields](https://usermanual.scope.wfp.org/scope-cards/content/common_topics/field_subtopics/enter_intervention_information_fields.htm)):
- **Fixed:** same for everyone.
- **Variable:** proportional to household size.
- **Tiered transfer value:** each tier has a household-size range.
- **Variable + Fixed**

*Adopt exactly these three options* in the planner step «هنوزع إزاي؟»:
- «كمية ثابتة لكل أسرة»
- «حسب عدد الأفراد (لكل فرد …)»
- «شرائح»: for example ١–٣ أفراد = ½ كيلو، ٤+ = ١ كيلو

Add a 4th basis, **per school child**, for school supplies (شنطة المدرسة).

**2.3 Live "needed vs available" with a suggested cap.** Foodlink's client-choice handbook gives the rule: with 10 dozen eggs and 10+ households expected, limit eggs to one dozen per household. Allocations follow household-size guidelines ([Foodlink Client Choice Handbook](https://foodlinkny.org/wp-content/uploads/2022/09/Client-Choice-Handbook-2022.pdf)). Feeding America-style client choice allots quantities or points by household size (**[unverified]**: Feeding America Learning Hub PDF unreachable, snippet only).
*Adopt:* a sticky bar under the tier editor: «المطلوب ١٤٧ كيلو — المتاح ١٢٠ كيلو — ناقص ٢٧». Offer three fixes as buttons:
- «قلّل الشرايح بالنسبة»
- «رتّب بالأولوية واقطع عند المتاح»
- «زوّد الكمية»

The math is trivial client-side for ~210 rows.

**2.4 Household summary before acting.** Link2Feed's visit page opens with a Household Summary: household size broken down by age, number of visits in the last 30 days, and eligible programs. The "New TEFAP Visit" button is **greyed out** when the client isn't eligible ([CAFB guide](https://www.capitalareafoodbank.org/wp-content/uploads/2019/11/NEW-CAFB-L2F-User-Guide.pdf)).
*Adopt:* in the planner, each filtered-out household is kept visible, not hidden, with a grey row and a reason chip: «خدت المرة اللي فاتت» / «درجة أقل من ٣٠» / «مفيش أطفال في ابتدائي». Staff can override with a tick and a mandatory reason. This makes the filter explainable, which matters when a family complains.

**2.5 Planner statistics as two small count tables, not charts.** Link2Feed's Interactive Household Report lets users pivot by age group ([CAFB guide](https://www.capitalareafoodbank.org/wp-content/uploads/2019/11/NEW-CAFB-L2F-User-Guide.pdf)). SCOPE has a "Planned households" figure ([SCOPE fields](https://usermanual.scope.wfp.org/scope-cards/content/common_topics/field_subtopics/enter_intervention_information_fields.htm)).
*Adopt:* «عدد الأسر حسب عدد الأفراد» (1, 2, 3, 4, 5, 6+) and «حسب عدد أطفال المدارس» (0, 1, 2, 3+) as plain tables with a CSS bar in each cell. Clicking a row filters the list. No chart library needed on Chrome 109.

**2.6 Printed roster with checkmarks, bulk entry afterwards.** Oasis documents printing a roster, ticking names at a distribution without internet, and later using "Add Multiple Assistance": type each case number, press "Add Case", then submit. People not on the roster are treated as new clients and registered on paper ([FBNN Oasis guide](https://www.fbnn.org/wp-content/uploads/2023/02/Oasis-User-Guide.pdf)). RedRose's field officer scans a barcode on the list, then "beneficiary and field officer sign the list" ([RedRose training docs](https://training.redrosecps.com/rst/beneficiary_management.html), **[unverified]**: page returned 502, snippet only).
*Adopt:* the printed كشف has these columns: م، رقم الكشف، اسم المستلم، عدد الأفراد، **الكمية المستحقة**، التوقيع/البصمة، ملاحظات. Put a short household code (e.g. `K-047`) in a large font. The after-day screen is «تسجيل الاستلام من الكشف الورقي»: type or tick codes, which are marked استلم, and everything else is left لم يحضر.

**2.7 Phone check-off on distribution day.** UNHCR's Global Distribution Tool takes distribution lists (from proGres or elsewhere) and reports in real time who has collected, which households were served and which commodities were distributed (per [UNHCR registration guidance](https://www.unhcr.org/registration-guidance/chapter3/registration-tools/), **[unverified]**: page 403, snippet only).
*Adopt:* a phone view with big rows (name, code, quantity) and one large «استلم ✓» button per row, plus a counter «استلم ٨٧ من ١٢٠». Add «استلم بالنيابة» with a free-text name. Link2Feed notes that one person picking up for several households must be recorded per household ([Link2Feed search result](https://link2feed.zendesk.com/hc/en-us/articles/11774558827796-Frequently-asked-questions), **[unverified]**).

**2.8 The whole household gets credit.** Link2Feed defaults "Who from the household is receiving services" to everyone, "preventing any other household members from receiving food… more than once per day" ([CAFB guide](https://www.capitalareafoodbank.org/wp-content/uploads/2019/11/NEW-CAFB-L2F-User-Guide.pdf)).
*Adopt:* collection is recorded against the household, not the person, so a second family member can't collect again.

**2.9 No-show priority.** No product source found for automatic "no-show gets priority next time". *Design recommendation:*
- Statuses are استلم / لم يحضر / اتلغى.
- The next planner run pre-sorts «لم يحضر المرة اللي فاتت» to the top with a chip.
- The "didn't receive last time" filter should read the status, not just list membership.

**2.10 Record distribution reasons and amounts per visit.** Link2Feed has an optional "Food Provided" quantity field ([CAFB guide](https://www.capitalareafoodbank.org/wp-content/uploads/2019/11/NEW-CAFB-L2F-User-Guide.pdf)). Oasis records type, date and amount per assistance ([FBNN guide](https://www.fbnn.org/wp-content/uploads/2023/02/Oasis-User-Guide.pdf)).
*Adopt:* the household page gets a «سجل المساعدات» timeline: date, item, quantity, donor, status.

---

## 3. Vulnerability and needs scoring (feature c)

**3.1 Scorecard, not a formula.** IFRC Livelihoods Centre guidance defines a scorecard as combining indicator types, each assigned a score, into a cumulative score that "determines eligibility". The score "must be verified by relevant stakeholders" ([IFRC/Livelihoods Centre, Targeting in Urban and Rural Contexts][ifrc]). It cites DRC in Turkey choosing a scorecard because non-technical staff could understand it and adjust scores. Proxy means testing, by contrast, needs statistical analysis of sample data (same source).
*Adopt:* keep the 53-point form. Make weights editable only by an admin, and show the point value next to each option («أرملة +٥»).

**3.2 Show the breakdown, not just the grade.** UNHCR's Jordan VAF shows a household's overall vulnerability score plus a breakdown by sector ([ENN summary of VAF](https://www.ennonline.net/fex/48/en/aid-effectiveness-and-vulnerability-assessment-framework-determining-vulnerability-among); [ReliefWeb VAF 2019](https://reliefweb.int/report/jordan/vulnerability-assessment-framework-population-study-2019)).
*Adopt:* result card «الدرجة ٣٨/٥٣ — فئة A» with 3–4 sub-totals (السكن، الدخل، الصحة، التعليم) as mini bars, and the list of answers that earned points.

**3.3 Live running total while filling.** *Design recommendation:* a sticky footer «المجموع لحد دلوقتي: ٢٧ نقطة (B)» that updates on every tick, so the assessor sees the effect immediately.

**3.4 Threshold plus manual override.** The IFRC doc's Ethiopian Red Cross example selected everyone above a score of 80 after stakeholder verification and correction of inclusion and exclusion errors ([IFRC/Livelihoods][ifrc]).
*Adopt:* the grade is computed, but staff may set «فئة يدوية» with a mandatory reason. Show both values.

**3.5 Verify a sample; date every assessment.** The same guidance says "at least 10% of the households must be checked" (same source).
*Adopt:*
- each assessment stores التاريخ and الباحث
- the case list flags «التقييم أقدم من سنة»
- a «راجع ١٠٪ عشوائي» button picks households for a home visit

**3.6 Keep criteria simple and explainable; have a complaints path.** Same source: standardised, simple criteria "increase perceptions of fairness", and a feedback mechanism is needed for complaints about selection.
*Adopt:* a printable one-page «معايير الاستحقاق» and a «شكوى/طلب إعادة تقييم» note type on the household.

**3.7 Proxy means testing: skip.** It needs statistical modelling on sample data ([IFRC/Livelihoods][ifrc]), which a 210-family charity can't calibrate.

---

## 4. Egyptian context and donor reporting (feature d)

**4.1 A public "Right to Know" page.** Egyptian Food Bank's [rtk.efb.eg](https://rtk.efb.eg/) and [annual report page](https://rtk.efb.eg/annual-report/) show:
- total beneficiaries and families
- partner organisations
- spending by program line
- administrative expenses as a percentage
- outcomes (meals)
- donor and beneficiary satisfaction

*Adopt at small scale:* a per-donor or per-year report «تقرير المتبرع» with these sections:
- عدد الأسر المستفيدة
- عدد الأفراد
- الكميات الموزعة حسب الصنف
- نسبة الاستلام (استلم ÷ المستحق)
- تواريخ التوزيعات

Everything is **aggregated only; no names, IDs or photos**.

**4.2 Seasonal campaigns as named distributions.** EFB runs Ramadan and Eid al-Adha feeding and monthly sponsorship ([EFB on GlobalGiving](https://www.globalgiving.org/microprojects/egyptian-food-bank-ramadan-2024/)). Press reports EFB delivered ~848k boxes via ~3,700 associations in 2023, each sized for a 5-person family ([Youm7][youm7], secondary source). That is a fixed box regardless of size, i.e. SCOPE's "Fixed" option.
*Adopt:* planner presets «شنطة رمضان», «لحمة العيد», «شنطة المدرسة», «كسوة», each pre-filling the tier basis (fixed / per member / per school child). EFB's partner-association model also suggests Dar El Ekram may **receive** boxes from EFB. The planner should record the donor as an organisation.

**4.3 Resala: activity posts, not figures.** The Resala homepage shows Eid-sacrifice achievements, aid convoys with food cartons, clothing exhibitions and literacy, with donate/volunteer calls. It showed no beneficiary or financial figures when fetched ([resala.org](https://resala.org/)).
*Takeaway:* a small, simple numeric report already beats common local practice.

**4.4 Misr El Kheir: not verified.** misrelkheir.org redirects to mekeg.org, which returned 403/522. Search snippets mention an orphan-care endowment with small "shares" and campaign pages for orphan students' education ([mekeg.org](https://mekeg.org/ar/causes/sponsorship-of-education-for-orphan-students)). **[unverified]**: no program details or reporting format could be confirmed.

**4.5 Privacy in donor output.** *Design recommendation, consistent with IFRC's CVA data-protection guidance* ([IFRC PDF](https://www.ifrc.org/sites/default/files/2021-11/CVA-Data-Protection-Guidance-final.pdf), not read in full): donor reports never include national IDs. Signed كشوفات stay in the office. For كفالات, a donor sees their sponsored child's first name and school stage at most.

---

## 5. Prioritised adoption table

| # | Pattern | Feature | Decision |
|---|---|---|---|
| 1.1 / 1.3 | Search before create; duplicate national-ID block | a | **Adopt now** |
| 1.2 | National ID auto-fills birth date/age/gender; soft checksum warning | a | **Adopt now** |
| 1.4 | Inline member rows + live counts | a | **Adopt now** |
| 1.5 | Active/inactive members, never delete | a | **Adopt now** |
| 1.7 | School stage dropdown | a (feeds b) | **Adopt now** |
| 1.6 | "Missing data" badges instead of blocking | a | Later |
| 1.8 | Alert strip on card and كشف | a / b | Later |
| 2.1 | Distribution → frozen list → status model | b | **Adopt now** |
| 2.2 | Fixed / per-member / tiers / per-school-child | b | **Adopt now** |
| 2.3 | Live needed-vs-available bar with fix buttons | b | **Adopt now** |
| 2.4 | Excluded households shown with reason; override with reason | b | **Adopt now** |
| 2.5 | Two count tables (by size, by school children) | b | **Adopt now** |
| 2.6 | Printed كشف with codes + bulk "mark collected" | b | **Adopt now** |
| 2.9 | No-show status → priority next time | b | **Adopt now** |
| 2.7 | Phone check-off with big buttons, proxy collector | b | Later (after paper flow works) |
| 2.10 | Assistance history timeline | b / d | Later |
| 2.4 (barcodes) | Barcode/QR scanning at collection (RedRose, Link2Feed) | b | Skip for now |
| 3.1 / 3.2 / 3.3 | Editable weights, breakdown card, live total | c | **Adopt now** |
| 3.4 | Manual grade override with reason | c | **Adopt now** |
| 3.5 | Assessment date, "older than a year" flag, 10% re-check | c | Later |
| 3.6 | Printable criteria sheet + complaint note type | c | Later |
| 3.7 | Proxy means test / statistical model | c | **Skip** |
| 4.1 | Aggregated donor report (families, persons, quantities, collection rate) | d | **Adopt now** |
| 4.2 | Seasonal presets; donor can be an organisation | b / d | Later |
| 4.5 | No personal data in donor output | d | **Adopt now** (rule) |
| — | Biometrics, e-signature pads, networked multi-agency sharing (SCOPE, GDT, Link2Feed) | — | **Skip** |

[ifrc]: https://www.livelihoodscentre.org/documents/114097690/181759481/Targeting_Rural-Urban+contexts_v151121_EN_Def.pdf/d3eed5f5-128b-9c88-d035-725505c0f942?t=1637057936342
[youm7]: https://www.youm7.com/story/2024/2/1/365-%D9%8A%D9%88%D9%85%D8%A7%D9%8B-%D9%85%D9%86-%D8%A7%D9%84%D8%B9%D9%85%D9%84-%D8%A7%D9%84%D8%AE%D9%8A%D8%B1%D9%8A-%D9%88%D8%A7%D9%84%D8%AA%D9%86%D9%85%D9%88%D9%8A-%D8%A7%D9%84%D9%85%D8%AA%D9%88%D8%A7%D8%B5%D9%84-%D9%84%D8%A8%D9%86%D9%83-%D8%A7%D9%84%D8%B7%D8%B9%D8%A7%D9%85-%D8%A7%D9%84%D9%85%D8%B5%D8%B1%D9%8A/6466675
