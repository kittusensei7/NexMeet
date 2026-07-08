const router = require('express').Router()
const { AccessToken } = require('livekit-server-sdk')
const jwt = require('jsonwebtoken')

// Middleware to verify JWT
const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1]
  if (!token) return res.status(401).json({ message: 'No token' })
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    req.user = decoded
    next()
  } catch {
    res.status(401).json({ message: 'Invalid token' })
  }
}

router.post('/token', authMiddleware, async (req, res) => {
  try {
    const { roomName, participantName } = req.body

    if (!roomName || !participantName) {
      return res.status(400).json({ 
        message: 'roomName and participantName required' 
      })
    }

    const at = new AccessToken(
      process.env.LIVEKIT_API_KEY,
      process.env.LIVEKIT_API_SECRET,
      {
        identity: `${participantName}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        name: participantName, // This shows in UI
        ttl: '2h'
      }
    )

    at.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true
    })

    const token = await at.toJwt()

    res.json({ 
      token,
      url: process.env.LIVEKIT_URL
    })
  } catch (err) {
    console.error('LiveKit token error:', err)
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
