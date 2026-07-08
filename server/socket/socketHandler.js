const roomUsers = {}
const socketToRoom = {}

module.exports = (io) => {
  io.on('connection', (socket) => {
    console.log('Connected:', socket.id)

    socket.on('join-room', ({ roomId, username }) => {
      socket.join(roomId)
      socketToRoom[socket.id] = roomId
      if (!roomUsers[roomId]) roomUsers[roomId] = []
      const exists = roomUsers[roomId]
        .find(u => u.socketId === socket.id)
      if (!exists) {
        roomUsers[roomId].push({ socketId: socket.id, username })
      }
      io.to(roomId).emit('room-users', roomUsers[roomId])
    })

    socket.on('send-message', (msg) => {
      const roomId = socketToRoom[socket.id]
      if (roomId) socket.to(roomId).emit('receive-message', msg)
    })

    socket.on('caption-update', ({ roomId, socketId, username, text }) => {
      socket.to(roomId).emit('receive-caption', {
        socketId: socket.id, username, text
      })
    })

    socket.on('raise-hand', ({ roomId, username }) => {
      io.to(roomId).emit('user-raised-hand', {
        socketId: socket.id, username
      })
    })

    socket.on('send-reaction', ({ roomId, emoji, username }) => {
      socket.to(roomId).emit('receive-reaction', {
        socketId: socket.id, emoji, username
      })
    })

    socket.on('leave-room', ({ roomId, username }) => {
      handleLeave(socket, roomId, username, io)
    })

    socket.on('disconnect', () => {
      const roomId = socketToRoom[socket.id]
      if (roomId) {
        const user = roomUsers[roomId]?.find(
          u => u.socketId === socket.id
        )
        handleLeave(socket, roomId, 
          user?.username || 'Someone', io)
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
  io.to(roomId).emit('room-users', roomUsers[roomId])
  if (roomUsers[roomId].length === 0) {
    delete roomUsers[roomId]
  }
}