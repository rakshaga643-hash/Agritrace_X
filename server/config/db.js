/**
 * AgriTraceX — Production MongoDB Connection Manager
 * - Auto-detects Atlas vs in-memory
 * - Retry with exponential backoff
 * - Graceful disconnect handling
 */
const mongoose = require('mongoose');

const MAX_RETRIES   = 5;
const RETRY_DELAY   = 3000;   // ms, doubles each attempt

const connectDB = async (attempt = 1) => {
  let uri = process.env.MONGODB_URI;

  const isPlaceholder = !uri ||
    uri.includes('xxxxx') ||
    uri.includes('<username>') ||
    uri.includes('your_') ||
    uri === 'mongodb://localhost/agritracex';

  // ── Use MongoDB Atlas if valid URI provided ────────────────────────────────
  if (!isPlaceholder) {
    try {
      await mongoose.connect(uri, {
        serverSelectionTimeoutMS: 8000,
        socketTimeoutMS: 45000,
      });
      console.log(`✅ MongoDB Atlas Connected`);
      _attachHandlers();
      return;
    } catch (err) {
      console.warn(`⚠️  Atlas connection failed (attempt ${attempt}): ${err.message}`);
      if (attempt < MAX_RETRIES) {
        const delay = RETRY_DELAY * Math.pow(1.5, attempt - 1);
        console.log(`   Retrying in ${Math.round(delay / 1000)}s...`);
        await new Promise(r => setTimeout(r, delay));
        return connectDB(attempt + 1);
      }
      console.warn('⚠️  Max retries reached — falling back to in-memory DB');
    }
  } else {
    console.log('⚡ No MongoDB Atlas URI — starting in-memory database...');
  }

  // ── Fallback: in-memory MongoDB ────────────────────────────────────────────
  try {
    const { MongoMemoryServer } = require('mongodb-memory-server');
    const mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
    process.mongodInstance = mongod;
    console.log('✅ In-memory MongoDB started (data resets on restart)');
    console.log('   👉 For persistent data: set MONGODB_URI in .env');
    _attachHandlers();
  } catch (fallbackErr) {
    console.error('❌ Database Error:', fallbackErr.message);
    process.exit(1);
  }
};

function _attachHandlers() {
  mongoose.connection.on('disconnected', () => {
    console.warn('⚠️  MongoDB disconnected — attempting reconnect...');
    setTimeout(() => connectDB(), 5000);
  });
  mongoose.connection.on('error', err => {
    console.error('❌ MongoDB error:', err.message);
  });
  mongoose.connection.on('reconnected', () => {
    console.log('✅ MongoDB reconnected');
  });
}

module.exports = connectDB;
