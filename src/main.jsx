import React, { useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'

const X_URL = 'https://x.com/mossuris'
const arts = Array.from({length:23}, (_, i) => `/assets/artwork/${String(i+1).padStart(2,'0')}.jpg`)

function App() {
  const [xUser, setXUser] = useState('')
  const [qt, setQt] = useState('')
  const [tags, setTags] = useState('')
  const [wallet, setWallet] = useState('')
  const [sent, setSent] = useState(false)

  const rows = useMemo(() => {
    const a = arts.slice(0, 12), b = arts.slice(12)
    return [a.concat(a), b.concat(b)]
  }, [])

  const submit = (e) => {
    e.preventDefault()
    setSent(true)
  }

  return (
    <main>
      <header className="top">
        <a className="social" href={X_URL} target="_blank" rel="noreferrer">X</a>
        <div className="rule"><span></span><i></i><span></span></div>
        <img className="logo" src="/assets/logo.png" alt="Mossuri" />
        <div className="rule"><span></span><i></i><span></span></div>
        <a className="social" href={X_URL} target="_blank" rel="noreferrer">X</a>
      </header>

      <section className="section">
        <div className="section-title">APPLY FOR WHITELIST</div>
        <form className="card" onSubmit={submit}>
          <div className="task">
            <label>FOLLOW X <small>(DROP X USERNAME)</small></label>
            <div className="row">
              <input value={xUser} onChange={e=>setXUser(e.target.value)} placeholder="@username" />
              <a className="action" href={X_URL} target="_blank" rel="noreferrer">FOLLOW</a>
            </div>
          </div>
          <div className="task">
            <label>LIKE &amp; RT PINNED POST</label>
            <a className="wide-action" href={X_URL} target="_blank" rel="noreferrer">GO TO X</a>
          </div>
          <div className="task">
            <label>QT PINNED POST</label>
            <input value={qt} onChange={e=>setQt(e.target.value)} placeholder="I’m connecting with @mossuris" />
          </div>
          <div className="task">
            <label>TAG 3 FRIENDS IN PINNED POST COMMENT</label>
            <input value={tags} onChange={e=>setTags(e.target.value)} placeholder="@friend1 @friend2 @friend3" />
          </div>
          <div className="task">
            <label>SUBMIT YOUR EVM WALLET</label>
            <input value={wallet} onChange={e=>setWallet(e.target.value)} placeholder="0x..." required />
          </div>
          <button className="submit" type="submit">SEND APPLICATION</button>
          {sent && <p className="success">APPLICATION RECEIVED.</p>}
        </form>
      </section>

      <section className="gallery-section">
        <div className="section-title">GALLERY</div>
        <div className="marquee">
          <div className="track left">
            {rows[0].map((src,i)=><img key={'a'+i} src={src} alt="" draggable="false"/>)}
          </div>
          <div className="track right">
            {rows[1].map((src,i)=><img key={'b'+i} src={src} alt="" draggable="false"/>)}
          </div>
        </div>
      </section>

      <footer>
        <span>© 2026 MOSSURI</span>
        <button onClick={()=>window.scrollTo({top:0,behavior:'smooth'})}>BACK TO TOP</button>
      </footer>
    </main>
  )
}

createRoot(document.getElementById('root')).render(<App />)
