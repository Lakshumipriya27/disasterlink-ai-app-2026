// On-device copy of the rule-based classifier + urgency engine (mirrors backend/app/ai/*.py) so that
// offline submissions still get an immediate local recommendation. The server re-analyses on sync.
const LEXICON = {
  food: { food: 3, hungry: 3, hunger: 3, starving: 4, meal: 2, meals: 2, rice: 2, eat: 2, ration: 2, rations: 2, milk: 2, 'baby food': 3, saapadu: 3, sapadu: 3, unavu: 3, 'no food': 4, 'food packets': 3 },
  water: { water: 2, 'drinking water': 4, thirsty: 3, thanni: 3, kudineer: 3, 'bottled water': 3, dehydrated: 3, dehydration: 3, 'clean water': 3, 'no water': 3, 'water cans': 3 },
  medicine: { medicine: 4, medicines: 4, medical: 3, insulin: 4, tablet: 3, tablets: 3, doctor: 3, fever: 3, injured: 3, injury: 3, wound: 3, bleeding: 3, diabetic: 3, diabetes: 3, 'blood pressure': 3, dialysis: 4, oxygen: 4, inhaler: 3, asthma: 3, 'first aid': 3, pregnant: 2, marunthu: 3, sick: 2, pain: 2, infection: 3, diarrhoea: 3, diarrhea: 3, 'medicine kit': 4 },
  shelter: { shelter: 4, homeless: 4, 'house collapsed': 4, roof: 2, 'house flooded': 3, 'place to stay': 4, 'relief camp': 3, camp: 2, tent: 3, tarpaulin: 3, displaced: 3, 'nowhere to stay': 4 },
  transport: { transport: 4, vehicle: 3, ambulance: 3, boat: 3, evacuation: 2, ride: 2, stranded: 2, 'hospital transfer': 3, pickup: 2, 'wheelchair transport': 4, van: 2 },
  clothing: { clothes: 4, clothing: 4, blanket: 3, blankets: 3, dress: 2, saree: 2, 'dry clothes': 4, bedsheet: 2, towel: 2 },
  rescue: { trapped: 5, rescue: 5, drowning: 6, stuck: 3, 'rising water': 4, 'water rising': 4, 'neck deep': 5, 'chest deep': 4, rooftop: 4, collapsed: 4, 'swept away': 6, 'cannot get out': 5, sos: 3, unconscious: 5, 'electric shock': 5, electrocuted: 5, kaapathunga: 4, marooned: 4, 'cut off': 3 },
}
const DANGER = { drowning: 40, 'swept away': 40, 'not breathing': 40, unconscious: 35, 'electric shock': 35, electrocuted: 35, trapped: 30, 'neck deep': 30, 'chest deep': 25, 'rising water': 22, 'water rising': 22, collapsed: 25, bleeding: 18, 'chest pain': 30, 'heart attack': 35, stroke: 30, seizure: 28, "can't breathe": 35, 'cannot breathe': 35, rooftop: 20, stuck: 12, marooned: 15, fire: 25, 'labour pain': 28, dialysis: 20, oxygen: 22, 'breathing difficulty': 30, insulin: 15, 'water entering': 12, 'cut off': 10 }
const TEXT_VUL = {
  elderly: ['elderly', 'old age', 'grandmother', 'grandfather', 'grandma', 'grandpa', 'aged', 'senior', 'paati', 'thatha'],
  children: ['child', 'children', 'baby', 'babies', 'infant', 'toddler', 'kids', 'newborn', 'kuzhandhai'],
  disabled: ['wheelchair', 'disabled', 'disability', 'bedridden', 'paralysed', 'paralyzed', 'blind', 'deaf', 'cannot walk'],
  pregnant: ['pregnant', 'pregnancy', 'labour', 'labor'],
}
const CATW = { rescue: 15, medicine: 12, water: 10, shelter: 8, food: 7, transport: 5, clothing: 2, other: 2 }

const norm = (t) => (t || '').toLowerCase().replace(/[^a-z0-9'\s]/g, ' ').replace(/\s+/g, ' ').trim()
const count = (text, term) => (text.match(new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g')) || []).length

export function classifyLocal(text, hint) {
  const n = norm(text)
  const scores = {}; const matched = {}
  for (const [cat, terms] of Object.entries(LEXICON)) {
    for (const [term, w] of Object.entries(terms)) {
      const c = count(n, term)
      if (c) { scores[cat] = (scores[cat] || 0) + w * Math.min(c, 2); (matched[cat] ||= []).push(term) }
    }
  }
  if (hint && hint !== 'other') scores[hint] = (scores[hint] || 0) + 3
  const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1])
  if (!ranked.length) return { category: hint || 'other', keywords: [], confidence: 0.2, explanation: ['No category keywords found.'] }
  const total = ranked.reduce((s, [, v]) => s + v, 0)
  const [primary, top] = ranked[0]
  return {
    category: primary,
    categories: [primary, ...ranked.slice(1).filter(([, s]) => s >= Math.max(3, 0.35 * top)).map(([c]) => c)],
    keywords: Object.values(matched).flat().slice(0, 8),
    confidence: Math.min(0.97, 0.45 + 0.5 * (top / total) * Math.min(1, top / 6)),
    explanation: ranked.filter(([c]) => matched[c]).map(([c, s]) => `${c}: matched ${matched[c].slice(0, 4).join(', ')} (score ${s})`),
  }
}

export function urgencyLocal({ text, category, people = 1, elderly, children, disabled, medical, pregnant, sos }) {
  const n = norm(text); const factors = []; let score = 0
  const hits = Object.entries(DANGER).filter(([t]) => count(n, t)).sort((a, b) => b[1] - a[1])
  if (hits.length) { const p = Math.min(50, hits.slice(0, 2).reduce((s, [, w]) => s + w, 0)); score += p; factors.push({ factor: 'Immediate danger indicators', detail: hits.slice(0, 4).map(([t]) => t).join(', '), points: p }) }
  if (sos) { score += 35; factors.push({ factor: 'One-touch SOS alert', detail: '', points: 35 }) }
  const pp = Math.round(Math.min(18, 6 * Math.log10(Math.max(1, people)) * 1.5) * 10) / 10
  if (pp) { score += pp; factors.push({ factor: 'People affected', detail: `${people} people`, points: pp }) }
  const inf = Object.fromEntries(Object.entries(TEXT_VUL).map(([k, ws]) => [k, ws.some((w) => count(n, w))]))
  elderly ||= inf.elderly; children ||= inf.children; disabled ||= inf.disabled; pregnant ||= inf.pregnant
  const v = [elderly && ['elderly', 6], children && ['children', 5], disabled && ['disability', 7], medical && ['medical condition', 7], pregnant && ['pregnant', 7]].filter(Boolean)
  if (v.length) { const p = Math.min(22, v.reduce((s, [, w]) => s + w, 0)); score += p; factors.push({ factor: 'Vulnerability', detail: v.map(([x]) => x).join(', '), points: p }) }
  const cw = CATW[category] || 2; score += cw; factors.push({ factor: 'Assistance category', detail: category, points: cw })
  score = Math.max(0, Math.min(100, Math.round(score * 10) / 10))
  const level = score >= 70 ? 'critical' : score >= 48 ? 'high' : score >= 28 ? 'medium' : 'low'
  return { level, score, factors }
}
