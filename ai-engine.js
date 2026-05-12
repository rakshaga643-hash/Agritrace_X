/**
 * AgriTrace X — AI Intelligence Engine
 * Shared module for all role dashboards
 */

const AgriAI = (() => {

  // ── Simulated sensor / field state ──────────────────────────────────────
  const state = {
    moisture: 65, temp: 28.4, humidity: 42, ndvi: 0.82,
    soilN: 210, soilP: 18, soilK: 145, soilPH: 7.2,
    cropType: 'Wheat', cropStage: 'Grain Filling',
    area: 4.5, yieldTarget: 4.5, season: 'Rabi',
    lastRain: 8, forecastRain: 3, windSpeed: 14,
    pestPressure: 0.35, diseasePressure: 0.18,
    floodRisk: 0.42, droughtRisk: 0.12,
  };

  // ── Irrigation Intelligence ──────────────────────────────────────────────
  function irrigationAnalysis() {
    const { moisture, cropStage, lastRain, forecastRain } = state;
    const optimal = { min: 55, max: 75 };
    let score = 100;
    let alerts = [];
    let recommendation = '';
    let nextIrrigation = 3;
    let waterReq = 35; // mm
    let efficiency = 82;

    if (moisture < optimal.min) {
      score -= 30; alerts.push({ level: 'danger', msg: 'Soil moisture critically low. Irrigate within 24 hours.' });
      nextIrrigation = 0; waterReq = 55;
    } else if (moisture < 60) {
      score -= 15; alerts.push({ level: 'warning', msg: 'Moisture below optimal. Schedule irrigation in 2 days.' });
      nextIrrigation = 2;
    } else if (moisture > 80) {
      score -= 20; alerts.push({ level: 'info', msg: 'Over-irrigation detected. Pause irrigation for 4 days.' });
      nextIrrigation = 5; waterReq = 0; efficiency = 55;
    }
    if (forecastRain < 5) { alerts.push({ level: 'warning', msg: 'No significant rainfall forecast. Manual irrigation essential.' }); }
    if (cropStage === 'Grain Filling') { recommendation = 'Light protective irrigation (30mm) recommended. Avoid waterlogging — damages grain quality.'; }
    else { recommendation = 'Standard irrigation cycle based on crop stage and current soil moisture.'; }

    return { score, alerts, recommendation, nextIrrigation, waterReq: waterReq + 'mm', efficiency: efficiency + '%', method: 'Drip Recommended', saving: '28% water saving vs flood irrigation' };
  }

  // ── Fertilizer Intelligence ──────────────────────────────────────────────
  function fertilizerAnalysis() {
    const { soilN, soilP, soilK, soilPH, cropStage, yieldTarget } = state;
    const recs = [];
    const deficiencies = [];
    const schedule = [];

    if (soilN < 220) { deficiencies.push({ nutrient: 'Nitrogen (N)', level: soilN, status: 'Low', color: 'amber' }); recs.push({ name: 'Urea (46-0-0)', qty: '25 kg/Ha', timing: 'Within 7 days', note: 'Top-dress application. Do not apply after grain filling.' }); }
    else { deficiencies.push({ nutrient: 'Nitrogen (N)', level: soilN, status: 'Adequate', color: 'green' }); }
    if (soilP < 20) { deficiencies.push({ nutrient: 'Phosphorus (P)', level: soilP, status: 'Deficient', color: 'red' }); recs.push({ name: 'SSP (0-16-0)', qty: '30 kg/Ha', timing: 'Next season — basal dose', note: 'Apply during land preparation for next crop.' }); }
    else { deficiencies.push({ nutrient: 'Phosphorus (P)', level: soilP, status: 'Adequate', color: 'green' }); }
    if (soilK < 150) { deficiencies.push({ nutrient: 'Potassium (K)', level: soilK, status: 'Low', color: 'amber' }); recs.push({ name: 'MOP (0-0-60)', qty: '20 kg/Ha', timing: 'Within 14 days', note: 'Improves grain weight and drought resistance.' }); }
    else { deficiencies.push({ nutrient: 'Potassium (K)', level: soilK, status: 'Adequate', color: 'green' }); }
    if (soilPH > 7.5) { recs.push({ name: 'Zinc Sulphate', qty: '25 kg/Ha', timing: 'With next irrigation', note: 'Corrects alkalinity. Apply as foliar spray.' }); }

    schedule.push({ month: 'Nov 2025', done: true, item: 'DAP 50 kg/Ha (Basal)' });
    schedule.push({ month: 'Dec 2025', done: true, item: 'Urea 65 kg/Ha (Tillering)' });
    schedule.push({ month: 'Jan 2026', done: true, item: 'MOP 30 kg/Ha (Jointing)' });
    schedule.push({ month: 'Feb 2026', done: true, item: 'Urea 35 kg/Ha (Grain Fill)' });
    schedule.push({ month: 'May 2026', done: false, item: 'Urea 25 kg/Ha (Recommended)' });

    return { deficiencies, recommendations: recs, schedule };
  }

  // ── Yield Prediction ─────────────────────────────────────────────────────
  function yieldPrediction() {
    const { ndvi, moisture, soilN, pestPressure, diseasePressure, area, yieldTarget } = state;
    let predicted = yieldTarget;
    const factors = [];

    if (ndvi >= 0.8)        { predicted += 0.2; factors.push({ label: 'NDVI Score', impact: '+0.2', color: 'green' }); }
    else if (ndvi < 0.6)   { predicted -= 0.5; factors.push({ label: 'Low NDVI', impact: '-0.5', color: 'red' }); }
    if (moisture >= 55)     { factors.push({ label: 'Soil Moisture', impact: '+0.1', color: 'green' }); predicted += 0.1; }
    else                    { predicted -= 0.3; factors.push({ label: 'Moisture Deficit', impact: '-0.3', color: 'amber' }); }
    if (soilN >= 200)       { factors.push({ label: 'Nitrogen Level', impact: '+0.1', color: 'green' }); predicted += 0.1; }
    else                    { predicted -= 0.2; factors.push({ label: 'N Deficiency', impact: '-0.2', color: 'amber' }); }
    if (pestPressure > 0.3) { predicted -= 0.4; factors.push({ label: 'Pest Pressure', impact: '-0.4', color: 'red' }); }

    const confidence = Math.round(Math.min(95, 70 + ndvi * 15 + (moisture > 55 ? 10 : 0)));
    const corrective = predicted < yieldTarget ? [
      'Apply recommended Urea dose to boost grain filling.',
      'Ensure 1 protective irrigation before maturity.',
      'Apply Chlorpyriphos preventively for pest pressure.',
      'Monitor daily — trigger early harvest if disease spreads.'
    ] : [];

    return { predicted: predicted.toFixed(1), target: yieldTarget, confidence, total: (predicted * area).toFixed(1), revenue: Math.round(predicted * area * 22750), factors, corrective };
  }

  // ── Disaster Prediction ──────────────────────────────────────────────────
  function disasterPrediction() {
    const { floodRisk, droughtRisk, pestPressure, diseasePressure, forecastRain, temp, windSpeed } = state;
    const risks = [];

    risks.push({ name: 'Flood Risk', score: Math.round(floodRisk * 100), level: floodRisk > 0.6 ? 'High' : floodRisk > 0.3 ? 'Medium' : 'Low', color: floodRisk > 0.4 ? 'blue' : 'green', zone: 'Zone Theta, Ludhiana Corridor', action: 'Clear drainage channels. Pre-harvest assessment recommended for low-lying plots.' });
    risks.push({ name: 'Pest Outbreak', score: Math.round(pestPressure * 100), level: pestPressure > 0.5 ? 'High' : pestPressure > 0.3 ? 'Medium' : 'Low', color: pestPressure > 0.3 ? 'red' : 'green', zone: 'Zone Gamma — 12km NE', action: 'Spray Chlorpyriphos 50%EC on field borders. Coordinate with district pest control unit.' });
    risks.push({ name: 'Drought Risk', score: Math.round(droughtRisk * 100), level: droughtRisk > 0.5 ? 'High' : droughtRisk > 0.2 ? 'Medium' : 'Low', color: droughtRisk > 0.5 ? 'red' : 'green', zone: 'Zone Epsilon', action: 'Low current risk. Monitor moisture bi-weekly. Prepare drip fallback.' });
    risks.push({ name: 'Disease Spread', score: Math.round(diseasePressure * 100), level: diseasePressure > 0.4 ? 'High' : 'Low', color: diseasePressure > 0.3 ? 'amber' : 'green', zone: 'Zone Zeta, Amritsar', action: 'Apply Propiconazole fungicide preventively. Avoid overhead irrigation during humid periods.' });
    risks.push({ name: 'Storm / Hail', score: Math.round(windSpeed / 30 * 100), level: windSpeed > 40 ? 'High' : 'Low', color: windSpeed > 40 ? 'red' : 'green', zone: 'State-wide forecast', action: 'IMD forecast shows 14 May storm warning. Harvest mature sections early if possible.' });

    return risks;
  }

  // ── Micro-zone Analysis ──────────────────────────────────────────────────
  function microZoneAnalysis() {
    return [
      { id: 'MZ-1', name: 'North Plot', ndvi: 0.85, moisture: 68, status: 'Healthy', color: '#276749', fill: '#276749', opacity: 0.2 },
      { id: 'MZ-2', name: 'South Plot', ndvi: 0.71, moisture: 52, status: 'Water Stress', color: '#c05621', fill: '#d69e2e', opacity: 0.25 },
      { id: 'MZ-3', name: 'East Strip', ndvi: 0.62, moisture: 45, status: 'Nutrient Deficient', color: '#744210', fill: '#d69e2e', opacity: 0.2 },
      { id: 'MZ-4', name: 'West Corner', ndvi: 0.88, moisture: 70, status: 'Optimal', color: '#276749', fill: '#48bb78', opacity: 0.15 },
    ];
  }

  // ── Live Alert Feed ─────────────────────────────────────────────────────
  const liveAlerts = [
    { time: '2m ago', type: 'warning', msg: 'Soil moisture dropped to 63% — Zone Alpha' },
    { time: '8m ago', type: 'danger', msg: 'Locust movement detected NE corridor — Drone dispatched' },
    { time: '15m ago', type: 'info', msg: 'DRN-X1 completed Waypoint 3 — 52% mission progress' },
    { time: '22m ago', type: 'success', msg: 'AI Yield model updated — confidence 87%' },
    { time: '35m ago', type: 'info', msg: 'Weather sync complete — IMD data refreshed' },
    { time: '1h ago', type: 'warning', msg: 'Zone Zeta: Powdery mildew spore count elevated' },
  ];

  return { state, irrigationAnalysis, fertilizerAnalysis, yieldPrediction, disasterPrediction, microZoneAnalysis, liveAlerts };
})();
