// Pawberry website. Plain JS, no build step. Everything from the network is shown via textContent.
const REPO = 'overhours/pawberry-updates'
const cfg = window.PAWBERRY_CONFIG || {}
const RARITIES = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythical', 'secret']
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches
const $ = (id) => document.getElementById(id)
const store = {
  get(k, fallback) {
    try {
      const v = localStorage.getItem(k)
      return v === null ? fallback : JSON.parse(v)
    } catch {
      return fallback
    }
  },
  set(k, v) {
    try {
      localStorage.setItem(k, JSON.stringify(v))
    } catch {}
  },
}

function el(tag, props = {}, ...children) {
  const e = document.createElement(tag)
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') e.className = v
    else if (k === 'text') e.textContent = v
    // custom properties (--r etc.) need setProperty; plain ones can be assigned
    else if (k === 'style') for (const [sk, sv] of Object.entries(v)) sk.startsWith('--') ? e.style.setProperty(sk, sv) : (e.style[sk] = sv)
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v)
    else e.setAttribute(k, v)
  }
  for (const c of children) if (c != null) e.append(c)
  return e
}
const catImg = (id, extra = {}) => el('img', { src: `img/cats/${id}.png`, alt: '', loading: 'lazy', ...extra })

/* ---------- theme ---------- */
$('theme-toggle').addEventListener('click', () => {
  const root = document.documentElement
  const dark = root.dataset.theme ? root.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches
  root.dataset.theme = dark ? 'light' : 'dark'
  try {
    localStorage.setItem('pawberry-theme', root.dataset.theme)
  } catch {}
})

/* ---------- downloads: always the newest release ---------- */
async function loadReleases() {
  try {
    const r = await fetch(`https://api.github.com/repos/${REPO}/releases?per_page=6`)
    if (!r.ok) throw new Error(String(r.status))
    const releases = (await r.json()).filter((x) => !x.draft)
    const latest = releases[0]
    if (latest) {
      const setup = latest.assets.find((a) => /Setup.*\.exe$/.test(a.name))
      const portable = latest.assets.find((a) => /Portable.*\.exe$/.test(a.name))
      document.querySelectorAll('[data-download="setup"]').forEach((a) => setup && (a.href = setup.browser_download_url))
      document.querySelectorAll('[data-download="portable"]').forEach((a) => portable && (a.href = portable.browser_download_url))
      $('version').textContent = `v${latest.tag_name.replace(/^v/, '')} · Free`
    }
    renderTimeline(releases)
  } catch {
    $('timeline').replaceChildren(el('p', { class: 'small', text: "Couldn't load patch notes right now. They're all on the releases page." }))
  }
}

