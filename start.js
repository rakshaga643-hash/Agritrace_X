/**
 * AgriTrace X — Combined Start Script
 * Seeds the database and starts the server in one command.
 * Works with in-memory MongoDB — no external DB installation needed.
 */
process.env.PORT = '3000'; // Force port 3000 — macOS AirPlay uses 5000
require('dotenv').config();
const mongoose = require('mongoose');

async function main() {
  // ── Step 1: Start in-memory MongoDB (or connect to real one) ──────────────
  let uri = process.env.MONGODB_URI || '';
  const isPlaceholder = !uri || uri.includes('xxxxx') || uri.includes('<username>');

  if (isPlaceholder) {
    console.log('⚡ Starting in-memory MongoDB (no installation needed)...');
    const { MongoMemoryServer } = require('mongodb-memory-server');
    const mongod = await MongoMemoryServer.create();
    uri = mongod.getUri();
    process.mongodInstance = mongod;
  }

  await mongoose.connect(uri);
  console.log('✅ Database connected');

  // ── Step 2: Seed demo data ────────────────────────────────────────────────
  const bcrypt = require('bcryptjs');
  const User   = require('./server/models/User');
  const Farm   = require('./server/models/Farm');
  const CropRecord = require('./server/models/CropRecord');
  const Mission = require('./server/models/Mission');
  const InsuranceClaim = require('./server/models/InsuranceClaim');

  const userCount = await User.countDocuments();
  if (userCount === 0) {
    console.log('🌱 Seeding demo data...');

    const users = await User.create([
      { userId:'FARMER_091A', name:'Rajinder Singh', password:'1234', role:'farmer',    district:'Ludhiana'  },
      { userId:'FARMER_092B', name:'Gurpreet Kaur',  password:'1234', role:'farmer',    district:'Patiala'   },
      { userId:'DRONE_A01',   name:'Arjun Mehta',    password:'2345', role:'drone',     district:'Patiala'   },
      { userId:'DRONE_A02',   name:'Manpreet Brar',  password:'2345', role:'drone',     district:'Amritsar'  },
      { userId:'ANALYST_01',  name:'Priya Sharma',   password:'3456', role:'analyst',   district:'Amritsar'  },
      { userId:'INS_AG01',    name:'Vikram Bhatia',  password:'4567', role:'insurance', district:'Jalandhar' },
      { userId:'ADMIN_001',   name:'Super Admin',    password:'0000', role:'admin',     district:'Punjab'    },
    ]);

    const f1 = users.find(u => u.userId === 'FARMER_091A');
    const f2 = users.find(u => u.userId === 'FARMER_092B');
    const d1 = users.find(u => u.userId === 'DRONE_A01');
    const ins = users.find(u => u.userId === 'INS_AG01');

    const farms = await Farm.create([
      { farmerId:f1._id, farmName:'North Field — Raikot', surveyNo:'PB-LDH-091A', khasraNo:'KH-4421',
        ownerName:'Rajinder Singh', cropType:'Wheat', village:'Raikot', tehsil:'Ludhiana West', district:'Ludhiana',
        totalArea:4.5, cultivatedArea:4.2, ownershipType:'Owner', cropHealth:'Optimal', ndviScore:0.82, isVerified:true,
        location:{ type:'Point', coordinates:[75.8555, 30.9070] },
        boundary:{ type:'Polygon', coordinates:[[[75.852,30.905],[75.854,30.910],[75.859,30.909],[75.858,30.904],[75.852,30.905]]] },
        vertices:[{lng:75.852,lat:30.905},{lng:75.854,lat:30.910},{lng:75.859,lat:30.909},{lng:75.858,lat:30.904}] },
      { farmerId:f2._id, farmName:'South Plot — Nabha', surveyNo:'PB-PTL-092B', khasraNo:'KH-1192',
        ownerName:'Gurpreet Kaur', cropType:'Cotton', village:'Nabha', tehsil:'Patiala', district:'Patiala',
        totalArea:3.2, cultivatedArea:3.0, ownershipType:'Tenant', cropHealth:'Moderate', ndviScore:0.54, isVerified:false,
        location:{ type:'Point', coordinates:[75.875, 30.848] },
        boundary:{ type:'Polygon', coordinates:[[[75.870,30.845],[75.875,30.855],[75.885,30.852],[75.882,30.842],[75.870,30.845]]] },
        vertices:[{lng:75.870,lat:30.845},{lng:75.875,lat:30.855},{lng:75.885,lat:30.852},{lng:75.882,lat:30.842}] },
    ]);

    const crops = await CropRecord.create([
      {
        farmId:farms[0]._id, farmerId:f1._id, cropType:'Wheat', variety:'HD-2967', season:'Rabi 2025-26',
        sowingDate:new Date('2025-11-15'), expectedHarvest:new Date('2026-04-10'),
        soilType:'Loamy', soilPH:7.2, soilN:210, soilP:18, soilK:145, organicCarbon:0.6,
        irrigationSource:'Canal', irrigationMethod:'Flood',
        currentMoisture:65, currentNDVI:0.82, currentTemp:28.4, currentHumidity:42, predictedYield:4.2,
        pmfbyPolicyNo:'PMFBY-PB-2026-091', sumInsured:124000, premiumPaid:3100,
        fertilizerHistory:[
          {date:new Date('2025-11-15'),name:'DAP', dose:50,stage:'Sowing'},
          {date:new Date('2025-12-10'),name:'Urea',dose:65,stage:'Tillering'},
          {date:new Date('2026-01-15'),name:'MOP', dose:30,stage:'Jointing'},
          {date:new Date('2026-02-20'),name:'Urea',dose:35,stage:'Grain Fill'},
        ],
        irrigationLogs:[{date:new Date('2026-05-10'),method:'Flood',waterUsed:320,moisture:65}],
      },
      { farmId:farms[1]._id, farmerId:f2._id, cropType:'Cotton', variety:'BT-1', season:'Kharif 2026', sowingDate:new Date('2026-05-01'), currentMoisture:38, currentNDVI:0.54, predictedYield:2.1 },
    ]);

    await Mission.create([
      { missionId:'MSN-2024-001', droneAgentId:d1._id, droneId:'DRN-X1', zone:'Zone Alpha', district:'Ludhiana', purpose:'Survey', status:'In Flight', waypoints:[{lat:30.920,lng:75.830,reached:true},{lat:30.940,lng:75.850,reached:true},{lat:30.930,lng:75.880,reached:false}], startTime:new Date(), batteryStart:100, areaCovered:185 },
      { missionId:'MSN-2024-002', droneAgentId:d1._id, droneId:'DRN-X2', zone:'Zone Gamma', district:'Jalandhar', purpose:'Pesticide Spray', status:'Completed', waypoints:[{lat:30.830,lng:75.780,reached:true}], startTime:new Date(Date.now()-3600000), endTime:new Date(), flightTime:3420, areaCovered:150 },
    ]);

    await InsuranceClaim.create([
      { claimId:'CLM-2024-0091', farmerId:f1._id, cropRecordId:crops[0]._id, agentId:ins._id, district:'Ludhiana', cropType:'Wheat', damagePct:78, claimedAmount:124000, status:'Pending',  fraudScore:12, disasterType:'Pest'  },
      { claimId:'CLM-2024-0092', farmerId:f2._id, agentId:ins._id,           district:'Patiala', cropType:'Cotton', damagePct:65, claimedAmount:87500, status:'Flagged', fraudScore:82, fraudReasons:['NDVI mismatch'], disasterType:'Flood' },
    ]);

    console.log(`✅ Seeded: ${users.length} users, ${farms.length} farms, ${crops.length} crops, 2 missions, 2 claims`);
  } else {
    console.log(`ℹ️  Database already has data (${userCount} users) — skipping seed.`);
  }

  // ── Step 3: Start Express server ─────────────────────────────────────────
  // Override connectDB so express server uses existing connection
  process.env.SKIP_DB_CONNECT = 'true';
  require('./server/index.js');
}

main().catch(err => { console.error('❌ Startup error:', err.message); process.exit(1); });
