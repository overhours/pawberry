// Pawberry site: point the download buttons at the newest release, and show the live leaderboards.
const REPO = 'overhours/pawberry-updates'
const BOARDS = [
  ['rebirths', 'Rebirths'],
  ['hours', 'Hours played'],
  ['gems', 'Gems earned'],
  ['bosses', 'Bosses beaten'],
  ['coins', 'Coins earned'],
  ['fish', 'Fish caught'],
]
const cfg = window.PAWBERRY_CONFIG || {}

// Text from the database is shown with textContent, never as HTML.
function el(tag, cls, text) {
  const e = document.createElement(tag)
  if (cls) e.className = cls
  if (text !== undefined) e.textContent = text
  return e
}

async function latestRelease() {
  try {
    const r = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`)
    if (!r.ok) throw new Error(r.status)
    const rel = await r.json()
    const setup = rel.assets.find((a) => /Setup.*\.exe$/.test(a.name))
    const portable = rel.assets.find((a) => /Portable.*\.exe$/.test(a.name))
    if (setup) document.getElementById('dl-setup').href = setup.browser_download_url
    if (portable) document.getElementById('dl-portable').href = portable.browser_download_url
    document.getElementById('version').textContent = `Latest version: ${rel.name || rel.tag_name}`
  } catch {
    document.getElementById('version').textContent = 'See every version on the releases page.'
  }
}

async function showBoard(id) {
  document.querySelectorAll('.tab').forEach((t) => t.setAttribute('aria-selected', String(t.dataset.id === id)))
  const list = document.getElementById('board')
  list.replaceChildren(el('li', 'empty', 'Loading...'))
  if (!cfg.url || !cfg.anonKey) return list.replaceChildren(el('li', 'empty', 'Leaderboards are coming soon!'))
  try {
    const r = await fetch(`${cfg.url}/rest/v1/leaderboard?select=id,name,${id}&order=${id}.desc,updated_at.asc&limit=50`, {
      headers: { apikey: cfg.anonKey, Authorization: `Bearer ${cfg.anonKey}` },
    })
    const rows = await r.json()
    if (!r.ok || !Array.isArray(rows)) throw new Error('bad response')
    if (!rows.length) return list.replaceChildren(el('li', 'empty', "Nobody's here yet. Be the first!"))
    list.replaceChildren(
      ...rows.map((row, i) => {
        const li = el('li')
        const n = Number(row[id])
        li.append(el('span', 'rank', String(i + 1)), el('span', 'name', row.name), el('b', 'score', id === 'hours' ? n.toFixed(1) : Math.round(n).toLocaleString()))
        return li
      }),
    )
  } catch {
    list.replaceChildren(el('li', 'empty', "Couldn't load the leaderboard right now."))
  }
}

const tabs = document.getElementById('tabs')
for (const [id, label] of BOARDS) {
  const b = el('button', 'tab', label)
  b.type = 'button'
  b.dataset.id = id
  b.onclick = () => showBoard(id)
  tabs.append(b)
}
latestRelease()
showBoard('rebirths')
