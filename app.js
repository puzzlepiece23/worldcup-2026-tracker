// ─── FIFA World Cup 2026 tracker ───
// Layers: embedded fixtures (fixtures.js) ← ESPN live scores ← manual edits.

'use strict';

// ── Base data ──
const MATCHES = {};
// Feed placeholders for undecided knockout slots: "To be announced", "1E", "2B", "3ABCDF", "W73", "RU101"…
const isPlaceholder = s => !s || s === 'To be announced' || /^([123][A-L]+|[WL]\d+|RU\d+)$/i.test(s.trim());
(window.WC_FIXTURES || []).forEach(f => {
  MATCHES[f.MatchNumber] = {
    n: f.MatchNumber,
    dateUtc: new Date(f.DateUtc.replace(' ', 'T')),
    loc: f.Location,
    venue: VENUES[f.Location] || { stadium: f.Location, city: '', tz: 'UTC' },
    group: f.Group ? f.Group.replace('Group ', '') : null,
    home: isPlaceholder(f.HomeTeam) ? null : f.HomeTeam,
    away: isPlaceholder(f.AwayTeam) ? null : f.AwayTeam,
    hs: f.HomeTeamScore, as: f.AwayTeamScore,
  };
});
const ALL_NUMS = Object.keys(MATCHES).map(Number).sort((a, b) => a - b);
const TEAMS = [...new Set(ALL_NUMS.filter(n => n <= 72).flatMap(n => [MATCHES[n].home, MATCHES[n].away]))].sort();
// Knockout rows: drop any leftover "team" that isn't one of the 48 qualified sides
ALL_NUMS.filter(n => n > 72).forEach(n => {
  if (MATCHES[n].home && !TEAMS.includes(MATCHES[n].home)) MATCHES[n].home = null;
  if (MATCHES[n].away && !TEAMS.includes(MATCHES[n].away)) MATCHES[n].away = null;
});

// ── Overlays (localStorage) ──
const store = {
  load(k) { try { return JSON.parse(localStorage.getItem(k)) || {}; } catch { return {}; } },
  save(k, v) { localStorage.setItem(k, JSON.stringify(v)); },
};
let espn = store.load('wc26-espn');
let manual = store.load('wc26-manual');

// Merged view of one match
function getMatch(n) {
  const b = MATCHES[n];
  const e = espn[n] || {};
  const m = manual[n] || {};
  const hs = m.hs != null ? m.hs : (e.hs != null ? e.hs : b.hs);
  const as = m.as != null ? m.as : (e.as != null ? e.as : b.as);
  let st = 'pre';
  if (e.st) st = e.st;
  else if (b.hs != null) st = 'ft';
  if (m.hs != null) st = 'ft';
  return {
    ...b,
    home: b.home || e.h || null,
    away: b.away || e.a || null,
    hs, as, st,
    hp: e.hp != null ? e.hp : null,   // shootout scores
    ap: e.ap != null ? e.ap : null,
    pw: m.pw || null,                 // manual penalty winner: 'h' | 'a'
    edited: m.hs != null,
  };
}
const finished = m => m.st === 'ft' && m.hs != null && m.as != null;

