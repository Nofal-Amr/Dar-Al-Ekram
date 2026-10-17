/* A small .xlsx writer with styles (borders, bold, fills, merged cells, right-to-left, page setup, a logo).
   The free SheetJS build can't write styles, so «Excel زي الورقة» is built here: plain XML parts in a zip,
   made on the device — no internet needed.
   buildXlsx(sheets) → Uint8Array. A sheet: { name, rtl, cols:[width…], rows:[{ h, cells:[cell|null…] }],
   merges:["A1:C1"…], breaks:[row index…], titles:[first,last] (rows repeated on every printed page),
   landscape, image:{ png:Uint8Array, w, h } (anchored at the top-right corner) }.
   A cell: { v: text|number, s: style name, rich:[{ t, small }] }. */

const enc = new TextEncoder();
const CRC = (() => { const t = new Uint32Array(256); for(let n = 0; n < 256; n++){ let c = n; for(let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = b => { let c = 0xFFFFFFFF; for(let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };

// zip with no compression ("stored") — tiny and fast, Excel/LibreOffice open it fine
export function zipStore(files){
  const parts = [], central = []; let off = 0;
  const now = new Date(), dt = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate(), tm = (now.getHours() << 11) | (now.getMinutes() << 5);
  for(const [name, data] of files){
    const nm = enc.encode(name), d = typeof data === "string" ? enc.encode(data) : data, crc = crc32(d);
    const h = new DataView(new ArrayBuffer(30));
    h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true); h.setUint16(10, tm, true); h.setUint16(12, dt, true);
    h.setUint32(14, crc, true); h.setUint32(18, d.length, true); h.setUint32(22, d.length, true); h.setUint16(26, nm.length, true);
    parts.push(new Uint8Array(h.buffer), nm, d);
    const c = new DataView(new ArrayBuffer(46));
    c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint16(12, tm, true); c.setUint16(14, dt, true);
    c.setUint32(16, crc, true); c.setUint32(20, d.length, true); c.setUint32(24, d.length, true); c.setUint16(28, nm.length, true); c.setUint32(42, off, true);
    central.push(new Uint8Array(c.buffer), nm);
    off += 30 + nm.length + d.length;
  }
  const size = central.reduce((s, x) => s + x.length, 0), e = new DataView(new ArrayBuffer(22));
  e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true); e.setUint32(12, size, true); e.setUint32(16, off, true);
  const all = [...parts, ...central, new Uint8Array(e.buffer)], out = new Uint8Array(all.reduce((s, x) => s + x.length, 0));
  let p = 0; for(const x of all){ out.set(x, p); p += x.length; }
  return out;
}

const xe = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;" }[c])).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
export const colName = i => { let s = ""; i++; while(i){ const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; };

// fonts / fills / borders / cell formats — index of each named style in cellXfs
const FONT = 'Arial';
const STYLES = {
  def:   { f:0, al:'<alignment horizontal="right" vertical="center" readingOrder="2"/>' },
  org:   { f:1, al:'<alignment horizontal="right" vertical="center" readingOrder="2"/>' },
  small: { f:2, al:'<alignment horizontal="right" vertical="center" readingOrder="2"/>' },
  date:  { f:0, al:'<alignment horizontal="left" vertical="center" readingOrder="2"/>' },
  title: { f:3, al:'<alignment horizontal="center" vertical="center" readingOrder="2"/>' },
  sub:   { f:0, al:'<alignment horizontal="center" vertical="center" readingOrder="2"/>' },
  h2:    { f:4, al:'<alignment horizontal="right" vertical="center" readingOrder="2"/>', b:2 },
  th:    { f:4, fill:2, b:1, al:'<alignment horizontal="center" vertical="center" wrapText="1" readingOrder="2"/>' },
  td:    { f:0, b:1, al:'<alignment horizontal="center" vertical="center" wrapText="1" readingOrder="2"/>' },
  tdr:   { f:0, b:1, al:'<alignment horizontal="right" vertical="center" wrapText="1" readingOrder="2"/>' },
  foot:  { f:4, fill:3, b:1, al:'<alignment horizontal="center" vertical="center" wrapText="1" readingOrder="2"/>' },
  sign:  { f:4, al:'<alignment horizontal="center" vertical="center" readingOrder="2"/>' },
  line:  { f:0, al:'<alignment horizontal="center" vertical="bottom" readingOrder="2"/>' },
  hdline:{ f:0, b:3 },
};
const ST = Object.keys(STYLES);
const sIdx = n => Math.max(0, ST.indexOf(n || "def"));
function stylesXml(){
  const fonts = [`<font><sz val="11"/><name val="${FONT}"/></font>`, `<font><b/><sz val="16"/><color rgb="FF962A25"/><name val="${FONT}"/></font>`,
    `<font><sz val="9"/><color rgb="FF444444"/><name val="${FONT}"/></font>`, `<font><b/><sz val="14"/><name val="${FONT}"/></font>`, `<font><b/><sz val="11"/><name val="${FONT}"/></font>`];
  const fills = ['<fill><patternFill patternType="none"/></fill>', '<fill><patternFill patternType="gray125"/></fill>',
    '<fill><patternFill patternType="solid"><fgColor rgb="FFEEEEEE"/><bgColor indexed="64"/></patternFill></fill>', '<fill><patternFill patternType="solid"><fgColor rgb="FFF3F3F3"/><bgColor indexed="64"/></patternFill></fill>'];
  const thin = s => `<${s} style="thin"><color rgb="FF000000"/></${s}>`;
  const borders = ['<border><left/><right/><top/><bottom/><diagonal/></border>', `<border>${thin("left")}${thin("right")}${thin("top")}${thin("bottom")}<diagonal/></border>`,
    `<border><left/><right/><top/>${thin("bottom")}<diagonal/></border>`, '<border><left/><right/><top/><bottom style="thick"><color rgb="FF962A25"/></bottom><diagonal/></border>'];
  const xfs = ST.map(n => { const x = STYLES[n]; return `<xf numFmtId="0" fontId="${x.f}" fillId="${x.fill || 0}" borderId="${x.b || 0}" xfId="0" applyFont="1"${x.fill ? ' applyFill="1"' : ""}${x.b ? ' applyBorder="1"' : ""}${x.al ? ` applyAlignment="1">${x.al}</xf>` : "/>"}`; });
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="${fonts.length}">${fonts.join("")}</fonts><fills count="${fills.length}">${fills.join("")}</fills><borders count="${borders.length}">${borders.join("")}</borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="${xfs.length}">${xfs.join("")}</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
}
function cellXml(c, ref){
  const s = sIdx(c.s);
  if(c.rich && c.rich.length){
    const runs = c.rich.map(r => `<r><rPr>${r.small ? `<sz val="8"/><color rgb="FF555555"/>` : r.bold ? `<b/><sz val="11"/>` : `<sz val="11"/>`}<rFont val="${FONT}"/></rPr><t xml:space="preserve">${xe(r.t)}</t></r>`).join("");
    return `<c r="${ref}" s="${s}" t="inlineStr"><is>${runs}</is></c>`;
  }
  if(c.v === "" || c.v == null) return `<c r="${ref}" s="${s}"/>`;
  if(typeof c.v === "number" && isFinite(c.v)) return `<c r="${ref}" s="${s}"><v>${c.v}</v></c>`;
  return `<c r="${ref}" s="${s}" t="inlineStr"><is><t xml:space="preserve">${xe(c.v)}</t></is></c>`;
}
function sheetXml(sh, hasImg){
  const cols = (sh.cols || []).map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join("");
  const rows = sh.rows.map((r, i) => { const cells = (r.cells || []).map((c, j) => c ? cellXml(c, colName(j) + (i + 1)) : "").join("");
    return `<row r="${i + 1}"${r.h ? ` ht="${r.h}" customHeight="1"` : ""}>${cells}</row>`; }).join("");
  const merges = sh.merges?.length ? `<mergeCells count="${sh.merges.length}">${sh.merges.map(m => `<mergeCell ref="${m}"/>`).join("")}</mergeCells>` : "";
  const brks = sh.breaks?.length ? `<rowBreaks count="${sh.breaks.length}" manualBreakCount="${sh.breaks.length}">${sh.breaks.map(b => `<brk id="${b}" max="16383" man="1"/>`).join("")}</rowBreaks>` : "";
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr><sheetViews><sheetView workbookViewId="0"${sh.rtl !== false ? ' rightToLeft="1"' : ""} showGridLines="0"/></sheetViews><sheetFormatPr defaultRowHeight="18"/>
${cols ? `<cols>${cols}</cols>` : ""}<sheetData>${rows}</sheetData>${merges}<printOptions horizontalCentered="1"/>
<pageMargins left="0.47" right="0.47" top="0.47" bottom="0.47" header="0.2" footer="0.2"/><pageSetup paperSize="9" orientation="${sh.landscape ? "landscape" : "portrait"}" fitToWidth="1" fitToHeight="0"/>
${brks}${hasImg ? '<drawing r:id="rId1"/>' : ""}</worksheet>`;
}
function drawingXml(img, ncols){
  // EMU: 9525 per pixel. The picture sits in the first column (the right edge on a right-to-left sheet).
  const cx = Math.round(img.w * 9525), cy = Math.round(img.h * 9525);
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<xdr:oneCellAnchor><xdr:from><xdr:col>0</xdr:col><xdr:colOff>38100</xdr:colOff><xdr:row>0</xdr:row><xdr:rowOff>38100</xdr:rowOff></xdr:from><xdr:ext cx="${cx}" cy="${cy}"/>
<xdr:pic><xdr:nvPicPr><xdr:cNvPr id="2" name="logo"/><xdr:cNvPicPr><a:picLocks noChangeAspect="1"/></xdr:cNvPicPr></xdr:nvPicPr>
<xdr:blipFill><a:blip r:embed="rId1"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill><xdr:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr></xdr:pic><xdr:clientData/></xdr:oneCellAnchor></xdr:wsDr>`;
}
const safeName = (n, used) => { let s = String(n || "Sheet").replace(/[\\/?*[\]:]/g, " ").trim().slice(0, 31) || "Sheet", b = s, i = 2; while(used.has(s)) s = `${b.slice(0, 28)} ${i++}`; used.add(s); return s; };

export function buildXlsx(sheets){
  const used = new Set(), names = sheets.map(s => safeName(s.name, used)), files = [];
  const imgs = sheets.map((s, i) => s.image?.png ? i : -1).filter(i => i >= 0);
  files.push(["[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}
${imgs.map(i => `<Override PartName="/xl/drawings/drawing${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>`).join("")}</Types>`]);
  files.push(["_rels/.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`]);
  const defined = sheets.map((s, i) => s.titles ? `<definedName name="_xlnm.Print_Titles" localSheetId="${i}">'${names[i].replace(/'/g, "''")}'!$${s.titles[0]}:$${s.titles[1]}</definedName>` : "").join("");
  files.push(["xl/workbook.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView/></bookViews>
<sheets>${names.map((n, i) => `<sheet name="${xe(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("")}</sheets>${defined ? `<definedNames>${defined}</definedNames>` : ""}</workbook>`]);
  files.push(["xl/_rels/workbook.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("")}
<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`]);
  files.push(["xl/styles.xml", stylesXml()]);
  sheets.forEach((s, i) => {
    const img = s.image?.png;
    files.push([`xl/worksheets/sheet${i + 1}.xml`, sheetXml(s, !!img)]);
    if(img){
      files.push([`xl/worksheets/_rels/sheet${i + 1}.xml.rels`, `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing${i + 1}.xml"/></Relationships>`]);
      files.push([`xl/drawings/drawing${i + 1}.xml`, drawingXml(s.image, (s.cols || []).length)]);
      files.push([`xl/drawings/_rels/drawing${i + 1}.xml.rels`, `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image${i + 1}.png"/></Relationships>`]);
      files.push([`xl/media/image${i + 1}.png`, img]);
    }
  });
  return zipStore(files);
}
