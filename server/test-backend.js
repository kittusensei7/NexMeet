const axios = require('axios');
const { io } = require('socket.io-client');
const mongoose = require('mongoose');
require('dotenv').config();

const PORT = process.env.PORT || 5000;
const API_URL = `http://localhost:${PORT}`;
const SOCKET_URL = `http://localhost:${PORT}`;

// Create unique test credentials
const timestamp = Date.now();
const testUser = {
  username: `testuser_${timestamp}`,
  email: `testuser_${timestamp}@example.com`,
  password: 'testPassword123'
};

async function runTests() {
  console.log('====================================================');
  console.log('      NEXMEET INTEGRATION TESTING SUITE             ');
  console.log('====================================================');

  let token = '';
  let roomId = '';
  const roomName = 'Sprint Planning';

  try {
    // 1. REGISTER USER
    console.log('\n[TEST 1] POST /api/auth/register - Create Account');
    const registerResponse = await axios.post(`${API_URL}/api/auth/register`, testUser);
    console.log('Response status:', registerResponse.status);
    console.log('Response body:', registerResponse.data);
    
    if (registerResponse.status !== 201 || registerResponse.data.message !== 'User registered successfully') {
      throw new Error('Registration verification failed');
    }

    // 2. CHECK DUPLICATE REGISTRATION
    console.log('\n[TEST 2] POST /api/auth/register - Check Email Unique Constraint');
    try {
      await axios.post(`${API_URL}/api/auth/register`, testUser);
      throw new Error('Duplicate email registrations should have been blocked');
    } catch (err) {
      if (err.response && err.response.status === 400) {
        console.log('Success: Correctly blocked registration and returned 400 Bad Request.');
      } else {
        throw err;
      }
    }

    // 3. LOGIN USER
    console.log('\n[TEST 3] POST /api/auth/login - Obtain Session Token');
    const loginResponse = await axios.post(`${API_URL}/api/auth/login`, {
      email: testUser.email,
      password: testUser.password
    });
    console.log('Response status:', loginResponse.status);
    console.log('Response body (user info):', loginResponse.data.user);
    
    token = loginResponse.data.token;
    if (!token || !loginResponse.data.user || loginResponse.data.user.email !== testUser.email) {
      throw new Error('Login validation failed');
    }

    // 4. CREATE ROOM (PROTECTED)
    console.log('\n[TEST 4] POST /api/rooms/create - Create Meeting Room (JWT Protected)');
    const createResponse = await axios.post(
      `${API_URL}/api/rooms/create`,
      { roomName },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    console.log('Response status:', createResponse.status);
    console.log('Response body:', createResponse.data);

    roomId = createResponse.data.roomId;
    if (!roomId || roomId.length !== 12 || createResponse.data.roomName !== roomName) {
      throw new Error('Create room payload verification failed');
    }

    // 5. VALIDATE ROOM (PUBLIC)
    console.log(`\n[TEST 5] GET /api/rooms/validate/${roomId} - Room Verification (Public)`);
    const validateResponse = await axios.get(`${API_URL}/api/rooms/validate/${roomId}`);
    console.log('Response status:', validateResponse.status);
    console.log('Response body:', validateResponse.data);

    if (!validateResponse.data.valid || validateResponse.data.roomName !== roomName) {
      throw new Error('Room validation failed');
    }

    // 6. GET MY ROOMS (PROTECTED)
    console.log('\n[TEST 6] GET /api/rooms/my-rooms - Get User Room History (JWT Protected)');
    const myRoomsResponse = await axios.get(
      `${API_URL}/api/rooms/my-rooms`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    console.log('Response status:', myRoomsResponse.status);
    console.log('Response body (first entry):', myRoomsResponse.data[0]);

    if (myRoomsResponse.data.length === 0 || myRoomsResponse.data[0].roomId !== roomId) {
      throw new Error('My rooms check failed');
    }

    // 7. SOCKET.IO COMMUNICATION FLOWS
    console.log('\n[TEST 7] Initiating Socket.io Handshake and Events Verification...');
    await testSocketFlows(roomId);

    console.log('\n====================================================');
    console.log('     🎉 ALL SERVER INTEGRATION TESTS PASSED 🎉       ');
    console.log('====================================================');

  } catch (error) {
    console.error('\n❌ INTEGRATION TEST FAILED:');
    if (error.response) {
      console.error(`Status code: ${error.response.status}`);
      console.error('Data:', error.response.data);
    } else {
      console.error(error.message);
    }
  } finally {
    if (process.env.USE_MEMORY_DB === 'true') {
      console.log('\nRunning in-memory database. Cleanup skipped (database will destroy on server exit).');
      process.exit(0);
    }
    // Connect to database to delete the newly created test items
    try {
      console.log('\nCleaning up test user and meeting rooms from MongoDB...');
      await mongoose.connect(process.env.MONGO_URI);
      
      const User = require('./models/User');
      const Room = require('./models/Room');

      const user = await User.findOneAndDelete({ email: testUser.email });
      if (user) {
        await Room.deleteMany({ hostId: user._id });
        console.log('Database cleaned successfully. Test data removed.');
      }
      
      await mongoose.disconnect();
    } catch (cleanupError) {
      console.error('Error cleaning up test database:', cleanupError.message);
    }
    process.exit(0);
  }
}

function testSocketFlows(roomId) {
  return new Promise((resolve, reject) => {
    let clientA, clientB;
    let clientBJoined = false;
    let messageReceived = false;
    let muteReceived = false;
    let raiseHandReceivedA = false;
    let raiseHandReceivedB = false;
    let userLeftReceived = false;

    // Timeout after 15 seconds to avoid infinite hangs if events are missed
    const timeoutTimer = setTimeout(() => {
      if (clientA) clientA.disconnect();
      if (clientB) clientB.disconnect();
      reject(new Error('Socket.io flow verification timed out (events not received in time).'));
    }, 15000);

    const checkComplete = () => {
      if (clientBJoined && messageReceived && muteReceived && raiseHandReceivedA && raiseHandReceivedB && userLeftReceived) {
        clearTimeout(timeoutTimer);
        console.log('Socket flow verified successfully.');
        resolve();
      }
    };

    console.log('[Socket] Connecting Client A (Alice)...');
    clientA = io(SOCKET_URL, { forceNew: true, transports: ['websocket'] });

    clientA.on('connect', () => {
      console.log('[Socket] Client A (Alice) connected. Sending join-room...');
      clientA.emit('join-room', { roomId, username: 'Alice' });
    });

    clientA.on('all-users', (users) => {
      console.log('[Socket] Client A received list of all-users:', users);
    });

    clientA.on('room-users', (users) => {
      console.log('[Socket] Client A received updated room-users:', users);
    });

    clientA.on('user-joined', (data) => {
      console.log('[Socket] Client A received user-joined event:', data);
      clientBJoined = true;
      
      // Client B has joined, let Alice send a chat message
      console.log('[Socket] Client A sending a message to the room...');
      clientA.emit('send-message', { roomId, message: 'Hello everyone!', username: 'Alice', time: new Date().toLocaleTimeString() });
    });

    clientA.on('user-mute-status', (data) => {
      console.log('[Socket] Client A received mute-status update:', data);
      if (data.username === 'Bob' && data.isMuted === true && data.socketId) {
        muteReceived = true;
        checkComplete();
      }
    });

    clientA.on('user-hand-status', (data) => {
      console.log('[Socket] Client A received raise-hand update:', data);
      if (data.username === 'Bob' && data.socketId) {
        raiseHandReceivedA = true;
        
        // Once both Alice and Bob receive Bob's hand raise, Bob disconnects
        if (raiseHandReceivedA && raiseHandReceivedB) {
          console.log('[Socket] Disconnecting Client B to verify user-left workflow...');
          clientB.disconnect();
        }
      }
    });

    clientA.on('user-left', (data) => {
      console.log('[Socket] Client A received user-left notification for socket:', data.socketId);
      userLeftReceived = true;
      clientA.disconnect();
      checkComplete();
    });

    // Wait a brief moment to connect client B (Bob) so Alice is already in the room
    setTimeout(() => {
      console.log('[Socket] Connecting Client B (Bob)...');
      clientB = io(SOCKET_URL, { forceNew: true, transports: ['websocket'] });

      clientB.on('connect', () => {
        console.log('[Socket] Client B (Bob) connected. Sending join-room...');
        clientB.emit('join-room', { roomId, username: 'Bob' });
      });

      clientB.on('all-users', (users) => {
        console.log('[Socket] Client B received list of all-users:', users);
        
        // Bob is fully joined, let Bob toggle his mute-status
        setTimeout(() => {
          console.log('[Socket] Client B sending mute-status toggle...');
          clientB.emit('mute-status', { roomId, isMuted: true, username: 'Bob' });

          // Then Bob raises hand
          setTimeout(() => {
            console.log('[Socket] Client B sending raise-hand event...');
            clientB.emit('raise-hand', { roomId, username: 'Bob' });
          }, 300);
        }, 300);
      });

      clientB.on('receive-message', (data) => {
        console.log('[Socket] Client B received message:', data);
        if (data.message === 'Hello everyone!' && data.username === 'Alice' && data.time) {
          messageReceived = true;
          checkComplete();
        }
      });

      clientB.on('user-hand-status', (data) => {
        console.log('[Socket] Client B received raise-hand update:', data);
        if (data.username === 'Bob' && data.socketId) {
          raiseHandReceivedB = true;
          
          // Once both Alice and Bob receive Bob's hand raise, Bob disconnects
          if (raiseHandReceivedA && raiseHandReceivedB) {
            console.log('[Socket] Disconnecting Client B to verify user-left workflow...');
            clientB.disconnect();
          }
        }
      });
    }, 1500);
  });
}

runTests();
