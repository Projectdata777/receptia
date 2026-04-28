/**
 * ReceptIA — Script de création automatique des produits Stripe
 * Usage : node setup-stripe.js sk_live_VOTRE_CLE  (ou sk_test_...)
 */

const fs   = require('fs');
const path = require('path');

const secretKey = process.argv[2];
if (!secretKey || (!secretKey.startsWith('sk_live_') && !secretKey.startsWith('sk_test_'))) {
  console.error('\n❌  Usage : node setup-stripe.js sk_live_VOTRE_CLE_SECRETE\n');
  process.exit(1);
}

const stripe = require('stripe')(secretKey);
const ENV_FILE = path.join(__dirname, '.env');

const PRODUCTS = [
  { name: 'ReceptIA Starter', amount: 9700,  envKey: 'STRIPE_PRICE_STARTER' },
  { name: 'ReceptIA Pro',     amount: 29700, envKey: 'STRIPE_PRICE_PRO'     },
  { name: 'ReceptIA Agency',  amount: 69700, envKey: 'STRIPE_PRICE_AGENCY'  },
];

async function run() {
  console.log('\n🚀 Création des produits Stripe ReceptIA...\n');

  const priceIds = {};

  for (const p of PRODUCTS) {
    process.stdout.write(`  📦 Création "${p.name}" (${p.amount / 100}€/mois)... `);

    const product = await stripe.products.create({ name: p.name });
    const price   = await stripe.prices.create({
      product:    product.id,
      unit_amount: p.amount,
      currency:   'eur',
      recurring:  { interval: 'month' },
    });

    priceIds[p.envKey] = price.id;
    console.log(`✅  ${price.id}`);
  }

  // Mettre à jour le .env
  let envContent = fs.existsSync(ENV_FILE) ? fs.readFileSync(ENV_FILE, 'utf-8') : '';

  // Injecter STRIPE_SECRET_KEY
  envContent = setEnvVar(envContent, 'STRIPE_SECRET_KEY', secretKey);

  // Injecter les price IDs
  for (const [key, val] of Object.entries(priceIds)) {
    envContent = setEnvVar(envContent, key, val);
  }

  fs.writeFileSync(ENV_FILE, envContent, 'utf-8');

  console.log('\n✅  .env mis à jour avec :\n');
  console.log(`   STRIPE_SECRET_KEY    = ${secretKey.substring(0, 20)}...`);
  for (const [key, val] of Object.entries(priceIds)) {
    console.log(`   ${key.padEnd(24)} = ${val}`);
  }

  console.log('\n📋  Prochaine étape : Créer le webhook Stripe');
  console.log('    1. Va sur https://dashboard.stripe.com/webhooks');
  console.log('    2. Clique "+ Ajouter un endpoint"');
  console.log('    3. URL : https://TON-APP.onrender.com/webhook');
  console.log('    4. Événements : checkout.session.completed + customer.subscription.deleted');
  console.log('    5. Copie le "Signing secret" → colle-le dans .env : STRIPE_WEBHOOK_SECRET=whsec_...\n');
}

function setEnvVar(content, key, value) {
  const regex = new RegExp(`^${key}=.*$`, 'm');
  const line  = `${key}=${value}`;
  if (regex.test(content)) return content.replace(regex, line);
  return content + (content.endsWith('\n') ? '' : '\n') + line + '\n';
}

run().catch(err => {
  console.error('\n❌  Erreur Stripe :', err.message);
  process.exit(1);
});