// ── Group standings (points, GD, GF, head-to-head) ──
function computeStandings(g) {
  const ms = ALL_NUMS.filter(n => MATCHES[n].group === g).map(getMatch);
  const teams = [...new Set(ms.flatMap(m => [m.home, m.away]))];
  const rows = {};
  teams.forEach(t => rows[t] = { team: t, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, gd: 0, pts: 0 });
  const done = ms.filter(finished);
  done.forEach(m => {
    const h = rows[m.home], a = rows[m.away];
    h.p++; a.p++; h.gf += m.hs; h.ga += m.as; a.gf += m.as; a.ga += m.hs;
    if (m.hs > m.as) { h.w++; a.l++; h.pts += 3; }
    else if (m.hs < m.as) { a.w++; h.l++; a.pts += 3; }
    else { h.d++; a.d++; h.pts++; a.pts++; }
    h.gd = h.gf - h.ga; a.gd = a.gf - a.ga;
  });
  const base = Object.values(rows).sort(cmpRows);
  // head-to-head among teams level on pts/GD/GF
  for (let i = 0; i < base.length;) {
    let j = i + 1;
    while (j < base.length && cmpRows(base[i], base[j]) === 0) j++;
    if (j - i > 1) {
      const names = new Set(base.slice(i, j).map(r => r.team));
      const sub = done.filter(m => names.has(m.home) && names.has(m.away));
      const mini = {};
      names.forEach(t => mini[t] = { pts: 0, gd: 0, gf: 0 });
      sub.forEach(m => {
        mini[m.home].gf += m.hs; mini[m.home].gd += m.hs - m.as;
        mini[m.away].gf += m.as; mini[m.away].gd += m.as - m.hs;
        if (m.hs > m.as) mini[m.home].pts += 3;
        else if (m.hs < m.as) mini[m.away].pts += 3;
        else { mini[m.home].pts++; mini[m.away].pts++; }
      });
      const seg = base.slice(i, j).sort((x, y) =>
        mini[y.team].pts - mini[x.team].pts || mini[y.team].gd - mini[x.team].gd ||
        mini[y.team].gf - mini[x.team].gf || x.team.localeCompare(y.team));
      base.splice(i, j - i, ...seg);
    }
    i = j;
  }
  return base;
}
function cmpRows(a, b) { return b.pts - a.pts || b.gd - a.gd || b.gf - a.gf; }
const GROUPS = 'ABCDEFGHIJKL'.split('');
const groupComplete = g => ALL_NUMS.filter(n => MATCHES[n].group === g).every(n => finished(getMatch(n)));
const groupStarted = g => ALL_NUMS.filter(n => MATCHES[n].group === g).some(n => finished(getMatch(n)));
const allGroupsComplete = () => GROUPS.every(groupComplete);

function thirdPlaceTable() {
  return GROUPS.filter(groupStarted)
    .map(g => ({ g, row: computeStandings(g)[2] }))
    .sort((a, b) => cmpRows(a.row, b.row) || a.g.localeCompare(b.g));
}

// Assign the 8 best thirds to their R32 slots (backtracking over allowed groups)
function allocateThirds() {
  const qualified = thirdPlaceTable().slice(0, 8);
  if (qualified.length < 8) return {};
  const slots = [74, 77, 79, 80, 81, 82, 85, 87]
    .map(n => ({ n, allowed: new Set(KO_SOURCES[n].a[1]) }))
    .sort((a, b) => a.allowed.size - b.allowed.size);
  const result = {};
  const used = new Set();
  function bt(i) {
    if (i === slots.length) return true;
    for (const q of qualified) {
      if (used.has(q.g) || !slots[i].allowed.has(q.g)) continue;
      used.add(q.g); result[slots[i].n] = q;
      if (bt(i + 1)) return true;
      used.delete(q.g); delete result[slots[i].n];
    }
    return false;
  }
  return bt(0) ? result : {};
}

// ── Bracket resolution ──
// Returns { name, prov, label } — name may be null when nothing is known yet.
function resolveSlot(spec, matchN, side) {
  const m = getMatch(matchN);
  const real = side === 'h' ? m.home : m.away;   // feed/ESPN already knows the team
  const [kind, ref] = spec;
  let label, name = null, prov = true;
  if (kind === 'W' || kind === 'R') {
    const idx = kind === 'W' ? 0 : 1;
    label = `Group ${ref} ${kind === 'W' ? 'winner' : 'runner-up'}`;
    if (groupStarted(ref)) {
      name = computeStandings(ref)[idx].team;
      prov = !groupComplete(ref);
    }
  } else if (kind === 'T') {
    label = `3rd place (${ref.join('/')})`;
    const q = allocateThirds()[matchN];
    if (q) { name = q.row.team; prov = !allGroupsComplete(); }
  } else if (kind === 'M' || kind === 'L') {
    label = `${kind === 'M' ? 'Winner' : 'Loser'} of M${ref}`;
    const w = matchOutcome(ref);
    if (w) {
      const pick = kind === 'M' ? w.winner : w.loser;
      name = pick.name; prov = pick.prov;
    }
  }
  if (real) return { name: real, prov: false, label };
  return { name, prov, label };
}

