const express = require('express');
const path = require('path');
const fs = require('fs');
const os = require('os');
const mongoose = require('mongoose');
const app = express();
const PORT = 3000;
const Server = require('./models/servers.js'); // adjust path as needed

//Server Information (for now)
let players = [
];
let playerup = 0;
let playersanswers = [];
let phase = "answering";
let question = "";
let phaseBeginTime = "";
let gameChat = [];
let answers = [];
let votes = [0, 0];
let votedUsers = []; 
let currentAnswerIndex = 0;
let currentAnswerBeingVoted = "";
let gameTimer = 0;
let gameTimerInterval = null;
let questionAsker = 0; 
let answerGiver = 1; 

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
  
  if (!message || !user) {
    return res.status(400).json({ error: 'Message and user are required' });
  }
  
  gameChat.push({ user, message });
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

app.post("/api/join", async (req, res) => { 
  let name = req.body.name;
  console.log("attempted to join: " + name);
  if(!name){
    return res.status(500).send("Name is Empty.");
  }
  
  // Check if player already exists
  let playerExists = false;
  for (let i = 0; i < players.length; i++){
    if (players[i].name === name){
      playerExists = true;
      break;
    }
  }
  
  if (playerExists) {
    return res.status(500).send("Name already exists.");
  }
  
  players.push({"name": name, "time": 5000, "score": 0});
  
  // Add server message to chat
  gameChat.push({ 
    user: "Server", 
    message: `${name} joined the game` 
  });
  if(gameChat.length > 7){
    gameChat.shift();
  }
  
  res.status(200).send("Name is valid.");
});
app.post("/api/leave", async (req, res) => {
  try {
    let name = req.body.name;
    if (!name) {
      return res.status(400).send("Name is required.");
    }
    
    let playerFound = false;
    for(let i = 0; i < players.length; i++){
      if(players[i].name == name){
        players.splice(i, 1);
        playerFound = true;
        break;
      }
    }
    
    if (!playerFound) {
      return res.status(404).send("Player not found.");
    }
    
    // Add server message to chat
    gameChat.push({ 
      user: "Server", 
      message: `${name} left the game` 
    });
    if(gameChat.length > 7){
      gameChat.shift();
    }
    
    res.status(200).send("Player left.");
  } catch (error) {
    console.error('Failed to remove player:', error);
    res.status(500).send("Failed to remove player.");
  }
});
app.get('/api/gamestate', async (req, res) => {
  const currentPlayer = players.length > 0 && playerup < players.length ? players[playerup].name : "";
  const questionAskerName = players.length > questionAsker ? players[questionAsker].name : "";
  const answerGiverName = players.length > answerGiver ? players[answerGiver].name : "";
  
  res.send({
    // Game info
    players, 
    playerup, 
    playersanswers, 
    phase, 
    question,
    currentPlayer,
    questionAsker: questionAskerName,
    answerGiver: answerGiverName,
    currentAnswerIndex,
    currentAnswerBeingVoted,
    gameTimer,
    votes,
    // Chat messages
    gameChat
  });
});

// Submit question endpoint
app.post('/api/submit-question', async (req, res) => {
  const { question: submittedQuestion, user } = req.body;
  
  if (!submittedQuestion || !user) {
    return res.status(400).json({ error: 'Question and user are required' });
  }
  
  if (phase !== "questioning" || players[questionAsker].name !== user) {
    return res.status(400).json({ error: 'Not your turn to ask a question' });
  }
  
  question = submittedQuestion;
  gameChat.push({ 
    user: "Server", 
    message: `${user} asked: "${submittedQuestion}"` 
  });
  if(gameChat.length > 7) gameChat.shift();
  
  res.json({ message: 'Question submitted successfully' });
});

// Submit answer endpoint
app.post('/api/submit-answer', async (req, res) => {
  const { answer, user } = req.body;
  
  if (!answer || !user) {
    return res.status(400).json({ error: 'Answer and user are required' });
  }
  
  if (!phase.startsWith('answer') || players[answerGiver].name !== user) {
    return res.status(400).json({ error: 'Not your turn to answer or not in answering phase' });
  }
  
  if (playersanswers.length >= 4) {
    return res.status(400).json({ error: 'Maximum answers reached' });
  }
  
  playersanswers.push(answer);
  
  gameChat.push({ 
    user: "Server", 
    message: `${user} submitted answer ${playersanswers.length}: "${answer}"` 
  });
  if(gameChat.length > 7) gameChat.shift();
  
  res.json({ message: 'Answer submitted successfully', answerCount: playersanswers.length });
});

