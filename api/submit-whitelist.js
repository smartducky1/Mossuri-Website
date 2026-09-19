import crypto from 'node:crypto'

const RATE_WINDOW_MS = 10 * 60 * 1000
const RATE_MAX = 5
const rateMap = globalThis.__mossuriRateMap || new Map()
globalThis.__mossuriRateMap = rateMap

function json(res, status, body) {
  res.status(status).setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(body))
}

function clean(v) {
  return String(v ?? '').trim()
}

function normalizeUsername(v) {
  return clean(v).replace(/^@/, '')
}

function isValidUsername(v) {
  const u = normalizeUsername(v)
  return /^[A-Za-z0-9_]{1,15}$/.test(u)
}

function isValidXStatusUrl(v) {
  try {
    const u = new URL(clean(v))
    const host = u.hostname.toLowerCase().replace(/^www\./, '')
    if (host !== 'x.com' && host !== 'twitter.com') return false
    const parts = u.pathname.split('/').filter(Boolean)
    return parts.length >= 3 && parts[1].toLowerCase() === 'status' && /^\d+$/.test(parts[2])
  } catch {
    return false
  }
}

function isValidEvmWallet(v) {
  return /^0x[a-fA-F0-9]{40}$/.test(clean(v))
}

function canonicalPayload(data, timestamp) {
  return JSON.stringify({
    timestamp,
    xUsername: data.xUsername,
    likeRt: 'true',
    quoteTweet: data.quoteTweet,
    tagFriends: data.tagFriends,
    wallet: data.wallet
  })
}

function sign(payload, secret) {
  return crypto.createHmac('sha256', secret).update(payload, 'utf8').digest('hex')
}

function rateLimited(ip) {
  const now = Date.now()
  const current = rateMap.get(ip) || []
  const recent = current.filter(t => now - t < RATE_WINDOW_MS)
  recent.push(now)
  rateMap.set(ip, recent)
  return recent.length > RATE_MAX
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return json(res, 405, { ok: false, error: 'Method not allowed.' })
  }

  const ip = (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim()
  if (rateLimited(ip)) {
    return json(res, 429, { ok: false, error: 'Too many submissions. Please try again later.' })
  }

  const secret = process.env.MOSSURI_HMAC_SECRET
  const appsScriptUrl = process.env.GOOGLE_APPS_SCRIPT_URL
  if (!secret || !appsScriptUrl) {
    return json(res, 500, { ok: false, error: 'Submission service is not configured.' })
  }

  const body = req.body || {}
  const data = {
    xUsername: normalizeUsername(body.xUsername),
    quoteTweet: clean(body.quoteTweet),
    tagFriends: clean(body.tagFriends),
    wallet: clean(body.wallet)
  }

  const errors = {}
  if (!isValidUsername(data.xUsername)) errors.xUsername = 'Enter a valid X username (1–15 letters, numbers or underscores).'
  if (!isValidXStatusUrl(data.quoteTweet)) errors.quoteTweet = 'Enter a valid X post URL, e.g. https://x.com/user/status/123456789.'
  if (!isValidXStatusUrl(data.tagFriends)) errors.tagFriends = 'Enter the X post/comment URL where you tagged 3 friends.'
  if (!isValidEvmWallet(data.wallet)) errors.wallet = 'Enter a valid 42-character EVM wallet address starting with 0x.'
  if (Object.keys(errors).length) return json(res, 400, { ok: false, error: 'Please correct the highlighted fields.', fields: errors })

  const timestamp = Date.now()
  const payload = canonicalPayload(data, timestamp)
  const signature = sign(payload, secret)

  try {
    const response = await fetch(appsScriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...JSON.parse(payload), signature })
    })

    const text = await response.text()
    let result
    try { result = JSON.parse(text) } catch { result = null }

    if (!response.ok || !result?.ok) {
      if (result?.error === 'This wallet has already been submitted.') {
        return json(res, 409, { ok: false, error: result.error })
      }
      return json(res, 502, { ok: false, error: 'We could not save your application. Please try again.' })
    }

    return json(res, 200, { ok: true })
  } catch (err) {
    console.error('Mossuri submission failed:', err?.message || err)
    return json(res, 502, { ok: false, error: 'We could not save your application. Please try again.' })
  }
}