function renderTimeline(releases) {
  const items = releases.slice(0, 5).map((rel, i) => {
    const date = new Date(rel.published_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
    const body = el('div')
    let list = null
    for (const raw of (rel.body || '').split(/\r?\n/)) {
      const line = raw.trim()
      if (!line) continue
      if (/^[-*] /.test(line)) {
        if (!list) body.append((list = el('ul')))
        list.append(el('li', { text: line.slice(2) }))
      } else {
        list = null
        body.append(el('p', { text: line.replace(/^#+\s*/, '') }))
      }
    }
    return el(
      'article',
      { class: 'release' },
      el('header', {}, el('h3', { text: rel.name || rel.tag_name }), el('span', { class: 'date', text: date }), i === 0 ? el('span', { class: 'latest', text: 'LATEST' }) : null),
      body,
    )
  })
  $('timeline').replaceChildren(...items)
}

/* ---------- Elsie ---------- */
const ELSIE_LINES = [
  "Hi hi! I'm Elsie, your sanctuary guide!",
  'Psst... the Secret cats are VERY rare.',
  'Try a summon further down the page!',
  "I'm terrible at fishing. Can you help?",
  'Block a boss attack right at the end of its charge!',
  'Cats with full hearts bring you gifts.',
]
let elsieIdx = 0
setInterval(() => {
  const b = $('elsie-line')
  b.style.opacity = '0'
  setTimeout(() => {
    elsieIdx = (elsieIdx + 1) % ELSIE_LINES.length
    b.textContent = ELSIE_LINES[elsieIdx]
    b.style.opacity = '1'
  }, 250)
}, 4500)

/* ---------- scroll reveal ---------- */
const io = new IntersectionObserver((entries) => entries.forEach((e) => e.isIntersecting && (e.target.classList.add('shown'), io.unobserve(e.target))), { threshold: 0.15 })
document.querySelectorAll('.reveal').forEach((n) => io.observe(n))

/* ---------- game data driven bits ---------- */
let GAME = null
const rarityStyle = (r) => ({ '--r': GAME.rarity[r].light, '--rd': GAME.rarity[r].dark })

async function loadGame() {
  GAME = await (await fetch('data/game.json')).json()
  $('stat-cats').textContent = String(GAME.cats.length)
  buildParade()
  buildMarquee()
  buildRates()
  buildGallery()
  buildBosses()
}

function buildParade() {
  const walkers = GAME.cats.filter((c) => c.summonable && RARITIES.indexOf(c.rarity) <= 3).slice(0, 14)
  const parade = $('parade')
  walkers.forEach((c, i) => {
    const back = i % 3 === 2
    const dur = 34 + ((i * 7) % 20)
    const w = el('div', { class: 'walker' + (back ? ' back' : ''), style: { animationDuration: dur + 's', animationDelay: -((i * dur) / walkers.length) + 's', bottom: ((i * 11) % 34) + 'px', animationName: back ? 'walk-back' : 'walk', zIndex: String(40 - ((i * 11) % 34)) } }, catImg(c.id, { width: '72' }))
    parade.append(w)
  })
}

function buildMarquee() {
  const cats = GAME.cats.filter((c) => c.rarity !== 'secret')
  const track = $('marquee')
  for (let pass = 0; pass < 2; pass++) for (const c of cats) track.append(catImg(c.id, { width: '48', title: c.name }))
}

/* ---------- gallery ---------- */
let filter = 'all'
function buildGallery() {
  const opts = [['all', 'All'], ...RARITIES.map((r) => [r, GAME.rarity[r].label]), ['limited', 'Limited']]
  $('filters').replaceChildren(
    ...opts.map(([id, label]) =>
      el('button', { class: 'chip', type: 'button', role: 'tab', 'aria-selected': String(id === filter), onclick: () => ((filter = id), buildGallery()) }, label),
    ),
  )
  const cats = GAME.cats
    .filter((c) => filter === 'all' || (filter === 'limited' ? c.exclusive : c.rarity === filter))
    .sort((a, b) => RARITIES.indexOf(a.rarity) - RARITIES.indexOf(b.rarity))
  $('gallery').replaceChildren(
    ...cats.map((c) => {
      const secret = c.rarity === 'secret'
      return el(
        'button',
        { class: 'card' + (secret ? ' secret' : ''), type: 'button', style: rarityStyle(c.rarity), onclick: () => openCat(c), 'aria-label': secret ? 'A secret cat' : c.name },
        catImg(c.id, { width: '96' }),
        el('b', { text: secret ? '???' : c.name }),
        el('small', { text: GAME.rarity[c.rarity].label }),
      )
    }),
  )
}

function openCat(c) {
  const secret = c.rarity === 'secret'
  const card = document.querySelector('.modal-card')
  for (const [k, v] of Object.entries(rarityStyle(c.rarity))) card.style.setProperty(k, v)
  const kind = c.exclusive ? 'Limited / boss reward' : c.summonable ? 'Summonable' : 'Evolved form'
  $('cat-modal-body').replaceChildren(
    el('div', { class: 'art' }, catImg(c.id, { width: '168', style: secret ? { filter: 'brightness(0)', opacity: '0.6' } : {} })),
    el('h3', { id: 'cat-modal-name', text: secret ? '???' : c.name }),
    el('div', { class: 'tags' }, el('span', { class: 'tag', text: GAME.rarity[c.rarity].label + ' ' + '★'.repeat(GAME.rarity[c.rarity].stars) }), el('span', { class: 'tag', text: GAME.elements[c.element].label }), el('span', { class: 'tag', text: GAME.roles[c.role].label }), el('span', { class: 'tag', text: kind })),
    el('p', { text: secret ? 'Nobody knows much about this one... Summon it to find out!' : c.personality }),
    secret ? null : el('div', { class: 'ability' }, el('b', { text: c.ability.name }), el('br'), document.createTextNode(c.ability.desc)),
  )
  $('cat-modal').hidden = false
  $('cat-modal-close').focus()
}
const closeModal = () => ($('cat-modal').hidden = true)
$('cat-modal-close').addEventListener('click', closeModal)
$('cat-modal').addEventListener('click', (e) => e.target === e.currentTarget && closeModal())
addEventListener('keydown', (e) => e.key === 'Escape' && closeModal())

function buildBosses() {
  $('bosses').replaceChildren(
    ...GAME.bosses.map((b) => el('div', { class: 'boss' }, el('img', { src: `img/bosses/${b.id}.png`, alt: '', width: '120', loading: 'lazy' }), el('b', { text: b.name }), el('span', { text: b.title }), el('span', { class: 'lv', text: 'Lv ' + b.level }))),
  )
}

/* ---------- try a summon (same rates and pity as the game) ---------- */
const EPIC_PITY = 10
const SOFT_PITY = 55
const HARD_PITY = 80
let pity = store.get('pawberry-site-pity', { epic: 0, legend: 0 })
let found = new Set(store.get('pawberry-site-found', []))
let pulls = store.get('pawberry-site-pulls', 0)

function buildRates() {
  $('rates').replaceChildren(
    ...[...RARITIES].reverse().map((r) => el('div', { class: 'rate r-' + r, style: rarityStyle(r) }, el('span', { text: GAME.rarity[r].label }), el('b', { text: GAME.rates[r] + '%' }))),
  )
  updateSummonStats()
}
const HIGH = ['legendary', 'mythical', 'secret']
const LOW = ['common', 'uncommon', 'rare', 'epic']
function pickWeighted(rs) {
  let t = Math.random() * rs.reduce((s, r) => s + GAME.rates[r], 0)
  for (const r of rs) if ((t -= GAME.rates[r]) < 0) return r
  return rs[rs.length - 1]
}
function pullOne() {
  const legend = pity.legend + 1
  const epic = pity.epic + 1
  const chance = legend >= HARD_PITY ? 1 : HIGH.reduce((s, r) => s + GAME.rates[r], 0) / 100 + Math.max(0, legend - SOFT_PITY) * 0.06
  let rarity = Math.random() < chance ? pickWeighted(HIGH) : pickWeighted(LOW)
  if (RARITIES.indexOf(rarity) < 3 && epic >= EPIC_PITY) rarity = 'epic'
  const isHigh = RARITIES.indexOf(rarity) >= 4
  pity = { epic: RARITIES.indexOf(rarity) >= 3 ? 0 : epic, legend: isHigh ? 0 : legend }
  for (let i = RARITIES.indexOf(rarity); i >= 0; i--) {
    const pool = GAME.cats.filter((c) => c.summonable && c.rarity === RARITIES[i])
    if (pool.length) return pool[Math.floor(Math.random() * pool.length)]
  }
}
function pullCard(c, single, delay) {
  const isNew = !found.has(c.id)
  found.add(c.id)
  return el(
    'div',
    { class: `pull r-${c.rarity}${single ? ' single' : ''}`, style: { ...rarityStyle(c.rarity), animationDelay: delay + 's' } },
    isNew ? el('span', { class: 'new', text: 'NEW' }) : null,
    catImg(c.id, { width: single ? '168' : '72' }),
    el('span', { class: 'rname', text: c.name }),
    el('span', { class: 'rbadge', text: GAME.rarity[c.rarity].label + ' ' + '★'.repeat(GAME.rarity[c.rarity].stars) }),
  )
}
function summon(n) {
  if (!GAME) return
  const yarn = $('yarn')
  const results = $('results')
  const stage = $('stage')
  results.classList.remove('on')
  yarn.hidden = false
  yarn.classList.add('spinning')
  ;['pull1', 'pull10'].forEach((id) => ($(id).disabled = true))
  setTimeout(
    () => {
      const cats = Array.from({ length: n }, pullOne)
      pulls += n
      const best = cats.reduce((b, c) => (RARITIES.indexOf(c.rarity) > RARITIES.indexOf(b.rarity) ? c : b))
      stage.className = 'stage glow-' + best.rarity
      void stage.offsetWidth // restart the flash animation
      yarn.classList.remove('spinning')
      yarn.hidden = true
      const cards = n === 1 ? [pullCard(cats[0], true, 0)] : [el('div', { class: 'results-grid' }, ...cats.map((c, i) => pullCard(c, false, i * 0.09)))]
      results.replaceChildren(...cards, el('button', { class: 'btn small again', type: 'button', onclick: () => ((results.classList.remove('on')), (yarn.hidden = false)) }, 'Back to the yarn'))
      results.classList.add('on')
      store.set('pawberry-site-pity', pity)
      store.set('pawberry-site-found', [...found])
      store.set('pawberry-site-pulls', pulls)
      updateSummonStats()
      ;['pull1', 'pull10'].forEach((id) => ($(id).disabled = false))
    },
    reduceMotion ? 50 : 900,
  )
}
function updateSummonStats() {
  const total = GAME ? GAME.cats.filter((c) => c.summonable).length : 0
  $('summon-stats').textContent = `${pulls} summons · ${[...found].filter((id) => GAME?.cats.find((c) => c.id === id)?.summonable).length}/${total} cats found · Legendary+ guaranteed in ${HARD_PITY - pity.legend}`
}
$('yarn').addEventListener('click', () => summon(1))
$('pull1').addEventListener('click', () => summon(1))
$('pull10').addEventListener('click', () => summon(10))

/* ---------- leaderboards ---------- */
const BOARDS = [
  ['rebirths', 'Rebirths', 'rebirths'],
  ['hours', 'Hours played', 'hours'],
  ['gems', 'Gems earned', 'gems'],
  ['bosses', 'Bosses beaten', 'bosses'],
  ['coins', 'Coins earned', 'coins'],
  ['fish', 'Fish caught', 'fish'],
]
let board = 'rebirths'
const headers = () => ({ apikey: cfg.anonKey, Authorization: `Bearer ${cfg.anonKey}` })
const fmt = (id, n) => (id === 'hours' ? Number(n).toFixed(1) : Math.round(Number(n)).toLocaleString())
// Each player gets a friendly cat avatar picked from their id, so the podium isn't just text.
function avatarFor(id) {
  const pool = GAME ? GAME.cats.filter((c) => c.summonable && c.rarity !== 'secret') : [{ id: 'berry' }]
  let h = 0
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return pool[h % pool.length].id
}

function buildTabs() {
  $('board-tabs').replaceChildren(
    ...BOARDS.map(([id, label]) => el('button', { class: 'chip', type: 'button', role: 'tab', 'aria-selected': String(id === board), onclick: () => ((board = id), buildTabs(), loadBoard()) }, label)),
  )
}

async function loadBoard() {
  const podium = $('podium')
  const list = $('board')
  if (!cfg.url || !cfg.anonKey) return podium.replaceChildren(emptyBoard('Leaderboards are coming soon!'))
  try {
    const r = await fetch(`${cfg.url}/rest/v1/leaderboard?select=id,name,${board}&order=${board}.desc,updated_at.asc&limit=50`, { headers: headers() })
    const rows = await r.json()
    if (!r.ok || !Array.isArray(rows)) throw new Error('bad response')
    list.replaceChildren()
    if (!rows.length) return podium.replaceChildren(emptyBoard("Nobody's on this board yet. Join from the Ranks screen in the game and be the first!"))
    const unit = BOARDS.find((b) => b[0] === board)[2]
    podium.replaceChildren(
      ...rows.slice(0, 3).map((row, i) =>
        el(
          'div',
          { class: 'place p' + (i + 1) },
          i === 0 ? el('img', { class: 'crown', src: 'img/icons/crown.png', alt: '', width: '42' }) : null,
          catImg(avatarFor(row.id), { width: '72' }),
          el('span', { class: 'who', text: row.name, title: row.name }),
          el('span', { class: 'score', text: `${fmt(board, row[board])} ${unit}` }),
          el('div', { class: 'block', text: String(i + 1) }),
        ),
      ),
    )
    list.replaceChildren(...rows.slice(3).map((row, i) => el('li', {}, el('span', { class: 'rank', text: String(i + 4) }), el('span', { class: 'name', text: row.name }), el('b', { text: fmt(board, row[board]) }))))
    $('board-note').textContent = `Updated ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
  } catch {
    podium.replaceChildren(emptyBoard("Couldn't load the leaderboard right now."))
    list.replaceChildren()
  }
}
function emptyBoard(text) {
  return el('div', { class: 'empty-board', style: { gridColumn: '1 / -1' } }, el('img', { src: 'img/cats/mochi.png', alt: '', width: '96' }), el('p', { text }))
}
async function loadPlayerCount() {
  if (!cfg.url || !cfg.anonKey) return
  try {
    const r = await fetch(`${cfg.url}/rest/v1/leaderboard?select=id`, { method: 'HEAD', headers: { ...headers(), Prefer: 'count=exact' } })
    const total = (r.headers.get('content-range') || '').split('/')[1]
    // Show a player count once there is one; until then just say the boards are live.
    if (total && total !== '*' && Number(total) > 0) $('stat-players-li').replaceChildren(el('b', { text: Number(total).toLocaleString() }), document.createTextNode(' players ranked'))
  } catch {}
}

/* ---------- go ---------- */
loadReleases()
loadGame().then(() => {
  buildTabs()
  loadBoard()
})
loadPlayerCount()
setInterval(loadBoard, 60_000)
