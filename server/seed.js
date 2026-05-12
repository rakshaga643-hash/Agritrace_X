require('dotenv').config();
const mongoose = require('mongoose');

// Auto-use in-memory MongoDB if no real URI configured
async function getUri() {
  const uri = process.env.MONGODB_URI || '';
  if (uri && !uri.includes('xxxxx') && !uri.includes('<username>')) return uri;
  const { MongoMemoryServer } = require('mongodb-memory-server');
  const mongod = await MongoMemoryServer.create();
  process.mongodInstance = mongod;
  console.log('⚡ Using in-memory MongoDB for seeding...');
  return mongod.getUri();
}
const connectDB = require('./config/db');
const User = require('./models/User');
const Farm = require('./models/Farm');
const CropRecord = require('./models/CropRecord');
const Mission = require('./models/Mission');
const InsuranceClaim = require('./models/InsuranceClaim');

const seed = async () => {
  await connectDB();
  console.log('🌱 Seeding AgriTrace X database...');

  // Clear all collections
  await Promise.all([User.deleteMany(), Farm.deleteMany(), CropRecord.deleteMany(), Mission.deleteMany(), InsuranceClaim.deleteMany()]);
  console.log('🗑️  Cleared existing data.');

  // ── Create Users ──────────────────────────────────────────────────────────
  const users = await User.create([
    { userId: 'FARMER_091A', name: 'Rajinder Singh',   password: '1234', role: 'farmer',    district: 'Ludhiana',  phone: '9876543210', email: 'rajinder@agri.in' },
    { userId: 'FARMER_092B', name: 'Gurpreet Kaur',    password: '1234', role: 'farmer',    district: 'Patiala',   phone: '9876543211', email: 'gurpreet@agri.in' },
    { userId: 'DRONE_A01',   name: 'Arjun Mehta',      password: '2345', role: 'drone',     district: 'Patiala',   phone: '9876543220' },
    { userId: 'DRONE_A02',   name: 'Manpreet Brar',    password: '2345', role: 'drone',     district: 'Amritsar',  phone: '9876543221' },
    { userId: 'ANALYST_01',  name: 'Priya Sharma',     password: '3456', role: 'analyst',   district: 'Amritsar',  phone: '9876543230' },
    { userId: 'INS_AG01',    name: 'Vikram Bhatia',    password: '4567', role: 'insurance', district: 'Jalandhar', phone: '9876543240' },
    { userId: 'ADMIN_001',   name: 'Super Admin',      password: '0000', role: 'admin',     district: 'Punjab',    phone: '9876543250' },
  ]);
  console.log(`✅ Created ${users.length} users.`);

  const farmer1 = users.find(u => u.userId === 'FARMER_091A');
  const farmer2 = users.find(u => u.userId === 'FARMER_092B');
  const drone1  = users.find(u => u.userId === 'DRONE_A01');
  const ins1    = users.find(u => u.userId === 'INS_AG01');

  // ── Create Farms ──────────────────────────────────────────────────────────
  const farms = await Farm.create([
    { farmerId: farmer1._id, surveyNo: 'PB-LDH-091A', khasraNo: 'KH-4421', village: 'Raikot',    tehsil: 'Ludhiana West', district: 'Ludhiana', totalArea: 4.5, cultivatedArea: 4.2, ownershipType: 'Owner',      coordinates: { lat: 30.9009, lng: 75.8572 }, geoPolygon: [{ lat:30.905, lng:75.852 },{ lat:30.910, lng:75.854 },{ lat:30.909, lng:75.859 },{ lat:30.904, lng:75.858 }] },
    { farmerId: farmer2._id, surveyNo: 'PB-PTL-092B', khasraNo: 'KH-1192', village: 'Nabha',     tehsil: 'Patiala',       district: 'Patiala',  totalArea: 3.2, cultivatedArea: 3.0, ownershipType: 'Tenant',     coordinates: { lat: 30.850, lng: 75.880 } },
  ]);
  console.log(`✅ Created ${farms.length} farms.`);

  // ── Create Crop Records ───────────────────────────────────────────────────
  const crops = await CropRecord.create([
    {
      farmId: farms[0]._id, farmerId: farmer1._id,
      cropType: 'Wheat', variety: 'HD-2967', season: 'Rabi 2025-26',
      sowingDate: new Date('2025-11-15'), expectedHarvest: new Date('2026-04-10'),
      seedSource: 'Government', seedRate: 120,
      soilType: 'Loamy', soilPH: 7.2, soilN: 210, soilP: 18, soilK: 145, organicCarbon: 0.6, lastSoilTest: new Date('2025-10-20'),
      irrigationSource: 'Canal', irrigationMethod: 'Flood', irrigationFrequency: 'Every 7 days',
      currentMoisture: 65, currentNDVI: 0.82, currentTemp: 28.4, currentHumidity: 42,
      predictedYield: 4.2,
      pmfbyPolicyNo: 'PMFBY-PB-2026-091', sumInsured: 124000, premiumPaid: 3100, insuranceStatus: 'Active',
      fertilizerHistory: [
        { date: new Date('2025-11-15'), name: 'DAP',  dose: 50, stage: 'Sowing' },
        { date: new Date('2025-12-10'), name: 'Urea', dose: 65, stage: 'Tillering' },
        { date: new Date('2026-01-15'), name: 'MOP',  dose: 30, stage: 'Jointing' },
        { date: new Date('2026-02-20'), name: 'Urea', dose: 35, stage: 'Grain Fill' },
      ],
      irrigationLogs: [
        { date: new Date('2026-05-10'), method: 'Flood', waterUsed: 320, moisture: 65 },
        { date: new Date('2026-05-03'), method: 'Flood', waterUsed: 310, moisture: 62 },
      ],
    },
    {
      farmId: farms[1]._id, farmerId: farmer2._id,
      cropType: 'Cotton', variety: 'BT-1', season: 'Kharif 2026',
      sowingDate: new Date('2026-05-01'), expectedHarvest: new Date('2026-11-15'),
      currentMoisture: 38, currentNDVI: 0.54, currentTemp: 32, currentHumidity: 55,
      predictedYield: 2.1,
    },
  ]);
  console.log(`✅ Created ${crops.length} crop records.`);

  // ── Create Missions ───────────────────────────────────────────────────────
  const missions = await Mission.create([
    {
      missionId: 'MSN-2024-001', droneAgentId: drone1._id, droneId: 'DRN-X1',
      zone: 'Zone Alpha', district: 'Ludhiana', purpose: 'Survey', status: 'In Flight',
      waypoints: [
        { lat:30.920, lng:75.830, reached:true }, { lat:30.940, lng:75.850, reached:true },
        { lat:30.930, lng:75.880, reached:false }, { lat:30.900, lng:75.900, reached:false },
      ],
      startTime: new Date(), batteryStart: 100, areaCovered: 185,
    },
    {
      missionId: 'MSN-2024-002', droneAgentId: drone1._id, droneId: 'DRN-X2',
      zone: 'Zone Gamma', district: 'Jalandhar', purpose: 'Pesticide Spray', status: 'Completed',
      waypoints: [{ lat:30.830, lng:75.780, reached:true }, { lat:30.860, lng:75.790, reached:true }],
      startTime: new Date(Date.now() - 3600000), endTime: new Date(), flightTime: 3420, areaCovered: 150,
    },
  ]);
  console.log(`✅ Created ${missions.length} missions.`);

  // ── Create Insurance Claims ───────────────────────────────────────────────
  await InsuranceClaim.create([
    { claimId:'CLM-2024-0091', farmerId:farmer1._id, cropRecordId:crops[0]._id, agentId:ins1._id, district:'Ludhiana',  cropType:'Wheat',  damagePct:78, claimedAmount:124000, status:'Pending',  fraudScore:12, disasterType:'Pest' },
    { claimId:'CLM-2024-0092', farmerId:farmer2._id, agentId:ins1._id,           district:'Patiala', cropType:'Cotton', damagePct:65, claimedAmount:87500,  status:'Flagged',  fraudScore:82, fraudReasons:['NDVI mismatch','Boundary discrepancy'], disasterType:'Flood' },
  ]);
  console.log(`✅ Created insurance claims.`);

  console.log('\n🎉 Database seeded successfully!\n');
  console.log('Login credentials:');
  console.log('  Farmer       → FARMER_091A / 1234');
  console.log('  Drone Agent  → DRONE_A01   / 2345');
  console.log('  Analyst      → ANALYST_01  / 3456');
  console.log('  Insurance    → INS_AG01    / 4567');
  console.log('  Super Admin  → ADMIN_001   / 0000');
  mongoose.disconnect();
};

seed().catch(err => { console.error('Seed error:', err); mongoose.disconnect(); });
