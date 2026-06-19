require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const mongoose = require('mongoose');

// Import routes and socket handler
const authRoutes = require('./routes/auth');
const roomRoutes = require('./routes/rooms');
const socketHandler = require('./socket/socketHandler');

const app = express();
const server = http.createServer(app);

// Initialize Socket.io and attach to HTTP server
const io = new Server(server, {
  cors: {
    origin: 'http://localhost:5173',
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Global Middlewares
app.use(cors());
app.use(express.json());

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/rooms', roomRoutes);

// Health Check Endpoint
app.get('/', (req, res) => {
  res.send('NexMeet Backend Running');
});

// Initialize Socket Handler
socketHandler(io);

// Server Configuration and Startup
const PORT = process.env.PORT || 5000;

// Connect to MongoDB Database
const connectDatabase = async () => {
  let mongoUri = process.env.MONGO_URI;

  if (process.env.USE_MEMORY_DB === 'true') {
    try {
      const { MongoMemoryServer } = require('mongodb-memory-server');
      const mongoServer = await MongoMemoryServer.create();
      mongoUri = mongoServer.getUri();
      console.log('Using in-memory MongoDB database for testing/development.');
    } catch (err) {
      console.error('Failed to start in-memory MongoDB server:', err.message);
      process.exit(1);
    }
  }

  if (!mongoUri) {
    console.error('CRITICAL: MONGO_URI is missing in environment variables (.env).');
    process.exit(1);
  }

  mongoose
    .connect(mongoUri)
    .then(() => {
      console.log('Successfully connected to MongoDB Database.');
      // Start Server
      server.listen(PORT, () => {
        console.log(`NexMeet Server is running successfully on port ${PORT}`);
      });
    })
    .catch((error) => {
      console.error('Database connection failed. Server shutting down...', error.message);
      process.exit(1);
    });
};

connectDatabase();
