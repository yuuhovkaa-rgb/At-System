import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import en from '../src/i18n/en.json';
import km from '../src/i18n/km.json';

const flat = (o: any, p = ''): string[] => Object.entries(o).flatMap(([k, v]) => (typeof v === 'object' ? flat(v, `${p}${k}.`) : [`${p}${k}`]));
const walk = (d: string): string[] => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : /\.tsx?$/.test(p) ? [p] : []; });
const get = (o: any, key: string) => key.split('.').reduce((a, k) => a?.[k], o);

describe('i18n dictionaries', () => {
  it('English and Khmer have exactly the same keys', () => { expect(flat(km).sort()).toEqual(flat(en).sort()); });
  it('no Khmer value is empty and interpolation variables match English', () => {
    for (const k of flat(en)) {
      const e = get(en, k) as string, x = get(km, k) as string;
      expect(x, k).toBeTruthy();
      expect([...x.matchAll(/{{(\w+)}}/g)].map((m) => m[1]).sort(), k).toEqual([...e.matchAll(/{{(\w+)}}/g)].map((m) => m[1]).sort());
    }
  });
  it('every translation key used in the source exists in both languages', () => {
    const re = /['"`]((?:common|nav|roles|status|sessionStatus|correction|corrections|auth|validation|dashboard|students|classes|monitors|attendance|reports|analytics|users|audit|settings|schedule|announcements|notif|toast|errors|student|profile|days|daysShort)\.[A-Za-z0-9_.]+)['"`]/g;
    const missing: string[] = [];
    for (const f of walk(join(__dirname, '../src'))) for (const m of readFileSync(f, 'utf8').matchAll(re)) {
      if (/^students\.(csv|xlsx)$/.test(m[1])) continue; // download file names, not keys
      if (get(en, m[1]) === undefined || get(km, m[1]) === undefined) missing.push(`${m[1]} (${f.split('src/')[1]})`);
    }
    expect(missing).toEqual([]);
  });
  it('Khmer text actually contains Khmer script', () => { expect(JSON.stringify(km)).toMatch(/[\u1780-\u17FF]/); });
});
