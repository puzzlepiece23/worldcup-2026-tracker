// CI updater: fetches the fixture feed, rewrites fixtures.js / fixtures_raw.json,
// and regenerates world-cup-2026.ics (the calendar-subscription target).
// Run from anywhere: node scripts/build-ics.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import vm from 'node:vm';

const ROOT = new URL('..', import.meta.url);
const FEED = 'https://fixturedownload.com/feed/json/fifa-world-cup-2026';

const res = await fetch(FEED);
if (!res.ok) throw new Error(`Feed fetch failed: ${res.status}`);
const raw = await res.text();
const fixtures = JSON.parse(raw);
if (!Array.isArray(fixtures) || fixtures.length < 100) throw new Error(`Unexpected fixture count: ${fixtures.length}`);

const stamp = new Date().toISOString().replace(/\.\d{3}/, '');
writeFileSync(new URL('fixtures_raw.json', ROOT), raw);
writeFileSync(new URL('fixtures.js', ROOT), `window.WC_FIXTURES = ${raw};\nwindow.WC_FETCHED_AT = '${stamp}';\n`);

// Pull VENUES / KO_SOURCES / stageOf out of the browser data module
const ctx = vm.createContext({});
const dataSrc = readFileSync(new URL('data.js', ROOT), 'utf8');
const { VENUES, KO_SOURCES, stageOf } = vm.runInContext(dataSrc + ';({ VENUES, KO_SOURCES, stageOf })', ctx);

const isPlaceholder = s => !s || s === 'To be announced' || /^([123][A-L]+|[WL]\d+|RU\d+)$/i.test(s.trim());
function slotLabel(spec) {
  const [kind, ref] = spec;
  if (kind === 'W') return `Group ${ref} winner`;
  if (kind === 'R') return `Group ${ref} runner-up`;
  if (kind === 'T') return `3rd place (${ref.join('/')})`;
  return `${kind === 'M' ? 'Winner' : 'Loser'} of M${ref}`;
}

const icsEscape = s => String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
function fold(line) {
  const out = [];
  while (line.length > 74) { out.push(line.slice(0, 74)); line = ' ' + line.slice(74); }
  out.push(line);
  return out;
}
const icsDate = d => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

const now = new Date();
const seq = Math.max(0, Math.floor((now - new Date('2026-01-01')) / 36e5));
const lines = [
  'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//worldcup-tracker//WC2026//EN',
  'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
  'X-WR-CALNAME:World Cup 2026',
  `X-WR-CALDESC:FIFA World Cup 2026 — auto-updated ${now.toISOString().slice(0, 16)}Z`,
  'REFRESH-INTERVAL;VALUE=DURATION:PT6H',
  'X-PUBLISHED-TTL:PT6H',
];
for (const f of fixtures.sort((a, b) => a.MatchNumber - b.MatchNumber)) {
  const n = f.MatchNumber;
  const start = new Date(f.DateUtc.replace(' ', 'T'));
  const venue = VENUES[f.Location] || { stadium: f.Location, city: '' };
  const src = KO_SOURCES[n];
  const home = !isPlaceholder(f.HomeTeam) ? f.HomeTeam : (src ? slotLabel(src.h) : 'TBD');
  const away = !isPlaceholder(f.AwayTeam) ? f.AwayTeam : (src ? slotLabel(src.a) : 'TBD');
  const played = f.HomeTeamScore != null && f.AwayTeamScore != null;
  const stage = stageOf(n);
  const tag = f.Group ? f.Group : stage.name;
  const summary = played
    ? `⚽ ${home} ${f.HomeTeamScore}–${f.AwayTeamScore} ${away} · ${tag}`
    : `⚽ ${home} vs ${away} · ${tag}`;
  const durMin = n <= 72 ? 120 : 165;
  lines.push(
    'BEGIN:VEVENT',
    `UID:wc2026-m${n}@worldcup-tracker`,
    `DTSTAMP:${icsDate(now)}`,
    `SEQUENCE:${seq}`,
    `DTSTART:${icsDate(start)}`,
    `DTEND:${icsDate(new Date(start.getTime() + durMin * 60e3))}`,
    `SUMMARY:${icsEscape(summary)}`,
    `LOCATION:${icsEscape(venue.stadium + ', ' + venue.city)}`,
    `DESCRIPTION:${icsEscape(`FIFA World Cup 2026 · Match ${n} · ${stage.name}\nVenue: ${venue.stadium}, ${venue.city}`)}`,
  );
  if (!played && start > now) {
    lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${icsEscape('Kickoff soon: ' + home + ' vs ' + away)}`, 'TRIGGER:-PT30M', 'END:VALARM');
  }
  lines.push('END:VEVENT');
}
lines.push('END:VCALENDAR');
writeFileSync(new URL('world-cup-2026.ics', ROOT), lines.flatMap(fold).join('\r\n') + '\r\n');

const done = fixtures.filter(f => f.HomeTeamScore != null).length;
console.log(`OK: ${fixtures.length} matches (${done} with scores) → fixtures.js + world-cup-2026.ics @ ${stamp}`);
