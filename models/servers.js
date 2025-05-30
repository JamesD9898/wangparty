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
  }
});

const Server = mongoose.model('Server', serverSchema);

module.exports = Server;