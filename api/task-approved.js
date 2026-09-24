import { createHmac } from 'node:crypto'

const APPS_SCRIPT_URL = process.env.GOOGLE_APPS_SCRIPT_URL
const HMAC_SECRET = process.env.MOSSURI_HMAC_SECRET

function json(res, status, data) {
  res
    .status(status)
    .setHeader('Content-Type', 'application/json')
    .setHeader('Cache-Control', 'no-store')

  return res.json(data)
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return json(res, 405, {
      ok: false,
      error: 'Method not allowed.',
    })
  }

  if (!APPS_SCRIPT_URL || !HMAC_SECRET) {
    return json(res, 500, {
      ok: false,
      error: 'Leaderboard service is not configured.',
    })
  }

  const timestamp = Date.now()

  // MUST exactly match Apps Script.
  const canonical = [
    'task-approved',
    String(timestamp),
  ].join('|')

  const signature = createHmac(
    'sha256',
    HMAC_SECRET.trim()
  )
    .update(canonical, 'utf8')
    .digest('hex')

  const payload = {
    type: 'task-approved',
    timestamp,
    signature,
  }

  try {
    const response = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      redirect: 'follow',
    })

    const text = await response.text()

    let data = {}

    try {
      data = JSON.parse(text)
    } catch {}

    if (!response.ok) {
      return json(res, 502, {
        ok: false,
        error: `Google Apps Script returned HTTP ${response.status}.`,
      })
    }

    return json(res, data.ok ? 200 : 400, data)
  } catch (error) {
    console.error('task-approved error:', error)

    return json(res, 502, {
      ok: false,
      error: 'Could not reach leaderboard service.',
    })
  }
}
