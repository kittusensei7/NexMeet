const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Room = require('../models/Room');

// Helper to generate a Google-Meet-like room code (abc-defg-hij)
const generateMeetingCode = () => {
  const letters = 'abcdefghijklmnopqrstuvwxyz';
  const randStr = (len) =>
    Array.from({ length: len }, () => letters[Math.floor(Math.random() * letters.length)]).join('');
  return `${randStr(3)}-${randStr(4)}-${randStr(3)}`;
};

/**
 * @route   POST /api/rooms/create
 * @desc    Create a new room (Protected)
 * @access  Private
 */
router.post('/create', auth, async (req, res) => {
  try {
    const { roomName } = req.body;

    let roomId;
    let isUnique = false;
    while (!isUnique) {
      roomId = generateMeetingCode();
      const existingRoom = await Room.findOne({ roomId });
      if (!existingRoom) isUnique = true;
    }

    const newRoom = new Room({
      roomId,
      roomName: roomName || undefined,
      hostId: req.user.id,
    });

    await newRoom.save();

    return res.status(201).json({
      roomId: newRoom.roomId,
      roomName: newRoom.roomName,
    });
  } catch (error) {
    console.error('Create Room Error:', error);
    return res.status(500).json({ message: 'Server error during room creation' });
  }
});

/**
 * @route   GET /api/rooms/validate/:roomId
 * @desc    Validate if a room exists (Public)
 * @access  Public
 */
router.get('/validate/:roomId', async (req, res) => {
  try {
    const { roomId } = req.params;

    let cleanId = roomId.toLowerCase().trim();

    // Auto-insert hyphens for 10-char unhyphenated codes
    if (cleanId.length === 10 && !cleanId.includes('-')) {
      cleanId = `${cleanId.slice(0, 3)}-${cleanId.slice(3, 7)}-${cleanId.slice(7)}`;
    }

    const room = await Room.findOne({ roomId: cleanId });

    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }

    return res.json({
      valid: true,
      roomName: room.roomName,
    });
  } catch (error) {
    console.error('Validate Room Error:', error);
    return res.status(500).json({ message: 'Server error during room validation' });
  }
});

/**
 * @route   GET /api/rooms/my-rooms
 * @desc    Get the last 5 rooms created by the logged in user (Protected)
 * @access  Private
 */
router.get('/my-rooms', auth, async (req, res) => {
  try {
    // Always fetch fresh from DB — never cached
    const rooms = await Room.find({ hostId: req.user.id })
      .sort({ createdAt: -1 })
      .limit(5);

    return res.json(rooms);
  } catch (error) {
    console.error('Get My Rooms Error:', error);
    return res.status(500).json({ message: 'Server error retrieving user rooms' });
  }
});

/**
 * @route   DELETE /api/rooms/:roomId
 * @desc    Delete a room permanently (Protected, host only)
 * @access  Private
 */
router.delete('/:roomId', auth, async (req, res) => {
  try {
    const { roomId } = req.params;

    const deleted = await Room.findOneAndDelete({
      roomId,
      hostId: req.user.id, // Only host can delete
    });

    if (!deleted) {
      return res.status(404).json({ message: 'Room not found or not authorized' });
    }

    console.log(`Room ${roomId} permanently deleted by host ${req.user.id}`);
    return res.json({ message: 'Room deleted successfully', roomId });
  } catch (error) {
    console.error('Delete Room Error:', error);
    return res.status(500).json({ message: 'Server error during room deletion' });
  }
});

module.exports = router;
