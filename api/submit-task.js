import { createHmac } from 'node:crypto'

const APPS_SCRIPT_URL = process.env.GOOGLE_APPS_SCRIPT_URL
const HMAC_SECRET = process.env.MOSSURI_HMAC_SECRET

function sendJson(res, status, data) {
  res.status(status)
  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Cache-Control', 'no-store')
  return res.json(data)
}

function clean(value) {
  return String(value ?? '').trim()
}

function validUsername(value) {
  return /^[A-Za-z0-9_]{1,15}$/.test(clean(value).replace(/^@/, ''))
}

function validXUrl(value) {
  try {
    const url = new URL(clean(value))
    const host = url.hostname.toLowerCase().replace(/^www\./, '')

    if (host !== 'x.com' && host !== 'twitter.com') return false

    const parts = url.pathname.split('/').filter(Boolean)

    return (
      parts.length >= 3 &&
      parts[1].toLowerCase() === 'status' &&
      /^\d+$/.test(parts[2])
    )
  } catch {
    return false
  }
}

function validWallet(value) {
  return /^0x[a-fA-F0-9]{40}$/.test(clean(value))
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return sendJson(res, 405, {
      ok: false,
      error: 'Method not allowed.',
    })
  }

  if (!APPS_SCRIPT_URL || !HMAC_SECRET) {
    return sendJson(res, 500, {
      ok: false,
      error: 'Task submission service is not configured.',
    })
  }

  let body

  try {
    body =
      typeof req.body === 'string'
        ? JSON.parse(req.body)
        : req.body || {}
  } catch {
    return sendJson(res, 400, {
      ok: false,
      error: 'Invalid request body.',
    })
  }

  const xUsername = clean(body.xUsername).replace(/^@/, '')
  const quoteTweet = clean(body.quoteTweet)
  const tagFriends = clean(body.tagFriends)
  const wallet = clean(body.wallet)
  const character = clean(body.character)

  const errors = {}

  if (!validUsername(xUsername)) {
    errors.xUsername = 'Enter a valid X username.'
  }

  if (!validXUrl(quoteTweet)) {
    errors.quoteTweet = 'Enter a valid X post URL.'
  }

  if (!validXUrl(tagFriends)) {
    errors.tagFriends = 'Enter a valid X post/comment URL.'
  }

  if (!validWallet(wallet)) {
    errors.wallet = 'Enter a valid EVM wallet address.'
  }

  if (!['Hyper', 'Smart', 'Goofy'].includes(character)) {
    errors.character = 'Invalid character.'
  }

  if (Object.keys(errors).length) {
    return sendJson(res, 400, {
      ok: false,
      error: 'Please correct the highlighted fields.',
      fields: errors,
    })
  }

  const timestamp = Date.now()

  // IMPORTANT:
  // This MUST exactly match the Apps Script verification string.
  const canonical = [
    'task',
    String(timestamp),
    xUsername,
    quoteTweet,
    tagFriends,
    wallet,
    character,
  ].join('|')

  const signature = createHmac(
    'sha256',
    HMAC_SECRET.trim()
  )
    .update(canonical, 'utf8')
    .digest('hex')

  const payload = {
    type: 'task',
    timestamp,
    xUsername,
    quoteTweet,
    tagFriends,
    wallet,
    character,
    signature,
  }

  try {
    const googleResponse = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      redirect: 'follow',
    })

    const text = await googleResponse.text()

    let data = {}

    try {
      data = JSON.parse(text)
    } catch {}

    if (!googleResponse.ok) {
      return sendJson(res, 502, {
        ok: false,
        error: `Google Apps Script returned HTTP ${googleResponse.status}.`,
      })
    }

    if (!data.ok) {
      return sendJson(res, 400, {
        ok: false,
        error: data.error || 'Task submission failed.',
      })
    }

    return sendJson(res, 200, data)
  } catch (error) {
    console.error('submit-task error:', error)

    return sendJson(res, 502, {
      ok: false,
      error: 'Could not reach submission service.',
    })
  }
}
