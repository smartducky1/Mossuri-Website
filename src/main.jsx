import React, { useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'

const X_URL = 'https://x.com/mossuris'
const PINNED_POST_URL = X_URL
const arts = Array.from({ length: 23 }, (_, i) => `/assets/artwork/${String(i + 1).padStart(2, '0')}.jpg`)

function validateUsername(value) {
  const username = value.trim().replace(/^@/, '')
  return /^[A-Za-z0-9_]{1,15}$/.test(username)
}

function validateXStatusUrl(value) {
  try {
    const url = new URL(value.trim())
    const host = url.hostname.toLowerCase().replace(/^www\./, '')
    if (host !== 'x.com' && host !== 'twitter.com') return false
    const parts = url.pathname.split('/').filter(Boolean)
    return parts.length >= 3 && parts[1].toLowerCase() === 'status' && /^\d+$/.test(parts[2])
  } catch {
    return false
  }
}

function validateWallet(value) {
  return /^0x[a-fA-F0-9]{40}$/.test(value.trim())
}

function App() {
  const [xUser, setXUser] = useState('')
  const [qt, setQt] = useState('')
  const [tags, setTags] = useState('')
  const [wallet, setWallet] = useState('')
  const [errors, setErrors] = useState({})
  const [status, setStatus] = useState('idle')
  const [serverError, setServerError] = useState('')

  const rows = useMemo(() => {
    const a = arts.slice(0, 12), b = arts.slice(12)
    return [a.concat(a), b.concat(b)]
  }, [])

  const clearForm = () => {
    setXUser('')
    setQt('')
    setTags('')
    setWallet('')
    setErrors({})
  }

  const validate = () => {
    const next = {}
    if (!validateUsername(xUser)) next.xUser = 'Enter a valid X username.'
    if (!validateXStatusUrl(qt)) next.qt = 'Enter a valid X post URL.'
    if (!validateXStatusUrl(tags)) next.tags = 'Enter the X post/comment URL where you tagged 3 friends.'
    if (!validateWallet(wallet)) next.wallet = 'Enter a valid EVM wallet address.'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const submit = async (e) => {
    e.preventDefault()
    setServerError('')
    if (!validate()) return
    setStatus('sending')

    try {
      const response = await fetch('/api/submit-whitelist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          xUsername: xUser,
          quoteTweet: qt,
          tagFriends: tags,
          wallet
        })
      })

      const result = await response.json().catch(() => ({}))

      if (!response.ok || !result.ok) {
        setServerError(
          result.error || 'We could not save your application. Please try again.'
        )

        if (result.fields) setErrors(result.fields)

        setStatus('idle')
        return
      }

      clearForm()
      setStatus('success')
    } catch {
      setServerError(
        'Connection error. Please check your internet connection and try again.'
      )
      setStatus('idle')
    }
  }

  const startAnother = () => {
    clearForm()
    setServerError('')
    setStatus('idle')
  }

  return (
    <main>
      <header className="top">
        <a
          className="social"
          href={X_URL}
          target="_blank"
          rel="noreferrer"
        >
          X
        </a>

        <div className="rule">
          <span></span>
          <i></i>
          <span></span>
        </div>

        <img
          className="logo"
          src="/assets/logo.png"
          alt="Mossuri"
        />

        <div className="rule">
          <span></span>
          <i></i>
          <span></span>
        </div>

        <a
          className="social"
          href={X_URL}
          target="_blank"
          rel="noreferrer"
        >
          X
        </a>
      </header>

      <section className="section">
        <div className="section-title">
          APPLY FOR WHITELIST
        </div>

        {status === 'success' ? (
          <>
            <div
              className="success-overlay"
              role="presentation"
              onMouseDown={(e) => {
                if (e.target === e.currentTarget) startAnother()
              }}
            >
              <div
                className="success-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="success-title"
              >
                <button
                  className="success-close"
                  type="button"
                  onClick={startAnother}
                  aria-label="Close success message"
                >
                  ×
                </button>

                <img
                  className="success-image"
                  src="/assets/success-mascot.jpg"
                  alt="Mossuri character"
                />

                <h1 id="success-title">
                  Your Application
                  <br />
                  <span>have been received!</span>
                </h1>

                <p>
                  Thanks for applying to Mossuri!
                  <br />
                  We’ll be in touch. Stay tuned!
                </p>

                <button
                  className="submit success-button"
                  type="button"
                  onClick={startAnother}
                >
                  Awesome!
                </button>
              </div>
            </div>
          </>
        ) : (
          <form
            className="card"
            onSubmit={submit}
            noValidate
          >
            <div className="task">
              <label>
                FOLLOW X <small>(DROP X USERNAME)</small>
              </label>

              <div className="row">
                <input
                  className={errors.xUser ? 'invalid' : ''}
                  value={xUser}
                  onChange={(e) => setXUser(e.target.value)}
                  placeholder="@username"
                  autoComplete="off"
                />

                <a
                  className="action"
                  href={X_URL}
                  target="_blank"
                  rel="noreferrer"
                >
                  FOLLOW
                </a>
              </div>

              {errors.xUser && (
                <p className="field-error">
                  {errors.xUser}
                </p>
              )}
            </div>

            <div className="task">
              <label>LIKE &amp; RT PINNED POST</label>

              <a
                className="wide-action"
                href={PINNED_POST_URL}
                target="_blank"
                rel="noreferrer"
              >
                GO TO X
              </a>
            </div>

            <div className="task">
              <label>QT PINNED POST</label>

              <input
                className={errors.qt ? 'invalid' : ''}
                value={qt}
                onChange={(e) => setQt(e.target.value)}
                placeholder="Paste your X post link"
                autoComplete="off"
              />

              {errors.qt && (
                <p className="field-error">
                  {errors.qt}
                </p>
              )}
            </div>

            <div className="task">
              <label>
                TAG 3 FRIENDS IN PINNED POST COMMENT
              </label>

              <input
                className={errors.tags ? 'invalid' : ''}
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="Paste your X comment link"
                autoComplete="off"
              />

              {errors.tags && (
                <p className="field-error">
                  {errors.tags}
                </p>
              )}
            </div>

            <div className="task">
              <label>SUBMIT YOUR EVM WALLET</label>

              <input
                className={errors.wallet ? 'invalid' : ''}
                value={wallet}
                onChange={(e) => setWallet(e.target.value)}
                placeholder="0x..."
                autoComplete="off"
                spellCheck="false"
              />

              {errors.wallet && (
                <p className="field-error">
                  {errors.wallet}
                </p>
              )}
            </div>

            {serverError && (
              <p className="form-error">
                {serverError}
              </p>
            )}

            <button
              className="submit"
              type="submit"
              disabled={status === 'sending'}
            >
              {status === 'sending'
                ? 'SUBMITTING...'
                : 'SEND APPLICATION'}
            </button>
          </form>
        )}
      </section>

      <section className="gallery-section">
        <div className="section-title">
          GALLERY
        </div>

        <div className="marquee">
          <div className="track left">
            {rows[0].map((src, i) => (
              <img
                key={'a' + i}
                src={src}
                alt=""
                draggable="false"
              />
            ))}
          </div>

          <div className="track right">
            {rows[1].map((src, i) => (
              <img
                key={'b' + i}
                src={src}
                alt=""
                draggable="false"
              />
            ))}
          </div>
        </div>
      </section>

      <footer>
        <span>© 2026 MOSSURI</span>

        <button
          onClick={() =>
            window.scrollTo({
              top: 0,
              behavior: 'smooth'
            })
          }
        >
          BACK TO TOP
        </button>
      </footer>
    </main>
  )
}

createRoot(
  document.getElementById('root')
).render(<App />)
