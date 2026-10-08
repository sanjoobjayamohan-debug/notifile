import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import firebaseConfig from './firebase-applet-config.json';
import { DEFAULT_BILLING_CONFIGURATION } from './src/config/billingConfig';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface SharedFile {
  id: string;
  fileName: string;
  data: Buffer;
  mimeType: string;
  size: number;
  createdAt: number;
}

// In-memory ephemeral file store (auto-wiped after 30 minutes)
const fileStore = new Map<string, SharedFile>();

// Clean up expired files every 5 minutes
setInterval(() => {
  const now = Date.now();
  const maxAge = 30 * 60 * 1000; // 30 minutes
  for (const [id, file] of fileStore.entries()) {
    if (now - file.createdAt > maxAge) {
      fileStore.delete(id);
    }
  }
}, 5 * 60 * 1000);

async function startServer() {
  const app = express();
  const port = process.env.PORT || 3000;

  const allowedOrigins = new Set(
    (process.env.NOTIFILE_ALLOWED_ORIGINS || 'http://localhost:3000,http://127.0.0.1:3000')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
  );
  const allowedOriginRegex = process.env.NOTIFILE_ALLOWED_ORIGIN_REGEX
    ? new RegExp(process.env.NOTIFILE_ALLOWED_ORIGIN_REGEX)
    : null;
  app.use((req, res, next) => {
    const origin = req.get('origin');
    if (origin && (allowedOrigins.has(origin) || allowedOriginRegex?.test(origin))) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    } else if (origin && req.method === 'OPTIONS') {
      return res.sendStatus(403);
    }
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  });

  // JSON body parser with 50mb limit for base64 file payloads
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  const getAdminServices = () => {
    let adminApp = getApps()[0];
    if (!adminApp) {
      const projectId = process.env.FIREBASE_PROJECT_ID || firebaseConfig.projectId;
      const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
      adminApp = initializeApp({
        projectId,
        credential: serviceAccount
          ? cert(JSON.parse(serviceAccount))
          : applicationDefault(),
      });
    }
    return { adminAuth: getAuth(adminApp), adminDb: getFirestore(adminApp) };
  };

  const getVerifiedUid = async (req: Request): Promise<{ uid: string; name: string; email: string }> => {
    const authorization = req.get('authorization') || '';
    const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
    if (!token) throw Object.assign(new Error('Sign in is required for checkout.'), { statusCode: 401 });
    const { adminAuth } = getAdminServices();
    const decoded = await adminAuth.verifyIdToken(token);
    return {
      uid: decoded.uid,
      name: typeof decoded.name === 'string' ? decoded.name : 'Owner',
      email: typeof decoded.email === 'string' ? decoded.email : '',
    };
  };

  const getServerBillingConfig = async () => {
    const { adminDb } = getAdminServices();
    const snapshot = await adminDb.doc('billingConfiguration/current').get();
    return snapshot.exists
      ? { ...DEFAULT_BILLING_CONFIGURATION, ...snapshot.data() }
      : DEFAULT_BILLING_CONFIGURATION;
  };

  app.post('/api/billing/mock-purchase', async (req: Request, res: Response) => {
    try {
      const identity = await getVerifiedUid(req);
      const config = await getServerBillingConfig();
      const { adminDb } = getAdminServices();
      const stateRef = adminDb.doc(`users/${identity.uid}/billing/state`);
      const transactionId = `mock_${crypto.randomUUID()}`;
      const now = Date.now();
      const discountPercent = Math.min(100, Math.max(0, Number(config.promotionalDiscountPercent) || 0));
      const discountedAmount = (amount: number) => Math.round(amount * (1 - discountPercent / 100) * 100) / 100;

      if (req.body?.kind === 'credits') {
        const plan = config.creditPlans.find((item) => item.id === req.body.planId && item.active);
        if (!plan) return res.status(400).json({ error: 'The selected credit plan is unavailable.' });
        const creditCount = plan.credits + plan.bonusCredits;
        const transaction = {
          id: transactionId,
          createdAt: now,
          description: `${plan.name} credit pack (simulated checkout)`,
          credits: creditCount,
          status: 'completed',
          amountINR: discountedAmount(plan.price),
          kind: 'purchase',
        };

        await adminDb.runTransaction(async (dbTransaction) => {
          const snapshot = await dbTransaction.get(stateRef);
          const current = snapshot.exists ? snapshot.data()! : {};
          const currentLots = Array.isArray(current.creditLots)
            ? current.creditLots.filter((lot: { remaining?: number; expiresAt?: number | null }) =>
              Number(lot.remaining) > 0 && (lot.expiresAt == null || Number(lot.expiresAt) > now))
            : [];
          const retainedBalance = currentLots.reduce((sum: number, lot: { remaining: number }) => sum + lot.remaining, 0);
          const lot = {
            id: transactionId,
            remaining: creditCount,
            expiresAt: plan.validityDays > 0 ? now + plan.validityDays * 24 * 60 * 60 * 1000 : null,
            maxFileSizeMB: plan.maxFileSizeMB,
          };
          dbTransaction.set(stateRef, {
            creditBalance: retainedBalance + creditCount,
            creditLots: [...currentLots, lot],
            creditsPurchased: Number(current.creditsPurchased || 0) + creditCount,
            creditsUsed: Number(current.creditsUsed || 0),
            lastPurchaseAt: now,
            teamSubscription: current.teamSubscription || null,
            usageTimestamps: Array.isArray(current.usageTimestamps) ? current.usageTimestamps : [],
          }, { merge: true });
          dbTransaction.create(adminDb.doc(`users/${identity.uid}/billingTransactions/${transactionId}`), transaction);
        });
        return res.json({ status: 'simulated', message: 'No payment was collected.' });
      }

      if (req.body?.kind === 'team') {
        const duration = config.teamDurations.find((item) => item.id === req.body.durationId && item.active);
        const seats = Number(req.body.seats);
        if (!duration || !Number.isInteger(seats) || seats < config.minimumTeamMembers || seats > config.maximumTeamMembers) {
          return res.status(400).json({ error: 'The selected team plan or seat count is invalid.' });
        }
        const transaction = {
          id: transactionId,
          createdAt: now,
          description: `Team Unlimited · ${seats} seat${seats === 1 ? '' : 's'} · ${duration.label} (simulated checkout)`,
          credits: 0,
          status: 'completed',
          amountINR: discountedAmount(duration.pricePerMember * seats),
          kind: 'team_purchase',
        };

        await adminDb.runTransaction(async (dbTransaction) => {
          const snapshot = await dbTransaction.get(stateRef);
          const current = snapshot.exists ? snapshot.data()! : {};
          const previousTeam = current.teamSubscription;
          const members = previousTeam?.members || [{
            id: identity.uid,
            name: identity.name,
            email: identity.email,
            role: 'Owner',
            status: 'Active',
            joinedAt: now,
          }];
          if (members.length > seats) {
            throw Object.assign(new Error('The new plan needs enough seats for current team members.'), { statusCode: 400 });
          }
          const subscription = {
            id: transactionId,
            teamName: previousTeam?.teamName || 'My Team',
            seats,
            durationId: duration.id,
            startedAt: now,
            expiresAt: now + duration.days * 24 * 60 * 60 * 1000,
            maxFileSizeMB: Math.max(...config.creditPlans.map((plan) => plan.maxFileSizeMB)),
            maximumProcessingMinutes: config.maximumProcessingMinutes,
            fairUseJobsPerHour: config.fairUseJobsPerHour,
            members,
          };
          dbTransaction.set(stateRef, {
            creditBalance: Number(current.creditBalance || 0),
            creditLots: Array.isArray(current.creditLots) ? current.creditLots : [],
            creditsPurchased: Number(current.creditsPurchased || 0),
            creditsUsed: Number(current.creditsUsed || 0),
            lastPurchaseAt: now,
            teamSubscription: subscription,
            usageTimestamps: [],
          }, { merge: true });
          dbTransaction.create(adminDb.doc(`users/${identity.uid}/billingTransactions/${transactionId}`), transaction);
        });
        return res.json({ status: 'simulated', message: 'No payment was collected.' });
      }

      return res.status(400).json({ error: 'Unsupported mock purchase type.' });
    } catch (error) {
      const statusCode = typeof error === 'object' && error !== null && 'statusCode' in error
        ? Number((error as { statusCode?: number }).statusCode)
        : 500;
      console.error('Mock checkout failed:', error);
      return res.status(statusCode).json({
        error: statusCode === 401
          ? 'Sign in is required for checkout.'
          : 'Mock checkout service is unavailable. Configure Firebase Admin credentials on the server.',
      });
    }
  });

  app.post('/api/billing/team-members', async (req: Request, res: Response) => {
    try {
      const identity = await getVerifiedUid(req);
      const { adminDb } = getAdminServices();
      const stateRef = adminDb.doc(`users/${identity.uid}/billing/state`);
      const members = req.body?.members;
      if (!Array.isArray(members)) return res.status(400).json({ error: 'A member list is required.' });
      const teamName = typeof req.body?.teamName === 'string' ? req.body.teamName.trim() : undefined;
      if (teamName !== undefined && (teamName.length === 0 || teamName.length > 80)) {
        return res.status(400).json({ error: 'Team name must be between 1 and 80 characters.' });
      }

      await adminDb.runTransaction(async (dbTransaction) => {
        const snapshot = await dbTransaction.get(stateRef);
        if (!snapshot.exists) throw Object.assign(new Error('No team was found for this account.'), { statusCode: 404 });
        const current = snapshot.data()!;
        const subscription = current.teamSubscription;
        if (!subscription || subscription.expiresAt <= Date.now()) {
          throw Object.assign(new Error('An active team plan is required.'), { statusCode: 403 });
        }
        if (!subscription.members.some((member: { id: string; role: string }) => member.id === identity.uid && member.role === 'Owner')) {
          throw Object.assign(new Error('Only the team owner can manage members.'), { statusCode: 403 });
        }
        if (members.length > subscription.seats) {
          throw Object.assign(new Error('The member list exceeds purchased seats.'), { statusCode: 400 });
        }
        const hasOwner = members.some((member: { id?: string; role?: string }) => member.id === identity.uid && member.role === 'Owner');
        if (!hasOwner) throw Object.assign(new Error('The team owner must remain on the member list.'), { statusCode: 400 });
        const memberIds = new Set<string>();
        const memberEmails = new Set<string>();
        for (const member of members) {
          if (
            typeof member.id !== 'string' ||
            typeof member.name !== 'string' ||
            typeof member.email !== 'string' ||
            member.email.length > 254 ||
            member.name.length > 120 ||
            !['Owner', 'Admin', 'Member'].includes(member.role) ||
            !['Active', 'Pending'].includes(member.status) ||
            (member.role === 'Owner' && member.id !== identity.uid) ||
            memberIds.has(member.id) ||
            memberEmails.has(member.email.toLowerCase())
          ) {
            throw Object.assign(new Error('A team member entry is invalid.'), { statusCode: 400 });
          }
          memberIds.add(member.id);
          memberEmails.add(member.email.toLowerCase());
        }
        dbTransaction.set(stateRef, {
          teamSubscription: {
            ...subscription,
            members,
            ...(teamName ? { teamName } : {}),
          },
        }, { merge: true });
      });
      return res.json({ status: 'saved' });
    } catch (error) {
      const statusCode = typeof error === 'object' && error !== null && 'statusCode' in error
        ? Number((error as { statusCode?: number }).statusCode)
        : 500;
      console.error('Team member update failed:', error);
      return res.status(statusCode).json({
        error: statusCode >= 400 && statusCode < 500 && error instanceof Error
          ? error.message
          : 'Team member service is unavailable.',
      });
    }
  });

  // API Route: Upload a processed file to obtain a phone QR share link
  app.post('/api/share/upload', (req: Request, res: Response) => {
    try {
      const { fileName, base64Data, mimeType } = req.body;

      if (!fileName || !base64Data) {
        return res.status(400).json({ error: 'Missing fileName or base64Data' });
      }

      // Extract pure base64 buffer
      const commaIndex = base64Data.indexOf(',');
      const cleanBase64 = commaIndex !== -1 ? base64Data.slice(commaIndex + 1) : base64Data;
      const buffer = Buffer.from(cleanBase64, 'base64');

      const id = crypto.randomBytes(4).toString('hex'); // 8-char unique ID

      const sharedFile: SharedFile = {
        id,
        fileName: path.basename(fileName),
        data: buffer,
        mimeType: mimeType || 'application/octet-stream',
        size: buffer.length,
        createdAt: Date.now(),
      };

      fileStore.set(id, sharedFile);

      // Compute base host URL
      const host = req.get('host') || `localhost:${port}`;
      const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
      const baseUrl = `${protocol}://${host}`;

      return res.json({
        id,
        fileName: sharedFile.fileName,
        size: sharedFile.size,
        mimeType: sharedFile.mimeType,
        shareUrl: `${baseUrl}/share/${id}`,
        directDownloadUrl: `${baseUrl}/api/share/download/${id}`,
        expiresIn: 1800, // 30 minutes
      });
    } catch (err: any) {
      console.error('Share upload error:', err);
      return res.status(500).json({ error: err.message || 'Failed to upload shared file' });
    }
  });

  // API Route: Direct download endpoint for phone or browser
  app.get('/api/share/download/:id', (req: Request, res: Response) => {
    const { id } = req.params;
    const file = fileStore.get(id);

    if (!file) {
      return res.status(404).send(`
        <!DOCTYPE html>
        <html>
          <head><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>File Not Found</title></head>
          <body style="font-family: system-ui, sans-serif; text-align: center; padding: 40px; background: #fafafa;">
            <h2>File Not Found or Expired</h2>
            <p>This transfer link has expired or the file was deleted for privacy reasons.</p>
          </body>
        </html>
      `);
    }

    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(file.fileName)}"`);
    res.setHeader('Content-Length', file.size);
    return res.end(file.data);
  });

  // API Route: Get metadata about a shared file
  app.get('/api/share/info/:id', (req: Request, res: Response) => {
    const { id } = req.params;
    const file = fileStore.get(id);

    if (!file) {
      return res.status(404).json({ error: 'File not found or expired' });
    }

    return res.json({
      id: file.id,
      fileName: file.fileName,
      size: file.size,
      mimeType: file.mimeType,
      createdAt: file.createdAt,
    });
  });

  // Vite middleware in dev or static files in production
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
  });
}

startServer();