function resolvedTeams(n) {
  const src = KO_SOURCES[n];
  if (!src) { const m = getMatch(n); return { h: { name: m.home, prov: false }, a: { name: m.away, prov: false } }; }
  return { h: resolveSlot(src.h, n, 'h'), a: resolveSlot(src.a, n, 'a') };
}

// winner/loser of a knockout match, or null if undecided
function matchOutcome(n) {
  const m = getMatch(n);
  if (!finished(m)) return null;
  const t = resolvedTeams(n);
  if (!t.h.name || !t.a.name) return null;
  let side = null;
  if (m.hs > m.as) side = 'h';
  else if (m.hs < m.as) side = 'a';
  else if (m.hp != null && m.ap != null && m.hp !== m.ap) side = m.hp > m.ap ? 'h' : 'a';
  else if (m.pw) side = m.pw;
  if (!side) return null;
  return side === 'h' ? { winner: t.h, loser: t.a, side } : { winner: t.a, loser: t.h, side };
}

// ── Formatting helpers ──
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const flag = t => FLAGS[t] || '';
const fmtDay = d => d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
const fmtTime = d => d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
const localDayKey = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const isLiveNow = m => m.st === 'in' || (m.st === 'pre' && Date.now() > m.dateUtc.getTime() - 15 * 60e3 && Date.now() < m.dateUtc.getTime() + 3.5 * 36e5);

function statusBadge(m) {
  if (m.st === 'in') return '<span class="badge live">LIVE</span>';
  if (finished(m)) return '<span class="badge ft">FT</span>';
  return '';
}
function teamCell(t) {
  if (!t || !t.name) return `<span class="tbd">${esc(t && t.label || 'TBD')}</span>`;
  const cls = t.prov ? ' prov' : '';
  return `<span class="team${cls}" title="${t.prov ? 'Projected from current standings' : ''}">${flag(t.name)} ${esc(t.name)}</span>`;
}

// ── Views ──
const view = document.getElementById('view');
let currentView = 'schedule';
let schedFilter = { stage: 'all', team: 'all' };

function render() {
  ({ schedule: renderSchedule, groups: renderGroups, bracket: renderBracket, calendar: renderCalendar })[currentView]();
  document.querySelectorAll('nav .tab').forEach(b => b.classList.toggle('active', b.dataset.view === currentView));
  renderStatusLine();
}

function renderStatusLine() {
  const el = document.getElementById('data-status');
  const live = Object.keys(espn).length;
  const fetched = window.WC_FETCHED_AT ? new Date(window.WC_FETCHED_AT).toLocaleDateString() : '?';
  el.textContent = `Schedule data: ${fetched}` + (live ? ` · live scores: ${new Date(lastRefresh || Date.now()).toLocaleTimeString()}` : '');
}

