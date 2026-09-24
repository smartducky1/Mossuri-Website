import React, { useEffect, useState } from 'react'
import './task.css'

const characters = [
  { name: 'Hyper', personality: 'Hyper', image: '/assets/task/hyper.png' },
  { name: 'Smart', personality: 'Smart', image: '/assets/task/smart.png' },
  { name: 'Goofy', personality: 'Goofy', image: '/assets/task/goofy.png' },
]

function validUsername(v) { return /^[A-Za-z0-9_]{1,15}$/.test(v.trim().replace(/^@/, '')) }
function validWallet(v) { return /^0x[a-fA-F0-9]{40}$/.test(v.trim()) }
function validXUrl(v) {
  try {
    const u = new URL(v.trim())
    const host = u.hostname.toLowerCase().replace(/^www\./, '')
    const p = u.pathname.split('/').filter(Boolean)
    return (host === 'x.com' || host === 'twitter.com') && p.length >= 3 && p[1] === 'status' && /^\d+$/.test(p[2])
  } catch { return false }
}

export default function TaskPage() {
  const [index, setIndex] = useState(0)
  const [xUser, setXUser] = useState('')
  const [quote, setQuote] = useState('')
  const [tags, setTags] = useState('')
  const [wallet, setWallet] = useState('')
  const [errors, setErrors] = useState({})
  const [submitted, setSubmitted] = useState(false)
  const [serverError, setServerError] = useState('')
  const [checkWallet, setCheckWallet] = useState('')
  const [checkResult, setCheckResult] = useState('')
  const [approved, setApproved] = useState([])
  const character = characters[index]

  useEffect(() => {
    const load = async () => {
      try {
        const r = await fetch('/api/task-approved', { cache: 'no-store' })
        const d = await r.json()
        if (r.ok && Array.isArray(d.approved)) setApproved(d.approved.slice(0, 10))
      } catch {}
    }
    load()
    const id = setInterval(load, 15000)
    return () => clearInterval(id)
  }, [])

  const download = () => {
    const a = document.createElement('a')
    a.href = character.image
    a.download = `${character.name}.png`
    a.click()
  }

  const checkStatus = async e => {
    e.preventDefault()
    if (!validWallet(checkWallet)) return setCheckResult('INVALID WALLET')
    try {
      const r = await fetch(`/api/task-status?wallet=${encodeURIComponent(checkWallet.trim())}`, { cache: 'no-store' })
      const d = await r.json()
      setCheckResult(d.status ? d.status.toUpperCase() : 'NOT FOUND')
    } catch { setCheckResult('ERROR') }
  }

  const submit = async e => {
    e.preventDefault()
    const next = {}
    if (!validUsername(xUser)) next.xUser = 'Invalid X username'
    if (!validXUrl(quote)) next.quote = 'Invalid X post URL'
    if (!validXUrl(tags)) next.tags = 'Invalid X comment URL'
    if (!validWallet(wallet)) next.wallet = 'Invalid EVM wallet'
    setErrors(next)
    setServerError('')
    if (Object.keys(next).length) return

    try {
      const r = await fetch('/api/submit-task', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ xUsername: xUser, quoteTweet: quote, tagFriends: tags, wallet, character: character.name })
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok || !d.ok) return setServerError(d.error || 'We could not save your application.')
      setXUser(''); setQuote(''); setTags(''); setWallet(''); setErrors({}); setSubmitted(true)
    } catch { setServerError('Connection error. Please try again.') }
  }

  return <main className="task-page">
    <section className="character-carousel">
      <button onClick={() => setIndex((index + 2) % 3)} aria-label="Previous">◀</button>
      <div className="character-window"><img src={character.image} alt={character.name} /></div>
      <button onClick={() => setIndex((index + 1) % 3)} aria-label="Next">▶</button>
    </section>

    <section className="status-area">
      <form onSubmit={checkStatus} className="status-check">
        <span>Check status</span><input value={checkWallet} onChange={e => setCheckWallet(e.target.value)} placeholder="Paste EVM" spellCheck="false" />
      </form>
      {checkResult && <div className={`status-result ${checkResult.toLowerCase()}`}>{checkResult}</div>}
    </section>

    <section className="task-card"><form onSubmit={submit}>
      <div className="task-row"><label>Follow X</label><div className="dark-row"><input value={xUser} onChange={e => setXUser(e.target.value)} placeholder="Drop your X username" /><a href="https://x.com/mossuris" target="_blank" rel="noreferrer">Follow</a></div>{errors.xUser && <small>{errors.xUser}</small>}</div>
      <div className="task-row"><label>Like and RT pinned post</label><div className="dark-row single"><a href="https://x.com/mossuris" target="_blank" rel="noreferrer">GO</a></div></div>
      <div className="task-row"><label>QT pinned post with your selected character</label><div className="dark-row"><input value={quote} onChange={e => setQuote(e.target.value)} placeholder="Link to QT https://x.com/status....." /></div>{errors.quote && <small>{errors.quote}</small>}</div>
      <div className="task-row"><label>Tag 3 friends in pinned post comment</label><div className="dark-row"><input value={tags} onChange={e => setTags(e.target.value)} placeholder="Link to comment https://x.com/status....." /></div>{errors.tags && <small>{errors.tags}</small>}</div>
      <div className="task-row"><label>Submit EVM wallet</label><div className="dark-row"><input value={wallet} onChange={e => setWallet(e.target.value)} placeholder="0x........" spellCheck="false" /></div>{errors.wallet && <small>{errors.wallet}</small>}</div>
      {serverError && <p className="server-error">{serverError}</p>}
      <button className="register" type="submit">REGISTER</button>
    </form></section>

    <section className="personality-card"><img src={character.image} alt={character.name} /><div><span>Personality</span><strong>{character.personality}</strong></div><button onClick={download} aria-label="Download character">⇩</button></section>

    <section className="leaderboard"><h2>Approved Mossuris</h2><div className="table"><div className="thead"><span>Username</span><span>Wallet</span><span>Status</span></div><div className="tbody">{approved.map((a, i) => <div className="tr" key={`${a.wallet}-${i}`}><span>{a.username}</span><span>{a.wallet}</span><span>{a.status}</span></div>)}</div></div><div className="scroll-buttons"><button onClick={() => document.querySelector('.tbody')?.scrollBy({top:-180,behavior:'smooth'})}>▲</button><button onClick={() => document.querySelector('.tbody')?.scrollBy({top:180,behavior:'smooth'})}>▼</button></div></section>

    {submitted && <div className="success-overlay"><div className="success-modal"><button className="close" onClick={() => setSubmitted(false)}>×</button><img src="/assets/task-success.png" alt="Mossuri" /><h2>Your Application have been received!</h2><p>Approval Pending.</p><button className="register" onClick={() => setSubmitted(false)}>Awesome!</button></div></div>}
  </main>
}
