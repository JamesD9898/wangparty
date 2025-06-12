let gameInfo = {
  question: "",
  players: [],
  currentPlayer: "",
  currentQuestion: "",
  currentAnswer: "",
  phase: "Waiting"
};

// Get current server ID from URL parameters or cookies
function getCurrentServerID() {
  const urlParams = new URLSearchParams(window.location.search);
  const serverIDFromURL = urlParams.get('serverID');
  
  if (serverIDFromURL) {
    return parseInt(serverIDFromURL);
  }
  
  // Try to get from cookie as fallback
  const serverIDFromCookie = getCookieValue("serverID");
  if (serverIDFromCookie) {
    return parseInt(serverIDFromCookie);
  }
  
  return null;
}

// Function to fetch and update game info
async function updateGameInfo() {
  const serverID = getCurrentServerID();
  if (!serverID) {
    console.error('No server ID found');
    return;
  }
  
  try {
    const response = await fetch(`/api/gamestate/${serverID}`);
    if (response.ok) {
      const data = await response.json();
      gameInfo = data;
      updatePlayerList();
      updateGameStatus();
    }
  } catch (error) {
    console.error('Failed to fetch game info:', error);
  }
}

// Function to update game status display
function updateGameStatus() {
  // Update question display
  const questionElement = document.getElementById('question');
  if (questionElement) {
    questionElement.textContent = gameInfo.question || 'Waiting for question...';
  }
  
  // Update current turn player
  const currentTurnElement = document.getElementById('currentTurnPlayer');
  if (currentTurnElement) {
    if (gameInfo.phase === 'questioning') {
      currentTurnElement.textContent = `${gameInfo.questionAsker} (asking question)`;
    } else if (gameInfo.phase && gameInfo.phase.startsWith('answer')) {
      currentTurnElement.textContent = `${gameInfo.answerGiver} (answering)`;
    } else if (gameInfo.phase === 'voting') {
      currentTurnElement.textContent = 'Everyone (voting)';
    } else {
      currentTurnElement.textContent = gameInfo.currentPlayer || 'Waiting...';
    }
  }
}

const playerList = document.getElementById("playerList");

// Remove the automatic join logic - players should already be joined when they reach this page
// This was causing issues with the wrong endpoint being called

function updatePlayerList() {
  if (!playerList) return;
  
  playerList.innerHTML = "";
  if (gameInfo.players && gameInfo.players.length > 0) {
    gameInfo.players.forEach(player => {
      const li = document.createElement("li");
      li.textContent = `${player.name} - Score: ${player.score || 0}/10`;
      li.style.fontWeight = player.name === gameInfo.currentPlayer ? 'bold' : 'normal';
      
      // Highlight current question asker and answer giver
      if (player.name === gameInfo.questionAsker) {
        li.style.color = '#ff6b6b'; // Red for question asker
        li.textContent += ' (Asking)';
      } else if (player.name === gameInfo.answerGiver) {
        li.style.color = '#4ecdc4'; // Teal for answer giver
        li.textContent += ' (Answering)';
      }
      
      playerList.appendChild(li);
    });
  } else {
    const li = document.createElement("li");
    li.textContent = "No players in game";
    li.style.fontStyle = "italic";
    li.style.color = "#666";
    playerList.appendChild(li);
  }
}

// Cookie helper function
function getCookieValue(name) {
  const value = document.cookie
    .split("; ")
    .find((row) => row.startsWith(name + "="))
    ?.split("=")[1];
  return value ? decodeURIComponent(value) : null;
}

// Start updating game info every 2 seconds
setInterval(updateGameInfo, 2000);

// Initial update
updateGameInfo();

async function leave(name) {
  const serverID = getCurrentServerID();
  if (!serverID) {
    console.error('No server ID found for leaving');
    return;
  }
  
  try {
    const response = await fetch(`/api/leave/${serverID}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: name }),
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return await response.text();
  } catch (error) {
    console.error("Failed to leave:", error);
    throw error;
  }
}