// — Schedule —
function renderSchedule() {
  const stageOpts = [
    ['all', 'All matches'], ['group', 'Group stage'], ['ko', 'Knockout rounds'],
    ...GROUPS.map(g => ['g' + g, 'Group ' + g]),
  ];
  let nums = ALL_NUMS.filter(n => {
    const m = MATCHES[n];
    const s = schedFilter.stage;
    if (s === 'group' && n > 72) return false;
    if (s === 'ko' && n <= 72) return false;
    if (s.length === 2 && s[0] === 'g' && m.group !== s[1]) return false;
    if (schedFilter.team !== 'all') {
      const mm = getMatch(n);
      if (mm.home !== schedFilter.team && mm.away !== schedFilter.team) return false;
    }
    return true;
  });

  const byDay = {};
  nums.forEach(n => {
    const k = localDayKey(MATCHES[n].dateUtc);
    (byDay[k] = byDay[k] || []).push(n);
  });
  const todayKey = localDayKey(new Date());

  let html = `<div class="controls">
    <select id="stage-filter">${stageOpts.map(([v, l]) => `<option value="${v}"${schedFilter.stage === v ? ' selected' : ''}>${l}</option>`).join('')}</select>
    <select id="team-filter"><option value="all">All teams</option>${TEAMS.map(t => `<option${schedFilter.team === t ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select>
    <button id="today-btn" class="small-btn">Jump to today</button>
    <span class="hint-text">Times shown in your local time zone · click a match to edit its score</span>
  </div>`;

  Object.keys(byDay).sort().forEach(day => {
    const d = MATCHES[byDay[day][0]].dateUtc;
    html += `<h2 class="day-head${day === todayKey ? ' today' : ''}" id="day-${day}">${fmtDay(d)}${day === todayKey ? ' <span class="today-chip">TODAY</span>' : ''}</h2>`;
    html += byDay[day]
      .sort((a, b) => MATCHES[a].dateUtc - MATCHES[b].dateUtc || a - b)
      .map(matchRow).join('');
  });
  view.innerHTML = html || '<p>No matches.</p>';

  document.getElementById('stage-filter').onchange = e => { schedFilter.stage = e.target.value; render(); };
  document.getElementById('team-filter').onchange = e => { schedFilter.team = e.target.value; render(); };
  document.getElementById('today-btn').onclick = () => {
    const t = document.getElementById('day-' + todayKey) || view.querySelector('.day-head');
    if (t) t.scrollIntoView({ behavior: 'smooth' });
  };
  view.querySelectorAll('.match-row').forEach(r => r.onclick = () => openEditor(+r.dataset.n));
}

function matchRow(n) {
  const m = getMatch(n);
  const t = resolvedTeams(n);
  const stage = stageOf(n);
  const tag = m.group ? 'Group ' + m.group : stage.name;
  const score = m.hs != null ? `${m.hs}<span class="dash">–</span>${m.as}` : fmtTime(m.dateUtc);
  const pens = (m.hp != null && m.ap != null) ? `<div class="pens">(${m.hp}–${m.ap} pens)</div>` : '';
  return `<div class="match-row${isLiveNow(m) ? ' live-row' : ''}" data-n="${n}">
    <div class="m-meta"><span class="m-num">M${n}</span><span class="m-tag">${tag}</span></div>
    <div class="m-teams">
      <div class="m-home">${teamCell(t.h)}</div>
      <div class="m-score">${score}${pens}${statusBadge(m)}${m.edited ? '<span class="badge man">edited</span>' : ''}</div>
      <div class="m-away">${teamCell(t.a)}</div>
    </div>
    <div class="m-venue">${esc(m.venue.stadium)} · ${esc(m.venue.city)}</div>
  </div>`;
}

// — Groups —
function renderGroups() {
  let html = '<div class="group-grid">';
  GROUPS.forEach(g => {
    const rows = computeStandings(g);
    html += `<div class="group-card"><h3>Group ${g}</h3>
      <table><thead><tr><th></th><th class="tl">Team</th><th>P</th><th>W</th><th>D</th><th>L</th><th>GD</th><th>Pts</th></tr></thead><tbody>`;
    rows.forEach((r, i) => {
      const cls = i < 2 ? 'qual' : i === 2 ? 'maybe' : '';
      html += `<tr class="${cls}"><td>${i + 1}</td><td class="tl">${flag(r.team)} ${esc(r.team)}</td><td>${r.p}</td><td>${r.w}</td><td>${r.d}</td><td>${r.l}</td><td>${r.gd > 0 ? '+' : ''}${r.gd}</td><td class="pts">${r.pts}</td></tr>`;
    });
    html += '</tbody></table></div>';
  });
  html += '</div>';

  const thirds = thirdPlaceTable();
  if (thirds.length) {
    html += `<div class="thirds"><h3>Third-place ranking <span class="sub">(best 8 advance)</span></h3>
      <table><thead><tr><th></th><th class="tl">Team</th><th>Grp</th><th>P</th><th>GD</th><th>GF</th><th>Pts</th></tr></thead><tbody>`;
    thirds.forEach((t, i) => {
      html += `<tr class="${i < 8 ? 'qual' : ''}"><td>${i + 1}</td><td class="tl">${flag(t.row.team)} ${esc(t.row.team)}</td><td>${t.g}</td><td>${t.row.p}</td><td>${t.row.gd > 0 ? '+' : ''}${t.row.gd}</td><td>${t.row.gf}</td><td class="pts">${t.row.pts}</td></tr>`;
    });
    html += '</tbody></table></div>';
  } else {
    html += '<p class="hint-text" style="text-align:center">Standings fill in as group results come through. Green = top two (advance), amber = third place (best 8 of 12 advance).</p>';
  }
  view.innerHTML = html;
}

// — Bracket —
function bracketCard(n, mini) {
  const m = getMatch(n);
  const t = resolvedTeams(n);
  const out = matchOutcome(n);
  const row = (side, tt) => {
    const win = out && out.side === side;
    const sc = m.hs != null ? (side === 'h' ? m.hs : m.as) : '';
    const pen = (m.hp != null && m.ap != null) ? `<span class="pen-sc">(${side === 'h' ? m.hp : m.ap})</span>` : '';
    return `<div class="b-row${win ? ' win' : ''}">${teamCell(tt)}<span class="b-score">${sc}${pen}</span></div>`;
  };
  return `<div class="b-match${mini ? ' mini' : ''}" data-n="${n}">
    <div class="b-head">M${n} · ${MATCHES[n].dateUtc.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} · ${esc(m.venue.city.split(',')[0])}${m.st === 'in' ? ' <span class="badge live">LIVE</span>' : ''}</div>
    ${row('h', t.h)}${row('a', t.a)}
  </div>`;
}

function renderBracket() {
  const L = BRACKET_LAYOUT;
  const col = (nums, label) => `<div class="b-col"><div class="b-col-label">${label}</div>${nums.map(n => bracketCard(n)).join('')}</div>`;
  const champion = matchOutcome(104);
  view.innerHTML = `<div class="bracket-note hint-text">Dimmed italic teams are projections from current standings; they become firm when groups finish and FIFA confirms pairings. Live data overrides projections automatically.</div>
  <div class="bracket">
    ${col(L.left.r32, 'Round of 32')}
    ${col(L.left.r16, 'Round of 16')}
    ${col(L.left.qf, 'Quarter-finals')}
    ${col([L.left.sf], 'Semi-final')}
    <div class="b-col center">
      <div class="champion">${champion ? `🏆<div class="champ-name">${flag(champion.winner.name)} ${esc(champion.winner.name)}</div>` : '🏆<div class="champ-name tbd">Champion</div>'}</div>
      <div class="b-col-label">Final · Jul 19</div>
      ${bracketCard(L.final)}
      <div class="b-col-label">Third place · Jul 18</div>
      ${bracketCard(L.third, true)}
    </div>
    ${col([L.right.sf], 'Semi-final')}
    ${col(L.right.qf, 'Quarter-finals')}
    ${col(L.right.r16, 'Round of 16')}
    ${col(L.right.r32, 'Round of 32')}
  </div>`;
  view.querySelectorAll('.b-match').forEach(c => c.onclick = () => openEditor(+c.dataset.n));
}

// — Calendar —
function subscribeSection() {
  if (location.protocol !== 'https:') return '';
  const icsUrl = new URL('world-cup-2026.ics', location.href).href;
  const webcal = icsUrl.replace(/^https:/, 'webcal:');
  return `<div class="cal-subscribe">
    <h3>⭐ Best option: subscribe (auto-updating)</h3>
    <p>This site republishes <code>world-cup-2026.ics</code> with fresh scores and knockout pairings every few hours. Subscribe once and Apple Calendar keeps itself current — no re-importing.</p>
    <p><a class="primary-btn" href="${webcal}">📲 Subscribe in Apple Calendar</a></p>
    <p class="hint-text">Or add the URL manually — iPhone: Settings → Apps → Calendar → Calendar Accounts → Add Account → Other → Add Subscribed Calendar. Mac: Calendar → File → New Calendar Subscription (set Auto-refresh to “Every hour”).</p>
    <p><code>${icsUrl}</code></p>
  </div>`;
}

function renderCalendar() {
  view.innerHTML = `<div class="cal-pane">
    <h2>📅 Apple Calendar sync</h2>
    ${subscribeSection()}
    <p>Export the schedule as an <code>.ics</code> file. Times are stored in UTC, so Apple Calendar shows every kickoff in your local time zone automatically (and adjusts if you travel).</p>
    <div class="cal-opts">
      <label>Matches
        <select id="cal-scope">
          <option value="all">All 104 matches</option>
          <option value="group">Group stage only</option>
          <option value="ko">Knockout rounds only</option>
          <option value="team">One team's matches…</option>
        </select>
      </label>
      <label id="cal-team-wrap" style="display:none">Team
        <select id="cal-team">${TEAMS.map(t => `<option>${esc(t)}</option>`).join('')}</select>
      </label>
      <label class="check"><input type="checkbox" id="cal-alarm" checked> 30-minute reminder before kickoff</label>
      <button id="cal-dl" class="primary-btn">⬇ Download .ics</button>
    </div>
    <div class="cal-help">
      <h3>Add to iPhone / iPad</h3>
      <ol>
        <li>Get the file onto the device: AirDrop it, email it to yourself, or save it to iCloud Drive.</li>
        <li>Tap the file → the schedule preview opens → <b>Add All</b>.</li>
        <li>Pick a calendar — create a dedicated <b>“World Cup 2026”</b> calendar so it's easy to update or remove later.</li>
      </ol>
      <h3>Add on Mac</h3>
      <ol>
        <li>In Calendar.app, create a new calendar named <b>“World Cup 2026”</b> (File → New Calendar).</li>
        <li>Double-click the downloaded <code>.ics</code> and choose that calendar when prompted.</li>
      </ol>
      <h3>Keeping it up to date</h3>
      <p>Event titles include scores and resolved knockout teams <i>as of the moment you export</i>. To refresh: hit <b>⟳ Refresh live scores</b>, download the file again, and re-import it into the same dedicated calendar — events keep stable IDs, so Calendar updates them in place (if your version duplicates instead, delete the “World Cup 2026” calendar and re-import — 10 seconds). On a Mac, events sync to your iPhone via iCloud automatically.</p>
    </div>
  </div>`;
  const scope = document.getElementById('cal-scope');
  scope.onchange = () => document.getElementById('cal-team-wrap').style.display = scope.value === 'team' ? '' : 'none';
  document.getElementById('cal-dl').onclick = () => {
    const team = scope.value === 'team' ? document.getElementById('cal-team').value : null;
    downloadICS(scope.value, team, document.getElementById('cal-alarm').checked);
  };
}

// ── ICS generation ──
function icsEscape(s) { return String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n'); }
function icsFold(line) {
  const out = [];
  while (line.length > 74) { out.push(line.slice(0, 74)); line = ' ' + line.slice(74); }
  out.push(line);
  return out;
}
function icsDate(d) { return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, ''); }

// Apple Calendar shows DESCRIPTION as the event's "Notes"
function buildEventNotes(n, m, hName, aName, stage, now) {
  let notes = `FIFA World Cup 2026 · Match ${n} · ${stage.name}\nVenue: ${m.venue.stadium}, ${m.venue.city}\nExported ${now.toLocaleString()} — re-import a fresh export to update teams & scores.`;
  if (finished(m)) {
    let result = `Result: ${hName} ${m.hs}–${m.as} ${aName}`;
    if (m.hp != null && m.ap != null) result += ` (${m.hp}–${m.ap} pens)`;
    if (n > 72 && m.hs === m.as) {
      const out = matchOutcome(n);
      if (out && out.winner.name) result += `\nWinner: ${out.winner.name}`;
    }
    notes = result + '\n\n' + notes;
  }
  return notes;
}

function buildICS(scopeKey, team, alarm) {
  let nums = ALL_NUMS;
  if (scopeKey === 'group') nums = nums.filter(n => n <= 72);
  if (scopeKey === 'ko') nums = nums.filter(n => n > 72);
  if (team) nums = nums.filter(n => { const m = getMatch(n); return m.home === team || m.away === team; });

  const now = new Date();
  const seq = Math.max(0, Math.floor((now - new Date('2026-01-01')) / 36e5));
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//worldcup-tracker//WC2026//EN',
    'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'X-WR-CALNAME:World Cup 2026' + (team ? ' · ' + team : ''),
    'X-WR-CALDESC:FIFA World Cup 2026 — generated ' + now.toISOString().slice(0, 10),
  ];
  nums.forEach(n => {
    const m = getMatch(n);
    const t = resolvedTeams(n);
    const stage = stageOf(n);
    const hName = t.h.name || t.h.label, aName = t.a.name || t.a.label;
    const tag = m.group ? `Group ${m.group}` : stage.name;
    const summary = finished(m)
      ? `⚽ ${hName} ${m.hs}–${m.as} ${aName} · ${tag}`
      : `⚽ ${hName} vs ${aName} · ${tag}`;
    const durMin = n <= 72 ? 120 : 165;   // knockout: allow extra time + penalties
    const end = new Date(m.dateUtc.getTime() + durMin * 60e3);
    lines.push(
      'BEGIN:VEVENT',
      `UID:wc2026-m${n}@worldcup-tracker`,
      `DTSTAMP:${icsDate(now)}`,
      `SEQUENCE:${seq}`,
      `DTSTART:${icsDate(m.dateUtc)}`,
      `DTEND:${icsDate(end)}`,
      `SUMMARY:${icsEscape(summary)}`,
      `LOCATION:${icsEscape(m.venue.stadium + ', ' + m.venue.city)}`,
      `DESCRIPTION:${icsEscape(buildEventNotes(n, m, hName, aName, stage, now))}`,
    );
    if (alarm && !finished(m)) {
      lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${icsEscape('Kickoff soon: ' + hName + ' vs ' + aName)}`, 'TRIGGER:-PT30M', 'END:VALARM');
    }
    lines.push('END:VEVENT');
  });
  lines.push('END:VCALENDAR');
  return lines.flatMap(icsFold).join('\r\n') + '\r\n';
}

