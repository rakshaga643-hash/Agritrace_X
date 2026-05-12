const mongoose = require('mongoose');

const connectDB = async () => {
  let uri = process.env.MONGODB_URI;

  // Check if URI is still a placeholder
  const isPlaceholder = !uri || uri.includes('xxxxx') || uri.includes('<username>');

  if (isPlaceholder) {
    // Auto-start in-memory MongoDB — no installation required
    console.log('⚡ No MongoDB URI found — starting in-memory database...');
    const { MongoMemoryServer } = require('mongodb-memory-server');
    const mongod = await MongoMemoryServer.create();
    uri = mongod.getUri();
    console.log('✅ In-memory MongoDB started (data resets on restart)');
    // Store reference to stop it gracefully
    process.mongodInstance = mongod;
  }

  try {
    const conn = await mongoose.connect(uri);
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.log(`⚠️  External MongoDB failed — falling back to in-memory database...`);
    try {
      const { MongoMemoryServer } = require('mongodb-memory-server');
      const mongod = await MongoMemoryServer.create();
      await mongoose.connect(mongod.getUri());
      process.mongodInstance = mongod;
      console.log('✅ In-memory MongoDB started (data resets on restart)');
    } catch (fallbackErr) {
      console.error('❌ Database Error:', fallbackErr.message);
      process.exit(1);
    }
  }
};

module.exports = connectDB;
