const express = require('express');
const path = require('path');
const fs = require('fs');
const os = require('os');
const mongoose = require('mongoose');
const app = express();
const PORT = 3000;
const Server = require('./models/servers.js'); // adjust path as needed

//Server Information (for now)
let players = [{"name": "David", "score": 0, "time": 5000}];
let playerup = 0;
let playersanswers = [];
let phase = "Waiting";
let question = "";
let phaseBeginTime = "";
let gameChat = [];

require('dotenv').config();


// MongoDB connection
const MONGODB_URI = process.env.MONGO_CONNECTION_URL;

mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log('Connected to WANGPARTY DB successfully');
  })
  .catch((error) => {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  });
  
// middleware
app.use(express.json());

// sere static files from the "public" directory
app.use(express.static(path.join(__dirname, 'public')));

// sends index.html if the user requests the route "/"
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});
app.get('/api/servers', async (req, res) => {
    //const tempdb = readServers();
    try {
    const servers = await Server.find({});
    res.json({ servers });
  } catch (error) {
    console.error('Failed to fetch servers:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
app.get('/api/gamechat', async (req, res) => {
  res.json({ gameChat });
});
app.post('/api/gamechat', async (req, res) => {
  const { message, user } = req.body;
  gameChat.push({ message, user });
  if(gameChat.length > 7){
    gameChat.shift();
  }
  res.json({ message: 'Message added to chat' });
});
app.post('/api/servers/join', async (req, res) => {
  try {
    const { serverID, playerID } = req.body;
    
    if (!serverID || !playerID) {
      return res.status(400).json({ error: 'serverID and playerID are not found' });
    }

    const server = await Server.findOne({ id: serverID });
    if (!server) {
      return res.status(404).json({ error: 'Server not found' });
    }

    if (server.players.length >= server.maxPlayers) {
      return res.status(400).json({ error: 'Full Server' });
    }

    if (server.players.includes(playerID)) {
      return res.status(400).json({ error: 'Already in server' });
    }

    server.players.push(playerID);
    await server.save();

    res.json({ message: 'Joined server!', server });
  } catch (error) {
    console.error('Failed to join server:', error);
    res.status(500).json({ error: 'Failed to join server' });
  }
});
app.post('/api/servers/add', async (req, res) => {
  try {
    const { name, public: isPublic, maxPlayers } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Server name is not found' });
    }

    const existingServers = await Server.find({}, { id: 1 }).sort({ id: -1 }).limit(1);
    const nextId = existingServers.length > 0 ? existingServers[0].id + 1 : 1;

    const newServer = new Server({
      id: nextId,
      name,
      public: isPublic || false,
      maxPlayers: maxPlayers || 5,
      players: []
    });

    await newServer.save();
    res.status(201).json({ message: 'Server created!', server: newServer });
  } catch (error) {
    console.error('Failed to create server:', error);
    res.status(500).json({ error: 'Failed to create server' });
  }
});
app.get("/api/gameinfo", async (req, res) => {
  res.send({
    players, playerup, playersanswers, phase, question
  })
});

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}


async function gameLoop(){
  while (true){
    if(players > 1){
      phase = "questioning"
      while(!question){
        await(1);
      }
      while (!question){
        console.log("waiting for question");
      }
      playerup = (playerup+1) % players;
      phase = "answering"
      // TODO find a way to log the time and set it to phaseTime
      // wait for the current player to add answers
      // wait for the current players time to end 
      phase = "voting";

    } else {
      phase = "waiting";
    }
  }
}


function getLocalIP(){
// i didnt write this bro
  const interfaces = os.networkInterfaces();
  for (const name in interfaces) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost'; 
}

const myIP = getLocalIP();
console.log('Local IP address:', myIP);
// start the server 
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