function downloadICS(scopeKey, team, alarm) {
  const blob = new Blob([buildICS(scopeKey, team, alarm)], { type: 'text/calendar;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'world-cup-2026' + (team ? '-' + team.toLowerCase().replace(/[^a-z]+/g, '-') : scopeKey === 'all' ? '' : '-' + scopeKey) + '.ics';
  a.click();
  URL.revokeObjectURL(a.href);
}

// ── ESPN live scores ──
let lastRefresh = null;
let refreshing = false;
const normName = s => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z]+/g, ' ').trim();
const NORM_TEAMS = {};   // normalized → canonical feed name
TEAMS.forEach(t => NORM_TEAMS[normName(t)] = t);
Object.entries(TEAM_ALIASES).forEach(([k, v]) => { if (NORM_TEAMS[normName(v)]) NORM_TEAMS[normName(k)] = NORM_TEAMS[normName(v)]; });
const canonTeam = espnName => NORM_TEAMS[normName(espnName)] || espnName;

function utcDayStr(d) { return d.toISOString().slice(0, 10).replace(/-/g, ''); }

function daysNeedingUpdate() {
  const now = Date.now();
  const days = new Set();
  ALL_NUMS.forEach(n => {
    const m = getMatch(n);
    const t = m.dateUtc.getTime();
    // catch up on anything unfinished in the past, plus the next 3 days
    if (m.st !== 'ft' && t < now + 3 * 864e5) days.add(utcDayStr(m.dateUtc));
  });
  return [...days].sort();
}

