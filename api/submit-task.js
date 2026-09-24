import { createHmac } from 'node:crypto';

const APPS_SCRIPT_URL =
  process.env.GOOGLE_APPS_SCRIPT_URL;

const HMAC_SECRET =
  process.env.MOSSURI_TASK_HMAC_SECRET;

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

/**
 * Send ONE POST to Google Apps Script.
 *
 * Google Apps Script ContentService returns a redirect.
 * fetch follows that redirect automatically.
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
  /*
   * Allow browser preflight.
   */
  if (req.method === 'OPTIONS') {
    res.status(204);
    return res.end();
  }

  /*
   * This endpoint only accepts POST.
   */
  if (req.method !== 'POST') {
    return sendJson(res, 405, {
      ok: false,
      error: 'Method not allowed.',
    });
  }

  /*
   * Check required environment variables.
   */
  if (!APPS_SCRIPT_URL) {
    return sendJson(res, 500, {
      ok: false,
      error: 'Submission service is not configured.',
    });
  }

  if (!HMAC_SECRET) {
    return sendJson(res, 500, {
      ok: false,
      error: 'Task submission security is not configured.',
    });
  }

  try {
    /*
     * Read request body.
     */
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

    /*
     * Basic validation.
     */
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

    /*
     * Create timestamp.
     */
    const timestamp = Date.now();

    /*
     * IMPORTANT:
     * This string MUST exactly match
     * taskSubmissionMessage_() in Code.gs.
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

    /*
     * Create HMAC signature.
     */
    const signature = createHmac(
      'sha256',
      HMAC_SECRET.trim()
    )
      .update(message, 'utf8')
      .digest('hex');

    /*
     * Send the task request to Apps Script.
     */
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

    /*
     * Read the final response after the redirect.
     */
    const responseText =
      await googleResponse.text();

    let googleData;

    try {
      googleData =
        JSON.parse(responseText);
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

    /*
     * Pass Apps Script errors back to the frontend.
     */
    if (!googleData.ok) {
      return sendJson(
        res,
        400,
        googleData
      );
    }

    /*
     * Successful submission.
     */
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
