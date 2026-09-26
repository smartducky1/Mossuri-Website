const crypto = require('crypto');

const ALLOWED_METHODS = ['POST'];

function sendJson(res, status, data) {
  res.status(status).json(data);
}

function normalizeWallet(wallet) {
  return String(wallet || '').trim().toLowerCase();
}

function isValidEvmWallet(wallet) {
  return /^0x[a-fA-F0-9]{40}$/.test(wallet);
}

function createHmac(payload, secret) {
  return crypto
    .createHmac('sha256', secret)
    .update(payload, 'utf8')
    .digest('hex');
}

module.exports = async function handler(req, res) {
  // ============================================
  // METHOD CHECK
  // ============================================

  if (!ALLOWED_METHODS.includes(req.method)) {
    res.setHeader('Allow', ALLOWED_METHODS);
    return sendJson(res, 405, {
      ok: false,
      error: 'Method not allowed.'
    });
  }

  try {
    // ============================================
    // ENVIRONMENT VARIABLES
    // ============================================

    const APPS_SCRIPT_URL =
      process.env.GOOGLE_APPS_SCRIPT_URL;

    const HMAC_SECRET =
      process.env.MOSSURI_HMAC_SECRET;

    if (!APPS_SCRIPT_URL) {
      console.error('GOOGLE_APPS_SCRIPT_URL is missing.');

      return sendJson(res, 500, {
        ok: false,
        error: 'Submission service is not configured.'
      });
    }

    if (!HMAC_SECRET) {
      console.error('MOSSURI_HMAC_SECRET is missing.');

      return sendJson(res, 500, {
        ok: false,
        error: 'Submission security is not configured.'
      });
    }

    // ============================================
    // READ REQUEST BODY
    // ============================================

    const body = req.body || {};

    // ============================================
    // SOURCE
    //
    // The current frontend sends:
    // source: "whitelist"
    //
    // We allow an omitted source so an older
    // cached frontend does not immediately fail.
    // ============================================

    if (
      body.source !== undefined &&
      body.source !== 'whitelist'
    ) {
      return sendJson(res, 400, {
        ok: false,
        error: 'Invalid submission source.'
      });
    }

    // ============================================
    // READ FORM DATA
    // ============================================

    const xUsername =
      String(body.xUsername || '')
        .trim()
        .replace(/^@/, '');

    const likeRt =
      String(body.likeRt || '').trim();

    const quoteTweet =
      String(body.quoteTweet || '').trim();

    const tagFriends =
      String(body.tagFriends || '').trim();

    const wallet =
      normalizeWallet(body.wallet);

    // ============================================
    // VALIDATE X USERNAME
    // ============================================

    if (!xUsername) {
      return sendJson(res, 400, {
        ok: false,
        error: 'X username is required.'
      });
    }

    if (!/^[A-Za-z0-9_]{1,15}$/.test(xUsername)) {
      return sendJson(res, 400, {
        ok: false,
        error: 'Invalid X username.'
      });
    }

    // ============================================
    // VALIDATE LIKE / RT
    // ============================================

    if (!likeRt) {
      return sendJson(res, 400, {
        ok: false,
        error: 'Like and RT confirmation is required.'
      });
    }

    // ============================================
    // VALIDATE QUOTE TWEET
    // ============================================

    if (!quoteTweet) {
      return sendJson(res, 400, {
        ok: false,
        error: 'Quote tweet is required.'
      });
    }

    // ============================================
    // VALIDATE TAGGED FRIENDS
    // ============================================

    if (!tagFriends) {
      return sendJson(res, 400, {
        ok: false,
        error: 'Tagged friends are required.'
      });
    }

    // ============================================
    // VALIDATE EVM WALLET
    // ============================================

    if (!wallet) {
      return sendJson(res, 400, {
        ok: false,
        error: 'EVM wallet is required.'
      });
    }

    if (!isValidEvmWallet(wallet)) {
      return sendJson(res, 400, {
        ok: false,
        error: 'Invalid EVM wallet address.'
      });
    }

    // ============================================
    // CREATE TIMESTAMP
    // ============================================

    const timestamp = Date.now();

    // ============================================
    // CREATE PAYLOAD
    //
    // IMPORTANT:
    // This order must stay the same because the
    // exact JSON is what gets signed by HMAC.
    // ============================================

    const payloadObject = {
      source: 'whitelist',
      timestamp,
      xUsername,
      likeRt,
      quoteTweet,
      tagFriends,
      wallet
    };

    const payload =
      JSON.stringify(payloadObject);

    // ============================================
    // CREATE HMAC SHA-256 SIGNATURE
    // ============================================

    const signature =
      createHmac(payload, HMAC_SECRET);

    // ============================================
    // SEND TO GOOGLE APPS SCRIPT
    // ============================================

    const appsScriptPayload = {
      ...payloadObject,
      signature
    };

    const response = await fetch(
      APPS_SCRIPT_URL,
      {
        method: 'POST',

        headers: {
          'Content-Type': 'application/json'
        },

        body: JSON.stringify(
          appsScriptPayload
        )
      }
    );

    // ============================================
    // READ APPS SCRIPT RESPONSE
    // ============================================

    const responseText =
      await response.text();

    let result;

    try {
      result = JSON.parse(responseText);
    } catch (parseError) {
      console.error(
        'Google Apps Script returned invalid JSON:',
        responseText
      );

      return sendJson(res, 502, {
        ok: false,
        error: 'Invalid response from submission service.'
      });
    }

    // ============================================
    // HANDLE APPS SCRIPT ERROR
    // ============================================

    if (!response.ok || result.ok === false) {
      console.error(
        'Google Apps Script error:',
        result
      );

      return sendJson(
        res,
        response.ok ? 400 : 502,
        {
          ok: false,
          error:
            result.error ||
            'Could not save your application.'
        }
      );
    }

    // ============================================
    // SUCCESS
    // ============================================

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
};
