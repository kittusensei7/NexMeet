const roomUsers = {}
const socketToRoom = {}

module.exports = (io) => {
  io.on('connection', socket => {
    console.log('[SOCKET] Connected:', socket.id)

    socket.on('join-room', ({ roomId, username, isMuted, isCameraOff }) => {
      console.log(`[JOIN] ${username} → ${roomId} (muted: ${isMuted}, cameraOff: ${isCameraOff})`)

      socket.join(roomId)
      socketToRoom[socket.id] = roomId

      if (!roomUsers[roomId]) {
        roomUsers[roomId] = []
      }

      // Get existing users BEFORE adding new user
      const existingUsers = roomUsers[roomId]
        .filter(u => u.socketId !== socket.id)

      // Send existing users to new joiner
      socket.emit('all-users', existingUsers)
      console.log(`[JOIN] Sent ${existingUsers.length} existing users to ${username}`)

      // Add new user to list
      const exists = roomUsers[roomId]
        .find(u => u.socketId === socket.id)

      if (!exists) {
        roomUsers[roomId].push({
          socketId: socket.id,
          username,
          isMuted: isMuted || false,
          isCameraOff: isCameraOff || false,
          isHandRaised: false
        })
      }

      // Tell others about new user
      socket.to(roomId).emit('user-joined', {
        socketId: socket.id,
        username,
        isMuted: isMuted || false,
        isCameraOff: isCameraOff || false,
        isHandRaised: false
      })

      // Send updated list to all
      io.to(roomId).emit('room-users',
        roomUsers[roomId]
      )

      console.log(`[ROOM] ${roomId}:`,
        roomUsers[roomId].map(u => u.username))
    })

    // Signal forwarding
    socket.on('signal', ({ signal, to, from, username }) => {
      console.log(`[SIGNAL] ${username} → ${to}:`,
        signal.type || 'candidate')
      io.to(to).emit('signal', {
        signal,
        from: socket.id,
        username
      })
    })

    // Chat
    socket.on('send-message', msg => {
      const roomId = socketToRoom[socket.id]
      if (roomId) {
        socket.to(roomId).emit('receive-message', msg)
      }
    })

    // Mute
    socket.on('mute-status',
      ({ roomId, isMuted, username }) => {
        if (roomUsers[roomId]) {
          const user = roomUsers[roomId].find(u => u.socketId === socket.id)
          if (user) user.isMuted = isMuted
        }
        socket.to(roomId).emit('user-mute-status', {
          socketId: socket.id,
          isMuted,
          username
        })
      }
    )

    // Camera
    socket.on('camera-status',
      ({ roomId, isCameraOff, username }) => {
        if (roomUsers[roomId]) {
          const user = roomUsers[roomId].find(u => u.socketId === socket.id)
          if (user) user.isCameraOff = isCameraOff
        }
        socket.to(roomId).emit('user-camera-status', {
          socketId: socket.id,
          isCameraOff,
          username
        })
      }
    )

    // Screen share
    socket.on('screen-share-started',
      ({ roomId, username, socketId }) => {
        socket.to(roomId).emit('user-screen-sharing', {
          socketId: socket.id,
          username
        })
      }
    )

    socket.on('screen-share-stopped',
      ({ roomId, username }) => {
        socket.to(roomId).emit('user-stopped-sharing', {
          socketId: socket.id,
          username
        })
      }
    )

    // Hand status (raise / lower)
    socket.on('hand-status', ({ roomId, isHandRaised, username }) => {
      if (roomUsers[roomId]) {
        const user = roomUsers[roomId].find(u => u.socketId === socket.id)
        if (user) user.isHandRaised = isHandRaised
      }
      socket.to(roomId).emit('user-hand-status', {
        socketId: socket.id,
        isHandRaised,
        username
      })
    })

    // Legacy raise hand
    socket.on('raise-hand', ({ roomId, username }) => {
      if (roomUsers[roomId]) {
        const user = roomUsers[roomId].find(u => u.socketId === socket.id)
        if (user) user.isHandRaised = true
      }
      io.to(roomId).emit('user-hand-status', {
        socketId: socket.id,
        isHandRaised: true,
        username
      })
    })

    // Reaction
    socket.on('send-reaction',
      ({ roomId, emoji, username }) => {
        socket.to(roomId).emit('receive-reaction', {
          socketId: socket.id,
          emoji,
          username
        })
      }
    )

    // Caption
    socket.on('caption-update',
      ({ roomId, socketId, username, text }) => {
        socket.to(roomId).emit('receive-caption', {
          socketId: socket.id,
          username,
          text
        })
      }
    )

    // End meeting (host)
    socket.on('end-meeting', ({ roomId, username }) => {
      io.to(roomId).emit('meeting-ended', {
        by: username
      })
      if (roomUsers[roomId]) {
        delete roomUsers[roomId]
      }
    })

    // Explicit leave
    socket.on('leave-room', ({ roomId, username }) => {
      console.log(`[LEAVE] ${username} ← ${roomId}`)
      handleLeave(socket, roomId, username, io)
    })

    // Disconnect
    socket.on('disconnect', () => {
      console.log('[SOCKET] Disconnected:', socket.id)
      const roomId = socketToRoom[socket.id]
      if (roomId) {
        const user = roomUsers[roomId]?.find(
          u => u.socketId === socket.id
        )
        handleLeave(
          socket,
          roomId,
          user?.username || 'Someone',
          io
        )
        delete socketToRoom[socket.id]
      }
    })
  })
}

function handleLeave(socket, roomId, username, io) {
  if (!roomUsers[roomId]) return

  roomUsers[roomId] = roomUsers[roomId]
    .filter(u => u.socketId !== socket.id)

  socket.leave(roomId)

  io.to(roomId).emit('user-left', {
    socketId: socket.id,
    username
  })

  io.to(roomId).emit('room-users',
    roomUsers[roomId]
  )

  console.log(`[ROOM] ${roomId} after leave:`,
    roomUsers[roomId].map(u => u.username))

  if (roomUsers[roomId].length === 0) {
    delete roomUsers[roomId]
    console.log(`[ROOM] ${roomId} deleted (empty)`)
  }
}