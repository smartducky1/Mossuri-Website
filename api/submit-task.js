import { createHmac } from 'node:crypto';

const APPS_SCRIPT_URL = process.env.GOOGLE_APPS_SCRIPT_URL;
const HMAC_SECRET = process.env.MOSSURI_HMAC_SECRET;

function sendJson(res, status, data) {
  res.status(status);
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  return res.json(data);
}

async function postToGoogleAppsScript(url, body) {
  let currentUrl = url;

  for (let attempt = 0; attempt < 5; attempt++) {
    const response = await fetch(currentUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body,
      redirect: 'manual',
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');

      if (!location) {
        throw new Error(
          `Google Apps Script returned HTTP ${response.status} without a redirect location.`
        );
      }

      currentUrl = new URL(location, currentUrl).toString();
      continue;
    }

    return response;
  }

  throw new Error('Too many redirects from Google Apps Script.');
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.status(204);
    return res.end();
  }

  if (req.method !== 'POST') {
    return sendJson(res, 405, {
      ok: false,
      error: 'Method not allowed.',
    });
  }

  if (!APPS_SCRIPT_URL) {
    return sendJson(res, 500, {
      ok: false,
      error: 'Submission service is not configured.',
    });
  }

  if (!HMAC_SECRET) {
    return sendJson(res, 500, {
      ok: false,
      error: 'Submission security is not configured.',
    });
  }

  try {
    const body =
      typeof req.body === 'string'
        ? JSON.parse(req.body)
        : req.body || {};

    const xUsername = String(body.xUsername || '').trim();
    const quoteTweet = String(body.quoteTweet || '').trim();
    const tagFriends = String(body.tagFriends || '').trim();
    const wallet = String(body.wallet || '').trim();
    const character = String(body.character || '').trim();

    if (!xUsername) {
      return sendJson(res, 400, {
        ok: false,
        error: 'X username is required.',
      });
    }

    if (!quoteTweet) {
      return sendJson(res, 400, {
        ok: false,
        error: 'Quote tweet is required.',
      });
    }

    if (!tagFriends) {
      return sendJson(res, 400, {
        ok: false,
        error: 'Tagged friends are required.',
      });
    }

    if (!/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
      return sendJson(res, 400, {
        ok: false,
        error: 'Invalid EVM wallet address.',
      });
    }

    if (!['Hyper', 'Smart', 'Goofy'].includes(character)) {
      return sendJson(res, 400, {
        ok: false,
        error: 'Invalid character.',
      });
    }

    const timestamp = Date.now();

    const payloadObject = {
      timestamp,
      xUsername,
      quoteTweet,
      tagFriends,
      wallet,
      character,
    };

    const payload = JSON.stringify(payloadObject);

    const signature = createHmac(
      'sha256',
      HMAC_SECRET
    )
      .update(payload, 'utf8')
      .digest('hex');

    const requestBody = JSON.stringify({
      type: 'task',
      ...payloadObject,
      signature,
    });

    const googleResponse = await postToGoogleAppsScript(
      APPS_SCRIPT_URL,
      requestBody
    );

    const responseText = await googleResponse.text();

    let googleData;

    try {
      googleData = JSON.parse(responseText);
    } catch {
      return sendJson(res, 502, {
        ok: false,
        error: 'Google Apps Script returned an invalid response.',
      });
    }

    if (!googleData.ok) {
      return sendJson(res, 400, googleData);
    }

    return sendJson(res, 200, {
      ok: true,
      status: googleData.status || 'Pending',
    });
  } catch (error) {
    console.error('Task submission error:', error);

    return sendJson(res, 500, {
      ok: false,
      error: 'Unable to submit application. Please try again.',
    });
  }
}
