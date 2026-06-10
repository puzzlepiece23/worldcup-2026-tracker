// ─── Static tournament structure: FIFA World Cup 2026 ───
// Fixture list (teams, kickoff times, scores) lives in fixtures.js, generated
// by update-data.ps1 from fixturedownload.com. Everything here is fixed by the
// official competition schedule and does not change during the tournament.

// Feed "Location" string → real stadium, city, IANA timezone
const VENUES = {
  'Mexico City Stadium':            { stadium: 'Estadio Azteca',          city: 'Mexico City, Mexico',     tz: 'America/Mexico_City' },
  'Guadalajara Stadium':            { stadium: 'Estadio Akron',           city: 'Guadalajara, Mexico',     tz: 'America/Mexico_City' },
  'Monterrey Stadium':              { stadium: 'Estadio BBVA',            city: 'Monterrey, Mexico',       tz: 'America/Monterrey' },
  'Toronto Stadium':                { stadium: 'BMO Field',               city: 'Toronto, Canada',         tz: 'America/Toronto' },
  'BC Place Vancouver':             { stadium: 'BC Place',                city: 'Vancouver, Canada',       tz: 'America/Vancouver' },
  'Seattle Stadium':                { stadium: 'Lumen Field',             city: 'Seattle, USA',            tz: 'America/Los_Angeles' },
  'San Francisco Bay Area Stadium': { stadium: "Levi's Stadium",          city: 'Santa Clara, USA',        tz: 'America/Los_Angeles' },
  'Los Angeles Stadium':            { stadium: 'SoFi Stadium',            city: 'Inglewood, USA',          tz: 'America/Los_Angeles' },
  'Dallas Stadium':                 { stadium: 'AT&T Stadium',            city: 'Arlington, USA',          tz: 'America/Chicago' },
  'Houston Stadium':                { stadium: 'NRG Stadium',             city: 'Houston, USA',            tz: 'America/Chicago' },
  'Kansas City Stadium':            { stadium: 'Arrowhead Stadium',       city: 'Kansas City, USA',        tz: 'America/Chicago' },
  'Atlanta Stadium':                { stadium: 'Mercedes-Benz Stadium',   city: 'Atlanta, USA',            tz: 'America/New_York' },
  'Miami Stadium':                  { stadium: 'Hard Rock Stadium',       city: 'Miami Gardens, USA',      tz: 'America/New_York' },
  'Boston Stadium':                 { stadium: 'Gillette Stadium',        city: 'Foxborough, USA',         tz: 'America/New_York' },
  'Philadelphia Stadium':           { stadium: 'Lincoln Financial Field', city: 'Philadelphia, USA',       tz: 'America/New_York' },
  'New York/New Jersey Stadium':    { stadium: 'MetLife Stadium',         city: 'East Rutherford, USA',    tz: 'America/New_York' },
};

// Knockout wiring (official match numbers 73–104).
// Slot spec: ['W', g] = winner of group g · ['R', g] = runner-up of group g
//            ['T', [groups]] = best third from one of these groups
//            ['M', n] = winner of match n · ['L', n] = loser of match n
const KO_SOURCES = {
  73:  { h: ['R', 'A'], a: ['R', 'B'] },
  74:  { h: ['W', 'E'], a: ['T', ['A','B','C','D','F']] },
  75:  { h: ['W', 'F'], a: ['R', 'C'] },
  76:  { h: ['W', 'C'], a: ['R', 'F'] },
  77:  { h: ['W', 'I'], a: ['T', ['C','D','F','G','H']] },
  78:  { h: ['R', 'E'], a: ['R', 'I'] },
  79:  { h: ['W', 'A'], a: ['T', ['C','E','F','H','I']] },
  80:  { h: ['W', 'L'], a: ['T', ['E','H','I','J','K']] },
  81:  { h: ['W', 'D'], a: ['T', ['B','E','F','I','J']] },
  82:  { h: ['W', 'G'], a: ['T', ['A','E','H','I','J']] },
  83:  { h: ['R', 'K'], a: ['R', 'L'] },
  84:  { h: ['W', 'H'], a: ['R', 'J'] },
  85:  { h: ['W', 'B'], a: ['T', ['E','F','G','I','J']] },
  86:  { h: ['W', 'J'], a: ['R', 'H'] },
  87:  { h: ['W', 'K'], a: ['T', ['D','E','I','J','L']] },
  88:  { h: ['R', 'D'], a: ['R', 'G'] },
  89:  { h: ['M', 74], a: ['M', 77] },
  90:  { h: ['M', 73], a: ['M', 75] },
  91:  { h: ['M', 76], a: ['M', 78] },
  92:  { h: ['M', 79], a: ['M', 80] },
  93:  { h: ['M', 83], a: ['M', 84] },
  94:  { h: ['M', 81], a: ['M', 82] },
  95:  { h: ['M', 86], a: ['M', 88] },
  96:  { h: ['M', 85], a: ['M', 87] },
  97:  { h: ['M', 89], a: ['M', 90] },
  98:  { h: ['M', 93], a: ['M', 94] },
  99:  { h: ['M', 91], a: ['M', 92] },
  100: { h: ['M', 95], a: ['M', 96] },
  101: { h: ['M', 97], a: ['M', 98] },
  102: { h: ['M', 99], a: ['M', 100] },
  103: { h: ['L', 101], a: ['L', 102] },
  104: { h: ['M', 101], a: ['M', 102] },
};

