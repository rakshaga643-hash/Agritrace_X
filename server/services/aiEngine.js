/**
 * AgriTrace X — Backend AI Intelligence Engine
 *
 * Architecture: Rule-based expert system → structured for ML model integration.
 *
 * Future integration points:
 *  - Python/TensorFlow: spawn child_process or call FastAPI microservice
 *  - ISRO Bhuvan API: real NDVI / satellite data
 *  - IMD OpenData API: real weather forecast
 *  - ICAR crop models: verified agronomic thresholds
 *
 * Each function returns a structured AIResult object:
 * { score, level, recommendation, alerts, actions, metadata }
 */

// ── Crop knowledge base ────────────────────────────────────────────────────
const CROP_KB = {
  Wheat:     { optMoisture:[55,75], optN:220, optP:20, optK:150, optPH:[6.5,7.5], baseYield:4.5, growthDays:150, waterPerHa:450 },
  Paddy:     { optMoisture:[70,85], optN:180, optP:15, optK:120, optPH:[5.5,6.5], baseYield:5.5, growthDays:130, waterPerHa:1200 },
  Cotton:    { optMoisture:[45,65], optN:160, optP:18, optK:100, optPH:[6.0,7.5], baseYield:3.0, growthDays:180, waterPerHa:700 },
  Mustard:   { optMoisture:[40,60], optN:120, optP:12, optK:80,  optPH:[6.0,7.5], baseYield:2.0, growthDays:120, waterPerHa:300 },
  Sunflower: { optMoisture:[45,65], optN:140, optP:16, optK:100, optPH:[6.0,7.5], baseYield:2.5, growthDays:100, waterPerHa:400 },
  default:   { optMoisture:[50,70], optN:180, optP:18, optK:120, optPH:[6.0,7.5], baseYield:3.5, growthDays:130, waterPerHa:500 },
};

function getCrop(type) { return CROP_KB[type] || CROP_KB.default; }

// ── Weather fetch — Open-Meteo (free, no API key required) ─────────────────
async function fetchWeather(lat, lng) {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
      `&current=temperature_2m,relative_humidity_2m,precipitation,windspeed_10m,weathercode` +
      `&daily=precipitation_sum,temperature_2m_max,temperature_2m_min` +
      `&timezone=Asia%2FKolkata&forecast_days=7`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Open-Meteo HTTP ' + res.status);
    const d = await res.json();
    const c = d.current || {};
    const daily = d.daily || {};
    const rain7d = (daily.precipitation_sum || []).reduce((s, v) => s + (v||0), 0);
    return {
      temperature:    c.temperature_2m      || 28,
      humidity:       c.relative_humidity_2m || 55,
      rainfall24h:    c.precipitation        || 0,
      forecastRain7d: parseFloat(rain7d.toFixed(1)),
      windSpeed:      c.windspeed_10m        || 12,
      maxTemp:        daily.temperature_2m_max?.[0] || c.temperature_2m || 32,
      minTemp:        daily.temperature_2m_min?.[0] || c.temperature_2m || 18,
      source:         'Open-Meteo',
    };
  } catch {
    // Fallback: deterministic simulation
    const seed = ((lat * 100 + lng * 10) % 30 + 30) % 30;
    return {
      temperature: 24 + (seed % 10), humidity: 45 + (seed % 30),
      rainfall24h: seed % 5, forecastRain7d: seed % 20,
      windSpeed: 10 + (seed % 15), source: 'SIMULATED-FALLBACK',
    };
  }
}

