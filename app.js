// Pawberry website. Plain JS, no build step. Anything from the network is shown with textContent.
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
const img = (src, extra = {}) => el('img', { src, alt: '', loading: 'lazy', ...extra })
const catImg = (id, extra = {}) => img(`img/cats/${id}.png`, extra)
const skel = (cls, n = 1, style = {}) => Array.from({ length: n }, () => el('span', { class: 'skel ' + cls, style }))

/* ---------- theme + menu ---------- */
$('theme-toggle').addEventListener('click', () => {
  const root = document.documentElement
  const dark = root.dataset.theme ? root.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches
  root.dataset.theme = dark ? 'light' : 'dark'
  try {
    localStorage.setItem('pawberry-theme', root.dataset.theme)
  } catch {}
})
$('menu-btn').addEventListener('click', () => {
  const open = $('nav-links').classList.toggle('open')
  $('menu-btn').setAttribute('aria-expanded', String(open))
})
$('nav-links').addEventListener('click', (e) => e.target.closest('a') && ($('nav-links').classList.remove('open'), $('menu-btn').setAttribute('aria-expanded', 'false')))

/* ---------- nav: solid after scrolling, and an indicator under the section you're reading ---------- */
const nav = document.querySelector('.nav')
addEventListener('scroll', () => nav.classList.toggle('scrolled', scrollY > 40), { passive: true })
const links = [...document.querySelectorAll('#nav-links a')]
const indicator = $('nav-indicator')
function markActive(id) {
  const link = links.find((a) => a.getAttribute('href') === '#' + id)
  links.forEach((a) => a.classList.toggle('active', a === link))
  if (!link) return (indicator.style.opacity = '0')
  indicator.style.opacity = '1'
  indicator.style.left = link.offsetLeft + 10 + 'px'
  indicator.style.width = link.offsetWidth - 20 + 'px'
}
const sections = links.map((a) => $(a.getAttribute('href').slice(1))).filter(Boolean)
const seen = new Map()
const sectionIO = new IntersectionObserver(
  (entries) => {
    entries.forEach((e) => seen.set(e.target.id, e.isIntersecting ? e.intersectionRatio : 0))
    const best = [...seen.entries()].sort((a, b) => b[1] - a[1])[0]
    markActive(best && best[1] > 0 ? best[0] : null)
  },
  { threshold: [0, 0.15, 0.3, 0.5], rootMargin: '-80px 0px -35% 0px' },
)
sections.forEach((s) => sectionIO.observe(s))

/* ---------- scroll reveal ---------- */
const io = new IntersectionObserver((entries) => entries.forEach((e) => e.isIntersecting && (e.target.classList.add('shown'), io.unobserve(e.target))), { threshold: 0.12 })
document.querySelectorAll('.reveal').forEach((n) => io.observe(n))

/* ---------- click sparkles on buttons (a tiny pixel burst) ---------- */
document.addEventListener('pointerdown', (e) => {
  const t = e.target.closest('.btn, .slot, .yarn')
  if (!t || reduceMotion) return
  const colors = ['#ff8fb1', '#ffe08a', '#c9b3ff', '#a9dca0']
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2
    const d = 22 + Math.random() * 14
    const b = el('i', { class: 'burst', style: { left: e.clientX - 3 + 'px', top: e.clientY - 3 + 'px', '--dx': Math.cos(a) * d + 'px', '--dy': Math.sin(a) * d + 'px', '--c': colors[i % 4] } })
    document.body.append(b)
    setTimeout(() => b.remove(), 520)
  }
})

/* ---------- a few drifting pixel decorations in the page margins ---------- */
function floaties() {
  if (reduceMotion) return
  const icons = ['heart', 'sparkle', 'star', 'strawberry', 'heart', 'sparkle']
  const box = document.querySelector('.floaties')
  icons.forEach((name, i) => {
    const left = i % 2 ? 92 + Math.random() * 5 : 2 + Math.random() * 5
    box.append(img(`img/icons/${name}.png`, { class: 'floatie', style: { left: left + '%', top: 12 + i * 14 + '%', animationDuration: 6 + i + 's', animationDelay: -i + 's' } }))
  })
}

