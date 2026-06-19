import { io } from 'socket.io-client';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:5000';

// Initialize the socket client with autoConnect set to false
const socket = io(SERVER_URL, {
  autoConnect: false,
  transports: ['websocket'] // Enforce WebSocket transport for real-time signaling efficiency
});

export default socket;
