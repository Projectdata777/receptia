/*!
 * SimulateurImmo Widget v1.0
 * Simulateur de crédit immobilier premium — intégrable sur tout site
 */
(function (global, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    global.SimulateurImmo = factory();
  }
}(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this, function () {
  'use strict';

  // ─── CSS ───────────────────────────────────────────────────────────────────
  const STYLES = `
    .siw-wrap * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
    .siw-wrap { --primary: #1a56db; --primary-dark: #1341a8; --purple: #7c3aed; --success: #10b981; --warning: #f59e0b; --danger: #ef4444; --gray-50: #f9fafb; --gray-100: #f3f4f6; --gray-200: #e5e7eb; --gray-300: #d1d5db; --gray-400: #9ca3af; --gray-500: #6b7280; --gray-600: #4b5563; --gray-700: #374151; --gray-800: #1f2937; --gray-900: #111827; --white: #ffffff; --radius: 16px; --shadow: 0 4px 24px rgba(0,0,0,0.08); --shadow-lg: 0 8px 40px rgba(0,0,0,0.12); }

    .siw-wrap { background: var(--white); border-radius: var(--radius); box-shadow: var(--shadow-lg); overflow: hidden; max-width: 600px; width: 100%; margin: 0 auto; position: relative; }

    /* Header */
    .siw-header { background: linear-gradient(135deg, var(--primary) 0%, var(--purple) 100%); padding: 28px 32px 0; color: white; }
    .siw-header-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
    .siw-logo { font-size: 13px; font-weight: 600; opacity: 0.8; letter-spacing: 0.5px; text-transform: uppercase; }
    .siw-close { background: rgba(255,255,255,0.2); border: none; color: white; width: 28px; height: 28px; border-radius: 50%; cursor: pointer; font-size: 16px; display: flex; align-items: center; justify-content: center; transition: background 0.2s; }
    .siw-close:hover { background: rgba(255,255,255,0.3); }
    .siw-title { font-size: 22px; font-weight: 700; margin-bottom: 4px; }
    .siw-subtitle { font-size: 13px; opacity: 0.8; margin-bottom: 20px; }

    /* Progress */
    .siw-progress-wrap { margin-bottom: 0; }
    .siw-step-labels { display: flex; justify-content: space-between; margin-bottom: 8px; }
    .siw-step-label { font-size: 10px; opacity: 0.6; font-weight: 500; transition: opacity 0.3s; }
    .siw-step-label.active { opacity: 1; }
    .siw-progress-track { height: 4px; background: rgba(255,255,255,0.25); border-radius: 2px; overflow: hidden; }
    .siw-progress-bar { height: 100%; background: white; border-radius: 2px; transition: width 0.5s cubic-bezier(0.4,0,0.2,1); }
    .siw-step-dots { display: flex; gap: 6px; justify-content: center; padding: 12px 0; }
    .siw-dot { width: 8px; height: 8px; border-radius: 50%; background: rgba(255,255,255,0.3); transition: all 0.3s; cursor: pointer; }
    .siw-dot.active { background: white; width: 24px; border-radius: 4px; }
    .siw-dot.done { background: rgba(255,255,255,0.7); }

    /* Body */
    .siw-body { padding: 28px 32px; min-height: 320px; }
    .siw-step { animation: siwFadeIn 0.35s ease; }
    @keyframes siwFadeIn { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: translateX(0); } }
    .siw-step-back { animation: siwFadeInBack 0.35s ease; }
    @keyframes siwFadeInBack { from { opacity: 0; transform: translateX(-20px); } to { opacity: 1; transform: translateX(0); } }

    .siw-step-title { font-size: 18px; font-weight: 700; color: var(--gray-900); margin-bottom: 4px; }
    .siw-step-desc { font-size: 13px; color: var(--gray-500); margin-bottom: 24px; }

    /* Fields */
    .siw-field { margin-bottom: 20px; }
    .siw-field label { display: flex; justify-content: space-between; align-items: center; font-size: 13px; font-weight: 600; color: var(--gray-700); margin-bottom: 8px; }
    .siw-field label span { font-size: 14px; font-weight: 700; color: var(--primary); }

    .siw-range { width: 100%; -webkit-appearance: none; height: 6px; border-radius: 3px; outline: none; cursor: pointer; }
    .siw-range::-webkit-slider-runnable-track { height: 6px; border-radius: 3px; background: linear-gradient(to right, var(--primary) 0%, var(--primary) var(--pct, 50%), var(--gray-200) var(--pct, 50%), var(--gray-200) 100%); }
    .siw-range::-webkit-slider-thumb { -webkit-appearance: none; width: 20px; height: 20px; border-radius: 50%; background: white; border: 3px solid var(--primary); margin-top: -7px; cursor: pointer; box-shadow: 0 2px 8px rgba(26,86,219,0.3); transition: transform 0.15s; }
    .siw-range::-webkit-slider-thumb:hover { transform: scale(1.15); }
    .siw-range::-moz-range-thumb { width: 20px; height: 20px; border-radius: 50%; background: white; border: 3px solid var(--primary); cursor: pointer; }
    .siw-range-hints { display: flex; justify-content: space-between; font-size: 11px; color: var(--gray-400); margin-top: 4px; }

    /* Duration cards */
    .siw-duration-cards { display: flex; gap: 10px; }
    .siw-duration-card { flex: 1; border: 2px solid var(--gray-200); border-radius: 12px; padding: 12px; text-align: center; cursor: pointer; transition: all 0.2s; }
    .siw-duration-card:hover { border-color: var(--primary); background: #f0f4ff; }
    .siw-duration-card.selected { border-color: var(--primary); background: linear-gradient(135deg, #f0f4ff, #f5f0ff); }
    .siw-duration-card .siw-years { font-size: 22px; font-weight: 800; color: var(--primary); }
    .siw-duration-card .siw-years-label { font-size: 11px; color: var(--gray-500); margin-top: 2px; }
    .siw-duration-card.selected .siw-years { color: var(--purple); }

    /* Results */
    .siw-result-main { background: linear-gradient(135deg, var(--primary) 0%, var(--purple) 100%); border-radius: 14px; padding: 24px; text-align: center; margin-bottom: 20px; color: white; }
    .siw-result-main-label { font-size: 12px; opacity: 0.8; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px; }
    .siw-result-main-amount { font-size: 42px; font-weight: 800; line-height: 1; }
    .siw-result-main-sub { font-size: 13px; opacity: 0.8; margin-top: 6px; }

    .siw-results-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px; }
    .siw-result-card { background: var(--gray-50); border-radius: 12px; padding: 14px; border: 1px solid var(--gray-100); }
    .siw-result-card-label { font-size: 11px; color: var(--gray-500); margin-bottom: 4px; font-weight: 500; }
    .siw-result-card-value { font-size: 16px; font-weight: 700; color: var(--gray-900); }
    .siw-result-card-value.green { color: var(--success); }
    .siw-result-card-value.orange { color: var(--warning); }
    .siw-result-card-value.red { color: var(--danger); }

    /* Debt gauge */
    .siw-gauge-wrap { background: var(--gray-50); border-radius: 14px; padding: 16px; margin-bottom: 16px; border: 1px solid var(--gray-100); }
    .siw-gauge-title { font-size: 12px; color: var(--gray-500); font-weight: 600; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 0.5px; }
    .siw-gauge-bar-track { height: 12px; background: var(--gray-200); border-radius: 6px; overflow: hidden; position: relative; }
    .siw-gauge-bar-fill { height: 100%; border-radius: 6px; transition: width 0.8s cubic-bezier(0.4,0,0.2,1); }
    .siw-gauge-bar-fill.green { background: linear-gradient(90deg, #10b981, #34d399); }
    .siw-gauge-bar-fill.orange { background: linear-gradient(90deg, #f59e0b, #fbbf24); }
    .siw-gauge-bar-fill.red { background: linear-gradient(90deg, #ef4444, #f87171); }
    .siw-gauge-limit { position: absolute; top: -2px; height: 16px; width: 2px; background: var(--gray-600); border-radius: 1px; }
    .siw-gauge-labels { display: flex; justify-content: space-between; font-size: 11px; color: var(--gray-400); margin-top: 6px; }
    .siw-gauge-pct { font-size: 20px; font-weight: 800; text-align: center; margin-top: 8px; }

    /* Scenarios */
    .siw-scenarios { display: flex; gap: 8px; margin-bottom: 16px; }
    .siw-scenario { flex: 1; border: 2px solid var(--gray-200); border-radius: 12px; padding: 12px; text-align: center; transition: all 0.2s; }
    .siw-scenario.active { border-color: var(--primary); background: #f0f4ff; }
    .siw-scenario-years { font-size: 11px; color: var(--gray-500); margin-bottom: 4px; font-weight: 600; }
    .siw-scenario-payment { font-size: 15px; font-weight: 700; color: var(--gray-900); }
    .siw-scenario-cost { font-size: 10px; color: var(--gray-400); margin-top: 2px; }

    /* Score */
    .siw-score-wrap { text-align: center; margin-bottom: 20px; }
    .siw-score-svg { display: block; margin: 0 auto; }
    .siw-score-badges { display: flex; gap: 8px; justify-content: center; flex-wrap: wrap; margin: 16px 0; }
    .siw-badge { display: inline-flex; align-items: center; gap: 6px; padding: 6px 14px; border-radius: 100px; font-size: 12px; font-weight: 600; }
    .siw-badge.green { background: #d1fae5; color: #065f46; }
    .siw-badge.orange { background: #fef3c7; color: #92400e; }
    .siw-badge.red { background: #fee2e2; color: #991b1b; }
    .siw-badge.blue { background: #dbeafe; color: #1e40af; }
    .siw-badge.purple { background: #ede9fe; color: #5b21b6; }

    .siw-tips { display: flex; flex-direction: column; gap: 8px; }
    .siw-tip { display: flex; gap: 10px; align-items: flex-start; padding: 12px; background: var(--gray-50); border-radius: 10px; border-left: 3px solid var(--primary); }
    .siw-tip-icon { font-size: 16px; flex-shrink: 0; }
    .siw-tip-text { font-size: 12px; color: var(--gray-700); line-height: 1.5; }

    /* Checklist */
    .siw-checklist { margin-bottom: 16px; }
    .siw-checklist-title { font-size: 13px; font-weight: 700; color: var(--gray-700); margin-bottom: 8px; display: flex; align-items: center; gap: 6px; cursor: pointer; }
    .siw-checklist-items { display: flex; flex-direction: column; gap: 4px; }
    .siw-check-item { display: flex; align-items: center; gap: 8px; padding: 6px 0; font-size: 12px; color: var(--gray-600); cursor: pointer; user-select: none; }
    .siw-check-item input[type=checkbox] { width: 16px; height: 16px; accent-color: var(--primary); cursor: pointer; }
    .siw-check-item.checked { color: var(--gray-400); text-decoration: line-through; }

    /* Lead form */
    .siw-lead-summary { background: linear-gradient(135deg, #f0f4ff, #f5f0ff); border-radius: 14px; padding: 16px; margin-bottom: 20px; border: 1px solid #dbeafe; }
    .siw-lead-summary-title { font-size: 12px; font-weight: 700; color: var(--primary); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; }
    .siw-lead-summary-items { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
    .siw-lead-summary-item { font-size: 12px; color: var(--gray-700); }
    .siw-lead-summary-item strong { color: var(--gray-900); }

    .siw-input-group { margin-bottom: 14px; }
    .siw-input-group label { display: block; font-size: 12px; font-weight: 600; color: var(--gray-700); margin-bottom: 6px; }
    .siw-input { width: 100%; padding: 11px 14px; border: 2px solid var(--gray-200); border-radius: 10px; font-size: 14px; color: var(--gray-900); background: white; outline: none; transition: border-color 0.2s; }
    .siw-input:focus { border-color: var(--primary); }
    .siw-input::placeholder { color: var(--gray-400); }
    .siw-input-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }

    /* Success */
    .siw-success { text-align: center; padding: 20px 0; }
    .siw-success-icon { font-size: 56px; margin-bottom: 12px; }
    .siw-success-title { font-size: 20px; font-weight: 800; color: var(--gray-900); margin-bottom: 8px; }
    .siw-success-desc { font-size: 14px; color: var(--gray-500); line-height: 1.6; margin-bottom: 20px; }
    .siw-success-details { background: var(--gray-50); border-radius: 12px; padding: 16px; text-align: left; margin-bottom: 16px; }
    .siw-success-detail { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid var(--gray-100); font-size: 13px; }
    .siw-success-detail:last-child { border-bottom: none; }
    .siw-success-detail span:first-child { color: var(--gray-500); }
    .siw-success-detail span:last-child { font-weight: 600; color: var(--gray-900); }

    /* Footer */
    .siw-footer { padding: 0 32px 24px; display: flex; gap: 10px; justify-content: flex-end; }
    .siw-btn { padding: 12px 24px; border-radius: 10px; font-size: 14px; font-weight: 600; cursor: pointer; border: none; transition: all 0.2s; display: flex; align-items: center; gap: 6px; }
    .siw-btn-back { background: var(--gray-100); color: var(--gray-600); }
    .siw-btn-back:hover { background: var(--gray-200); }
    .siw-btn-next { background: linear-gradient(135deg, var(--primary), var(--purple)); color: white; box-shadow: 0 4px 14px rgba(26,86,219,0.3); }
    .siw-btn-next:hover { transform: translateY(-1px); box-shadow: 0 6px 20px rgba(26,86,219,0.4); }
    .siw-btn-next:active { transform: translateY(0); }
    .siw-btn-next:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }
    .siw-btn-cta { width: 100%; justify-content: center; padding: 14px; font-size: 15px; background: linear-gradient(135deg, var(--primary), var(--purple)); color: white; box-shadow: 0 4px 20px rgba(26,86,219,0.35); border-radius: 12px; border: none; cursor: pointer; font-weight: 700; transition: all 0.2s; }
    .siw-btn-cta:hover { transform: translateY(-2px); box-shadow: 0 8px 30px rgba(26,86,219,0.45); }
    .siw-btn-recall { width: 100%; justify-content: center; padding: 11px; font-size: 13px; background: white; color: var(--primary); border: 2px solid var(--primary); border-radius: 12px; cursor: pointer; font-weight: 600; transition: all 0.2s; margin-top: 8px; display: flex; align-items: center; gap: 6px; }
    .siw-btn-recall:hover { background: #f0f4ff; }

    .siw-privacy { font-size: 11px; color: var(--gray-400); text-align: center; margin-top: 10px; }

    /* Modal mode */
    .siw-modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); backdrop-filter: blur(4px); z-index: 9998; display: flex; align-items: center; justify-content: center; padding: 20px; opacity: 0; transition: opacity 0.3s; pointer-events: none; }
    .siw-modal-overlay.open { opacity: 1; pointer-events: all; }
    .siw-modal-overlay .siw-wrap { max-height: 90vh; overflow-y: auto; z-index: 9999; transform: scale(0.95); transition: transform 0.3s; }
    .siw-modal-overlay.open .siw-wrap { transform: scale(1); }

    /* Drawer mode */
    .siw-drawer { position: fixed; bottom: 0; left: 0; right: 0; z-index: 9999; transform: translateY(100%); transition: transform 0.4s cubic-bezier(0.4,0,0.2,1); }
    .siw-drawer.open { transform: translateY(0); }
    .siw-drawer .siw-wrap { border-radius: 24px 24px 0 0; max-width: 100%; box-shadow: 0 -8px 40px rgba(0,0,0,0.2); max-height: 90vh; overflow-y: auto; }

    /* Floating button */
    .siw-float-btn { position: fixed; bottom: 24px; right: 24px; z-index: 9997; background: linear-gradient(135deg, var(--primary), var(--purple)); color: white; border: none; border-radius: 100px; padding: 14px 22px; font-size: 14px; font-weight: 700; cursor: pointer; box-shadow: 0 4px 20px rgba(26,86,219,0.4); display: flex; align-items: center; gap: 8px; transition: all 0.2s; }
    .siw-float-btn:hover { transform: translateY(-2px) scale(1.02); box-shadow: 0 8px 30px rgba(26,86,219,0.5); }
    .siw-float-pulse { width: 10px; height: 10px; background: #34d399; border-radius: 50%; animation: siwPulse 2s infinite; }
    @keyframes siwPulse { 0%, 100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.4); opacity: 0.7; } }

    @media (max-width: 480px) {
      .siw-header { padding: 20px 20px 0; }
      .siw-body { padding: 20px; }
      .siw-footer { padding: 0 20px 20px; }
      .siw-results-grid { grid-template-columns: 1fr; }
      .siw-input-row { grid-template-columns: 1fr; }
      .siw-title { font-size: 18px; }
      .siw-result-main-amount { font-size: 34px; }
    }
  `;

  // ─── Helpers ────────────────────────────────────────────────────────────────
  function fmt(n, decimals = 0) {
    return new Intl.NumberFormat('fr-FR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(n);
  }
  function fmtEur(n, decimals = 0) {
    return fmt(n, decimals) + ' €';
  }

  // ─── Calculations ──────────────────────────────────────────────────────────
  function calcMonthly(principal, annualRate, years) {
    if (principal <= 0) return 0;
    const r = annualRate / 100 / 12;
    const n = years * 12;
    if (r === 0) return principal / n;
    return principal * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1);
  }

  function calcBorrowingCapacity(income, existingCharges, annualRate, years) {
    const maxMonthly = income * 0.35 - existingCharges;
    if (maxMonthly <= 0) return 0;
    const r = annualRate / 100 / 12;
    const n = years * 12;
    if (r === 0) return maxMonthly * n;
    return maxMonthly * (Math.pow(1 + r, n) - 1) / (r * Math.pow(1 + r, n));
  }

  function calcDebtRatio(income, existingCharges, monthly) {
    if (income <= 0) return 0;
    return ((existingCharges + monthly) / income) * 100;
  }

  function calcBuyerScore(data) {
    const { income, charges, existingCredit, downPayment, price, annualRate, years } = data;
    const principal = Math.max(0, price - downPayment);
    const monthly = calcMonthly(principal, annualRate, years);
    const debtRatio = calcDebtRatio(income, existingCredit, monthly);
    const downPct = price > 0 ? (downPayment / price) * 100 : 0;
    const remainingToLive = income - charges - monthly - existingCredit;

    let score = 0;

    // Debt ratio (35pts)
    if (debtRatio < 25) score += 35;
    else if (debtRatio < 30) score += 28;
    else if (debtRatio < 35) score += 18;
    else score += 5;

    // Down payment (25pts)
    if (downPct >= 20) score += 25;
    else if (downPct >= 15) score += 20;
    else if (downPct >= 10) score += 14;
    else if (downPct >= 5) score += 8;
    else score += 2;

    // Remaining to live (20pts)
    if (remainingToLive >= 1500) score += 20;
    else if (remainingToLive >= 1000) score += 14;
    else if (remainingToLive >= 600) score += 7;
    else score += 0;

    // Stability (20pts)
    const chargeRatio = (charges + existingCredit) / income * 100;
    if (chargeRatio < 20) score += 20;
    else if (chargeRatio < 30) score += 15;
    else if (chargeRatio < 40) score += 8;
    else score += 0;

    return Math.min(100, Math.round(score));
  }

  function calcNegotiationScore(data) {
    const { income, existingCredit, downPayment, price, annualRate, years } = data;
    const principal = Math.max(0, price - downPayment);
    const monthly = calcMonthly(principal, annualRate, years);
    const debtRatio = calcDebtRatio(income, existingCredit, monthly);
    const downPct = price > 0 ? (downPayment / price) * 100 : 0;

    if (downPct >= 20 && debtRatio < 30) return 'Fort';
    if (downPct >= 10 || debtRatio < 35) return 'Moyen';
    return 'Faible';
  }

  function calcTiming(score) {
    if (score >= 70) return 'Maintenant';
    if (score >= 50) return '3 mois';
    return '6 mois +';
  }

  function generateTips(data, score) {
    const { income, existingCredit, downPayment, price, annualRate, years } = data;
    const principal = Math.max(0, price - downPayment);
    const monthly = calcMonthly(principal, annualRate, years);
    const debtRatio = calcDebtRatio(income, existingCredit, monthly);
    const downPct = price > 0 ? (downPayment / price) * 100 : 0;
    const tips = [];

    if (debtRatio > 35)
      tips.push({ icon: '⚠️', text: `Votre taux d'endettement est de ${fmt(debtRatio, 1)} %, au-dessus du seuil bancaire de 35 %. Réduire les crédits en cours ou augmenter l'apport améliorerait votre dossier.` });
    else if (debtRatio < 30)
      tips.push({ icon: '✅', text: `Excellent taux d'endettement de ${fmt(debtRatio, 1)} %. Votre profil est très attractif pour les banques.` });

    if (downPct < 10)
      tips.push({ icon: '💡', text: `Un apport de 10 % minimum (${fmtEur(price * 0.1)}) couvre les frais de notaire et rassure les banques. Pensez à l'épargne salariale ou au prêt familial.` });
    else if (downPct >= 20)
      tips.push({ icon: '🏆', text: `Votre apport de ${fmt(downPct, 0)} % est excellent. Vous pouvez négocier le taux à la baisse et éviter l'assurance emprunteur groupée.` });

    const notaryFees = price * (price < 150000 ? 0.08 : 0.075);
    tips.push({ icon: '📋', text: `Frais de notaire estimés : ${fmtEur(notaryFees)} (${price < 150000 ? '8' : '7,5'} % pour l'ancien). À prévoir en plus de l'apport.` });

    if (score >= 70)
      tips.push({ icon: '🚀', text: `Votre profil est solide. Faites jouer la concurrence entre 3-4 banques et n'hésitez pas à faire appel à un courtier pour négocier le meilleur taux.` });

    const safetyReserve = monthly * 3;
    tips.push({ icon: '🛡️', text: `Réserve de sécurité recommandée : ${fmtEur(safetyReserve)} (3 mensualités). Elle vous protège en cas d'imprévu sans mettre votre remboursement en danger.` });

    return tips.slice(0, 4);
  }

  // ─── SVG Circular Score ────────────────────────────────────────────────────
  function renderScoreSVG(score) {
    const r = 70, cx = 90, cy = 90;
    const circ = 2 * Math.PI * r;
    const filled = circ * score / 100;
    const color = score >= 70 ? '#10b981' : score >= 50 ? '#f59e0b' : '#ef4444';
    const label = score >= 70 ? 'Excellent' : score >= 50 ? 'Bon' : 'À améliorer';
    return `
      <svg class="siw-score-svg" width="180" height="180" viewBox="0 0 180 180">
        <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#f3f4f6" stroke-width="14"/>
        <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${color}" stroke-width="14"
          stroke-dasharray="${filled} ${circ}" stroke-dashoffset="${circ * 0.25}" stroke-linecap="round"
          style="transition: stroke-dasharray 1s cubic-bezier(0.4,0,0.2,1)"/>
        <text x="${cx}" y="${cy - 8}" text-anchor="middle" font-size="32" font-weight="800" fill="${color}">${score}</text>
        <text x="${cx}" y="${cy + 14}" text-anchor="middle" font-size="12" fill="#6b7280">/ 100</text>
        <text x="${cx}" y="${cy + 32}" text-anchor="middle" font-size="13" font-weight="600" fill="${color}">${label}</text>
      </svg>`;
  }

  // ─── Widget Class ──────────────────────────────────────────────────────────
  class SimulateurImmo {
    constructor(options = {}) {
      this.options = Object.assign({
        container: 'body',
        mode: 'inline',        // inline | modal | drawer | float
        agencyName: 'Agence des Jardins',
        primaryColor: '#1a56db',
        accentColor: '#7c3aed',
        onLeadCaptured: null,
        onHighIntentDetected: null,
        onSimulationCompleted: null,
        onRecallRequested: null,
        webhookUrl: null,
      }, options);

      this.step = 1;
      this.totalSteps = 5;
      this.direction = 'next';
      this.submitted = false;

      this.data = {
        income: 3500,
        charges: 800,
        existingCredit: 0,
        persons: 2,
        price: 200000,
        downPayment: 20000,
        years: 20,
        annualRate: 3.7,
      };

      this._injectStyles();
      this._render();
    }

    _injectStyles() {
      if (document.getElementById('siw-styles')) return;
      const style = document.createElement('style');
      style.id = 'siw-styles';
      style.textContent = STYLES;
      document.head.appendChild(style);
    }

    _getContainer() {
      if (typeof this.options.container === 'string')
        return document.querySelector(this.options.container);
      return this.options.container;
    }

    _render() {
      const mode = this.options.mode;

      if (mode === 'float') {
        this._renderFloatButton();
        return;
      }
      if (mode === 'modal') {
        this._renderModal();
        return;
      }
      if (mode === 'drawer') {
        this._renderDrawer();
        return;
      }

      // Inline
      const container = this._getContainer();
      if (!container) return;
      container.innerHTML = '';
      const wrap = this._buildWidget();
      container.appendChild(wrap);
    }

    _renderFloatButton() {
      const btn = document.createElement('button');
      btn.className = 'siw-float-btn';
      btn.innerHTML = `<span class="siw-float-pulse"></span> Simuler mon crédit`;
      btn.onclick = () => {
        btn.remove();
        this.options.mode = 'drawer';
        this._renderDrawer();
        setTimeout(() => this._drawer && this._drawer.classList.add('open'), 10);
      };
      document.body.appendChild(btn);
    }

    _renderModal() {
      const overlay = document.createElement('div');
      overlay.className = 'siw-modal-overlay';
      const widget = this._buildWidget();
      overlay.appendChild(widget);
      overlay.onclick = (e) => { if (e.target === overlay) this.close(); };
      document.body.appendChild(overlay);
      this._overlay = overlay;
      setTimeout(() => overlay.classList.add('open'), 10);
    }

    _renderDrawer() {
      const drawer = document.createElement('div');
      drawer.className = 'siw-drawer';
      const widget = this._buildWidget();
      drawer.appendChild(widget);
      document.body.appendChild(drawer);
      this._drawer = drawer;
    }

    open() {
      if (this._overlay) this._overlay.classList.add('open');
      if (this._drawer) { this._drawer.classList.add('open'); }
    }

    close() {
      if (this._overlay) this._overlay.classList.remove('open');
      if (this._drawer) this._drawer.classList.remove('open');
    }

    _buildWidget() {
      const wrap = document.createElement('div');
      wrap.className = 'siw-wrap';
      wrap.innerHTML = this._getHTML();
      this._wrap = wrap;
      this._bindEvents(wrap);
      return wrap;
    }

    _getHTML() {
      const steps = ['Profil', 'Projet', 'Résultats', 'Score', 'Contact'];
      const pct = ((this.step - 1) / (this.totalSteps - 1)) * 100;

      const dots = steps.map((s, i) => {
        const cls = i + 1 === this.step ? 'active' : i + 1 < this.step ? 'done' : '';
        return `<div class="siw-dot ${cls}" data-step="${i + 1}"></div>`;
      }).join('');

      const labels = steps.map((s, i) => {
        const cls = i + 1 === this.step ? 'active' : '';
        return `<span class="siw-step-label ${cls}">${s}</span>`;
      }).join('');

      const showBack = this.step > 1 && !this.submitted;
      const showNext = this.step < this.totalSteps && !this.submitted;
      const nextLabel = this.step === 3 ? 'Voir mon score →' : this.step === 4 ? 'Recevoir mon analyse →' : 'Continuer →';

      return `
        <div class="siw-header">
          <div class="siw-header-top">
            <span class="siw-logo">${this.options.agencyName}</span>
            <button class="siw-close" onclick="this.closest('.siw-wrap').parentElement.querySelector('.siw-modal-overlay') && this.closest('.siw-modal-overlay').classList.remove('open')">✕</button>
          </div>
          <div class="siw-title">Simulateur de crédit immobilier</div>
          <div class="siw-subtitle">Évaluez votre capacité d'achat en 2 minutes</div>
          <div class="siw-progress-wrap">
            <div class="siw-step-labels">${labels}</div>
            <div class="siw-progress-track">
              <div class="siw-progress-bar" style="width:${pct}%"></div>
            </div>
            <div class="siw-step-dots">${dots}</div>
          </div>
        </div>
        <div class="siw-body" id="siw-body">
          ${this._renderStep()}
        </div>
        <div class="siw-footer">
          ${showBack ? `<button class="siw-btn siw-btn-back" id="siw-back">← Retour</button>` : '<span></span>'}
          ${showNext ? `<button class="siw-btn siw-btn-next" id="siw-next">${nextLabel}</button>` : ''}
        </div>`;
    }

    _renderStep() {
      switch (this.step) {
        case 1: return this._step1();
        case 2: return this._step2();
        case 3: return this._step3();
        case 4: return this._step4();
        case 5: return this._step5();
        default: return '';
      }
    }

    _rangeField(id, label, min, max, step, value, unit = '€', labelExtra = '') {
      const pct = ((value - min) / (max - min)) * 100;
      return `
        <div class="siw-field">
          <label>${label}${labelExtra} <span id="${id}-val">${fmtEur(value)}</span></label>
          <input type="range" class="siw-range" id="${id}" min="${min}" max="${max}" step="${step}" value="${value}" style="--pct:${pct}%">
          <div class="siw-range-hints"><span>${unit === '€' ? fmtEur(min) : min + ' %'}</span><span>${unit === '€' ? fmtEur(max) : max + ' %'}</span></div>
        </div>`;
    }

    _step1() {
      return `
        <div class="siw-step">
          <div class="siw-step-title">Votre profil financier</div>
          <div class="siw-step-desc">Ces informations permettent d'estimer votre capacité d'emprunt.</div>
          ${this._rangeField('income', 'Revenus nets mensuels', 1000, 12000, 100, this.data.income)}
          ${this._rangeField('charges', 'Charges mensuelles (loyer, etc.)', 0, 4000, 50, this.data.charges)}
          ${this._rangeField('existingCredit', 'Crédits en cours', 0, 2000, 50, this.data.existingCredit)}
          ${this._rangeField('downPayment', 'Apport disponible', 0, 200000, 1000, this.data.downPayment)}
        </div>`;
    }

    _step2() {
      const d20 = calcMonthly(Math.max(0, this.data.price - this.data.downPayment), this.data.annualRate, 20);
      const ratePct = ((this.data.annualRate - 1) / (6 - 1)) * 100;
      return `
        <div class="siw-step">
          <div class="siw-step-title">Votre projet immobilier</div>
          <div class="siw-step-desc">Renseignez les caractéristiques du bien visé.</div>
          ${this._rangeField('price', 'Prix du bien', 50000, 900000, 5000, this.data.price)}
          <div class="siw-field">
            <label>Durée du prêt</label>
            <div class="siw-duration-cards">
              ${[15, 20, 25].map(y => `
                <div class="siw-duration-card ${this.data.years === y ? 'selected' : ''}" data-years="${y}">
                  <div class="siw-years">${y}</div>
                  <div class="siw-years-label">ans</div>
                </div>`).join('')}
            </div>
          </div>
          <div class="siw-field">
            <label>Taux d'intérêt annuel <span id="annualRate-val">${fmt(this.data.annualRate, 1)} %</span></label>
            <input type="range" class="siw-range" id="annualRate" min="1" max="6" step="0.1" value="${this.data.annualRate}" style="--pct:${ratePct}%">
            <div class="siw-range-hints"><span>1 %</span><span>Taux actuel marché ≈ 3,5-4 %</span><span>6 %</span></div>
          </div>
        </div>`;
    }

    _step3() {
      const { income, existingCredit, downPayment, price, annualRate, years } = this.data;
      const principal = Math.max(0, price - downPayment);
      const monthly = calcMonthly(principal, annualRate, years);
      const debtRatio = calcDebtRatio(income, existingCredit, monthly);
      const capacity = calcBorrowingCapacity(income, existingCredit, annualRate, years);
      const totalCost = monthly * years * 12;
      const creditCost = totalCost - principal;
      const remaining = income - this.data.charges - monthly - existingCredit;

      const debtClass = debtRatio < 30 ? 'green' : debtRatio < 35 ? 'orange' : 'red';
      const debtBarW = Math.min(100, debtRatio / 50 * 100);

      // Multi-scenario
      const scenarios = [15, 20, 25].map(y => {
        const m = calcMonthly(principal, annualRate, y);
        const c = m * y * 12 - principal;
        return { y, m, c };
      });

      if (this.options.onSimulationCompleted)
        this.options.onSimulationCompleted({ monthly, debtRatio, capacity, principal, totalCost });

      return `
        <div class="siw-step">
          <div class="siw-result-main">
            <div class="siw-result-main-label">Mensualité estimée</div>
            <div class="siw-result-main-amount">${fmtEur(monthly)}</div>
            <div class="siw-result-main-sub">sur ${years} ans · taux ${fmt(annualRate, 1)} %</div>
          </div>

          <div class="siw-gauge-wrap">
            <div class="siw-gauge-title">Taux d'endettement</div>
            <div class="siw-gauge-bar-track">
              <div class="siw-gauge-bar-fill ${debtClass}" style="width:${debtBarW}%"></div>
              <div class="siw-gauge-limit" style="left:70%"></div>
            </div>
            <div class="siw-gauge-labels"><span>0 %</span><span style="color:#374151;font-weight:700">Limite 35 %</span><span>50 %</span></div>
            <div class="siw-gauge-pct" style="color:${debtClass === 'green' ? '#10b981' : debtClass === 'orange' ? '#f59e0b' : '#ef4444'}">${fmt(debtRatio, 1)} %</div>
          </div>

          <div class="siw-results-grid">
            <div class="siw-result-card">
              <div class="siw-result-card-label">Capacité d'emprunt max</div>
              <div class="siw-result-card-value">${fmtEur(capacity)}</div>
            </div>
            <div class="siw-result-card">
              <div class="siw-result-card-label">Coût total du crédit</div>
              <div class="siw-result-card-value orange">${fmtEur(creditCost)}</div>
            </div>
            <div class="siw-result-card">
              <div class="siw-result-card-label">Reste à vivre</div>
              <div class="siw-result-card-value ${remaining >= 1000 ? 'green' : 'red'}">${fmtEur(remaining)}</div>
            </div>
            <div class="siw-result-card">
              <div class="siw-result-card-label">Montant emprunté</div>
              <div class="siw-result-card-value">${fmtEur(principal)}</div>
            </div>
          </div>

          <div style="font-size:12px;color:#6b7280;font-weight:600;margin-bottom:8px;text-transform:uppercase;letter-spacing:0.5px">Comparaison des durées</div>
          <div class="siw-scenarios">
            ${scenarios.map(s => `
              <div class="siw-scenario ${s.y === years ? 'active' : ''}">
                <div class="siw-scenario-years">${s.y} ans</div>
                <div class="siw-scenario-payment">${fmtEur(s.m)}/mois</div>
                <div class="siw-scenario-cost">Coût: ${fmtEur(s.c)}</div>
              </div>`).join('')}
          </div>
        </div>`;
    }

    _step4() {
      const score = calcBuyerScore(this.data);
      const nego = calcNegotiationScore(this.data);
      const timing = calcTiming(score);
      const tips = generateTips(this.data, score);

      const negoClass = nego === 'Fort' ? 'green' : nego === 'Moyen' ? 'orange' : 'red';
      const timingClass = timing === 'Maintenant' ? 'green' : timing === '3 mois' ? 'orange' : 'red';

      if (score >= 65 && this.options.onHighIntentDetected)
        this.options.onHighIntentDetected({ score, nego, timing, data: this.data });

      const checklist = ['Pièce d\'identité', 'Derniers bulletins de salaire (x3)', 'Avis d\'imposition (x2)', 'Relevés bancaires (x3)', 'Justificatif de domicile', 'Compromis de vente', 'Justificatif d\'apport'];

      return `
        <div class="siw-step">
          <div class="siw-step-title">Votre score acheteur</div>
          <div class="siw-step-desc">Analyse de votre profil financier pour l'achat immobilier.</div>

          <div class="siw-score-wrap">
            ${renderScoreSVG(score)}
            <div class="siw-score-badges">
              <span class="siw-badge ${negoClass}">💪 Négociation ${nego}</span>
              <span class="siw-badge ${timingClass}">⏱ Timing : ${timing}</span>
              <span class="siw-badge blue">📊 Endettement ${fmt(calcDebtRatio(this.data.income, this.data.existingCredit, calcMonthly(Math.max(0, this.data.price - this.data.downPayment), this.data.annualRate, this.data.years)), 1)} %</span>
            </div>
          </div>

          <div class="siw-tips">
            ${tips.map(t => `<div class="siw-tip"><span class="siw-tip-icon">${t.icon}</span><span class="siw-tip-text">${t.text}</span></div>`).join('')}
          </div>

          <div class="siw-checklist" style="margin-top:16px">
            <div class="siw-checklist-title">📁 Dossier de prêt — Votre checklist</div>
            <div class="siw-checklist-items">
              ${checklist.map(item => `
                <label class="siw-check-item">
                  <input type="checkbox" onchange="this.closest('.siw-check-item').classList.toggle('checked', this.checked)">
                  ${item}
                </label>`).join('')}
            </div>
          </div>
        </div>`;
    }

    _step5() {
      if (this.submitted) return this._stepSuccess();
      const { income, downPayment, price, annualRate, years } = this.data;
      const principal = Math.max(0, price - downPayment);
      const monthly = calcMonthly(principal, annualRate, years);
      const score = calcBuyerScore(this.data);

      return `
        <div class="siw-step">
          <div class="siw-step-title">Recevoir votre analyse complète</div>
          <div class="siw-step-desc">Un conseiller vous enverra votre plan personnalisé sous 24h.</div>

          <div class="siw-lead-summary">
            <div class="siw-lead-summary-title">📊 Votre simulation</div>
            <div class="siw-lead-summary-items">
              <div class="siw-lead-summary-item">Mensualité <strong>${fmtEur(monthly)}</strong></div>
              <div class="siw-lead-summary-item">Durée <strong>${years} ans</strong></div>
              <div class="siw-lead-summary-item">Apport <strong>${fmtEur(downPayment)}</strong></div>
              <div class="siw-lead-summary-item">Score <strong>${score} / 100</strong></div>
            </div>
          </div>

          <div class="siw-input-row">
            <div class="siw-input-group">
              <label>Prénom & Nom *</label>
              <input type="text" class="siw-input" id="siw-name" placeholder="Marie Dupont">
            </div>
            <div class="siw-input-group">
              <label>Téléphone *</label>
              <input type="tel" class="siw-input" id="siw-phone" placeholder="06 00 00 00 00">
            </div>
          </div>
          <div class="siw-input-group">
            <label>Email</label>
            <input type="email" class="siw-input" id="siw-email" placeholder="marie@exemple.fr">
          </div>

          <button class="siw-btn-cta" id="siw-submit">
            📩 Recevoir mon plan personnalisé
          </button>
          <button class="siw-btn-recall" id="siw-recall">
            📞 Être rappelé maintenant
          </button>
          <p class="siw-privacy">🔒 Vos données sont confidentielles et ne seront jamais revendues.</p>
        </div>`;
    }

    _stepSuccess() {
      const { price, downPayment, annualRate, years } = this.data;
      const principal = Math.max(0, price - downPayment);
      const monthly = calcMonthly(principal, annualRate, years);
      const score = calcBuyerScore(this.data);

      return `
        <div class="siw-step siw-success">
          <div class="siw-success-icon">🎉</div>
          <div class="siw-success-title">Votre analyse est en route !</div>
          <div class="siw-success-desc">Un conseiller de ${this.options.agencyName} vous contacte dans les meilleurs délais avec votre plan personnalisé.</div>
          <div class="siw-success-details">
            <div class="siw-success-detail"><span>Mensualité estimée</span><span>${fmtEur(monthly)}/mois</span></div>
            <div class="siw-success-detail"><span>Durée</span><span>${years} ans à ${fmt(annualRate, 1)} %</span></div>
            <div class="siw-success-detail"><span>Score acheteur</span><span>${score} / 100</span></div>
            <div class="siw-success-detail"><span>Prix du bien</span><span>${fmtEur(price)}</span></div>
          </div>
          <button class="siw-btn-recall" id="siw-recall-success">
            📞 Parler à un conseiller maintenant
          </button>
        </div>`;
    }

    _bindEvents(wrap) {
      // Range sliders
      wrap.querySelectorAll('.siw-range').forEach(input => {
        const updateRange = () => {
          const min = +input.min, max = +input.max, val = +input.value;
          const pct = ((val - min) / (max - min)) * 100;
          input.style.setProperty('--pct', pct + '%');
          const id = input.id;
          const valEl = wrap.querySelector('#' + id + '-val');
          if (valEl) {
            if (id === 'annualRate') valEl.textContent = fmt(val, 1) + ' %';
            else valEl.textContent = fmtEur(val);
          }
          if (id in this.data) this.data[id] = val;
        };
        input.addEventListener('input', updateRange);
        updateRange();
      });

      // Duration cards
      wrap.querySelectorAll('.siw-duration-card').forEach(card => {
        card.addEventListener('click', () => {
          wrap.querySelectorAll('.siw-duration-card').forEach(c => c.classList.remove('selected'));
          card.classList.add('selected');
          this.data.years = +card.dataset.years;
        });
      });

      // Navigation
      const nextBtn = wrap.querySelector('#siw-next');
      const backBtn = wrap.querySelector('#siw-back');
      if (nextBtn) nextBtn.addEventListener('click', () => this._goNext());
      if (backBtn) backBtn.addEventListener('click', () => this._goBack());

      // Submit
      const submitBtn = wrap.querySelector('#siw-submit');
      if (submitBtn) submitBtn.addEventListener('click', () => this._submit(wrap));

      // Recall
      const recallBtn = wrap.querySelector('#siw-recall, #siw-recall-success');
      if (recallBtn) recallBtn.addEventListener('click', () => this._recall(wrap));
    }

    _goNext() {
      if (this.step < this.totalSteps) {
        this.direction = 'next';
        this.step++;
        this._refresh();
      }
    }

    _goBack() {
      if (this.step > 1) {
        this.direction = 'back';
        this.step--;
        this._refresh();
      }
    }

    _refresh() {
      if (!this._wrap) return;
      this._wrap.innerHTML = this._getHTML();
      this._bindEvents(this._wrap);
      this._wrap.querySelector('.siw-step').classList.add(this.direction === 'back' ? 'siw-step-back' : 'siw-step');
    }

    _submit(wrap) {
      const name = wrap.querySelector('#siw-name')?.value?.trim();
      const phone = wrap.querySelector('#siw-phone')?.value?.trim();
      const email = wrap.querySelector('#siw-email')?.value?.trim();

      if (!name || !phone) {
        [wrap.querySelector('#siw-name'), wrap.querySelector('#siw-phone')].forEach(el => {
          if (el && !el.value.trim()) el.style.borderColor = '#ef4444';
        });
        return;
      }

      const score = calcBuyerScore(this.data);
      const principal = Math.max(0, this.data.price - this.data.downPayment);
      const monthly = calcMonthly(principal, this.data.annualRate, this.data.years);

      const leadData = {
        name, phone, email,
        score,
        monthly: Math.round(monthly),
        ...this.data,
        timestamp: new Date().toISOString(),
        highIntent: score >= 65,
      };

      if (this.options.onLeadCaptured) this.options.onLeadCaptured(leadData);
      if (score >= 65 && this.options.onHighIntentDetected) this.options.onHighIntentDetected(leadData);

      if (this.options.webhookUrl) {
        fetch(this.options.webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(leadData),
        }).catch(() => {});
      }

      this.submitted = true;
      this._refresh();
    }

    _recall(wrap) {
      const phone = this.options.agencyPhone || '01 89 48 09 17';
      if (this.options.onRecallRequested) {
        this.options.onRecallRequested({ data: this.data });
      } else {
        window.location.href = `tel:${phone.replace(/\s/g, '')}`;
      }
    }
  }

  // ─── Auto-init from data attributes ───────────────────────────────────────
  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-siw]').forEach(el => {
      const opts = {};
      try { Object.assign(opts, JSON.parse(el.dataset.siwOptions || '{}')); } catch (e) {}
      opts.container = el;
      new SimulateurImmo(opts);
    });
  });

  return SimulateurImmo;
}));
