'use strict';

require('dotenv').config();

const express = require('express');
const path    = require('path');
const fs      = require('fs');
const { Resend } = require('resend');

const app    = express();

// Stripe et Resend initialisés lazily pour ne pas crasher sans .env
const getStripe = (() => {
  let instance = null;
  return () => {
    if (!instance) {
      if (!process.env.STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY manquant dans .env');
      instance = require('stripe')(process.env.STRIPE_SECRET_KEY);
    }
    return instance;
  };
})();

const getResend = (() => {
  let instance = null;
  return () => {
    if (!instance) instance = new Resend(process.env.RESEND_API_KEY || 're_placeholder');
    return instance;
  };
})();
const PORT   = process.env.PORT || 3000;

const CLIENTS_FILE = path.join(__dirname, 'clients.json');

// ─── Mapping plan → price ID Stripe ───────────────────────────────────────
const PRICE_IDS = {
  starter: process.env.STRIPE_PRICE_STARTER,
  pro:     process.env.STRIPE_PRICE_PRO,
  agency:  process.env.STRIPE_PRICE_AGENCY,
};

const PLAN_LABELS = {
  starter: 'Starter — 97€/mois',
  pro:     'Pro — 297€/mois',
  agency:  'Agency — 697€/mois',
};

const PLAN_AMOUNTS = {
  starter: 97,
  pro:     297,
  agency:  697,
};

// ─── Middleware ────────────────────────────────────────────────────────────
// Le webhook Stripe doit recevoir le raw body AVANT express.json()
app.use('/webhook', express.raw({ type: 'application/json' }));
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// ═══════════════════════════════════════════════════════════════════════════
// POST /create-checkout-session
// ═══════════════════════════════════════════════════════════════════════════
app.post('/create-checkout-session', async (req, res) => {
  const { plan, email } = req.body;

  if (!plan || !PRICE_IDS[plan]) {
    return res.status(400).json({ error: 'Plan invalide. Valeurs acceptées : starter, pro, agency.' });
  }
  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Email invalide.' });
  }
  if (!PRICE_IDS[plan]) {
    return res.status(500).json({ error: `Price ID manquant pour le plan "${plan}". Vérifiez vos variables d'environnement.` });
  }

  try {
    const session = await getStripe().checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      customer_email: email,
      line_items: [
        {
          price: PRICE_IDS[plan],
          quantity: 1,
        },
      ],
      metadata: {
        plan,
        email,
      },
      success_url: `${req.headers.origin || `http://localhost:${PORT}`}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.headers.origin || `http://localhost:${PORT}`}/#pricing`,
      locale: 'fr',
      billing_address_collection: 'auto',
      allow_promotion_codes: true,
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error('[Stripe] Erreur création session :', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// POST /webhook  (Stripe)
// ═══════════════════════════════════════════════════════════════════════════
app.post('/webhook', async (req, res) => {
  const sig = req.headers['stripe-signature'];

  let event;
  try {
    event = getStripe().webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('[Webhook] Signature invalide :', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Répondre immédiatement à Stripe
  res.status(200).json({ received: true });

  // Traitement asynchrone
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const email   = session.customer_email || session.metadata?.email;
    const plan    = session.metadata?.plan || 'starter';

    console.log(`[Webhook] Nouveau client — ${email} — plan: ${plan}`);

    await Promise.allSettled([
      sendWelcomeEmail(email, plan),
      logClient(email, plan, session.id, PLAN_AMOUNTS[plan]),
    ]);
  }

  if (event.type === 'customer.subscription.deleted') {
    const sub   = event.data.object;
    const email = sub.metadata?.email || '';
    console.log(`[Webhook] Résiliation — ${email}`);
    updateClientStatus(email, 'résilié');
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// GET /success
// ═══════════════════════════════════════════════════════════════════════════
app.get('/success', async (req, res) => {
  const { session_id } = req.query;
  let planLabel = 'votre formule';
  let email     = '';

  if (session_id) {
    try {
      const session = await getStripe().checkout.sessions.retrieve(session_id);
      planLabel = PLAN_LABELS[session.metadata?.plan] || planLabel;
      email     = session.customer_email || '';
    } catch (e) {
      console.error('[Success] Impossible de récupérer la session :', e.message);
    }
  }

  const calendlyUrl = process.env.CALENDLY_URL || 'https://calendly.com/prospexxagency/appel-decouverte-receptia-20-min';

  res.send(`<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Bienvenue chez ReceptIA 🎉</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://assets.calendly.com/assets/external/widget.css" rel="stylesheet"/>
  <script src="https://assets.calendly.com/assets/external/widget.js" async></script>
</head>
<body class="bg-gradient-to-br from-blue-50 to-indigo-50 min-h-screen flex items-center justify-center p-4">
  <div class="bg-white rounded-3xl shadow-2xl p-10 max-w-lg w-full text-center">
    <div class="text-7xl mb-6">🎉</div>
    <h1 class="text-3xl font-extrabold text-gray-900 mb-3">Bienvenue chez ReceptIA !</h1>
    <p class="text-gray-500 mb-2">Votre abonnement <strong class="text-blue-600">${planLabel}</strong> est actif.</p>
    ${email ? `<p class="text-gray-400 text-sm mb-8">Un email de confirmation a été envoyé à <strong>${email}</strong></p>` : '<div class="mb-8"></div>'}

    <div class="bg-blue-50 rounded-2xl p-6 mb-8 text-left">
      <h2 class="font-bold text-gray-900 mb-3">📋 Prochaines étapes</h2>
      <ol class="space-y-2 text-gray-600 text-sm">
        <li class="flex items-start gap-2"><span class="font-bold text-blue-600">1.</span> Vérifiez votre boîte email — les instructions d'onboarding vous y attendent.</li>
        <li class="flex items-start gap-2"><span class="font-bold text-blue-600">2.</span> Réservez votre appel de configuration (30 min) avec notre équipe.</li>
        <li class="flex items-start gap-2"><span class="font-bold text-blue-600">3.</span> Votre ReceptIA sera opérationnelle sous 24h.</li>
      </ol>
    </div>

    <button onclick="Calendly.initPopupWidget({url:'${calendlyUrl}'})"
            class="w-full py-4 bg-blue-600 text-white font-bold text-lg rounded-2xl hover:bg-blue-700 transition-colors mb-4">
      📅 Réserver mon appel d'onboarding →
    </button>
    <a href="/" class="text-sm text-gray-400 hover:text-gray-600 transition-colors">← Retour à l'accueil</a>
  </div>
</body>
</html>`);
});

// ═══════════════════════════════════════════════════════════════════════════
// GET / (fallback — sert index.html)
// ═══════════════════════════════════════════════════════════════════════════
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

async function sendWelcomeEmail(email, plan) {
  if (!email) return;

  const calendlyUrl      = process.env.CALENDLY_URL       || 'https://calendly.com/VOTRE_LIEN_ICI';
  const onboardingFormUrl = process.env.ONBOARDING_FORM_URL || 'https://notion.so/VOTRE_FORMULAIRE';
  const fromEmail        = process.env.FROM_EMAIL          || 'contact@receptia.fr';
  const planLabel        = PLAN_LABELS[plan]               || plan;

  const emailHtml = buildEmailHtml({ email, plan, planLabel, calendlyUrl, onboardingFormUrl });

  try {
    const result = await getResend().emails.send({
      from:    `ReceptIA <${fromEmail}>`,
      to:      [email],
      subject: '🎉 Bienvenue chez ReceptIA — voici vos accès',
      html:    emailHtml,
    });
    console.log(`[Email] Envoyé à ${email} :`, result.data?.id);
  } catch (err) {
    console.error(`[Email] Erreur envoi à ${email} :`, err.message);
  }
}

function buildEmailHtml({ email, plan, planLabel, calendlyUrl, onboardingFormUrl }) {
  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#F3F4F6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F3F4F6;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#1e3a8a,#2563EB);padding:40px 40px 32px;text-align:center;">
            <h1 style="margin:0;color:#ffffff;font-size:28px;font-weight:800;letter-spacing:-0.5px;">
              Recept<span style="color:#34D399;">IA</span>
            </h1>
            <p style="margin:8px 0 0;color:#BFDBFE;font-size:15px;">Votre réceptionniste IA est prête</p>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:40px;">
            <p style="font-size:22px;font-weight:700;color:#111827;margin:0 0 8px;">🎉 Bienvenue chez ReceptIA !</p>
            <p style="color:#6B7280;font-size:15px;line-height:1.6;margin:0 0 24px;">
              Votre abonnement <strong style="color:#2563EB;">${planLabel}</strong> est confirmé.<br/>
              Voici les prochaines étapes pour mettre en place votre réceptionniste IA.
            </p>

            <!-- Étapes -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#EFF6FF;border-radius:12px;padding:24px;margin-bottom:28px;">
              <tr><td>
                <p style="font-weight:700;color:#1E40AF;margin:0 0 16px;font-size:15px;">📋 Vos prochaines étapes</p>
                <table width="100%" cellpadding="0" cellspacing="8">
                  <tr>
                    <td style="vertical-align:top;width:28px;"><span style="background:#2563EB;color:#fff;border-radius:50%;width:22px;height:22px;display:inline-block;text-align:center;line-height:22px;font-size:12px;font-weight:700;">1</span></td>
                    <td style="padding-left:10px;color:#374151;font-size:14px;line-height:1.5;">Remplissez le formulaire de configuration de votre script d'accueil (10 minutes)</td>
                  </tr>
                  <tr><td colspan="2" style="height:12px;"></td></tr>
                  <tr>
                    <td style="vertical-align:top;width:28px;"><span style="background:#2563EB;color:#fff;border-radius:50%;width:22px;height:22px;display:inline-block;text-align:center;line-height:22px;font-size:12px;font-weight:700;">2</span></td>
                    <td style="padding-left:10px;color:#374151;font-size:14px;line-height:1.5;">Réservez votre appel d'onboarding (30 min) — notre équipe configure tout avec vous</td>
                  </tr>
                  <tr><td colspan="2" style="height:12px;"></td></tr>
                  <tr>
                    <td style="vertical-align:top;width:28px;"><span style="background:#2563EB;color:#fff;border-radius:50%;width:22px;height:22px;display:inline-block;text-align:center;line-height:22px;font-size:12px;font-weight:700;">3</span></td>
                    <td style="padding-left:10px;color:#374151;font-size:14px;line-height:1.5;">Votre ReceptIA est opérationnelle sous 24h après la session de configuration</td>
                  </tr>
                </table>
              </td></tr>
            </table>

            <!-- CTA Formulaire -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
              <tr><td align="center">
                <a href="${onboardingFormUrl}" style="display:inline-block;background:#2563EB;color:#ffffff;font-weight:700;font-size:16px;padding:14px 32px;border-radius:12px;text-decoration:none;">
                  📝 Remplir mon formulaire de configuration →
                </a>
              </td></tr>
            </table>

            <!-- CTA Calendly -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
              <tr><td align="center">
                <a href="${calendlyUrl}" style="display:inline-block;background:#10B981;color:#ffffff;font-weight:700;font-size:16px;padding:14px 32px;border-radius:12px;text-decoration:none;">
                  📅 Réserver mon appel d'onboarding (30 min) →
                </a>
              </td></tr>
            </table>

            <!-- Support -->
            <table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #E5E7EB;padding-top:24px;">
              <tr><td>
                <p style="color:#6B7280;font-size:14px;margin:0 0 8px;">💬 <strong>Des questions ?</strong></p>
                <p style="color:#6B7280;font-size:14px;margin:0;line-height:1.6;">
                  Répondez directement à cet email — notre équipe répond sous 24h.<br/>
                  Email : <a href="mailto:contact@receptia.fr" style="color:#2563EB;">contact@receptia.fr</a>
                </p>
              </td></tr>
            </table>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="background:#F9FAFB;padding:20px 40px;text-align:center;border-top:1px solid #E5E7EB;">
            <p style="color:#9CA3AF;font-size:12px;margin:0;">
              © 2025 ReceptIA · Vous recevez cet email car vous avez souscrit à nos services.<br/>
              <a href="#" style="color:#9CA3AF;">Se désabonner</a> · <a href="#" style="color:#9CA3AF;">Mentions légales</a>
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function logClient(email, plan, stripeSessionId, montant) {
  try {
    let clients = [];
    if (fs.existsSync(CLIENTS_FILE)) {
      const raw = fs.readFileSync(CLIENTS_FILE, 'utf-8');
      try { clients = JSON.parse(raw); } catch { clients = []; }
    }

    const newClient = {
      id:                `cli_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      email,
      plan,
      montant:           montant || PLAN_AMOUNTS[plan] || 0,
      date_iso:          new Date().toISOString(),
      statut:            'actif',
      stripe_session_id: stripeSessionId || '',
    };

    clients.push(newClient);
    fs.writeFileSync(CLIENTS_FILE, JSON.stringify(clients, null, 2), 'utf-8');
    console.log(`[Log] Client enregistré : ${email} (${plan})`);
  } catch (err) {
    console.error('[Log] Erreur écriture clients.json :', err.message);
  }
}

function updateClientStatus(email, statut) {
  try {
    if (!fs.existsSync(CLIENTS_FILE)) return;
    const clients = JSON.parse(fs.readFileSync(CLIENTS_FILE, 'utf-8'));
    const updated = clients.map(c => c.email === email ? { ...c, statut } : c);
    fs.writeFileSync(CLIENTS_FILE, JSON.stringify(updated, null, 2), 'utf-8');
    console.log(`[Log] Statut mis à jour : ${email} → ${statut}`);
  } catch (err) {
    console.error('[Log] Erreur mise à jour statut :', err.message);
  }
}

// ─── Démarrage ─────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀 ReceptIA serveur démarré sur http://localhost:${PORT}`);
  console.log(`   Stripe webhook endpoint : POST /webhook`);
  console.log(`   Checkout endpoint       : POST /create-checkout-session\n`);
});
