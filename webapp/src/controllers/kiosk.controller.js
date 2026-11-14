import * as clientModel from '../models/client.model.js';
import * as sessionModel from '../models/session.model.js';
import { resolveTier } from '../services/dietaryMatrix.js';
import { decrypt } from '../lib/crypto.js';
import { ah } from '../lib/asyncHandler.js';

export function showKiosk(req, res) {
  res.render('kiosk', {
    title: 'Check in',
    bodyClass: 'kiosk',
    error: null,
    floor: null,
  });
}

export const checkIn = ah(async (req, res) => {
  const rawToken = String(req.body.token || '').trim().toUpperCase();
  if (!rawToken) {
    return res.status(400).render('kiosk', {
      title: 'Check in',
      bodyClass: 'kiosk',
      error: 'Please enter the code printed on your card (it looks like MTG-1001).',
      floor: null,
    });
  }

  const client = await clientModel.findByToken(rawToken);
  if (!client) {
    return res.status(404).render('kiosk', {
      title: 'Check in',
      bodyClass: 'kiosk',
      error: "We couldn't find that code. Double-check it, or a volunteer at the desk will be happy to help.",
      floor: null,
    });
  }

  const expired =
    client.enrollmentStatus !== 'active' ||
    (client.enrollmentExpiresOn && new Date(client.enrollmentExpiresOn) < new Date());

  if (expired) {
    return res.status(403).render('error', {
      title: 'Time to renew',
      status: 403,
      message: `Hi ${client.name}, your membership needs a quick renewal. A volunteer at the desk can do it in a minute — no paperwork.`,
    });
  }

  // One locked step: reuse an open session, take a free slot, or join the back of the line.
  const tier = resolveTier(client.conditions);
  const session = await sessionModel.checkInToFloor({ clientId: client.id, dietaryTierId: tier.id });

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
      title: 'Your spot has ended',
      status: 410,
      message: "This place in line is no longer active. Check in again at the kiosk and we'll get you right back in line.",
    });
  }

  const floor = await sessionModel.getFloorState();
  res.render('queue', {
    title: 'Waiting list',
    bodyClass: 'queue',
    clientName: (decrypt(session.full_name_enc) || 'friend').split(' ')[0],
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