// ────────────────────────────────────────────────────────────────────────────
// 1. IRRIGATION ANALYSIS
// ────────────────────────────────────────────────────────────────────────────
async function irrigationAnalysis(crop) {
  const kb = getCrop(crop.cropType);
  const weather = await fetchWeather(crop.lat || 30.9, crop.lng || 75.8);
  const moisture = crop.currentMoisture || 60;
  const [minM, maxM] = kb.optMoisture;

  let score = 100, level = 'Optimal', alerts = [], nextDays = 3, waterReq = 0, efficiency = 85;

  if (moisture < minM - 10) {
    score = 30; level = 'Critical'; waterReq = kb.waterPerHa * 0.08;
    nextDays = 0; efficiency = 70;
    alerts.push({ sev:'danger', msg:`Severe moisture deficit (${moisture}%). Irrigate within 24 hours.` });
  } else if (moisture < minM) {
    score = 60; level = 'Low'; waterReq = kb.waterPerHa * 0.05;
    nextDays = 2; efficiency = 78;
    alerts.push({ sev:'warning', msg:`Moisture below optimal. Schedule irrigation in ${nextDays} days.` });
  } else if (moisture > maxM) {
    score = 55; level = 'Excess'; waterReq = 0; nextDays = 6; efficiency = 55;
    alerts.push({ sev:'info', msg:`Over-irrigation detected. Risk of root rot and N leaching.` });
  }

  if (weather.forecastRain7d > 15) {
    nextDays = Math.min(nextDays + 2, 7);
    alerts.push({ sev:'info', msg:`IMD forecast: ${weather.forecastRain7d}mm rain expected. Delay irrigation.` });
  }
  if (weather.temperature > 38) alerts.push({ sev:'warning', msg:`High temperature (${weather.temperature}°C). Irrigate early morning or evening.` });

  const method = crop.irrigationMethod || 'Flood';
  if (method === 'Flood') efficiency = Math.max(efficiency - 15, 40);
  if (method === 'Drip')  efficiency = Math.min(efficiency + 10, 95);

  return {
    module: 'irrigation', score, level,
    recommendation: score >= 80
      ? `Soil moisture optimal (${moisture}%). Maintain current schedule.`
      : level === 'Critical'
      ? `CRITICAL: Apply ${waterReq.toFixed(0)}mm water immediately to prevent crop loss.`
      : `Apply ${waterReq > 0 ? waterReq.toFixed(0)+'mm' : 'no'} water. Next irrigation in ${nextDays} days.`,
    alerts,
    actions: [
      { action: 'Next Irrigation', value: nextDays === 0 ? 'Now' : `${nextDays} days` },
      { action: 'Water Requirement', value: waterReq > 0 ? waterReq.toFixed(0)+' mm/Ha' : 'None' },
      { action: 'Efficiency Score', value: efficiency + '%' },
      { action: 'Method', value: method },
      { action: 'Weather Temp', value: weather.temperature + '°C' },
      { action: 'Rain Forecast', value: weather.forecastRain7d + 'mm / 7 days' },
    ],
    metadata: { weather, moisture, cropType: crop.cropType, optimalRange: kb.optMoisture },
  };
}

// ────────────────────────────────────────────────────────────────────────────
// 2. FERTILIZER ANALYSIS
// ────────────────────────────────────────────────────────────────────────────
function fertilizerAnalysis(crop) {
  const kb = getCrop(crop.cropType);
  const N = crop.soilN || 180, P = crop.soilP || 18, K = crop.soilK || 130, pH = crop.soilPH || 7.0;
  const nutrients = [], recs = [], alerts = [];
  let score = 100;

  // Nitrogen
  const nDef = kb.optN - N;
  if (nDef > 30)      { score -= 25; alerts.push({ sev:'warning', msg:`Nitrogen deficient (${N} kg/Ha). Crop yield at risk.` }); nutrients.push({ name:'Nitrogen (N)', status:'Low', value:N, optimal:kb.optN, color:'red' }); recs.push({ name:'Urea (46-0-0)', dose: Math.round(nDef/0.46)+' kg/Ha', timing:'Within 7 days', priority:'High' }); }
  else if (nDef > 10) { score -= 10; nutrients.push({ name:'Nitrogen (N)', status:'Marginal', value:N, optimal:kb.optN, color:'amber' }); recs.push({ name:'Urea (46-0-0)', dose:'20–25 kg/Ha', timing:'Within 14 days', priority:'Medium' }); }
  else                { nutrients.push({ name:'Nitrogen (N)', status:'Adequate', value:N, optimal:kb.optN, color:'green' }); }

  // Phosphorus
  const pDef = kb.optP - P;
  if (pDef > 5)       { score -= 15; nutrients.push({ name:'Phosphorus (P)', status:'Low', value:P, optimal:kb.optP, color:'amber' }); recs.push({ name:'SSP (0-16-0)', dose: Math.round(pDef/0.16)+' kg/Ha', timing:'Next basal application', priority:'Medium' }); }
  else                { nutrients.push({ name:'Phosphorus (P)', status:'Adequate', value:P, optimal:kb.optP, color:'green' }); }

  // Potassium
  const kDef = kb.optK - K;
  if (kDef > 20)      { score -= 10; nutrients.push({ name:'Potassium (K)', status:'Low', value:K, optimal:kb.optK, color:'amber' }); recs.push({ name:'MOP (0-0-60)', dose: Math.round(kDef/0.60)+' kg/Ha', timing:'Within 14 days', priority:'Medium' }); }
  else                { nutrients.push({ name:'Potassium (K)', status:'Adequate', value:K, optimal:kb.optK, color:'green' }); }

  // pH correction
  if (pH > kb.optPH[1])       { recs.push({ name:'Zinc Sulphate', dose:'25 kg/Ha', timing:'With irrigation', priority:'Low' }); alerts.push({ sev:'info', msg:`Soil pH ${pH} slightly alkaline. Zinc sulphate foliar spray advised.` }); }
  else if (pH < kb.optPH[0])  { recs.push({ name:'Agricultural Lime', dose:'500 kg/Ha', timing:'Before next season', priority:'Low' }); }

  return {
    module: 'fertilizer', score: Math.max(score, 0),
    level: score >= 80 ? 'Balanced' : score >= 60 ? 'Minor Deficiency' : 'Deficient',
    recommendation: recs.length === 0 ? 'Soil nutrients balanced. No fertilizer application needed currently.' : `Apply ${recs.length} fertilizer(s) as scheduled to optimise yield.`,
    alerts, nutrients, recommendations: recs,
    metadata: { N, P, K, pH, cropType: crop.cropType },
  };
}