/* ---------- downloads + patch notes ---------- */
$('timeline').replaceChildren(...[0, 1].map(() => el('div', { class: 'entry' }, ...skel('skel-title'), ...skel('skel-line', 3))))
async function loadReleases() {
  try {
    const r = await fetch(`https://api.github.com/repos/${REPO}/releases?per_page=5`)
    if (!r.ok) throw new Error(String(r.status))
    const releases = (await r.json()).filter((x) => !x.draft)
    const latest = releases[0]
    if (latest) {
      const setup = latest.assets.find((a) => /Setup.*\.exe$/.test(a.name))
      const portable = latest.assets.find((a) => /Portable.*\.exe$/.test(a.name))
      document.querySelectorAll('[data-download="setup"]').forEach((a) => setup && (a.href = setup.browser_download_url))
      document.querySelectorAll('[data-download="portable"]').forEach((a) => portable && (a.href = portable.browser_download_url))
      $('version').textContent = `v${latest.tag_name.replace(/^v/, '')}, free`
    }
    $('timeline').replaceChildren(...releases.slice(0, 4).map(entry))
  } catch {
    $('timeline').replaceChildren(el('p', { text: "Couldn't load the patch notes right now. They're all on the releases page." }))
  }
}
function entry(rel, i) {
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
  return el('article', { class: 'entry' }, el('h3', {}, rel.name || rel.tag_name, el('span', { class: 'date', text: date }), i === 0 ? el('span', { class: 'latest', text: 'latest' }) : null), body)
}

/* ---------- Elsie's tips ---------- */
const ELSIE_LINES = [
  "Hi hi! I'm Elsie, your sanctuary guide!",
  'Psst... Secret cats are VERY rare.',
  'Try the summon machine just below!',
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
}, 4800)

/* ---------- everything drawn from the game's own data ---------- */
let GAME = null
const rarityStyle = (r) => ({ '--r': GAME.rarity[r].light, '--rd': GAME.rarity[r].dark })
$('gallery').replaceChildren(el('div', { class: 'slots' }, ...skel('skel-slot', 12)))

async function loadGame() {
  GAME = await (await fetch('data/game.json')).json()
  buildParade()
  buildRates()
  buildTower()
  buildBosses()
  buildFish()
  buildGallery()
}

function buildParade() {
  const walkers = GAME.cats.filter((c) => c.summonable && RARITIES.indexOf(c.rarity) <= 3).slice(0, 12)
  walkers.forEach((c, i) => {
    const back = i % 3 === 2
    const dur = 38 + ((i * 7) % 20)
    $('parade').append(
      el('div', { class: 'walker' + (back ? ' back' : ''), style: { animationDuration: dur + 's', animationDelay: -((i * dur) / walkers.length) + 's', bottom: ((i * 7) % 22) + 'px', animationName: back ? 'walk-back' : 'walk', zIndex: String(30 - ((i * 7) % 22)) } }, catImg(c.id, { width: '64' })),
    )
  })
}

function buildRates() {
  // bar heights on a square-root scale, so 0.05% still shows up next to 46%
  const max = Math.sqrt(GAME.rates.common)
  $('rates').replaceChildren(
    ...RARITIES.map((r) =>
      el('div', { style: rarityStyle(r) }, el('dt', {}, el('i', { style: { height: Math.max(6, (Math.sqrt(GAME.rates[r]) / max) * 64) + 'px' } })), el('dd', {}, el('b', { text: GAME.rates[r] + '%' }), GAME.rarity[r].label)),
    ),
  )
  updateSummonStats()
}

function buildTower() {
  const boss = (i) => el('img', { src: `img/bosses/${GAME.bosses[i].id}.png`, alt: '' })
  const floor = (n, b) => el('div', { class: 'floor' + (b !== undefined ? ' boss' : '') }, el('span', { text: 'F' + n }), b !== undefined ? boss(b) : null)
  $('floors').replaceChildren(el('div', { class: 'floor dots', text: '...' }), floor(15, 2), floor(10, 1), el('div', { class: 'floor dots', text: '...' }), floor(5, 0), floor(3), floor(2), floor(1), el('div', { class: 'tower-base' }))
}

function buildBosses() {
  $('bosses').replaceChildren(...GAME.bosses.map((b) => el('div', { class: 'step' }, img(`img/bosses/${b.id}.png`, { width: '110' }), el('b', { text: b.name }), el('span', { text: 'Lv ' + b.level }))))
}

function buildFish() {
  $('fish-strip').replaceChildren(...GAME.fish.map((f) => img(`img/fish/${f.id}.png`, { width: '54', title: f.rarity === 'secret' ? '???' : f.name, style: f.rarity === 'secret' ? { filter: 'brightness(0)', opacity: '0.5' } : {} })))
}

