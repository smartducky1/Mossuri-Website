import {
  createHmac,
  createHash,
} from 'node:crypto';

console.log(
  'MOSSURI_HMAC_SECRET fingerprint:',
  HMAC_SECRET
    ? createHash('sha256')
        .update(HMAC_SECRET.trim(), 'utf8')
        .digest('hex')
    : 'MISSING'
);

function sendJson(res, status, data) {
  res.status(status);
  res.setHeader(
    'Content-Type',
    'application/json'
  );
  res.setHeader(
    'Cache-Control',
    'no-store'
  );

  return res.json(data);
}

/*
 * Send one POST to Google Apps Script.
 * Google Apps Script handles the response redirect.
 */
async function postToGoogleAppsScript(url, body) {
  return fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body,
    redirect: 'follow',
  });
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

    const xUsername =
      String(body.xUsername || '').trim();

    const quoteTweet =
      String(body.quoteTweet || '').trim();

    const tagFriends =
      String(body.tagFriends || '').trim();

    const wallet =
      String(body.wallet || '').trim();

    const character =
      String(body.character || '').trim();

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

    if (
      !['Hyper', 'Smart', 'Goofy'].includes(character)
    ) {
      return sendJson(res, 400, {
        ok: false,
        error: 'Invalid character.',
      });
    }

    const timestamp = Date.now();

    /*
     * MUST match taskSubmissionMessage_()
     * in Code.gs exactly.
     */
    const message = [
      'task',
      String(timestamp),
      xUsername,
      quoteTweet,
      tagFriends,
      wallet,
      character,
    ].join('|');

    const signature = createHmac(
      'sha256',
      HMAC_SECRET.trim()
    )
      .update(message, 'utf8')
      .digest('hex');

    const requestBody = JSON.stringify({
      type: 'task',
      timestamp,
      xUsername,
      quoteTweet,
      tagFriends,
      wallet,
      character,
      signature,
    });

    const googleResponse =
      await postToGoogleAppsScript(
        APPS_SCRIPT_URL,
        requestBody
      );

    const responseText =
      await googleResponse.text();

    let googleData;

    try {
      googleData = JSON.parse(responseText);
    } catch {
      console.error(
        'Google Apps Script returned non-JSON:',
        responseText
      );

      return sendJson(res, 502, {
        ok: false,
        error:
          'Google Apps Script returned an invalid response.',
      });
    }

    if (!googleData.ok) {
      return sendJson(
        res,
        400,
        googleData
      );
    }

    return sendJson(res, 200, {
      ok: true,
      status:
        googleData.status || 'Pending',
    });
  } catch (error) {
    console.error(
      'Task submission error:',
      error
    );

    return sendJson(res, 500, {
      ok: false,
      error:
        'Unable to submit application. Please try again.',
    });
  }
}