// Vote endpoint
app.post('/api/vote', async (req, res) => {
  const { vote, user } = req.body; // vote is boolean: true for approve, false for reject
  
  if (vote === undefined || !user) {
    return res.status(400).json({ error: 'Vote and user are required' });
  }
  
  if (phase !== "voting") {
    return res.status(400).json({ error: 'Not in voting phase' });
  }
  
  // Check if user already voted on this answer
  if (votedUsers.includes(user)) {
    return res.status(400).json({ error: 'You have already voted on this answer' });
  }
  
  // Add user to voted users list
  votedUsers.push(user);
  
  if (vote) {
    votes[0]++; // approve
  } else {
    votes[1]++; // reject
  }
  
  gameChat.push({ 
    user: "Server", 
    message: `${user} voted ${vote ? 'Approve' : 'Reject'}` 
  });
  if(gameChat.length > 7) gameChat.shift();
  
  res.json({ message: 'Vote recorded successfully' });
});

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function startTimer(seconds) {
  gameTimer = seconds;
  if (gameTimerInterval) {
    clearInterval(gameTimerInterval);
  }
  
  gameTimerInterval = setInterval(() => {
    gameTimer--;
    if (gameTimer <= 0) {
      clearInterval(gameTimerInterval);
      gameTimerInterval = null;
    }
  }, 1000);
}

function resetGameState() {
  question = "";
  playersanswers = [];
  currentAnswerIndex = 0;
  currentAnswerBeingVoted = "";
  votes = [0, 0];
  votedUsers = [];
  if (gameTimerInterval) {
    clearInterval(gameTimerInterval);
    gameTimerInterval = null;
  }
  gameTimer = 0;
}

