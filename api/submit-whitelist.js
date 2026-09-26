function sendJson(res, status, data) {
  res.status(status);
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  return res.json(data);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return sendJson(res, 405, {
      ok: false,
      error: 'Method not allowed.'
    });
  }

  try {
    const APPS_SCRIPT_URL =
      process.env.GOOGLE_APPS_SCRIPT_URL;

    const SUBMISSION_TOKEN =
      process.env.MOSSURI_SUBMISSION_TOKEN;

    if (!APPS_SCRIPT_URL) {
      console.error('GOOGLE_APPS_SCRIPT_URL is missing.');

      return sendJson(res, 500, {
        ok: false,
        error: 'Submission service is not configured.'
      });
    }

    if (!SUBMISSION_TOKEN) {
      console.error('MOSSURI_SUBMISSION_TOKEN is missing.');

      return sendJson(res, 500, {
        ok: false,
        error: 'Submission security is not configured.'
      });
    }

    const body =
      typeof req.body === 'string'
        ? JSON.parse(req.body)
        : req.body || {};

    const xUsername =
      String(body.xUsername || '')
        .trim()
        .replace(/^@/, '');

    const quoteTweet =
      String(body.quoteTweet || '').trim();

    const tagFriends =
      String(body.tagFriends || '').trim();

    const wallet =
      String(body.wallet || '').trim();

    // Validate X username
    if (!/^[A-Za-z0-9_]{1,15}$/.test(xUsername)) {
      return sendJson(res, 400, {
        ok: false,
        error: 'Invalid X username.'
      });
    }

    // Validate quote tweet
    if (!quoteTweet) {
      return sendJson(res, 400, {
        ok: false,
        error: 'Quote tweet is required.'
      });
    }

    // Validate tagged friends
    if (!tagFriends) {
      return sendJson(res, 400, {
        ok: false,
        error: 'Tagged friends are required.'
      });
    }

    // Validate EVM wallet
    if (!/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
      return sendJson(res, 400, {
        ok: false,
        error: 'Invalid EVM wallet address.'
      });
    }

    // Send submission to Google Apps Script
    const payload = {
      source: 'whitelist',
      timestamp: Date.now(),
      xUsername,
      quoteTweet,
      tagFriends,
      wallet,
      token: SUBMISSION_TOKEN
    };

    const response = await fetch(
      APPS_SCRIPT_URL,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload),
        redirect: 'follow'
      }
    );

    const responseText =
      await response.text();

    console.log(
      'Google Apps Script status:',
      response.status
    );

    console.log(
      'Google Apps Script response:',
      responseText
    );

    let result;

    try {
      result = JSON.parse(responseText);
    } catch (parseError) {
      console.error(
        'Invalid Google Apps Script response:',
        responseText
      );

      return sendJson(res, 502, {
        ok: false,
        error:
          'Invalid response from submission service.'
      });
    }

    if (!response.ok || result.ok === false) {
      console.error(
        'Google Apps Script rejected submission:',
        result
      );

      return sendJson(res, 400, {
        ok: false,
        error:
          result.error ||
          'Could not save your application.'
      });
    }

    return sendJson(res, 200, {
      ok: true,
      success: true,
      message:
        result.message ||
        'Application submitted successfully.'
    });

  } catch (error) {
    console.error(
      'Whitelist submission error:',
      error
    );

    return sendJson(res, 500, {
      ok: false,
      error:
        'Could not save your application. Please try again.'
    });
  }
}