async function refreshLive(showErrors) {
  if (refreshing) return;
  refreshing = true;
  const btn = document.getElementById('refresh-btn');
  btn.classList.add('busy');
  try {
    for (const day of daysNeedingUpdate()) {
      const r = await fetch(`https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=${day}`);
      if (!r.ok) continue;
      const data = await r.json();
      (data.events || []).forEach(applyEspnEvent);
    }
    store.save('wc26-espn', espn);
    lastRefresh = Date.now();
    render();
  } catch (err) {
    if (showErrors) alert('Live score refresh failed (offline?): ' + err.message);
  } finally {
    refreshing = false;
    btn.classList.remove('busy');
  }
}

function applyEspnEvent(ev) {
  const comp = ev.competitions && ev.competitions[0];
  if (!comp) return;
  const kick = new Date(ev.date).getTime();
  const home = comp.competitors.find(c => c.homeAway === 'home');
  const away = comp.competitors.find(c => c.homeAway === 'away');
  if (!home || !away) return;
  const hName = canonTeam(home.team.displayName), aName = canonTeam(away.team.displayName);

  // candidates within ±2h of the ESPN kickoff; score by team names, then venue city
  let best = null, bestScore = 0;
  ALL_NUMS.forEach(n => {
    const b = MATCHES[n];
    if (Math.abs(b.dateUtc.getTime() - kick) > 2 * 36e5) return;
    let s = 1;
    if (b.home && b.home === hName) s += 4;
    if (b.away && b.away === aName) s += 4;
    if (b.home && b.home === aName) s += 2;   // tolerate swapped home/away
    if (b.away && b.away === hName) s += 2;
    if (!b.home && !b.away) s += 1;           // TBD knockout slot
    const venueName = comp.venue && comp.venue.fullName ? normName(comp.venue.fullName) : '';
    if (venueName && normName(b.venue.stadium).split(' ').some(w => w.length > 3 && venueName.includes(w))) s += 2;
    if (b.dateUtc.getTime() === kick) s += 1;
    if (s > bestScore) { bestScore = s; best = n; }
  });
  if (!best || bestScore < 2) return;

  const state = ev.status && ev.status.type ? ev.status.type.state : 'pre';
  espn[best] = {
    h: hName, a: aName,
    hs: home.score != null && state !== 'pre' ? +home.score : null,
    as: away.score != null && state !== 'pre' ? +away.score : null,
    hp: home.shootoutScore != null ? +home.shootoutScore : null,
    ap: away.shootoutScore != null ? +away.shootoutScore : null,
    st: state === 'post' ? 'ft' : state === 'in' ? 'in' : 'pre',
  };
}

