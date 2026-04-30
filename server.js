'use strict';

require('dotenv').config();

const express = require('express');
const path    = require('path');
const fs      = require('fs');
// Email via Brevo (pas de dépendance supplémentaire — fetch natif Node 18+)

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

async function sendBrevoEmail({ to, subject, html }) {
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': process.env.BREVO_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      sender: { name: 'ReceptIA', email: process.env.FROM_EMAIL },
      to: [{ email: to }],
      subject,
      htmlContent: html,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Brevo error ${res.status}: ${err}`);
  }
  return res.json();
}
const PORT   = process.env.PORT || 3000;

const CLIENTS_FILE = path.join(__dirname, 'clients.json');

// ─── Utilitaires sécurité ──────────────────────────────────────────────────
function escapeHtml(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;');
}

const ALLOWED_ORIGINS = [
  `http://localhost:${PORT}`,
  'https://receptia.onrender.com',
];

function getSafeOrigin(req) {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) return origin;
  return 'https://receptia.onrender.com';
}

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

// Bloquer l'accès aux fichiers sensibles avant le middleware statique
const BLOCKED_FILES = ['/clients.json', '/server.js', '/setup-stripe.js', '/package.json', '/package-lock.json'];
app.use((req, res, next) => {
  const p = req.path.toLowerCase();
  if (BLOCKED_FILES.includes(p) || p.startsWith('/.') || p.endsWith('.json') && p !== '/') {
    return res.status(404).end();
  }
  next();
});

// Rate limiting basique en mémoire
const rateLimitMap = new Map();
function rateLimit(windowMs, max) {
  return (req, res, next) => {
    const key = req.ip;
    const now = Date.now();
    const entry = rateLimitMap.get(key) || { count: 0, start: now };
    if (now - entry.start > windowMs) { entry.count = 0; entry.start = now; }
    entry.count++;
    rateLimitMap.set(key, entry);
    if (entry.count > max) return res.status(429).json({ error: 'Trop de requêtes. Réessayez dans quelques minutes.' });
    next();
  };
}

app.use(express.static(path.join(__dirname)));

