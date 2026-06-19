import { inflateSync, inflateRawSync } from 'node:zlib';

/**
 * Dependency-frit PDF-tekstudtræk: finder content-streams, inflater FlateDecode
 * (node:zlib) og læser tekst fra (…)Tj / […]TJ-operatorer. Virker for digitalt
 * genererede PDF'er med tekstlag (fakturaer, energimærker, garantibeviser).
 * Scannede PDF'er har intet tekstlag -> tom streng (kalderen falder tilbage til OCR).
 * Til fuld fidelitet (fonts/encoding) kan pdfjs/Textract sættes ind senere.
 */
export function extractPdfText(buf: Buffer): string {
  if (buf.subarray(0, 5).toString('latin1') !== '%PDF-') return '';
  const out: string[] = [];
  let idx = 0;
  while (true) {
    const s = buf.indexOf('stream', idx, 'latin1');
    if (s === -1) break;
    const dictStart = buf.lastIndexOf('<<', s);
    const dict = dictStart !== -1 ? buf.subarray(dictStart, s).toString('latin1') : '';
    let dataStart = s + 6;
    if (buf[dataStart] === 0x0d) dataStart++;
    if (buf[dataStart] === 0x0a) dataStart++;
    const e = buf.indexOf('endstream', dataStart, 'latin1');
    if (e === -1) break;
    const raw = buf.subarray(dataStart, e);
    let content = '';
    if (/FlateDecode/.test(dict)) {
      try { content = inflateSync(raw).toString('latin1'); }
      catch { try { content = inflateRawSync(raw).toString('latin1'); } catch { content = ''; } }
    } else if (/\/Length/.test(dict) && !/\/(Image|DCTDecode|JPXDecode)/.test(dict)) {
      content = raw.toString('latin1');
    }
    if (content && /(Tj|TJ)/.test(content)) out.push(extractFromContent(content));
    idx = e + 9;
  }
  return out.join('\n').replace(/[ \t]{2,}/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}

function extractFromContent(content: string): string {
  const parts: string[] = [];
  const n = content.length;
  let i = 0;
  const readString = (start: number): [string, number] => {
    let depth = 0, res = '', j = start;
    for (; j < n; j++) {
      const c = content[j];
      if (c === '\\') {
        const next = content[j + 1];
        if (next === 'n') res += '\n';
        else if (next === 'r') res += '';
        else if (next === 't') res += '\t';
        else if (next >= '0' && next <= '7') {
          let oct = next, k = j + 2;
          for (; k < j + 4 && content[k] >= '0' && content[k] <= '7'; k++) oct += content[k];
          res += String.fromCharCode(parseInt(oct, 8) & 0xff);
          j = k - 1; continue;
        } else res += next;
        j++; continue;
      } else if (c === '(') { depth++; res += c; }
      else if (c === ')') { if (depth === 0) return [res, j + 1]; depth--; res += c; }
      else res += c;
    }
    return [res, j];
  };
  while (i < n) {
    const c = content[i];
    if (c === '(') { const [str, next] = readString(i + 1); parts.push(str); i = next; }
    else if (c === 'T' && (content[i + 1] === 'd' || content[i + 1] === 'D' || content[i + 1] === '*')) { parts.push('\n'); i += 2; }
    else if (c === "'" || c === '"') { parts.push('\n'); i += 1; }
    else i++;
  }
  return parts.join('');
}