// ── Manual score editor ──
function openEditor(n) {
  const m = getMatch(n);
  const t = resolvedTeams(n);
  if (!t.h.name || !t.a.name) return;   // nothing to edit until teams are known
  const root = document.getElementById('modal-root');
  const isKO = n > 72;
  root.innerHTML = `<div class="modal-bg"><div class="modal">
    <h3>M${n} · ${esc(stageOf(n).name)}</h3>
    <div class="ed-row">
      <span>${flag(t.h.name)} ${esc(t.h.name)}</span>
      <input id="ed-h" type="number" min="0" max="20" value="${m.hs != null ? m.hs : ''}">
      <span class="dash">–</span>
      <input id="ed-a" type="number" min="0" max="20" value="${m.as != null ? m.as : ''}">
      <span>${esc(t.a.name)} ${flag(t.a.name)}</span>
    </div>
    ${isKO ? `<label class="ed-pen">If drawn, penalty winner:
      <select id="ed-pw"><option value="">—</option><option value="h"${m.pw === 'h' ? ' selected' : ''}>${esc(t.h.name)}</option><option value="a"${m.pw === 'a' ? ' selected' : ''}>${esc(t.a.name)}</option></select></label>` : ''}
    <p class="hint-text">Manual scores override live data (handy for predictions). Live refresh keeps official results separate.</p>
    <div class="ed-btns">
      <button id="ed-clear" class="small-btn">Clear override</button>
      <button id="ed-cancel" class="small-btn">Cancel</button>
      <button id="ed-save" class="primary-btn">Save</button>
    </div>
  </div></div>`;
  const close = () => root.innerHTML = '';
  root.querySelector('.modal-bg').onclick = e => { if (e.target.classList.contains('modal-bg')) close(); };
  document.getElementById('ed-cancel').onclick = close;
  document.getElementById('ed-clear').onclick = () => { delete manual[n]; store.save('wc26-manual', manual); close(); render(); };
  document.getElementById('ed-save').onclick = () => {
    const h = document.getElementById('ed-h').value, a = document.getElementById('ed-a').value;
    if (h === '' || a === '') { close(); return; }
    const entry = { hs: +h, as: +a };
    const pw = isKO ? document.getElementById('ed-pw').value : '';
    if (pw) entry.pw = pw;
    manual[n] = entry;
    store.save('wc26-manual', manual);
    close(); render();
  };
}

// ── Init ──
document.querySelectorAll('nav .tab').forEach(b => b.onclick = () => { currentView = b.dataset.view; render(); });
document.getElementById('refresh-btn').onclick = () => refreshLive(true);
render();
refreshLive(false);
setInterval(() => {
  if (ALL_NUMS.some(n => isLiveNow(getMatch(n)))) refreshLive(false);
}, 90e3);

if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