// Visual bracket: two halves meeting at the final
const BRACKET_LAYOUT = {
  left:  { r32: [74, 77, 73, 75, 83, 84, 81, 82], r16: [89, 90, 93, 94], qf: [97, 98],  sf: 101 },
  right: { r32: [76, 78, 79, 80, 86, 88, 85, 87], r16: [91, 92, 95, 96], qf: [99, 100], sf: 102 },
  final: 104,
  third: 103,
};

function stageOf(n) {
  if (n <= 72)  return { key: 'group', name: 'Group stage', short: 'GRP' };
  if (n <= 88)  return { key: 'r32',   name: 'Round of 32', short: 'R32' };
  if (n <= 96)  return { key: 'r16',   name: 'Round of 16', short: 'R16' };
  if (n <= 100) return { key: 'qf',    name: 'Quarter-final', short: 'QF' };
  if (n <= 102) return { key: 'sf',    name: 'Semi-final', short: 'SF' };
  if (n === 103) return { key: 'third', name: 'Third place', short: '3RD' };
  return { key: 'final', name: 'Final', short: 'FINAL' };
}

const FLAGS = {
  'Mexico': '🇲🇽', 'South Africa': '🇿🇦', 'Korea Republic': '🇰🇷', 'Czechia': '🇨🇿',
  'Canada': '🇨🇦', 'Bosnia and Herzegovina': '🇧🇦', 'Qatar': '🇶🇦', 'Switzerland': '🇨🇭',
  'Brazil': '🇧🇷', 'Haiti': '🇭🇹', 'Morocco': '🇲🇦', 'Scotland': '🏴󠁧󠁢󠁳󠁣󠁴󠁿',
  'Australia': '🇦🇺', 'Paraguay': '🇵🇾', 'Türkiye': '🇹🇷', 'USA': '🇺🇸',
  "Côte d'Ivoire": '🇨🇮', 'Curaçao': '🇨🇼', 'Ecuador': '🇪🇨', 'Germany': '🇩🇪',
  'Japan': '🇯🇵', 'Netherlands': '🇳🇱', 'Sweden': '🇸🇪', 'Tunisia': '🇹🇳',
  'Belgium': '🇧🇪', 'Egypt': '🇪🇬', 'IR Iran': '🇮🇷', 'New Zealand': '🇳🇿',
  'Cabo Verde': '🇨🇻', 'Saudi Arabia': '🇸🇦', 'Spain': '🇪🇸', 'Uruguay': '🇺🇾',
  'France': '🇫🇷', 'Iraq': '🇮🇶', 'Norway': '🇳🇴', 'Senegal': '🇸🇳',
  'Algeria': '🇩🇿', 'Argentina': '🇦🇷', 'Austria': '🇦🇹', 'Jordan': '🇯🇴',
  'Colombia': '🇨🇴', 'Congo DR': '🇨🇩', 'Portugal': '🇵🇹', 'Uzbekistan': '🇺🇿',
  'Croatia': '🇭🇷', 'England': '🏴󠁧󠁢󠁥󠁮󠁧󠁿', 'Ghana': '🇬🇭', 'Panama': '🇵🇦',
};

// ESPN name → feed name, for live-score matching (keys/values normalized at use)
const TEAM_ALIASES = {
  'united states': 'usa',
  'south korea': 'korea republic',
  'iran': 'ir iran',
  'dr congo': 'congo dr',
  'democratic republic of the congo': 'congo dr',
  'cape verde': 'cabo verde',
  'cape verde islands': 'cabo verde',
  'turkey': 'turkiye',
  'ivory coast': "Côte d'Ivoire",
  'czech republic': 'czechia',
  'bosnia herzegovina': 'bosnia and herzegovina',
  'holland': 'netherlands',
};
