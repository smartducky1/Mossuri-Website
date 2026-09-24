import React, { useEffect, useState } from 'react'
import './task.css'

const characters = [
  {
    name: 'Hyper',
    personality: 'Hyper',
    image: '/assets/task/hyper.png',
  },
  {
    name: 'Smart',
    personality: 'Smart',
    image: '/assets/task/smart.png',
  },
  {
    name: 'Goofy',
    personality: 'Goofy',
    image: '/assets/task/goofy.png',
  },
]

function validUsername(value) {
  return /^[A-Za-z0-9_]{1,15}$/.test(
    value.trim().replace(/^@/, '')
  )
}

function validWallet(value) {
  return /^0x[a-fA-F0-9]{40}$/.test(value.trim())
}

function validXUrl(value) {
  try {
    const url = new URL(value.trim())

    const host = url.hostname
      .toLowerCase()
      .replace(/^www\./, '')

    const parts = url.pathname
      .split('/')
      .filter(Boolean)

    return (
      (host === 'x.com' || host === 'twitter.com') &&
      parts.length >= 3 &&
      parts[1].toLowerCase() === 'status' &&
      /^\d+$/.test(parts[2])
    )
  } catch {
    return false
  }
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
  const [checkingStatus, setCheckingStatus] = useState(false)

  const [approved, setApproved] = useState([])

  const character = characters[index]

  useEffect(() => {
    const load = async () => {
      try {
        const response = await fetch('/api/task-approved', {
          cache: 'no-store',
        })

        const data = await response.json()

        if (
          response.ok &&
          Array.isArray(data.approved)
        ) {
          setApproved(data.approved.slice(0, 10))
        }
      } catch {
        // Keep the page usable if the leaderboard request fails.
      }
    }

    load()

    const intervalId = setInterval(load, 15000)

    return () => clearInterval(intervalId)
  }, [])

  const download = () => {
    const link = document.createElement('a')

    link.href = character.image
    link.download = `${character.name}.png`

    document.body.appendChild(link)
    link.click()
    link.remove()
  }

  const checkStatus = async event => {
    event.preventDefault()

    const walletValue = checkWallet.trim()

    setCheckResult('')

    if (!validWallet(walletValue)) {
      setCheckResult('INVALID WALLET')
      return
    }

    setCheckingStatus(true)

    try {
      const response = await fetch(
        `/api/task-status?wallet=${encodeURIComponent(walletValue)}`,
        {
          cache: 'no-store',
        }
      )

      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        setCheckResult(
          data.status
            ? String(data.status).toUpperCase()
            : 'ERROR'
        )
        return
      }

      setCheckResult(
        data.status
          ? String(data.status).toUpperCase()
          : 'NOT FOUND'
      )
    } catch {
      setCheckResult('ERROR')
    } finally {
      setCheckingStatus(false)
    }
  }

  const submit = async event => {
    event.preventDefault()

    const nextErrors = {}

    if (!validUsername(xUser)) {
      nextErrors.xUser = 'Invalid X username'
    }

    if (!validXUrl(quote)) {
      nextErrors.quote = 'Invalid X post URL'
    }

    if (!validXUrl(tags)) {
      nextErrors.tags = 'Invalid X comment URL'
    }

    if (!validWallet(wallet)) {
      nextErrors.wallet = 'Invalid EVM wallet'
    }

    setErrors(nextErrors)
    setServerError('')

    if (Object.keys(nextErrors).length > 0) {
      return
    }

    try {
      const response = await fetch('/api/submit-task', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          xUsername: xUser,
          quoteTweet: quote,
          tagFriends: tags,
          wallet,
          character: character.name,
        }),
      })

      const data = await response.json().catch(() => ({}))

      if (!response.ok || !data.ok) {
        setServerError(
          data.error ||
            'We could not save your application.'
        )
        return
      }

      setXUser('')
      setQuote('')
      setTags('')
      setWallet('')
      setErrors({})
      setServerError('')
      setSubmitted(true)
    } catch {
      setServerError(
        'Connection error. Please try again.'
      )
    }
  }

  return (
    <main className="task-page">

      {/* CHARACTER CAROUSEL */}
      <section className="character-carousel">
        <button
          type="button"
          onClick={() =>
            setIndex(
              (index + characters.length - 1) %
                characters.length
            )
          }
          aria-label="Previous character"
        >
          ◀
        </button>

        <div className="character-window">
          <img
            src={character.image}
            alt={character.name}
          />
        </div>

        <button
          type="button"
          onClick={() =>
            setIndex(
              (index + 1) % characters.length
            )
          }
          aria-label="Next character"
        >
          ▶
        </button>
      </section>

      {/* CHECK STATUS */}
      <section className="status-area">
        <form
          className="status-check"
          onSubmit={checkStatus}
          noValidate
        >
          <div className="status-check-box">
            <input
              value={checkWallet}
              onChange={event =>
                setCheckWallet(event.target.value)
              }
              placeholder="Paste EVM"
              spellCheck="false"
              autoComplete="off"
              aria-label="EVM wallet"
            />

            <button
              type="submit"
              className="status-check-button"
              disabled={checkingStatus}
            >
              {checkingStatus
                ? 'Checking...'
                : 'Check status'}
            </button>
          </div>
        </form>

        {checkResult && (
          <div
            className="status-result"
            role="status"
            aria-live="polite"
          >
            {checkResult}
          </div>
        )}
      </section>

      {/* TASK FORM */}
      <section className="task-card">
        <form onSubmit={submit} noValidate>

          <div className="task-row">
            <label>Follow X</label>

            <div className="dark-row">
              <input
                value={xUser}
                onChange={event =>
                  setXUser(event.target.value)
                }
                placeholder="Drop your X username"
                autoComplete="off"
              />

              <a
                href="https://x.com/mossuris"
                target="_blank"
                rel="noreferrer"
              >
                Follow
              </a>
            </div>

            {errors.xUser && (
              <small>{errors.xUser}</small>
            )}
          </div>

          <div className="task-row">
            <label>Like and RT pinned post</label>

            <div className="dark-row single">
              <a
                href="https://x.com/mossuris"
                target="_blank"
                rel="noreferrer"
              >
                GO
              </a>
            </div>
          </div>

          <div className="task-row">
            <label>
              QT pinned post with your selected character
            </label>

            <div className="dark-row">
              <input
                value={quote}
                onChange={event =>
                  setQuote(event.target.value)
                }
                placeholder="Link to QT https://x.com/status....."
                autoComplete="off"
              />
            </div>

            {errors.quote && (
              <small>{errors.quote}</small>
            )}
          </div>

          <div className="task-row">
            <label>
              Tag 3 friends in pinned post comment
            </label>

            <div className="dark-row">
              <input
                value={tags}
                onChange={event =>
                  setTags(event.target.value)
                }
                placeholder="Link to comment https://x.com/status....."
                autoComplete="off"
              />
            </div>

            {errors.tags && (
              <small>{errors.tags}</small>
            )}
          </div>

          <div className="task-row">
            <label>Submit EVM wallet</label>

            <div className="dark-row">
              <input
                value={wallet}
                onChange={event =>
                  setWallet(event.target.value)
                }
                placeholder="0x........"
                spellCheck="false"
                autoComplete="off"
              />
            </div>

            {errors.wallet && (
              <small>{errors.wallet}</small>
            )}
          </div>

          {serverError && (
            <p className="server-error">
              {serverError}
            </p>
          )}

          <button
            className="register"
            type="submit"
          >
            REGISTER
          </button>
        </form>
      </section>

      {/* PERSONALITY CARD */}
      <section className="personality-card">
        <img
          src={character.image}
          alt={character.name}
        />

        <div>
          <span>Personality</span>
          <strong>{character.personality}</strong>
        </div>

        <button
          className="character-download"
          onClick={download}
          aria-label="Download character"
          type="button"
        >
          <span aria-hidden="true">⇩</span>
        </button>
      </section>

      {/* LEADERBOARD */}
      <section className="leaderboard">
        <h2>Approved Mossuris</h2>

        <div className="table">
          <div className="thead">
            <span>Username</span>
            <span>Wallet</span>
            <span>Status</span>
          </div>

          <div className="tbody">
            {approved.map((applicant, rowIndex) => (
              <div
                className="tr"
                key={`${applicant.wallet}-${rowIndex}`}
              >
                <span>{applicant.username}</span>
                <span>{applicant.wallet}</span>
                <span>{applicant.status}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="scroll-buttons">
          <button
            type="button"
            onClick={() =>
              document
                .querySelector('.tbody')
                ?.scrollBy({
                  top: -180,
                  behavior: 'smooth',
                })
            }
            aria-label="Scroll leaderboard up"
          >
            ▲
          </button>

          <button
            type="button"
            onClick={() =>
              document
                .querySelector('.tbody')
                ?.scrollBy({
                  top: 180,
                  behavior: 'smooth',
                })
            }
            aria-label="Scroll leaderboard down"
          >
            ▼
          </button>
        </div>
      </section>

      {/* SUCCESS POPUP */}
      {submitted && (
        <div className="success-overlay">
          <div className="success-modal">

            <button
              className="close"
              onClick={() => setSubmitted(false)}
              type="button"
              aria-label="Close"
            >
              ×
            </button>

            <img
              src="/assets/task/task-success.png"
              alt="Mossuri"
            />

            <h2>
              Your Application have been received!
            </h2>

            <p>Approval Pending.</p>

            <button
              className="register"
              onClick={() => setSubmitted(false)}
              type="button"
            >
              Awesome!
            </button>

          </div>
        </div>
      )}
    </main>
  )
}