/* ---------- the collection binder ---------- */
let filter = 'all'
let limit = 60 // per-rarity pages: hundreds of cats per tab, shown 60 at a time
function buildGallery() {
  const tabs = [['all', 'All'], ...RARITIES.map((r) => [r, GAME.rarity[r].label]), ['limited', 'Limited']]
  $('filters').replaceChildren(...tabs.map(([id, label]) => el('button', { class: 'binder-tab', type: 'button', role: 'tab', 'aria-selected': String(id === filter), onclick: () => ((filter = id), (limit = 60), buildGallery()) }, label)))
  const pick = (c) => filter === 'all' || (filter === 'limited' ? c.exclusive : c.rarity === filter)
  const groups = RARITIES.map((r) => [r, GAME.cats.filter((c) => c.rarity === r && pick(c))]).filter(([, cats]) => cats.length)
  $('gallery').replaceChildren(
    ...groups.map(([r, cats]) =>
      el(
        'div',
        { class: 'rarity-group', style: rarityStyle(r) },
        el('h3', { class: 'rarity-label' }, GAME.rarity[r].label, el('small', { text: `${cats.length} cat${cats.length === 1 ? '' : 's'}` })),
        // On "All", each rarity shows a short preview so the page doesn't become one long wall of cards.
        el('div', { class: 'slots' }, ...(filter === 'all' ? cats.slice(0, RARITIES.indexOf(r) >= 4 ? 4 : 7) : cats.slice(0, limit)).map(slot)),
        filter !== 'all' && cats.length > limit ? el('button', { class: 'see-all', type: 'button', onclick: () => ((limit += 60), buildGallery()) }, `Show more (${cats.length - limit} left)`) : null,
        filter === 'all' && cats.length > (RARITIES.indexOf(r) >= 4 ? 4 : 7)
          ? el('button', { class: 'see-all', type: 'button', onclick: () => ((filter = r), (limit = 60), buildGallery(), $('cats').scrollIntoView()) }, `See all ${cats.length} ${GAME.rarity[r].label} cats →`)
          : null,
      ),
    ),
  )
}
function slot(c) {
  const secret = c.rarity === 'secret'
  const big = RARITIES.indexOf(c.rarity) >= 4
  return el(
    'button',
    { class: 'slot' + (big ? ' big' : '') + (secret ? ' secret' : ''), type: 'button', style: rarityStyle(c.rarity), onclick: () => openCat(c), 'aria-label': secret ? 'A secret cat' : c.name },
    catImg(c.id, { width: big ? '112' : '80' }),
    el('b', { text: secret ? '???' : c.name }),
    big ? el('small', { text: secret ? 'Nobody knows...' : c.ability.name }) : null,
  )
}
function openCat(c) {
  const secret = c.rarity === 'secret'
  const card = document.querySelector('.modal-card')
  for (const [k, v] of Object.entries(rarityStyle(c.rarity))) card.style.setProperty(k, v)
  const kind = c.exclusive ? 'Limited or boss reward' : c.summonable ? 'Summonable' : 'Evolved form'
  $('cat-modal-body').replaceChildren(
    el('div', { class: 'art' }, catImg(c.id, { width: '160', style: secret ? { filter: 'brightness(0)', opacity: '0.6' } : {} })),
    el('h3', { id: 'cat-modal-name', text: secret ? '???' : c.name }),
    el('div', { class: 'tags' }, ...[GAME.rarity[c.rarity].label + ' ' + '★'.repeat(GAME.rarity[c.rarity].stars), GAME.elements[c.element].label, GAME.roles[c.role].label, kind].map((t) => el('span', { class: 'tag', text: t }))),
    el('p', { text: secret ? 'Nobody knows much about this one. Summon it to find out!' : c.personality }),
    secret ? null : el('div', { class: 'ability' }, el('b', { text: c.ability.name }), el('br'), document.createTextNode(c.ability.desc)),
  )
  $('cat-modal').hidden = false
  $('cat-modal-close').focus()
}
const closeModal = () => ($('cat-modal').hidden = true)
$('cat-modal-close').addEventListener('click', closeModal)
$('cat-modal').addEventListener('click', (e) => e.target === e.currentTarget && closeModal())
addEventListener('keydown', (e) => e.key === 'Escape' && closeModal())

