const express = require('express');
const path = require('path');
const fs = require('fs');
const os = require('os');
const mongoose = require('mongoose');
const app = express();
const PORT = 3000;
const Server = require('./models/servers.js'); // adjust path as needed

let serverTimers = new Map(); // serverID -> intervalId

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
  try {
    const servers = await Server.find({});
    
    // Enhance server data with gameState info
    const enhancedServers = servers.map(server => {
      const gameState = server.gameState || {};
      const playerCount = gameState.players ? gameState.players.length : 0;
      const phase = gameState.phase || "waiting";
      const currentPlayer = gameState.players && gameState.players.length > 0 && gameState.playerup < gameState.players.length 
        ? gameState.players[gameState.playerup].name 
        : "";
      const questionAsker = gameState.players && gameState.players.length > gameState.questionAsker 
        ? gameState.players[gameState.questionAsker].name 
        : "";
      const answerGiver = gameState.players && gameState.players.length > gameState.answerGiver 
        ? gameState.players[gameState.answerGiver].name 
        : "";
      
      return {
        id: server.id,
        name: server.name,
        public: server.public,
        maxPlayers: server.maxPlayers,
        players: server.players,
        gameState: {
          playerCount,
          phase,
          currentPlayer,
          questionAsker,
          answerGiver,
          gameTimer: gameState.gameTimer || 0,
          question: gameState.question || "",
          playersInGame: gameState.players || []
        }
      };
    });
    
    res.json({ servers: enhancedServers });
  } catch (error) {
    console.error('Failed to fetch servers:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Helper function to get server and validate
async function getServerById(serverID) {
  const server = await Server.findOne({ id: serverID });
  if (!server) {
    throw new Error('Server not found');
  }
  
  // Initialize gameState if it doesn't exist
  if (!server.gameState) {
    server.gameState = {
      players: [],
      playerup: 0,
      playersanswers: [],
      phase: "waiting",
      question: "",
      gameChat: [],
      votes: [0, 0],
      votedUsers: [],
      currentAnswerIndex: 0,
      currentAnswerBeingVoted: "",
      gameTimer: 0,
      questionAsker: 0,
      answerGiver: 1
    };
    await server.save();
  }
  
  return server;
}

app.get('/api/gamechat/:serverID', async (req, res) => {
  try {
    const server = await getServerById(parseInt(req.params.serverID));
    res.json({ gameChat: server.gameState.gameChat || [] });
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
});

app.post('/api/gamechat/:serverID', async (req, res) => {
  try {
    const { message, user } = req.body;
    
    if (!message || !user) {
      return res.status(400).json({ error: 'Message and user are required' });
    }
    
    const server = await getServerById(parseInt(req.params.serverID));
    
    if (!server.gameState.gameChat) {
      server.gameState.gameChat = [];
    }
    
    server.gameState.gameChat.push({ user, message });
    if(server.gameState.gameChat.length > 7){
      server.gameState.gameChat.shift();
    }
    
    await server.save();
    res.json({ message: 'Message added to chat' });
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
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
      players: [],
      gameState: {
        players: [],
        playerup: 0,
        playersanswers: [],
        phase: "waiting",
        question: "",
        gameChat: [],
        votes: [0, 0],
        votedUsers: [],
        currentAnswerIndex: 0,
        currentAnswerBeingVoted: "",
        gameTimer: 0,
        questionAsker: 0,
        answerGiver: 1
      }
    });

    await newServer.save();
    
    // Start game loop for this server
    startGameLoop(nextId);
    
    res.status(201).json({ message: 'Server created!', server: newServer });
  } catch (error) {
    console.error('Failed to create server:', error);
    res.status(500).json({ error: 'Failed to create server' });
  }
});

app.post("/api/join/:serverID", async (req, res) => { 
  try {
    let name = req.body.name;
    const serverID = parseInt(req.params.serverID);
    
    console.log(`attempted to join server ${serverID}: ${name}`);
    
    if(!name){
      return res.status(500).send("Name is Empty.");
    }
    
    const server = await getServerById(serverID);
    
    // check  if server is full using gameState.players
    if (server.gameState.players.length >= server.maxPlayers) {
      return res.status(500).send("Server is full.");
    }
    
    let playerExists = false;
    for (let i = 0; i < server.gameState.players.length; i++){
      if (server.gameState.players[i].name === name){
        playerExists = true;
        break;
      }
    }
    
    if (playerExists) {
      return res.status(500).send("Name already exists.");
    }
    
    server.gameState.players.push({"name": name, "time": 5000, "score": 0});
    
    if (!server.gameState.gameChat) {
      server.gameState.gameChat = [];
    }
    server.gameState.gameChat.push({ 
      user: "Server", 
      message: `${name} joined the game` 
    });
    if(server.gameState.gameChat.length > 7){
      server.gameState.gameChat.shift();
    }
    
    await server.save();
    res.status(200).send("Name is valid.");
  } catch (error) {
    console.error('Failed to join server:', error);
    res.status(500).send("Failed to join server.");
  }
});

app.post("/api/leave/:serverID", async (req, res) => {
  try {
    let name = req.body.name;
    const serverID = parseInt(req.params.serverID);
    
    if (!name) {
      return res.status(400).send("Name is required.");
    }
    
    const server = await getServerById(serverID);
    
    let playerFound = false;
    for(let i = 0; i < server.gameState.players.length; i++){
      if(server.gameState.players[i].name == name){
        server.gameState.players.splice(i, 1);
        playerFound = true;
        break;
      }
    }
    
    if (!playerFound) {
      return res.status(404).send("Player not found.");
    }
    
    // Add server message to chat
    if (!server.gameState.gameChat) {
      server.gameState.gameChat = [];
    }
    server.gameState.gameChat.push({ 
      user: "Server", 
      message: `${name} left the game` 
    });
    if(server.gameState.gameChat.length > 7){
      server.gameState.gameChat.shift();
    }
    
    await server.save();
    res.status(200).send("Player left.");
  } catch (error) {
    console.error('Failed to remove player:', error);
    res.status(500).send("Failed to remove player.");
  }
});

app.get('/api/gamestate/:serverID', async (req, res) => {
  try {
    const server = await getServerById(parseInt(req.params.serverID));
    const gameState = server.gameState;
    
    const currentPlayer = gameState.players.length > 0 && gameState.playerup < gameState.players.length ? gameState.players[gameState.playerup].name : "";
    const questionAskerName = gameState.players.length > gameState.questionAsker ? gameState.players[gameState.questionAsker].name : "";
    const answerGiverName = gameState.players.length > gameState.answerGiver ? gameState.players[gameState.answerGiver].name : "";
    
    res.send({
      // Game info
      players: gameState.players, 
      playerup: gameState.playerup, 
      playersanswers: gameState.playersanswers, 
      phase: gameState.phase, 
      question: gameState.question,
      currentPlayer,
      questionAsker: questionAskerName,
      answerGiver: answerGiverName,
      currentAnswerIndex: gameState.currentAnswerIndex,
      currentAnswerBeingVoted: gameState.currentAnswerBeingVoted,
      gameTimer: gameState.gameTimer,
      votes: gameState.votes,
      // chat messages
      gameChat: gameState.gameChat || []
    });
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
});

// Submit question endpoint
app.post('/api/submit-question/:serverID', async (req, res) => {
  try {
    const { question: submittedQuestion, user } = req.body;
    const serverID = parseInt(req.params.serverID);
    
    if (!submittedQuestion || !user) {
      return res.status(400).json({ error: 'Question and user are required' });
    }
    
    const server = await getServerById(serverID);
    const gameState = server.gameState;
    
    if (gameState.phase !== "questioning" || gameState.players[gameState.questionAsker].name !== user) {
      return res.status(400).json({ error: 'Not your turn to ask a question' });
    }
    
    gameState.question = submittedQuestion;
    gameState.gameChat.push({ 
      user: "Server", 
      message: `${user} asked: "${submittedQuestion}"` 
    });
    if(gameState.gameChat.length > 7) gameState.gameChat.shift();
    
    await server.save();
    res.json({ message: 'Question submitted successfully' });
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
});

//  answer endpoint
app.post('/api/submit-answer/:serverID', async (req, res) => {
  try {
    const { answer, user } = req.body;
    const serverID = parseInt(req.params.serverID);
    
    if (!answer || !user) {
      return res.status(400).json({ error: 'Answer and user are required' });
    }
    
    const server = await getServerById(serverID);
    const gameState = server.gameState;
    
    if (!gameState.phase.startsWith('answer') || gameState.players[gameState.answerGiver].name !== user) {
      return res.status(400).json({ error: 'Not your turn to answer or not in answering phase' });
    }
    
    if (gameState.playersanswers.length >= 4) {
      return res.status(400).json({ error: 'Maximum answers reached' });
    }
    
    gameState.playersanswers.push(answer);
    
    gameState.gameChat.push({ 
      user: "Server", 
      message: `${user} submitted answer ${gameState.playersanswers.length}: "${answer}"` 
    });
    if(gameState.gameChat.length > 7) gameState.gameChat.shift();
    
    await server.save();
    res.json({ message: 'Answer submitted successfully', answerCount: gameState.playersanswers.length });
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
});

// voting endpoint
app.post('/api/vote/:serverID', async (req, res) => {
  try {
    const { vote, user } = req.body; 
    const serverID = parseInt(req.params.serverID);
    
    if (vote === undefined || !user) {
      return res.status(400).json({ error: 'Vote and user are required' });
    }
    
    const server = await getServerById(serverID);
    const gameState = server.gameState;
    
    if (gameState.phase !== "voting") {
      return res.status(400).json({ error: 'Not in voting phase' });
    }
    
    if (gameState.votedUsers.includes(user)) {
      return res.status(400).json({ error: 'You have already voted on this answer' });
    }
      
    gameState.votedUsers.push(user);
    
    if (vote) {
      gameState.votes[0]++;
    } else {
      gameState.votes[1]++;
    }
    
    gameState.gameChat.push({ 
      user: "Server", 
      message: `${user} voted ${vote ? 'Approve' : 'Reject'}` 
    });
    if(gameState.gameChat.length > 7) gameState.gameChat.shift();
    
    await server.save();
    res.json({ message: 'Vote recorded successfully' });
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
});

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function startTimer(serverID, seconds) {
  if (serverTimers.has(serverID)) {
    clearInterval(serverTimers.get(serverID));
  }
  
  const intervalId = setInterval(async () => {
    try {
      const server = await Server.findOne({ id: serverID });
      if (server && server.gameState) {
        server.gameState.gameTimer--;
        if (server.gameState.gameTimer <= 0) {
          clearInterval(intervalId);
          serverTimers.delete(serverID);
          server.gameState.gameTimer = 0;
        }
        await server.save();
      } else {
        clearInterval(intervalId);
        serverTimers.delete(serverID);
      }
    } catch (error) {
      console.error(`Timer error for server ${serverID}:`, error);
      clearInterval(intervalId);
      serverTimers.delete(serverID);
    }
  }, 1000);
  
  serverTimers.set(serverID, intervalId);
  
  Server.findOne({ id: serverID }).then(server => {
    if (server) {
      server.gameState.gameTimer = seconds;
      server.save();
    }
  });
}

async function resetGameState(serverID) {
  try {
    const server = await Server.findOne({ id: serverID });
    if (server) {
      server.gameState.question = "";
      server.gameState.playersanswers = [];
      server.gameState.currentAnswerIndex = 0;
      server.gameState.currentAnswerBeingVoted = "";
      server.gameState.votes = [0, 0];
      server.gameState.votedUsers = [];
      server.gameState.gameTimer = 0;
      
      if (serverTimers.has(serverID)) {
        clearInterval(serverTimers.get(serverID));
        serverTimers.delete(serverID);
      }
      
      await server.save();
    }
  } catch (error) {
    console.error(`Error resetting game state for server ${serverID}:`, error);
  }
}

async function startGameLoop(serverID) {
  console.log(`Starting game loop for server ${serverID}`);
  
  const gameLoop = async () => {
    try {
      const server = await Server.findOne({ id: serverID });
      if (!server || !server.gameState) {
        console.log(`Server ${serverID} not found, stopping game loop`);
        return;
      }
      
      const gameState = server.gameState;
      
      if (gameState.players.length >= 2) {
        // check for winner
        const winner = gameState.players.find(player => player.score >= 10);
        if (winner) {
          gameState.phase = "game_over";
          gameState.gameChat.push({ 
            user: "Server", 
            message: `🎉 ${winner.name} wins with ${winner.score} points! 🎉` 
          });
          if(gameState.gameChat.length > 7) gameState.gameChat.shift();
          
          await server.save();
          
          // reset scores after announcing winner
          await sleep(10000); // show the winner for 10 seconds
          gameState.players.forEach(player => player.score = 0);
          await resetGameState(serverID);
          gameState.questionAsker = 0;
          gameState.answerGiver = 1;
          
          await server.save();
          setTimeout(() => gameLoop(), 1000);
          return;
        }
        
        // Questioning 
        gameState.phase = "questioning";
        await resetGameState(serverID);
        
        gameState.gameChat.push({ 
          user: "Server", 
          message: `${gameState.players[gameState.questionAsker].name}, ask a question to ${gameState.players[gameState.answerGiver].name}!` 
        });
        if(gameState.gameChat.length > 7) gameState.gameChat.shift();
        
        // 5 second buffer 
        gameState.phase = "buffer";
        gameState.gameChat.push({ 
          user: "Server", 
          message: `Get ready! Questioning phase starts in 5 seconds...` 
        });
        if(gameState.gameChat.length > 7) gameState.gameChat.shift();
        
        await server.save();
        await sleep(5000);
        
        // Reload server state
        const updatedServer = await Server.findOne({ id: serverID });
        if (!updatedServer) return;
        
        updatedServer.gameState.phase = "questioning";
        await updatedServer.save();
        
        startTimer(serverID, 30); 
        
        // waitas for question to be submitted or timer to run out
        while (!updatedServer.gameState.question) {
          await sleep(100);
          const currentServer = await Server.findOne({ id: serverID });
          if (!currentServer || currentServer.gameState.gameTimer <= 0) {
            break;
          }
          Object.assign(updatedServer.gameState, currentServer.gameState);
        }
        
        const finalServer = await Server.findOne({ id: serverID });
        if (!finalServer.gameState.question) {
          finalServer.gameState.gameChat.push({ 
            user: "Server", 
            message: `${finalServer.gameState.players[finalServer.gameState.questionAsker].name} took too long to ask a question. Moving to next player.` 
          });
          if(finalServer.gameState.gameChat.length > 7) finalServer.gameState.gameChat.shift();
          
          // move to next pair
          finalServer.gameState.questionAsker = (finalServer.gameState.questionAsker + 1) % finalServer.gameState.players.length;
          finalServer.gameState.answerGiver = (finalServer.gameState.questionAsker + 1) % finalServer.gameState.players.length;
          if (finalServer.gameState.answerGiver >= finalServer.gameState.players.length) {
            finalServer.gameState.answerGiver = 0;
          }
          if (finalServer.gameState.answerGiver === finalServer.gameState.questionAsker && finalServer.gameState.players.length > 1) {
            finalServer.gameState.answerGiver = (finalServer.gameState.answerGiver + 1) % finalServer.gameState.players.length;
          }
          
          await finalServer.save();
          setTimeout(() => gameLoop(), 1000);
          return;
        }
        
        // Continue with answering phase...
        // Answering 
        const currentServer = await Server.findOne({ id: serverID });
        if (!currentServer) return;
        
        currentServer.gameState.phase = "buffer";
        currentServer.gameState.gameChat.push({ 
          user: "Server", 
          message: `${currentServer.gameState.players[currentServer.gameState.answerGiver].name}, get ready! You'll have 5 seconds for each of 4 answers...` 
        });
        if(currentServer.gameState.gameChat.length > 7) currentServer.gameState.gameChat.shift();
        
        await currentServer.save();
        await sleep(3000);
        
        //   4 answer phases
        for (let answerNum = 1; answerNum <= 4; answerNum++) {
          const serverForAnswer = await Server.findOne({ id: serverID });
          if (!serverForAnswer) return;
          
          serverForAnswer.gameState.phase = `answer${answerNum}`;
          const initialAnswerCount = serverForAnswer.gameState.playersanswers.length;
          
          serverForAnswer.gameState.gameChat.push({ 
            user: "Server", 
            message: `Answer ${answerNum}: GO! 5 seconds...` 
          });
          if(serverForAnswer.gameState.gameChat.length > 7) serverForAnswer.gameState.gameChat.shift();
          
          await serverForAnswer.save();
          startTimer(serverID, 5);
          

          let timeLeft = 5;
          while (timeLeft > 0) {
            const checkServer = await Server.findOne({ id: serverID });
            if (!checkServer || checkServer.gameState.playersanswers.length > initialAnswerCount) {
              break; // break if they already submitted an answer
            }
            timeLeft = checkServer.gameState.gameTimer;
            await sleep(100);
          }
          
          const updatedServer = await Server.findOne({ id: serverID });
          if (!updatedServer) return;
          
          if (updatedServer.gameState.playersanswers.length > initialAnswerCount) {
            updatedServer.gameState.gameChat.push({ 
              user: "Server", 
              message: `Answer ${answerNum} submitted early! Moving to next...` 
            });
            if(updatedServer.gameState.gameChat.length > 7) updatedServer.gameState.gameChat.shift();
            await updatedServer.save();
            await sleep(1000);
          } else {
            updatedServer.gameState.gameChat.push({ 
              user: "Server", 
              message: `Time's up for answer ${answerNum}!` 
            });
            if(updatedServer.gameState.gameChat.length > 7) updatedServer.gameState.gameChat.shift();
            await updatedServer.save();
          }
        }
        
        const finalAnswerServer = await Server.findOne({ id: serverID });
        if (!finalAnswerServer) return;
        
        if (finalAnswerServer.gameState.playersanswers.length === 0) {
          finalAnswerServer.gameState.gameChat.push({ 
            user: "Server", 
            message: `${finalAnswerServer.gameState.players[finalAnswerServer.gameState.answerGiver].name} didn't provide any answers. No points awarded.` 
          });
          if(finalAnswerServer.gameState.gameChat.length > 7) finalAnswerServer.gameState.gameChat.shift();
          
          finalAnswerServer.gameState.questionAsker = (finalAnswerServer.gameState.questionAsker + 1) % finalAnswerServer.gameState.players.length;
          finalAnswerServer.gameState.answerGiver = (finalAnswerServer.gameState.questionAsker + 1) % finalAnswerServer.gameState.players.length;
          if (finalAnswerServer.gameState.answerGiver >= finalAnswerServer.gameState.players.length) {
            finalAnswerServer.gameState.answerGiver = 0;
          }
          if (finalAnswerServer.gameState.answerGiver === finalAnswerServer.gameState.questionAsker && finalAnswerServer.gameState.players.length > 1) {
            finalAnswerServer.gameState.answerGiver = (finalAnswerServer.gameState.answerGiver + 1) % finalAnswerServer.gameState.players.length;
          }
          
          await finalAnswerServer.save();
          setTimeout(() => gameLoop(), 1000);
          return;
        }
        
        finalAnswerServer.gameState.gameChat.push({ 
          user: "Server", 
          message: `${finalAnswerServer.gameState.players[finalAnswerServer.gameState.answerGiver].name} provided ${finalAnswerServer.gameState.playersanswers.length} answers. Time to vote!` 
        });
        if(finalAnswerServer.gameState.gameChat.length > 7) finalAnswerServer.gameState.gameChat.shift();
        
        finalAnswerServer.gameState.phase = "buffer";
        finalAnswerServer.gameState.gameChat.push({ 
          user: "Server", 
          message: `Voting starts in 5 seconds! Get ready to judge the answers...` 
        });
        if(finalAnswerServer.gameState.gameChat.length > 7) finalAnswerServer.gameState.gameChat.shift();
        
        await finalAnswerServer.save();
        await sleep(5000);
        
        // Voting
        let pointsEarned = 0;
        
        for (let i = 0; i < finalAnswerServer.gameState.playersanswers.length; i++) {
          const voteServer = await Server.findOne({ id: serverID });
          if (!voteServer) return;
          
          voteServer.gameState.phase = "voting";
          voteServer.gameState.currentAnswerIndex = i;
          voteServer.gameState.currentAnswerBeingVoted = voteServer.gameState.playersanswers[i];
          voteServer.gameState.votes = [0, 0];
          voteServer.gameState.votedUsers = [];
          
          voteServer.gameState.gameChat.push({ 
            user: "Server", 
            message: `Voting on answer ${i + 1}: "${voteServer.gameState.playersanswers[i]}" - 5 seconds to vote!` 
          });
          if(voteServer.gameState.gameChat.length > 7) voteServer.gameState.gameChat.shift();
          
          await voteServer.save();
          startTimer(serverID, 5);
          
          let voteTimeLeft = 5;
          while (voteTimeLeft > 0) {
            const checkVoteServer = await Server.findOne({ id: serverID });
            if (!checkVoteServer) return;
            voteTimeLeft = checkVoteServer.gameState.gameTimer;
            await sleep(100);
          }
          
          const finalVoteServer = await Server.findOne({ id: serverID });
          if (!finalVoteServer) return;
          
          const totalVotes = finalVoteServer.gameState.votes[0] + finalVoteServer.gameState.votes[1];
          const approvalRate = totalVotes > 0 ? (finalVoteServer.gameState.votes[0] / totalVotes) : 0;
          // 50% APPROVAL or more
          if (approvalRate >= 0.5 && finalVoteServer.gameState.votes[0] > 0) {
            pointsEarned++;
            finalVoteServer.gameState.gameChat.push({ 
              user: "Server", 
              message: `✅ Answer "${finalVoteServer.gameState.playersanswers[i]}" APPROVED! (${finalVoteServer.gameState.votes[0]} approve, ${finalVoteServer.gameState.votes[1]} reject)` 
            });
          } else {
            finalVoteServer.gameState.gameChat.push({ 
              user: "Server", 
              message: `❌ Answer "${finalVoteServer.gameState.playersanswers[i]}" REJECTED! (${finalVoteServer.gameState.votes[0]} approve, ${finalVoteServer.gameState.votes[1]} reject)` 
            });
          }
          if(finalVoteServer.gameState.gameChat.length > 7) finalVoteServer.gameState.gameChat.shift();
          
          await finalVoteServer.save();
          
          if (i < finalVoteServer.gameState.playersanswers.length - 1) {
            finalVoteServer.gameState.phase = "buffer";
            finalVoteServer.gameState.gameChat.push({ 
              user: "Server", 
              message: `Next answer coming up in 5 seconds...` 
            });
            if(finalVoteServer.gameState.gameChat.length > 7) finalVoteServer.gameState.gameChat.shift();
            
            await finalVoteServer.save();
            await sleep(5000);
          } else {
            await sleep(2000); 
          }
        }
        
        const pointsServer = await Server.findOne({ id: serverID });
        if (!pointsServer) return;
        
        pointsServer.gameState.players[pointsServer.gameState.answerGiver].score += pointsEarned;
        
        pointsServer.gameState.gameChat.push({ 
          user: "Server", 
          message: `${pointsServer.gameState.players[pointsServer.gameState.answerGiver].name} earned ${pointsEarned} points! Total score: ${pointsServer.gameState.players[pointsServer.gameState.answerGiver].score}/10` 
        });
        if(pointsServer.gameState.gameChat.length > 7) pointsServer.gameState.gameChat.shift();
        
        // show current scores
        const scoreMessage = pointsServer.gameState.players.map(p => `${p.name}: ${p.score}`).join(', ');
        pointsServer.gameState.gameChat.push({ 
          user: "Server", 
          message: `Current scores: ${scoreMessage}` 
        });
        if(pointsServer.gameState.gameChat.length > 7) pointsServer.gameState.gameChat.shift();
        
        await pointsServer.save();
        await sleep(3000); 
        
        pointsServer.gameState.questionAsker = (pointsServer.gameState.questionAsker + 1) % pointsServer.gameState.players.length;
        pointsServer.gameState.answerGiver = (pointsServer.gameState.questionAsker + 1) % pointsServer.gameState.players.length;
        if (pointsServer.gameState.answerGiver >= pointsServer.gameState.players.length) {
          pointsServer.gameState.answerGiver = 0;
        }
        if (pointsServer.gameState.answerGiver === pointsServer.gameState.questionAsker && pointsServer.gameState.players.length > 1) {
          pointsServer.gameState.answerGiver = (pointsServer.gameState.answerGiver + 1) % pointsServer.gameState.players.length;
        }
        
        await pointsServer.save();
      } else {
        gameState.phase = "waiting";
        await resetGameState(serverID);
        if (gameState.players.length === 1) {
          gameState.gameChat.push({ 
            user: "Server", 
            message: "Waiting for more players to join..." 
          });
          if(gameState.gameChat.length > 7) gameState.gameChat.shift();
        }
        await server.save();
      }
      
      setTimeout(() => gameLoop(), 1000);
    } catch (error) {
      console.error(`Game loop error for server ${serverID}:`, error);
      setTimeout(() => gameLoop(), 1000);
    }
  };
  
  gameLoop();
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

// start game loops for existing servers when server starts up
async function initializeExistingServers() {
  try {
    const existingServers = await Server.find({});
    console.log(`Found ${existingServers.length} existing servers`);
    
    for (const server of existingServers) {
      // init  ialize gameState if it doesn't exist
      if (!server.gameState) {
        server.gameState = {
          players: [],
          playerup: 0,
          playersanswers: [],
          phase: "waiting",
          question: "",
          gameChat: [],
          votes: [0, 0],
          votedUsers: [],
          currentAnswerIndex: 0,
          currentAnswerBeingVoted: "",
          gameTimer: 0,
          questionAsker: 0,
          answerGiver: 1
        };
        await server.save();
      }
      
      startGameLoop(server.id);
      console.log(`Started game loop for server ${server.id}: "${server.name}"`);
    }
  } catch (error) {
    console.error('Error initializing existing servers:', error);
  }
}

initializeExistingServers().then(() => {
  app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
    console.log('Multi-server Five Second Rule game ready!');
  });
});

