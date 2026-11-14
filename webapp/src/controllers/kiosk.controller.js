import * as clientModel from '../models/client.model.js';
import * as sessionModel from '../models/session.model.js';
import { resolveTier } from '../services/dietaryMatrix.js';
import { decrypt } from '../lib/crypto.js';
import { ah } from '../lib/asyncHandler.js';
import { setLanguageCookie } from '../i18n/index.js';

const CODE_PARAM = /^MTG-\d{4,8}$/i;

export function showKiosk(req, res) {
  // ?code=MTG-1001 pre-fills the card code (e.g. from a link or a printed QR); ?lang=xx sets the language.
  const code = String(req.query.code || '').trim().toUpperCase();
  res.render('kiosk', {
    title: req.t('kiosk.title'),
    bodyClass: 'kiosk',
    error: null,
    floor: null,
    prefillCode: CODE_PARAM.test(code) ? code : '',
  });
}

export const checkIn = ah(async (req, res) => {
  const rawToken = String(req.body.token || '').trim().toUpperCase();
  if (!rawToken) {
    return res.status(400).render('kiosk', {
      title: req.t('kiosk.title'),
      bodyClass: 'kiosk',
      error: req.t('kiosk.err.empty'),
      floor: null,
    });
  }

  const client = await clientModel.findByToken(rawToken);
  if (!client) {
    return res.status(404).render('kiosk', {
      title: req.t('kiosk.title'),
      bodyClass: 'kiosk',
      error: req.t('kiosk.err.unknown'),
      floor: null,
    });
  }

  const expired =
    client.enrollmentStatus !== 'active' ||
    (client.enrollmentExpiresOn && new Date(client.enrollmentExpiresOn) < new Date());

  if (expired) {
    return res.status(403).render('error', {
      title: req.t('kiosk.renew.title'),
      status: 403,
      message: req.t('kiosk.renew.msg', { name: client.greetingName }),
    });
  }

  // One locked step: reuse an open session, take a free slot, or join the back of the line.
  const tier = resolveTier(client.conditions);
  const session = await sessionModel.checkInToFloor({ clientId: client.id, dietaryTierId: tier.id });

  // Switch to the language this client chose at sign-up, unless they just picked one here.
  if (client.preferredLang && !req.query.lang && client.preferredLang !== req.lang) {
    setLanguageCookie(res, client.preferredLang);
  }

  if (session.status === 'active') {
    req.session.shopping = { id: session.id, token: session.session_token, clientId: client.id };
    return res.redirect(303, '/shop');
  }
  // Redirect (not render) so the waiting page has its own URL and survives refreshes.
  return res.redirect(303, `/queue?token=${encodeURIComponent(session.session_token)}`);
});

async function queueStatus(token) {
  const session = token ? await sessionModel.getSessionByToken(token) : null;
  if (!session) return null;
  if (session.status === 'queue_waiting') await sessionModel.touchSession(session.id);
  const position = session.status === 'queue_waiting' ? await sessionModel.getLivePosition(token) : 0;
  return { session, position };
}

export const showQueueStatus = ah(async (req, res) => {
  const token = String(req.query.token || '').trim();
  const result = await queueStatus(token);
  if (!result) return res.redirect('/kiosk');
  const { session, position } = result;

  if (session.status === 'active') {
    // Admitted from the line: start shopping on this device without re-entering the code.
    req.session.shopping = { id: session.id, token: session.session_token, clientId: session.client_id };
    return res.redirect('/shop');
  }
  if (session.status !== 'queue_waiting') {
    return res.render('error', {
      title: req.t('queue.ended.title'),
      status: 410,
      message: req.t('queue.ended.msg'),
    });
  }

  const floor = await sessionModel.getFloorState();
  res.render('queue', {
    title: req.t('queue.title'),
    bodyClass: 'queue',
    clientName: session.preferred_name_enc ? decrypt(session.preferred_name_enc) : (decrypt(session.full_name_enc) || '').split(' ')[0],
    position,
    floor,
    refreshToken: token,
  });
});

/** Polled by the waiting page every few seconds (also acts as the "still here" heartbeat). */
export const apiQueueStatus = ah(async (req, res) => {
  const result = await queueStatus(String(req.params.token || '').trim());
  if (!result) return res.status(404).json({ error: 'Unknown place in line.' });
  res.json({ status: result.session.status, position: result.position });
});

export const leaveLine = ah(async (req, res) => {
  const token = String(req.body.token || '').trim();
  if (token) await sessionModel.leaveQueue(token);
  res.redirect(303, '/kiosk');
});
