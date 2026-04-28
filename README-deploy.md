# ReceptIA — Guide de déploiement complet

> Suivez ces étapes dans l'ordre. Durée totale estimée : **45 à 60 minutes**.

---

## ÉTAPE 1 — Stripe : Créer les produits et les prix

1. Connectez-vous sur [dashboard.stripe.com](https://dashboard.stripe.com)
2. Dans le menu gauche, cliquez sur **Catalogue de produits** → **+ Créer un produit**
3. Créez **3 produits** avec les configurations suivantes :

| Nom du produit | Prix | Facturation | Récupérez l'ID |
|---|---|---|---|
| ReceptIA Starter | 97,00 € | Mensuelle récurrente | `price_xxx` |
| ReceptIA Pro | 297,00 € | Mensuelle récurrente | `price_xxx` |
| ReceptIA Agency | 697,00 € | Mensuelle récurrente | `price_xxx` |

4. Pour chaque produit : cliquez sur le prix créé → copiez l'**ID du prix** (format `price_xxxxxxx`)
5. Notez ces 3 IDs — ils vont dans `.env` : `STRIPE_PRICE_STARTER`, `STRIPE_PRICE_PRO`, `STRIPE_PRICE_AGENCY`

**Récupérer la clé secrète Stripe :**
- Menu gauche → **Développeurs** → **Clés API**
- Copiez la **Clé secrète** (commence par `sk_live_...` ou `sk_test_...` pour les tests)
- → Variable `.env` : `STRIPE_SECRET_KEY`

---

## ÉTAPE 2 — Stripe : Créer le webhook

1. Menu gauche → **Développeurs** → **Webhooks** → **+ Ajouter un endpoint**
2. **URL de l'endpoint** : `https://VOTRE-APP.onrender.com/webhook`
   *(vous obtenez cette URL à l'étape Render — revenez ici pour la renseigner)*
3. **Événements à écouter** — cliquez sur "Sélectionner des événements" et cochez :
   - `checkout.session.completed`
   - `customer.subscription.deleted`
4. Cliquez sur **Ajouter un endpoint**
5. Sur la page du webhook créé → section **Signing secret** → **Révéler** → copiez la valeur
6. → Variable `.env` : `STRIPE_WEBHOOK_SECRET`

---

## ÉTAPE 3 — Resend : Compte et domaine

1. Créez un compte sur [resend.com](https://resend.com)
2. Dans le tableau de bord → **Domains** → **Add Domain**
3. Entrez votre domaine (ex: `receptia.fr`) et suivez les instructions DNS
   *(ajoutez les enregistrements TXT et MX chez votre registrar — OVH, Ionos, etc.)*
4. Attendez la vérification du domaine (quelques minutes à quelques heures)
5. Menu → **API Keys** → **Create API Key** → copiez la clé
6. → Variable `.env` : `RESEND_API_KEY`
7. → Variable `.env` : `FROM_EMAIL=contact@receptia.fr` (ou l'adresse de votre domaine vérifié)

---

## ÉTAPE 4 — Vapi : Créer l'assistant vocal

1. Créez un compte sur [dashboard.vapi.ai](https://dashboard.vapi.ai)
2. Cliquez sur **Create Assistant**
3. Configurez l'assistant :
   - **Nom** : ReceptIA Demo
   - **Voice** : choisissez une voix française naturelle (ex: ElevenLabs - French Female)
   - **System Prompt** : 
     ```
     Tu es ReceptIA, la réceptionniste IA de [NOM_ENTREPRISE]. 
     Réponds toujours en français, avec un ton professionnel et chaleureux.
     Tu accueilles les appelants, prends note de leur demande et les informes des services disponibles.
     Si c'est une urgence, propose de transférer vers [NUMÉRO_URGENCE].
     ```
   - **First Message** : "Bonjour, vous êtes bien chez [NOM_ENTREPRISE], je suis ReceptIA votre assistante IA. Comment puis-je vous aider ?"
4. Sauvegardez l'assistant → copiez son **ID** (dans l'URL ou dans les paramètres)
5. → Variable `.env` : `VAPI_ASSISTANT_ID=xxxxx`
6. Menu → **Account** → **Public Key** → copiez la clé publique
7. → Variable `.env` : `VAPI_PUBLIC_KEY=xxxxx`
8. Dans `index.html`, remplacez également :
   - `VAPI_ASSISTANT_ID_HERE` par votre ID assistant
   - `VAPI_PUBLIC_KEY_HERE` par votre clé publique

---

## ÉTAPE 5 — Calendly : Créer le lien de réservation

1. Créez un compte sur [calendly.com](https://calendly.com)
2. Cliquez sur **+ Créer un type d'événement**
3. Configurez :
   - **Nom** : "Appel découverte ReceptIA (20 min)" ou "Session onboarding ReceptIA (30 min)"
   - **Durée** : 20 ou 30 minutes selon l'usage
   - **Disponibilités** : définissez vos créneaux
4. Copiez l'URL de l'événement (ex: `https://calendly.com/votre-nom/30min`)
5. → Variable `.env` : `CALENDLY_URL=https://calendly.com/votre-nom/30min`
6. Dans `index.html`, remplacez aussi `https://calendly.com/VOTRE_LIEN_ICI` par votre URL

---

## ÉTAPE 6 — Formulaire d'onboarding (Notion ou Typeform)

### Option A — Notion (gratuit)
1. Créez une page Notion avec un formulaire (ou utilisez [notion.so/forms](https://notion.so/forms))
2. Champs recommandés : Nom entreprise, secteur d'activité, script d'accueil souhaité, numéros de transfert, horaires
3. Partagez le formulaire publiquement → copiez l'URL

### Option B — Typeform (recommandé)
1. Créez un compte sur [typeform.com](https://typeform.com)
2. Créez un formulaire avec les champs ci-dessus
3. Copiez le lien de partage

4. → Variable `.env` : `ONBOARDING_FORM_URL=https://...`

---

## ÉTAPE 7 — Déployer sur Render

### 7a. Préparer le repo GitHub

```bash
# Dans le dossier receptia/
git init
git add .
git commit -m "Initial commit — ReceptIA"
```

1. Créez un repo sur [github.com](https://github.com) (privé recommandé)
2. Suivez les instructions GitHub pour pousser votre code :
```bash
git remote add origin https://github.com/VOTRE-USER/receptia.git
git branch -M main
git push -u origin main
```

### 7b. Créer le service sur Render

1. Connectez-vous sur [render.com](https://render.com)
2. Cliquez sur **New +** → **Web Service**
3. Connectez votre compte GitHub si ce n'est pas fait
4. Sélectionnez votre repo `receptia`
5. Configurez le service :
   - **Name** : `receptia`
   - **Region** : `Frankfurt (EU Central)` (le plus proche de la France)
   - **Branch** : `main`
   - **Runtime** : `Node`
   - **Build Command** : `npm install`
   - **Start Command** : `node server.js`
   - **Instance Type** : `Free` pour tester, `Starter ($7/mois)` pour la production
6. Cliquez sur **Create Web Service**
7. Attendez le déploiement (2-3 minutes) → notez l'URL générée (ex: `https://receptia.onrender.com`)

---

## ÉTAPE 8 — Ajouter les variables d'environnement sur Render

1. Sur Render, ouvrez votre service → onglet **Environment**
2. Cliquez sur **Add Environment Variable** et ajoutez **une par une** :

| Clé | Valeur |
|---|---|
| `STRIPE_SECRET_KEY` | `sk_live_...` |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` |
| `STRIPE_PRICE_STARTER` | `price_...` |
| `STRIPE_PRICE_PRO` | `price_...` |
| `STRIPE_PRICE_AGENCY` | `price_...` |
| `RESEND_API_KEY` | `re_...` |
| `FROM_EMAIL` | `contact@receptia.fr` |
| `VAPI_ASSISTANT_ID` | `xxxxx` |
| `VAPI_PUBLIC_KEY` | `xxxxx` |
| `CALENDLY_URL` | `https://calendly.com/...` |
| `ONBOARDING_FORM_URL` | `https://...` |
| `NODE_ENV` | `production` |

3. Cliquez sur **Save Changes** → Render redémarre automatiquement le service

---

## ÉTAPE 9 — Mettre à jour le webhook Stripe avec l'URL Render

1. Retournez sur [dashboard.stripe.com](https://dashboard.stripe.com) → **Développeurs** → **Webhooks**
2. Modifiez l'endpoint créé à l'étape 2
3. Remplacez l'URL par : `https://receptia.onrender.com/webhook`
4. Sauvegardez

---

## ÉTAPE 10 — Test end-to-end complet

### Test 1 — Landing page
- [ ] Ouvrez `https://receptia.onrender.com`
- [ ] Vérifiez que la page s'affiche correctement
- [ ] Cliquez sur "Réserver un appel" → le popup Calendly s'ouvre
- [ ] Faites défiler vers la section démo → le bouton Vapi est visible

### Test 2 — Démo vocale Vapi
- [ ] Cliquez sur "📞 Lancer la démo vocale"
- [ ] Autorisez l'accès au microphone
- [ ] Parlez à l'assistant → il doit répondre en français

### Test 3 — Tunnel de paiement Stripe
- [ ] Cliquez sur "Choisir Starter" dans la section pricing
- [ ] Entrez un email valide
- [ ] Vous êtes redirigé vers Stripe Checkout
- [ ] Utilisez la carte de test Stripe : `4242 4242 4242 4242` / exp: `12/28` / CVC: `123`
- [ ] Après paiement → vous arrivez sur `/success`

### Test 4 — Webhook et email
- [ ] Après le paiement test, vérifiez les logs Render (onglet **Logs**)
- [ ] Vous devez voir : `[Webhook] Nouveau client — email@test.com — plan: starter`
- [ ] Vous devez voir : `[Email] Envoyé à email@test.com`
- [ ] Vérifiez que l'email de bienvenue est bien reçu
- [ ] Vérifiez que `clients.json` a été créé sur le serveur (via les logs ou un endpoint de debug)

### Test 5 — Page de succès
- [ ] La page `/success` affiche le bon plan
- [ ] Le bouton Calendly fonctionne sur cette page

---

## Domaine personnalisé (optionnel)

1. Sur Render → votre service → onglet **Settings** → **Custom Domains**
2. Cliquez sur **Add Custom Domain** → entrez `receptia.fr` ou `www.receptia.fr`
3. Render vous donne un enregistrement CNAME à ajouter chez votre registrar
4. Ajoutez l'enregistrement DNS → attendez la propagation (quelques minutes)
5. Render active automatiquement le certificat SSL (HTTPS)

---

## Récapitulatif des services utilisés

| Service | Usage | Coût |
|---|---|---|
| [Stripe](https://stripe.com) | Paiements & abonnements | 1,4% + 0,25€ par transaction |
| [Resend](https://resend.com) | Emails transactionnels | Gratuit jusqu'à 3 000 emails/mois |
| [Vapi](https://vapi.ai) | Agent vocal IA | ~0,05$/min d'appel |
| [Calendly](https://calendly.com) | Prise de RDV | Gratuit (plan Basic) |
| [Render](https://render.com) | Hébergement serveur | Gratuit (Free) ou 7$/mois (Starter) |
| GitHub | Hébergement code | Gratuit |

---

## Support

Pour toute question technique : contact@receptia.fr
