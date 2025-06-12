const mongoose = require('mongoose');

const serverSchema = new mongoose.Schema({
  id: {
    type: Number,
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true
  },
  players: {
    type: [String],
    default: []
  },
  public: {
    type: Boolean,
    default: false
  },
  maxPlayers: {
    type: Number,
    default: 5 
  },
  // Game state for this server
  gameState: {
    players: [{
      name: String,
      time: { type: Number, default: 5000 },
      score: { type: Number, default: 0 }
    }],
    playerup: { type: Number, default: 0 },
    playersanswers: { type: [String], default: [] },
    phase: { type: String, default: "waiting" },
    question: { type: String, default: "" },
    gameChat: [{
      user: String,
      message: String
    }],
    votes: { type: [Number], default: [0, 0] },
    votedUsers: { type: [String], default: [] },
    currentAnswerIndex: { type: Number, default: 0 },
    currentAnswerBeingVoted: { type: String, default: "" },
    gameTimer: { type: Number, default: 0 },
    questionAsker: { type: Number, default: 0 },
    answerGiver: { type: Number, default: 1 }
  }
}, {
  timestamps: true
});

const Server = mongoose.model('Server', serverSchema);

module.exports = Server;