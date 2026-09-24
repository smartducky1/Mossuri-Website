import React, { useEffect, useMemo, useState } from 'react'
import './task.css'

const characters = [
  { name: 'Hyper', personality: 'Hyper', image: '/assets/task/hyper.png' },
  { name: 'Smart', personality: 'Smart', image: '/assets/task/smart.png' },
  { name: 'Goofy', personality: 'Goofy', image: '/assets/task/goofy.png' },
]

function validUsername(value) {
  return /^[A-Za-z0-9_]{1,15}$/.test(String(value || '').trim().replace(/^@/, ''))
}

function validWallet(value) {
  return /^0x[a-fA-F0-9]{40}$/.test(String(value || '').trim())
}

function validXUrl(value) {
  try {
    const url = new URL(String(value || '').trim())
    const host = url.hostname.toLowerCase().replace(/^www\./, '')
    if (host !== 'x.com' && host !== 'twitter.com') return false
    const parts = url.pathname.split('/').filter(Boolean)
    return parts.length >= 3 && parts[1].toLowerCase() === 'status' && /^\d+$/.test(parts[2])
  } catch {
    return false
  }
}

export default function TaskPage() {
  const [characterIndex, setCharacterIndex] = useState(0)
  const [xUser, setXUser] = useState('')
  const [quote, setQuote] = useState('')
  const [tags, setTags] = useState('')
  const [wallet, setWallet] = useState('')
  const [status, setStatus] = useState('idle')
  const [serverError, setServerError] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [checkWallet, setCheckWallet] = useState('')
  const [checkResult, setCheckResult] = useState('')
  const [approved, setApproved] = useState([])
  const [page, setPage] = useState(0)
  const [showSuccess, setShowSuccess] = useState(false)

  const character = characters[characterIndex]

  const leaderboardPage = useMemo(() => {
    const start = page * 10
    return approved.slice(start, start + 10)
  }, [approved, page])

  useEffect(() => {
    let alive = true
    const load = async () => {
      try {
        const response = await fetch('/api/task-approved', { cache: 'no-store' })
        const result = await response.json().catch(() => ({}))
        if (alive && response.ok && result.ok) {
          setApproved(Array.isArray(result.approved) ? result.approved : [])
          setPage(0)
        }
      } catch {}
    }

    load()
    const timer = setInterval(load, 15000)
    return () => {
      alive = false
      clearInterval(timer)
    }
  }, [])

  const previousCharacter = () => {
    setCharacterIndex((current) => (current - 1 + characters.length) % characters.length)
  }

  const nextCharacter = () => {
    setCharacterIndex((current) => (current + 1) % characters.length)
  }

  const download = () => {
    const link = document.createElement('a')
    link.href = character.image
    link.download = `${character.name.toLowerCase()}.png`
    document.body.appendChild(link)
    link.click()
    link.remove()
  }

  const clearForm = () => {
    setXUser('')
    setQuote('')
    setTags('')
    setWallet('')
    setFieldErrors({})
    setServerError('')
  }

  const validate = () => {
    const next = {}
    if (!validUsername(xUser)) next.xUser = 'Enter a valid X username.'
    if (!validXUrl(quote)) next.quote = 'Enter a valid X post URL.'
    if (!validXUrl(tags)) next.tags = 'Enter a valid X post/comment URL.'
    if (!validWallet(wallet)) next.wallet = 'Enter a valid EVM wallet address.'
    setFieldErrors(next)
    return Object.keys(next).length === 0
  }

  const submit = async (event) => {
    event.preventDefault()
    setServerError('')
    if (!validate()) return
    setStatus('sending')

    try {
      const response = await fetch('/api/submit-task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          xUsername: xUser.trim().replace(/^@/, ''),
          quoteTweet: quote.trim(),
          tagFriends: tags.trim(),
          wallet: wallet.trim(),
          character: character.name,
        }),
      })

      const result = await response.json().catch(() => ({}))
      if (!response.ok || !result.ok) {
        setServerError(result.error || 'We could not save your task application.')
        setStatus('idle')
        return
      }

      clearForm()
      setStatus('idle')
      setShowSuccess(true)
    } catch {
      setServerError('Connection error. Please try again.')
      setStatus('idle')
    }
  }

  const checkStatus = async (event) => {
    event.preventDefault()
    setCheckResult('')
    if (!validWallet(checkWallet)) {
      setCheckResult('Enter a valid EVM wallet.')
      return
    }

    try {
      const response = await fetch(`/api/task-status?wallet=${encodeURIComponent(checkWallet.trim())}`, {
        cache: 'no-store',
      })
      const result = await response.json().catch(() => ({}))
      setCheckResult(result.status || result.error || 'Unable to check status.')
    } catch {
      setCheckResult('Unable to check status.')
    }
  }

  const totalPages = Math.max(1, Math.ceil(approved.length / 10))
  const canPrevious = page > 0
  const canNext = page + 1 < totalPages

  return (
    <main className="task-page">
      <section className="character-carousel">
        <button type="button" onClick={previousCharacter} aria-label="Previous character">‹</button>
        <div className="character-window">
          <img src={character.image} alt={character.name} />
        </div>
        <button type="button" onClick={nextCharacter} aria-label="Next character">›</button>
      </section>

      <section className="status-area">
        <form className="status-check" onSubmit={checkStatus}>
          <div className="status-check-box">
            <input
              value={checkWallet}
              onChange={(event) => setCheckWallet(event.target.value)}
              placeholder="Paste EVM"
              autoComplete="off"
              spellCheck="false"
            />
            <button className="status-check-button" type="submit">Check status</button>
          </div>
        </form>
        {checkResult && <div className="status-result">{checkResult}</div>}
      </section>

      <section className="task-card">
        <form onSubmit={submit} noValidate>
          <div className="task-row">
            <label>FOLLOW X</label>
            <div className="dark-row">
              <input
                value={xUser}
                onChange={(event) => setXUser(event.target.value)}
                placeholder="@username"
                autoComplete="off"
              />
              <a href="https://x.com/mossuris" target="_blank" rel="noreferrer">FOLLOW</a>
            </div>
            {fieldErrors.xUser && <small>{fieldErrors.xUser}</small>}
          </div>

          <div className="task-row">
            <label>LIKE &amp; RT PINNED POST</label>
            <div className="dark-row single">
              <a href="https://x.com/mossuris" target="_blank" rel="noreferrer">GO TO X</a>
            </div>
          </div>

          <div className="task-row">
            <label>QT PINNED POST</label>
            <div className="dark-row">
              <input
                value={quote}
                onChange={(event) => setQuote(event.target.value)}
                placeholder="Paste X post link"
                autoComplete="off"
              />
            </div>
            {fieldErrors.quote && <small>{fieldErrors.quote}</small>}
          </div>

          <div className="task-row">
            <label>TAG 3 FRIENDS IN PINNED POST COMMENT</label>
            <div className="dark-row">
              <input
                value={tags}
                onChange={(event) => setTags(event.target.value)}
                placeholder="Paste X comment link"
                autoComplete="off"
              />
            </div>
            {fieldErrors.tags && <small>{fieldErrors.tags}</small>}
          </div>

          <div className="task-row">
            <label>SUBMIT YOUR EVM WALLET</label>
            <div className="dark-row">
              <input
                value={wallet}
                onChange={(event) => setWallet(event.target.value)}
                placeholder="0x..."
                autoComplete="off"
                spellCheck="false"
              />
            </div>
            {fieldErrors.wallet && <small>{fieldErrors.wallet}</small>}
          </div>

          {serverError && <p className="server-error">{serverError}</p>}

          <button className="register" type="submit" disabled={status === 'sending'}>
            {status === 'sending' ? 'SUBMITTING...' : 'REGISTER'}
          </button>
        </form>
      </section>

      <section className="personality-card">
        <img src={character.image} alt={character.name} />
        <div>
          <span>PERSONALITY</span>
          <strong>{character.personality}</strong>
        </div>
        <button className="character-download" onClick={download} aria-label="Download character" type="button">
          <span aria-hidden="true">⇩</span>
        </button>
      </section>

      <section className="leaderboard">
        <h2>LEADERBOARD</h2>
        <div className="table">
          <div className="thead">
            <span>Username</span>
            <span>Wallet</span>
            <span>Status</span>
          </div>
          <div className="tbody">
            {leaderboardPage.map((row, index) => (
              <div className="tr" key={`${row.wallet}-${row.username}-${index}`}>
                <span>{row.username}</span>
                <span>{row.wallet}</span>
                <span>{row.status || 'Approved'}</span>
              </div>
            ))}
          </div>
        </div>
        {approved.length > 10 && (
          <div className="scroll-buttons">
            <button type="button" onClick={() => setPage((value) => value - 1)} disabled={!canPrevious}>‹</button>
            <button type="button" onClick={() => setPage((value) => value + 1)} disabled={!canNext}>›</button>
          </div>
        )}
      </section>

      {showSuccess && (
        <div className="success-overlay" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setShowSuccess(false)
        }}>
          <div className="success-modal" role="dialog" aria-modal="true">
            <button className="close" type="button" onClick={() => setShowSuccess(false)} aria-label="Close">×</button>
            <img src="/assets/task/task-success.png" alt="Mossuri success" />
            <h2>Application received</h2>
            <p>You&apos;re on the list!</p>
          </div>
        </div>
      )}
    </main>
  )
}
