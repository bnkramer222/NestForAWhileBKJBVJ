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
      error: 'Enter the enrollment token printed on your MTG card.',
      floor: null,
    });
  }

  const client = await clientModel.findByToken(rawToken);
  if (!client) {
    return res.status(404).render('kiosk', {
      title: 'Check in',
      bodyClass: 'kiosk',
      error: 'That token is not recognized. Please see a volunteer at the desk.',
      floor: null,
    });
  }

  const expired =
    client.enrollmentStatus !== 'active' ||
    (client.enrollmentExpiresOn && new Date(client.enrollmentExpiresOn) < new Date());

  if (expired) {
    return res.status(403).render('error', {
      title: 'Enrollment expired',
      status: 403,
      message: `MTG enrollment for ${client.name} is not active. A volunteer can renew it — no paperwork is required.`,
    });
  }

  const slot = await sessionModel.claimFloorSlot();
  if (!slot) {
    const queued = await sessionModel.enqueue(client.id);
    const position = await sessionModel.getQueuedPosition(client.id);
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
    return res.redirect('/kiosk?ready=1');
  }

  res.render('queue', {
    title: 'Waiting list',
    clientName: decrypt(session.full_name_enc) || 'Your household',
    position: session.queue_position,
    refreshToken: token,
  });
});
