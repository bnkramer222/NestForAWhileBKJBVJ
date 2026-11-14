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

  // Re-check-in (or a queued household that was just admitted): reuse the open session
  // instead of claiming a second slot or joining the line twice.
  const open = await sessionModel.findOpenSessionForClient(client.id);
  if (open?.status === 'active') {
    req.session.shopping = { id: open.id, token: open.session_token, clientId: client.id };
    return res.redirect(303, '/shop');
  }
  if (open?.status === 'queue_waiting') {
    return res.redirect(303, `/queue?token=${encodeURIComponent(open.session_token)}`);
  }

  const slot = await sessionModel.claimFloorSlot();
  if (!slot) {
    const queued = await sessionModel.enqueue(client.id);
    const position = await sessionModel.getLivePosition(queued.session_token);
    return res.status(202).render('queue', {
      title: 'Waiting list',
      clientName: client.name,
      position: position || queued.queue_position,
      refreshToken: queued.session_token,
    });
  }

  const tier = resolveTier(client.conditions);
  const sessionRow = await sessionModel.createSession({ clientId: client.id, dietaryTierId: tier.id });

  req.session.shopping = {
    id: sessionRow.id,
    token: sessionRow.session_token,
    clientId: client.id,
  };

  res.redirect(303, '/shop');
});

export const showQueueStatus = ah(async (req, res) => {
  const token = req.query.token;
  if (!token) return res.redirect('/kiosk');
  const session = await sessionModel.getSessionByToken(token);
  if (!session) return res.redirect('/kiosk');

  if (session.status === 'active') {
    // Admitted from the line: start shopping on this device without re-entering the token.
    req.session.shopping = { id: session.id, token: session.session_token, clientId: session.client_id };
    return res.redirect('/shop');
  }
  if (session.status !== 'queue_waiting') return res.redirect('/kiosk');

  res.render('queue', {
    title: 'Waiting list',
    clientName: decrypt(session.full_name_enc) || 'Your household',
    position: await sessionModel.getLivePosition(token),
    refreshToken: token,
  });
});

export const leaveLine = ah(async (req, res) => {
  const token = String(req.body.token || '').trim();
  if (token) await sessionModel.leaveQueue(token);
  res.redirect(303, '/kiosk');
});