// ═══════════════════════════════════════════════════════════════════════════
// POST /create-checkout-session
// ═══════════════════════════════════════════════════════════════════════════
app.post('/create-checkout-session', rateLimit(60_000, 10), async (req, res) => {
  const { plan, email } = req.body;

  if (!plan || !PRICE_IDS[plan]) {
    return res.status(400).json({ error: 'Plan invalide. Valeurs acceptées : starter, pro, agency.' });
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  if (!email || !emailRegex.test(email)) {
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
      success_url: `${getSafeOrigin(req)}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${getSafeOrigin(req)}/#pricing`,
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

  const safeEmail     = escapeHtml(email);
  const safePlanLabel = escapeHtml(planLabel);
  const calendlyUrl   = escapeHtml(process.env.CALENDLY_URL || 'https://calendly.com/prospexxagency/appel-decouverte-receptia-20-min');

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
    <p class="text-gray-500 mb-2">Votre abonnement <strong class="text-blue-600">${safePlanLabel}</strong> est actif.</p>
    ${safeEmail ? `<p class="text-gray-400 text-sm mb-8">Un email de confirmation a été envoyé à <strong>${safeEmail}</strong></p>` : '<div class="mb-8"></div>'}

    <div class="bg-blue-50 rounded-2xl p-6 mb-8 text-left">
      <h2 class="font-bold text-gray-900 mb-3">📋 Prochaines étapes</h2>
      <ol class="space-y-2 text-gray-600 text-sm">
        <li class="flex items-start gap-2"><span class="font-bold text-blue-600">1.</span> Vérifiez votre boîte email — les instructions d'onboarding vous y attendent.</li>
        <li class="flex items-start gap-2"><span class="font-bold text-blue-600">2.</span> Réservez votre appel de configuration (30 min) avec notre équipe.</li>
        <li class="flex items-start gap-2"><span class="font-bold text-blue-600">3.</span> Votre ReceptIA sera opérationnelle sous 24h.</li>
      </ol>
    </div>

    <button onclick="Calendly.initPopupWidget({url:'${calendlyUrl.replace(/'/g, '')}'}"
            class="w-full py-4 bg-blue-600 text-white font-bold text-lg rounded-2xl hover:bg-blue-700 transition-colors mb-4">
      📅 Réserver mon appel d'onboarding →
    </button>
    <a href="/" class="text-sm text-gray-400 hover:text-gray-600 transition-colors">← Retour à l'accueil</a>
  </div>
</body>
</html>`);
});

// ═══════════════════════════════════════════════════════════════════════════
// GET /onboarding — Formulaire de configuration client
// ═══════════════════════════════════════════════════════════════════════════
app.get('/onboarding', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Configuration ReceptIA — Votre réceptionniste IA</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    .fade-in { animation: fadeIn .4s ease; }
    @keyframes fadeIn { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:none; } }
  </style>
</head>
<body class="bg-gradient-to-br from-blue-50 to-indigo-50 min-h-screen py-12 px-4">

  <!-- SUCCESS STATE -->
  <div id="successState" class="hidden fade-in max-w-lg mx-auto bg-white rounded-3xl shadow-2xl p-10 text-center">
    <div class="text-7xl mb-6">✅</div>
    <h1 class="text-2xl font-extrabold text-gray-900 mb-3">Formulaire envoyé !</h1>
    <p class="text-gray-500 mb-6">Nous allons configurer votre ReceptIA et vous recontacter sous 24h pour finaliser le paramétrage.</p>
    <p class="text-gray-400 text-sm">Pensez aussi à réserver votre appel d'onboarding si ce n'est pas encore fait.</p>
  </div>

  <!-- FORM STATE -->
  <div id="formState" class="max-w-2xl mx-auto">
    <div class="text-center mb-8">
      <h1 class="text-3xl font-extrabold text-gray-900 mb-2">
        Recept<span class="text-blue-600">IA</span> — Configuration
      </h1>
      <p class="text-gray-500">Remplissez ce formulaire pour que nous puissions configurer votre réceptionniste IA. <strong>10 minutes suffisent.</strong></p>
    </div>

    <form id="onboardingForm" class="bg-white rounded-3xl shadow-xl p-8 space-y-6">

      <!-- Section 1 : Identité -->
      <div class="border-b pb-6">
        <h2 class="text-lg font-bold text-gray-900 mb-4">👤 Vos informations</h2>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-semibold text-gray-700 mb-1">Prénom *</label>
            <input name="prenom" required placeholder="Marie" class="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"/>
          </div>
          <div>
            <label class="block text-sm font-semibold text-gray-700 mb-1">Nom *</label>
            <input name="nom" required placeholder="Dupont" class="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"/>
          </div>
          <div>
            <label class="block text-sm font-semibold text-gray-700 mb-1">Email *</label>
            <input name="email" type="email" required placeholder="marie@monsalon.fr" class="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"/>
          </div>
          <div>
            <label class="block text-sm font-semibold text-gray-700 mb-1">Téléphone *</label>
            <input name="telephone" required placeholder="06 12 34 56 78" class="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"/>
          </div>
        </div>
      </div>

      <!-- Section 2 : Entreprise -->
      <div class="border-b pb-6">
        <h2 class="text-lg font-bold text-gray-900 mb-4">🏢 Votre entreprise</h2>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div class="sm:col-span-2">
            <label class="block text-sm font-semibold text-gray-700 mb-1">Nom de votre entreprise *</label>
            <input name="entreprise" required placeholder="Salon Beauté Marie" class="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"/>
          </div>
          <div>
            <label class="block text-sm font-semibold text-gray-700 mb-1">Secteur d'activité *</label>
            <select name="secteur" required class="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
              <option value="">-- Choisir --</option>
              <option>Salon de coiffure / esthétique</option>
              <option>Cabinet médical / dentaire</option>
              <option>Cabinet d'avocat / comptable</option>
              <option>Plombier / Électricien / Artisan</option>
              <option>Restaurant / Hôtel</option>
              <option>Agence immobilière</option>
              <option>Garage automobile</option>
              <option>Autre</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-semibold text-gray-700 mb-1">Numéro de téléphone pro actuel *</label>
            <input name="tel_pro" required placeholder="01 23 45 67 89" class="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"/>
          </div>
          <div class="sm:col-span-2">
            <label class="block text-sm font-semibold text-gray-700 mb-1">Adresse de votre établissement</label>
            <input name="adresse" placeholder="12 rue de la Paix, 75001 Paris" class="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"/>
          </div>
        </div>
      </div>

      <!-- Section 3 : Horaires -->
      <div class="border-b pb-6">
        <h2 class="text-lg font-bold text-gray-900 mb-4">🕐 Vos horaires d'ouverture *</h2>
        <textarea name="horaires" required rows="3" placeholder="Ex: Lundi-Vendredi 9h-19h, Samedi 9h-17h, fermé dimanche" class="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"></textarea>
      </div>

      <!-- Section 4 : Script -->
      <div class="border-b pb-6">
        <h2 class="text-lg font-bold text-gray-900 mb-2">📞 Message d'accueil *</h2>
        <p class="text-gray-500 text-sm mb-3">Comment souhaitez-vous que votre réceptionniste IA réponde aux appels ? (elle s'adaptera, mais donnez-lui une base)</p>
        <textarea name="message_accueil" required rows="3" placeholder='Ex: "Bonjour, vous avez bien joint le Salon Beauté Marie, je suis votre assistante Sofia. Comment puis-je vous aider ?"' class="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"></textarea>
      </div>

      <!-- Section 5 : Types d'appels -->
      <div class="border-b pb-6">
        <h2 class="text-lg font-bold text-gray-900 mb-2">📋 Principaux types d'appels que vous recevez *</h2>
        <p class="text-gray-500 text-sm mb-3">Cochez tout ce qui s'applique :</p>
        <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
          ${['Prises de rendez-vous', 'Demandes de prix / devis', 'Renseignements horaires', 'Urgences / SAV', 'Demandes de rappel', 'Commandes', 'Réclamations', 'Partenaires / fournisseurs', 'Autre'].map(v => `
          <label class="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input type="checkbox" name="types_appels" value="${v}" class="rounded text-blue-600"/>
            ${v}
          </label>`).join('')}
        </div>
      </div>

      <!-- Section 6 : Instructions spéciales -->
      <div class="border-b pb-6">
        <h2 class="text-lg font-bold text-gray-900 mb-2">⚙️ Instructions particulières</h2>
        <p class="text-gray-500 text-sm mb-3">Y a-t-il des choses spécifiques à savoir ? (tarifs, services, adresse, procédures urgence...)</p>
        <textarea name="instructions" rows="4" placeholder="Ex: Pour les urgences plomberie, prendre le nom, le problème et l'adresse et me transmettre le message. Tarif d'intervention = 90€/h. Ne pas promettre de disponibilité le jour même..." class="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"></textarea>
      </div>

      <!-- Section 7 : Email de réception des messages -->
      <div>
        <h2 class="text-lg font-bold text-gray-900 mb-2">📨 Email de réception des messages vocaux</h2>
        <p class="text-gray-500 text-sm mb-3">Où souhaitez-vous recevoir les résumés des appels et messages laissés ?</p>
        <input name="email_messages" type="email" placeholder="marie@monsalon.fr (laisser vide = même que ci-dessus)" class="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"/>
      </div>

      <!-- Error -->
      <div id="formError" class="hidden bg-red-50 text-red-700 rounded-xl p-4 text-sm"></div>

      <!-- Submit -->
      <button type="submit" id="submitBtn"
              class="w-full py-4 bg-blue-600 text-white font-bold text-lg rounded-2xl hover:bg-blue-700 active:scale-95 transition-all">
        Envoyer ma configuration →
      </button>
    </form>
  </div>

  <script>
    document.getElementById('onboardingForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = document.getElementById('submitBtn');
      const errDiv = document.getElementById('formError');
      btn.disabled = true;
      btn.textContent = 'Envoi en cours...';
      errDiv.classList.add('hidden');

      const fd = new FormData(e.target);
      const data = {};
      for (const [k, v] of fd.entries()) {
        if (data[k]) {
          data[k] = Array.isArray(data[k]) ? [...data[k], v] : [data[k], v];
        } else {
          data[k] = v;
        }
      }

      try {
        const res = await fetch('/onboarding', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
        if (!res.ok) throw new Error(await res.text());
        document.getElementById('formState').classList.add('hidden');
        document.getElementById('successState').classList.remove('hidden');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } catch (err) {
        errDiv.textContent = 'Erreur lors de l\\'envoi. Veuillez réessayer ou nous contacter.';
        errDiv.classList.remove('hidden');
        btn.disabled = false;
        btn.textContent = 'Envoyer ma configuration →';
      }
    });
  </script>
</body>
</html>`);
});

// ═══════════════════════════════════════════════════════════════════════════
// POST /onboarding — Réception du formulaire → email au propriétaire
// ═══════════════════════════════════════════════════════════════════════════
app.post('/onboarding', rateLimit(60_000, 5), async (req, res) => {
  const d = req.body;

  const rows = [
    ['Prénom', d.prenom],
    ['Nom', d.nom],
    ['Email client', d.email],
    ['Téléphone', d.telephone],
    ['Entreprise', d.entreprise],
    ['Secteur', d.secteur],
    ['Téléphone pro', d.tel_pro],
    ['Adresse', d.adresse || '—'],
    ['Horaires', d.horaires],
    ['Message d\'accueil', d.message_accueil],
    ['Types d\'appels', Array.isArray(d.types_appels) ? d.types_appels.join(', ') : d.types_appels || '—'],
    ['Instructions spéciales', d.instructions || '—'],
    ['Email messages', d.email_messages || d.email],
  ];

  const tableRows = rows.map(([label, val]) => `
    <tr>
      <td style="padding:10px 14px;font-weight:600;color:#374151;background:#F9FAFB;border-bottom:1px solid #E5E7EB;width:38%;vertical-align:top;">${escapeHtml(label)}</td>
      <td style="padding:10px 14px;color:#111827;border-bottom:1px solid #E5E7EB;white-space:pre-wrap;">${escapeHtml(val) || '—'}</td>
    </tr>`).join('');

  const html = `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"/></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;background:#F3F4F6;padding:32px 16px;">
  <div style="max-width:640px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,.08);">
    <div style="background:linear-gradient(135deg,#1e3a8a,#2563EB);padding:32px 36px;">
      <h1 style="margin:0;color:#fff;font-size:22px;">🎯 Nouveau formulaire d'onboarding ReceptIA</h1>
      <p style="margin:8px 0 0;color:#BFDBFE;font-size:14px;">Reçu le ${new Date().toLocaleString('fr-FR')}</p>
    </div>
    <div style="padding:24px 36px;">
      <p style="color:#6B7280;font-size:14px;margin:0 0 20px;">Un client vient de soumettre son formulaire de configuration. Voici ses informations :</p>
      <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E5E7EB;border-radius:12px;overflow:hidden;border-collapse:collapse;">
        ${tableRows}
      </table>
      <div style="margin-top:24px;padding:16px;background:#EFF6FF;border-radius:12px;">
        <p style="margin:0;color:#1E40AF;font-size:14px;font-weight:600;">📌 Prochaine étape</p>
        <p style="margin:6px 0 0;color:#3B82F6;font-size:14px;">Contacter <strong>${escapeHtml(d.email)}</strong> pour planifier la session de configuration et mettre en place le script Vapi.</p>
      </div>
    </div>
  </div>
</body>
</html>`;

  try {
    await sendBrevoEmail({
      to:      process.env.OWNER_EMAIL || 'ferykdp2004@gmail.com',
      subject: `🎯 Nouveau client onboarding — ${d.entreprise || d.email}`,
      html,
    });
    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[Onboarding] Erreur email :', err.message);
    res.status(500).json({ error: err.message });
  }
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
    const result = await sendBrevoEmail({
      to:      email,
      subject: '🎉 Bienvenue chez ReceptIA — voici vos accès',
      html:    emailHtml,
    });
    console.log(`[Email] Envoyé à ${email} :`, result.messageId);
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

// ─── Retell Web Call — Agence des Jardins ──────────────────────────────────
app.options('/retell/web-call', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.sendStatus(204);
});

app.post('/retell/web-call', async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  try {
    const apiKey   = process.env.RETELL_API_KEY;
    const agentId  = process.env.RETELL_AGENT_ID;
    if (!apiKey || !agentId) return res.status(500).json({ error: 'Retell config manquante' });

    const retellRes = await fetch('https://api.retellai.com/v2/create-web-call', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ agent_id: agentId }),
    });

    if (!retellRes.ok) {
      const err = await retellRes.text();
      console.error('[Retell] web-call error:', err);
      return res.status(502).json({ error: 'Retell API error', detail: err });
    }

    const data = await retellRes.json();
    res.json({ access_token: data.access_token, call_id: data.call_id });
  } catch (err) {
    console.error('[Retell] web-call exception:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── Retell Webhook — Agence des Jardins (call_ended) ──────────────────────
app.post('/retell/webhook', express.json(), async (req, res) => {
  res.sendStatus(200); // répondre immédiatement à Retell
  try {
    const event = req.body.event;
    const call  = req.body.call || req.body.data || {};
    if (event !== 'call_ended') return;

    const fromNumber  = call.from_number  || call.from || '';
    const transcript  = call.transcript   || '';
    const analysis    = call.call_analysis || {};
    const summary     = analysis.call_summary || 'Résumé non disponible';
    const sentiment   = analysis.user_sentiment || 'inconnu';
    const duration    = call.end_timestamp && call.start_timestamp
      ? Math.round((call.end_timestamp - call.start_timestamp) / 1000) + 's'
      : '';

    const fullText = (summary + ' ' + transcript).toLowerCase();

    // ── Détection du type de besoin ──────────────────────────────────────
    const isVisite     = /visite|visiter|voir le bien|voir l.appart|voir la maison/i.test(fullText);
    const isEstimation = /estimat|valeur|prix de (mon|ma|notre)|combien vaut|évaluat/i.test(fullText);
    const isVente      = /vendre|mise en vente|mandat de vente|vente de (mon|ma|notre)/i.test(fullText);
    const isLocation   = /louer|location|trouver un logement|cherche un appart|cherche une maison/i.test(fullText);
    const hasRDV       = /rendez-vous|rdv|convenu|confirm|planifi|fix[eé] le|prévu le/i.test(fullText);

    const dateMatch = (summary + ' ' + transcript).match(/\b(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche|\d{1,2}[\/\-]\d{1,2}(?:[\/\-]\d{2,4})?)\b.*?\b(\d{1,2}h\d{0,2}|\d{1,2}:\d{2})/i);
    const rdvDateTime = dateMatch ? `${dateMatch[1]} à ${dateMatch[2]}` : null;

    // ── Score ──────────────────────────────────────────────────────────────
    let score = 'FROID';
    if (hasRDV || /urgent|imm[eé]diat|sign/i.test(fullText)) score = 'CHAUD';
    else if (/ti[eè]de|r[eé]flexion|mois|semaine|peut-[eê]tre/i.test(fullText)) score = 'TIÈDE';

    const ntfyTopic  = 'agence-leads';
    const scoreEmoji = score === 'CHAUD' ? '🔥' : score === 'TIÈDE' ? '🌡️' : '❄️';

    // ── Label du besoin ───────────────────────────────────────────────────
    const besoinLabel = isEstimation ? '📐 Estimation'
      : isVente       ? '🏷️ Vente'
      : isVisite      ? '🚪 Visite'
      : isLocation    ? '🔑 Location'
      : '💬 Renseignement';

    // ── Ligne RDV ─────────────────────────────────────────────────────────
    const rdvLine = hasRDV
      ? `📅 RDV${rdvDateTime ? ` : ${rdvDateTime}` : ' : confirmé (date à préciser)'}`
      : `📅 Pas de RDV pris`;

    // ── Score clair ───────────────────────────────────────────────────────
    const scoreLine = score === 'CHAUD'
      ? `${scoreEmoji} CHAUD — lead à rappeler en priorité`
      : score === 'TIÈDE'
      ? `${scoreEmoji} TIÈDE — intéressé mais pas encore décidé`
      : `${scoreEmoji} FROID — simple renseignement, pas urgent`;

    // ── 1. NTFY → patron ──────────────────────────────────────────────────
    const ntfyMsg = [
      `${scoreEmoji} Appel Agence des Jardins`,
      `📞 ${fromNumber || 'inconnu'} | ⏱ ${duration} | 😊 ${sentiment}`,
      ``,
      besoinLabel,
      rdvLine,
      scoreLine,
      ``,
      `📋 Résumé :`,
      summary,
    ].join('\n');

    await fetch(`https://ntfy.sh/${ntfyTopic}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Title': `${scoreEmoji} ${besoinLabel.replace(/^\S+\s/, '')} — ${score}${rdvDateTime ? ' | ' + rdvDateTime : ''}`,
        'Priority': score === 'CHAUD' ? 'high' : 'default',
        'Tags': 'house,phone',
      },
      body: ntfyMsg,
    }).then(r => console.log('[ntfy] Status:', r.status))
      .catch(e => console.error('[ntfy] Erreur:', e.message));

    // ── 2. SMS Brevo → client appelant ────────────────────────────────────
    // (isVisite, isEstimation, isVente, isLocation, hasRDV, rdvDateTime déjà définis plus haut)
    if (fromNumber && fromNumber !== 'unknown') {
      let smsBody;
      if (hasRDV && isVisite) {
        smsBody = `Bonjour, votre RDV de visite avec l'Agence des Jardins est bien enregistré${rdvDateTime ? ` : ${rdvDateTime}` : ''}. Notre conseiller sera présent. Pour toute question : 01 89 48 09 17`;
      } else if (hasRDV && isEstimation) {
        smsBody = `Bonjour, votre RDV d'estimation gratuite avec l'Agence des Jardins est confirmé${rdvDateTime ? ` : ${rdvDateTime}` : ''}. Nos experts se déplacent chez vous. Contact : 01 89 48 09 17`;
      } else if (hasRDV && (isVente || isLocation)) {
        const typeLabel = isVente ? 'de mise en vente' : 'pour votre projet de location';
        smsBody = `Bonjour, votre RDV ${typeLabel} avec l'Agence des Jardins est confirmé${rdvDateTime ? ` : ${rdvDateTime}` : ''}. À très bientôt ! 01 89 48 09 17`;
      } else if (isEstimation) {
        smsBody = `Bonjour, merci pour votre demande d'estimation. Un expert de l'Agence des Jardins vous contacte très prochainement pour fixer un RDV. 📞 01 89 48 09 17`;
      } else if (isVisite) {
        smsBody = `Bonjour, merci pour votre intérêt. Un conseiller de l'Agence des Jardins vous rappelle pour organiser votre visite. 📞 01 89 48 09 17`;
      } else if (isVente) {
        smsBody = `Bonjour, merci pour votre contact. Un expert de l'Agence des Jardins vous rappelle rapidement pour étudier votre projet de vente. 📞 01 89 48 09 17`;
      } else {
        smsBody = `Bonjour, merci pour votre appel à l'Agence des Jardins. Un conseiller vous recontacte très prochainement. 📞 01 89 48 09 17`;
      }

      await fetch('https://api.brevo.com/v3/transactionalSMS/sms', {
        method: 'POST',
        headers: {
          'api-key': process.env.BREVO_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sender: 'ADesJardins',
          recipient: fromNumber.startsWith('+') ? fromNumber : `+${fromNumber}`,
          content: smsBody,
          type: 'transactional',
        }),
      }).then(async r => {
        const txt = await r.text();
        console.log('[SMS Brevo] Status:', r.status, txt.slice(0, 100));
      }).catch(e => console.error('[SMS Brevo] Erreur:', e.message));
    }

    console.log(`[Retell Webhook] Appel traité : ${fromNumber} | Score: ${score} | Durée: ${duration}`);
  } catch (err) {
    console.error('[Retell Webhook] Exception:', err.message);
  }
});

// ─── Démarrage ─────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀 ReceptIA serveur démarré sur http://localhost:${PORT}`);
  console.log(`   Stripe webhook endpoint : POST /webhook`);
  console.log(`   Checkout endpoint       : POST /create-checkout-session\n`);
});
