import { createHmac } from 'node:crypto';

const APPS_SCRIPT_URL = process.env.GOOGLE_APPS_SCRIPT_URL;
const HMAC_SECRET = process.env.MOSSURI_HMAC_SECRET;

function sendJson(res, status, data) {
  res.status(status);
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  return res.json(data);
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

    if (body.source !== 'whitelist') {
      return sendJson(res, 400, {
        ok: false,
        error: 'This endpoint accepts homepage whitelist submissions only.',
      });
    }

    const xUsername = String(body.xUsername || '').trim();
    const likeRt = String(body.likeRt || '').trim();
    const quoteTweet = String(body.quoteTweet || '').trim();
    const tagFriends = String(body.tagFriends || '').trim();
    const wallet = String(body.wallet || '').trim();

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

    const timestamp = Date.now();

    const payloadObject = {
      source: 'whitelist',
      timestamp,
      xUsername,
      likeRt,
      quoteTweet,
      tagFriends,
      wallet,
    };

    const payload = JSON.stringify(payloadObject);

    const signature = createHmac(
      'sha256',
      HMAC_SECRET
    )
      .update(payload, 'utf8')
      .digest('hex');

    const requestBody = JSON.stringify({
      ...payloadObject,
      signature,
    });

    /*
     * Google Apps Script web apps redirect the request.
     * We let fetch handle Google's redirect instead of manually
     * POSTing to the redirect destination, which was causing 405.
     */
    const googleResponse = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: requestBody,
      redirect: 'follow',
    });

    const responseText = await googleResponse.text();

    console.log(
      'Google Apps Script response:',
      googleResponse.status,
      responseText
    );

    if (!googleResponse.ok) {
      return sendJson(res, 502, {
        ok: false,
        error: `Google Apps Script returned HTTP ${googleResponse.status}.`,
      });
    }

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
      return sendJson(res, 400, {
        ok: false,
        error: googleData.error || 'Submission was rejected.',
      });
    }

    return sendJson(res, 200, {
      ok: true,
      success: true,
      message: 'Application submitted successfully.',
    });

  } catch (error) {
    console.error('Whitelist submission error:', error);

    return sendJson(res, 500, {
      ok: false,
      error: 'Unable to submit application. Please try again.',
    });
  }
}