// ────────────────────────────────────────────────────────────────────────────
// 3. YIELD PREDICTION
// ────────────────────────────────────────────────────────────────────────────
async function yieldPrediction(crop) {
  const kb = getCrop(crop.cropType);
  const weather = await fetchWeather(crop.lat || 30.9, crop.lng || 75.8);
  let predicted = kb.baseYield;
  const factors = [], corrective = [];

  // NDVI impact
  const ndvi = crop.currentNDVI || 0.70;
  if (ndvi >= 0.80)       { predicted += 0.3; factors.push({ label:'NDVI Score', impact:'+0.3 MT', color:'green' }); }
  else if (ndvi >= 0.65)  { factors.push({ label:'NDVI Score', impact:'Neutral', color:'green' }); }
  else if (ndvi >= 0.50)  { predicted -= 0.4; factors.push({ label:'Low NDVI', impact:'-0.4 MT', color:'amber' }); corrective.push('Apply foliar micronutrient spray to boost leaf area index.'); }
  else                    { predicted -= 0.9; factors.push({ label:'Critical NDVI', impact:'-0.9 MT', color:'red' }); corrective.push('Immediate crop recovery protocol required — consult field agronomist.'); }

  // Moisture
  const moisture = crop.currentMoisture || 60;
  const [minM, maxM] = getCrop(crop.cropType).optMoisture;
  if (moisture >= minM && moisture <= maxM) { predicted += 0.1; factors.push({ label:'Soil Moisture', impact:'+0.1 MT', color:'green' }); }
  else { predicted -= 0.2; factors.push({ label:'Moisture Issue', impact:'-0.2 MT', color:'amber' }); corrective.push('Optimise irrigation schedule to maintain soil moisture in target range.'); }

  // Nutrient N
  if ((crop.soilN||180) >= (getCrop(crop.cropType).optN - 10)) { predicted += 0.1; factors.push({ label:'Nitrogen Level', impact:'+0.1 MT', color:'green' }); }
  else { predicted -= 0.2; factors.push({ label:'N Deficiency', impact:'-0.2 MT', color:'amber' }); corrective.push('Apply Urea top-dressing to support grain-filling stage.'); }

  // Weather
  if (weather.temperature > 38) { predicted -= 0.3; factors.push({ label:'Heat Stress', impact:'-0.3 MT', color:'red' }); corrective.push('Install shade nets for nursery. Irrigate in early morning.'); }
  if (weather.forecastRain7d > 60) { predicted -= 0.2; factors.push({ label:'Excess Rain Risk', impact:'-0.2 MT', color:'amber' }); }

  const area = crop.totalArea || 4.5;
  const confidence = Math.min(95, Math.round(60 + ndvi * 20 + (moisture >= minM ? 10 : 0)));
  predicted = Math.max(0, predicted);
  const msp = 2275; // ₹/quintal — MSP 2025-26

  return {
    module: 'yield', score: confidence,
    level: predicted >= kb.baseYield ? 'Above Target' : predicted >= kb.baseYield * 0.8 ? 'Near Target' : 'Below Target',
    recommendation: predicted >= kb.baseYield
      ? `Yield tracking above target. Expected ${predicted.toFixed(1)} MT/Ha — good agronomic practice.`
      : `Predicted yield ${predicted.toFixed(1)} MT/Ha is below target ${kb.baseYield} MT/Ha. Apply corrective actions.`,
    factors, corrective,
    actions: [
      { action: 'Predicted Yield', value: predicted.toFixed(1)+' MT/Ha' },
      { action: 'Target Yield',    value: kb.baseYield+' MT/Ha' },
      { action: 'Total Expected',  value: (predicted*area).toFixed(1)+' MT' },
      { action: 'Revenue Est.',    value: '₹'+Math.round(predicted*area*msp*10).toLocaleString('en-IN') },
      { action: 'AI Confidence',   value: confidence+'%' },
      { action: 'Weather',         value: weather.temperature+'°C, '+weather.forecastRain7d+'mm/7d' },
    ],
    metadata: { predicted, target: kb.baseYield, area, confidence, weather, ndvi },
  };
}