async function gameLoop() {
  while (true) {
    if (players.length >= 2) {
      // Check for winner
      const winner = players.find(player => player.score >= 10);
      if (winner) {
        phase = "game_over";
        gameChat.push({ 
          user: "Server", 
          message: `🎉 ${winner.name} wins with ${winner.score} points! 🎉` 
        });
        if(gameChat.length > 7) gameChat.shift();
        
        // Reset scores after announcing winner
        await sleep(10000); // Show winner for 10 seconds
        players.forEach(player => player.score = 0);
        resetGameState();
        questionAsker = 0;
        answerGiver = 1;
        continue;
      }
      
      // Phase 1: Questioning (first person asks question to next person)
      phase = "questioning";
      resetGameState();
      
      gameChat.push({ 
        user: "Server", 
        message: `${players[questionAsker].name}, ask a question to ${players[answerGiver].name}!` 
      });
      if(gameChat.length > 7) gameChat.shift();
      
      // 5 second buffer before questioning phase starts
      phase = "buffer";
      gameChat.push({ 
        user: "Server", 
        message: `Get ready! Questioning phase starts in 5 seconds...` 
      });
      if(gameChat.length > 7) gameChat.shift();
      
      await sleep(5000);
      phase = "questioning";
      
      startTimer(30); // 30 seconds to ask a question
      
      // Wait for question to be submitted or timer to run out
      while (!question && gameTimer > 0) {
        await sleep(100);
      }
      
      if (!question) {
        gameChat.push({ 
          user: "Server", 
          message: `${players[questionAsker].name} took too long to ask a question. Moving to next player.` 
        });
        if(gameChat.length > 7) gameChat.shift();
        
        // Move to next pair
        questionAsker = (questionAsker + 1) % players.length;
        answerGiver = (questionAsker + 1) % players.length;
        if (answerGiver >= players.length) {
          answerGiver = 0;
        }
        if (answerGiver === questionAsker && players.length > 1) {
          answerGiver = (answerGiver + 1) % players.length;
        }
        continue;
      }
      
      // Phase 2: Answering (5 seconds per answer, 4 answers total)
      phase = "buffer";
      gameChat.push({ 
        user: "Server", 
        message: `${players[answerGiver].name}, get ready! You'll have 5 seconds for each of 4 answers...` 
      });
      if(gameChat.length > 7) gameChat.shift();
      
      await sleep(3000);
      
      // Cycle through 4 answer phases
      for (let answerNum = 1; answerNum <= 4; answerNum++) {
        phase = `answer${answerNum}`;
        const initialAnswerCount = playersanswers.length;
        
        gameChat.push({ 
          user: "Server", 
          message: `Answer ${answerNum}: GO! 5 seconds...` 
        });
        if(gameChat.length > 7) gameChat.shift();
        
        startTimer(5);
        
        // Wait for 5 seconds OR until they submit an answer
        while (gameTimer > 0 && playersanswers.length === initialAnswerCount) {
          await sleep(100);
        }
        
        // If they submitted an answer early, acknowledge it
        if (playersanswers.length > initialAnswerCount) {
          gameChat.push({ 
            user: "Server", 
            message: `Answer ${answerNum} submitted early! Moving to next...` 
          });
          if(gameChat.length > 7) gameChat.shift();
          await sleep(1000); // Brief pause before next answer
        } else {
          // Time ran out
          gameChat.push({ 
            user: "Server", 
            message: `Time's up for answer ${answerNum}!` 
          });
          if(gameChat.length > 7) gameChat.shift();
        }
      }
      
      if (playersanswers.length === 0) {
        gameChat.push({ 
          user: "Server", 
          message: `${players[answerGiver].name} didn't provide any answers. No points awarded.` 
        });
        if(gameChat.length > 7) gameChat.shift();
        
        // Move to next pair
        questionAsker = (questionAsker + 1) % players.length;
        answerGiver = (questionAsker + 1) % players.length;
        if (answerGiver >= players.length) {
          answerGiver = 0;
        }
        if (answerGiver === questionAsker && players.length > 1) {
          answerGiver = (answerGiver + 1) % players.length;
        }
        continue;
      }
      
      gameChat.push({ 
        user: "Server", 
        message: `${players[answerGiver].name} provided ${playersanswers.length} answers. Time to vote!` 
      });
      if(gameChat.length > 7) gameChat.shift();
      
      // 5 second buffer before voting starts
      phase = "buffer";
      gameChat.push({ 
        user: "Server", 
        message: `Voting starts in 5 seconds! Get ready to judge the answers...` 
      });
      if(gameChat.length > 7) gameChat.shift();
      
      await sleep(5000);
      
      // Phase 3: Voting on each answer
      let pointsEarned = 0;
      
      for (let i = 0; i < playersanswers.length; i++) {
        phase = "voting";
        currentAnswerIndex = i;
        currentAnswerBeingVoted = playersanswers[i];
        votes = [0, 0];
        votedUsers = []; 
        
        gameChat.push({ 
          user: "Server", 
          message: `Voting on answer ${i + 1}: "${playersanswers[i]}" - 5 seconds to vote!` 
        });
        if(gameChat.length > 7) gameChat.shift();
        
        startTimer(5);
        
        // Wait for 5 seconds of voting
        while (gameTimer > 0) {
          await sleep(100);
        }
        
        // Calculate if answer passes (50% or more approval)
        const totalVotes = votes[0] + votes[1];
        const approvalRate = totalVotes > 0 ? (votes[0] / totalVotes) : 0;
        
        if (approvalRate >= 0.5 && votes[0] > 0) {
          pointsEarned++;
          gameChat.push({ 
            user: "Server", 
            message: `✅ Answer "${playersanswers[i]}" APPROVED! (${votes[0]} approve, ${votes[1]} reject)` 
          });
        } else {
          gameChat.push({ 
            user: "Server", 
            message: `❌ Answer "${playersanswers[i]}" REJECTED! (${votes[0]} approve, ${votes[1]} reject)` 
          });
        }
        if(gameChat.length > 7) gameChat.shift();
        
        // 5 second buffer between votes (except after the last vote)
        if (i < playersanswers.length - 1) {
          phase = "buffer";
          gameChat.push({ 
            user: "Server", 
            message: `Next answer coming up in 5 seconds...` 
          });
          if(gameChat.length > 7) gameChat.shift();
          
          await sleep(5000);
        } else {
          await sleep(2000); // Brief pause after last vote
        }
      }
      
      // Award points and announce results
      players[answerGiver].score += pointsEarned;
      
      gameChat.push({ 
        user: "Server", 
        message: `${players[answerGiver].name} earned ${pointsEarned} points! Total score: ${players[answerGiver].score}/10` 
      });
      if(gameChat.length > 7) gameChat.shift();
      
      // Show current scores
      const scoreMessage = players.map(p => `${p.name}: ${p.score}`).join(', ');
      gameChat.push({ 
        user: "Server", 
        message: `Current scores: ${scoreMessage}` 
      });
      if(gameChat.length > 7) gameChat.shift();
      
      await sleep(3000); // Brief pause before next round
      
      // Move to next pair
      questionAsker = (questionAsker + 1) % players.length;
      answerGiver = (questionAsker + 1) % players.length;
      if (answerGiver >= players.length) {
        answerGiver = 0;
      }
      if (answerGiver === questionAsker && players.length > 1) {
        answerGiver = (answerGiver + 1) % players.length;
      }
      
    } else {
      phase = "waiting";
      resetGameState();
      if (players.length === 1) {
        gameChat.push({ 
          user: "Server", 
          message: "Waiting for more players to join..." 
        });
        if(gameChat.length > 7) gameChat.shift();
      }
    }
    
    await sleep(1000); // Check every second
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

// Start the game loop
gameLoop().catch(console.error);

// start the server 
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