/* ---------- the summon machine (same rates and pity as the game) ---------- */
const EPIC_PITY = 10
const SOFT_PITY = 55
const HARD_PITY = 80
let pity = store.get('pawberry-site-pity', { epic: 0, legend: 0 })
const found = new Set(store.get('pawberry-site-found', []))
let pulls = store.get('pawberry-site-pulls', 0)
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
  pity = { epic: RARITIES.indexOf(rarity) >= 3 ? 0 : epic, legend: RARITIES.indexOf(rarity) >= 4 ? 0 : legend }
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
    catImg(c.id, { width: single ? '144' : '60' }),
    el('span', { class: 'rname', text: c.name }),
    el('span', { class: 'rbadge', text: GAME.rarity[c.rarity].label + ' ' + '★'.repeat(GAME.rarity[c.rarity].stars) }),
  )
}
function summon(n) {
  if (!GAME) return
  const yarn = $('yarn')
  const results = $('results')
  results.classList.remove('on')
  yarn.hidden = false
  yarn.classList.add('spinning')
  ;['pull1', 'pull10'].forEach((id) => ($(id).disabled = true))
  setTimeout(
    () => {
      const cats = Array.from({ length: n }, pullOne)
      pulls += n
      const best = Math.max(...cats.map((c) => RARITIES.indexOf(c.rarity)))
      const stage = $('stage')
      stage.classList.remove('flash')
      void stage.offsetWidth
      if (best >= 4) stage.classList.add('flash')
      yarn.classList.remove('spinning')
      yarn.hidden = true
      const cards = n === 1 ? [pullCard(cats[0], true, 0)] : [el('div', { class: 'results-grid' }, ...cats.map((c, i) => pullCard(c, false, i * 0.08)))]
      results.replaceChildren(...cards, el('button', { class: 'btn btn-secondary btn-sm again', type: 'button', onclick: () => (results.classList.remove('on'), (yarn.hidden = false)) }, 'Back to the yarn'))
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
  const total = GAME.cats.filter((c) => c.summonable).length
  const got = [...found].filter((id) => GAME.cats.find((c) => c.id === id)?.summonable).length
  $('summon-stats').textContent = pulls ? `${pulls} pulls · ${got}/${total} found · Legendary+ in ${HARD_PITY - pity.legend}` : 'real rates, just for fun'
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
function avatarFor(id) {
  const pool = GAME ? GAME.cats.filter((c) => c.summonable && c.rarity !== 'secret') : [{ id: 'berry' }]
  let h = 0
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return pool[h % pool.length].id
}
function buildTabs() {
  $('board-tabs').replaceChildren(...BOARDS.map(([id, label]) => el('button', { type: 'button', role: 'tab', 'aria-selected': String(id === board), onclick: () => ((board = id), buildTabs(), loadBoard()) }, label)))
}
async function loadBoard() {
  const podium = $('podium')
  const list = $('board')
  podium.replaceChildren(...[1, 2, 3].map((i) => el('div', { class: 'place p' + i }, ...skel('skel-block', 1, { width: '100%', height: [130, 92, 66][i - 1] + 'px' }))))
  list.replaceChildren(...skel('skel-row', 3).map((s) => el('li', { style: { display: 'block', padding: '0' } }, s)))
  if (!cfg.url || !cfg.anonKey) return podium.replaceChildren(emptyBoard('Leaderboards are coming soon!')), list.replaceChildren()
  try {
    const r = await fetch(`${cfg.url}/rest/v1/leaderboard?select=id,name,${board}&order=${board}.desc,updated_at.asc&limit=50`, { headers: headers() })
    const rows = await r.json()
    if (!r.ok || !Array.isArray(rows)) throw new Error('bad response')
    list.replaceChildren()
    if (!rows.length) {
      // An empty podium waiting for its first players, rather than a blank box.
      podium.replaceChildren(
        ...[1, 2, 3].map((i) =>
          el('div', { class: 'place ghost p' + i }, catImg(['berry', 'mochi', 'nyx'][i - 1], { width: '72' }), el('span', { class: 'who', text: i === 1 ? 'Your name here?' : '???' }), el('span', { class: 'score', text: 'waiting...' }), el('div', { class: 'block', text: String(i) })),
        ),
      )
      $('board-note').textContent = 'Nobody has joined yet. Join from the Ranks screen in the game and take first place!'
      return
    }
    const unit = BOARDS.find((b) => b[0] === board)[2]
    podium.replaceChildren(
      ...rows.slice(0, 3).map((row, i) =>
        el(
          'div',
          { class: 'place p' + (i + 1) },
          i === 0 ? img('img/icons/crown.png', { class: 'crown', width: '40' }) : null,
          catImg(avatarFor(row.id), { width: '72' }),
          el('span', { class: 'who', text: row.name, title: row.name }),
          el('span', { class: 'score', text: `${fmt(board, row[board])} ${unit}` }),
          el('div', { class: 'block', text: String(i + 1) }),
        ),
      ),
    )
    list.replaceChildren(...rows.slice(3).map((row, i) => el('li', {}, el('span', { class: 'rank', text: '#' + (i + 4) }), el('span', { class: 'name', text: row.name }), el('b', { text: fmt(board, row[board]) }))))
    $('board-note').textContent = `Updated ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
  } catch {
    podium.replaceChildren(emptyBoard("Couldn't load the leaderboard right now."))
    list.replaceChildren()
  }
}
function emptyBoard(text) {
  return el('div', { class: 'empty-board' }, img('img/cats/mochi.png', { width: '88' }), el('p', { text }))
}

/* ---------- go ---------- */
floaties()
loadReleases()
buildTabs()
loadBoard()
loadGame().catch(() => $('gallery').replaceChildren(el('p', { text: "Couldn't load the cats right now." })))
setInterval(loadBoard, 60_000)
