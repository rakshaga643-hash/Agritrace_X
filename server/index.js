process.env.PORT = process.env.PORT || '3000';
require('dotenv').config();
const express  = require('express');
const http     = require('http');
const { Server } = require('socket.io');
const cors     = require('cors');
const path     = require('path');
const rateLimit = require('express-rate-limit');
const connectDB = require('./config/db');

const app    = express();
const server = http.createServer(app);

// ── Socket.IO ────────────────────────────────────────────────────────────────
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET','POST'] }
});
app.io = io;  // attach so routes can broadcast

io.on('connection', socket => {
  console.log(`📡 Client connected: ${socket.id}`);

  // Drone client subscribes to its own channel
  socket.on('drone:subscribe', droneId => {
    socket.join(`drone:${droneId}`);
    console.log(`🚁 Drone ${droneId} subscribed`);
  });

  // Dashboard subscribes to all drones
  socket.on('dashboard:subscribe', () => {
    socket.join('dashboard');
    console.log(`📊 Dashboard connected: ${socket.id}`);
  });

  // Real-time telemetry push from drone client (WebSocket path)
  socket.on('telemetry:push', async (data) => {
    try {
      const Telemetry = require('./models/Telemetry');
      const packet = await Telemetry.create({ ...data, protocol: data.protocol || 'SIMULATED' });
      io.emit('telemetry:broadcast', { ...data, _id: packet._id });
    } catch (e) { console.error('Telemetry push error:', e.message); }
  });

  socket.on('disconnect', () => console.log(`📴 Client disconnected: ${socket.id}`));
});

// Connect to MongoDB (skip if already connected via start.js)
if (!process.env.SKIP_DB_CONNECT) connectDB();

// Rate limiter
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 200, message: 'Too many requests.' });
app.use(cors({ origin: '*', methods: ['GET','POST','PUT','DELETE'], allowedHeaders: ['Content-Type','Authorization'] }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/api/', limiter);

// Routes
app.use('/api/auth',      require('./routes/auth'));
app.use('/api',           require('./routes/api'));
app.use('/api/gis',       require('./routes/gis'));
app.use('/api/telemetry', require('./routes/telemetry'));
app.use('/api/images',    require('./routes/images'));
app.use('/api/ai',        require('./routes/ai'));
app.use('/api/iot',       require('./routes/iot'));

// Serve uploaded survey images
const path2 = require('path');
app.use('/uploads', express.static(path2.join(__dirname, '../uploads')));

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'OK', timestamp: new Date(), version: '2.0.0', socketio: true }));

// Static frontend
app.use(express.static(path.join(__dirname, '..')));
app.get(/^(?!\/api).*/, (req, res) => res.sendFile(path.join(__dirname, '..', 'index.html')));

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.statusCode || 500).json({ success: false, message: err.message || 'Server Error' });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`\n🚀 AgriTrace X v2 — http://localhost:${PORT}`);
  console.log(`📡 Socket.IO ready`);
  console.log(`📊 API: http://localhost:${PORT}/api`);
  console.log(`🌐 Frontend: http://localhost:${PORT}/index.html\n`);
});

module.exports = { app, server, io };