// ────────────────────────────────────────────────────────────────────────────
// 4. DISASTER RISK ANALYSIS
// ────────────────────────────────────────────────────────────────────────────
async function disasterRisk(crop) {
  const weather = await fetchWeather(crop.lat || 30.9, crop.lng || 75.8);
  const risks = [];

  // Flood
  const floodScore = Math.min(100, Math.round(weather.forecastRain7d * 1.5 + (crop.currentMoisture > 75 ? 20 : 0)));
  risks.push({ name:'Flood Risk', score:floodScore, level:floodScore>60?'High':floodScore>30?'Medium':'Low', color:floodScore>60?'red':floodScore>30?'amber':'green', action: floodScore>40 ? 'Clear drainage channels. Pre-harvest assessment for low-lying plots.' : 'Low risk. Monitor drainage during monsoon approach.' });

  // Drought
  const droughtScore = Math.min(100, Math.round((70 - (crop.currentMoisture||60)) + (weather.forecastRain7d < 5 ? 20 : 0)));
  risks.push({ name:'Drought Risk', score:Math.max(droughtScore,0), level:droughtScore>50?'High':droughtScore>20?'Medium':'Low', color:droughtScore>50?'red':droughtScore>20?'amber':'green', action: droughtScore>30 ? 'Activate drip irrigation. Mulch field to retain moisture.' : 'Adequate moisture levels. Monitor weekly.' });

  // Pest
  const pestScore = Math.min(100, Math.round(40 + (weather.humidity > 65 ? 20 : 0) + (weather.temperature > 32 ? 15 : 0)));
  risks.push({ name:'Pest Outbreak', score:pestScore, level:pestScore>60?'High':pestScore>35?'Medium':'Low', color:pestScore>60?'red':pestScore>35?'amber':'green', action: pestScore>40 ? 'Apply Chlorpyriphos 50%EC on field borders. Deploy pheromone traps.' : 'Routine scouting recommended. No immediate action needed.' });

  // Disease
  const diseaseScore = Math.min(100, Math.round(30 + (weather.humidity > 70 ? 25 : 0) + ((crop.currentNDVI||0.7) < 0.55 ? 20 : 0)));
  risks.push({ name:'Disease Spread', score:diseaseScore, level:diseaseScore>55?'High':diseaseScore>30?'Medium':'Low', color:diseaseScore>55?'red':diseaseScore>30?'amber':'green', action: diseaseScore>35 ? 'Apply Propiconazole fungicide. Avoid overhead irrigation.' : 'Low disease pressure. Maintain proper canopy management.' });

  // Heatwave
  const heatScore = Math.min(100, Math.round(Math.max(0, (weather.temperature - 30) * 8)));
  risks.push({ name:'Heat / Hailstorm', score:heatScore, level:heatScore>60?'High':heatScore>30?'Medium':'Low', color:heatScore>60?'red':heatScore>30?'amber':'green', action: heatScore>40 ? 'IMD heat alert active. Irrigate at dawn. Harvest mature sections early.' : 'Temperature within safe range.' });

  const maxRisk = Math.max(...risks.map(r => r.score));
  return {
    module: 'disaster',
    score: 100 - maxRisk,
    level: maxRisk > 60 ? 'High Risk' : maxRisk > 30 ? 'Moderate' : 'Low Risk',
    recommendation: maxRisk > 60 ? 'Multiple high-risk events predicted. Immediate preventive action required.' : maxRisk > 30 ? 'Moderate risks identified. Monitor closely and apply preventive measures.' : 'Low risk environment. Continue standard field management.',
    risks,
    metadata: { weather, maxRisk },
  };
}

// ────────────────────────────────────────────────────────────────────────────
// 5. FULL AI ANALYSIS (all 4 modules combined)
// ────────────────────────────────────────────────────────────────────────────
async function fullAnalysis(cropData) {
  const [irr, fert, yld, dis] = await Promise.all([
    irrigationAnalysis(cropData),
    Promise.resolve(fertilizerAnalysis(cropData)),
    yieldPrediction(cropData),
    disasterRisk(cropData),
  ]);
  const overallScore = Math.round((irr.score + fert.score + yld.score + dis.score) / 4);
  return {
    overallScore,
    overallLevel: overallScore >= 75 ? 'Good' : overallScore >= 50 ? 'Moderate' : 'At Risk',
    generatedAt: new Date(),
    cropType: cropData.cropType,
    irrigation: irr,
    fertilizer: fert,
    yield: yld,
    disaster: dis,
  };
}

module.exports = { irrigationAnalysis, fertilizerAnalysis, yieldPrediction, disasterRisk, fullAnalysis };
