let gameInfo = {
  question: "",
  players: [],
  currentPlayer: "",
  currentQuestion: "",
  currentAnswer: "",
  phase: "Waiting"
};

// Function to fetch and update game info
async function updateGameInfo() {
  try {
    const response = await fetch("/api/gamestate");
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

// Initial fetch
updateGameInfo();

const playerList = document.getElementById("playerList");

function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(';').shift();
  return null;
}

//  for compatibility with other files
function getCookieValue(name) {
  return getCookie(name);
}

const playerName = getCookie('name');
console.log(playerName);
if (playerName) {
  fetch('/api/join', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name: playerName })
  })
  .then(response => {
    if (!response.ok) {
      return response.text().then(text => {
        throw new Error(text);
      });
    }
    return response.text();
  })
  .then(data => {
    console.log('Successfully joined game:', data);
    updateGameInfo();
  })
  .catch(error => {
    console.error('Failed to join game:', error.message);
  });
}

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
  }
}

function updateGameStatus() {
  const questionElement = document.getElementById("question");
  if (questionElement) {
    if (gameInfo.question) {
      questionElement.textContent = gameInfo.question;
    } else {
      // Show phase-specific messages
      switch (gameInfo.phase) {
        case "waiting":
          questionElement.textContent = "Waiting for more players to join...";
          break;
        case "buffer":
          questionElement.textContent = "Get ready for the next phase...";
          break;
        case "questioning":
          questionElement.textContent = `${gameInfo.questionAsker} is asking a question to ${gameInfo.answerGiver}...`;
          break;
        case "answering":
          questionElement.textContent = `${gameInfo.answerGiver} is providing answers...`;
          break;
        case "voting":
          questionElement.textContent = `Voting on: "${gameInfo.currentAnswerBeingVoted}"`;
          break;
        case "game_over":
          questionElement.textContent = "Game Over! Check chat for winner.";
          break;
        default:
          questionElement.textContent = "Waiting for question...";
      }
    }
  }
  
  const currentTurnElement = document.getElementById("currentTurnPlayer");
  if (currentTurnElement) {
    switch (gameInfo.phase) {
      case "buffer":
        currentTurnElement.textContent = "Preparing...";
        break;
      case "questioning":
        currentTurnElement.textContent = `${gameInfo.questionAsker} (Asking)`;
        break;
      case "answering":
        currentTurnElement.textContent = `${gameInfo.answerGiver} (Answering)`;
        break;
      case "voting":
        currentTurnElement.textContent = "Everyone (Voting)";
        break;
      default:
        currentTurnElement.textContent = "Waiting...";
    }
  }
  
  // Update timer display
  const timerElement = document.getElementById("time");
  if (timerElement && gameInfo.gameTimer !== undefined) {
    const minutes = Math.floor(gameInfo.gameTimer / 60);
    const seconds = gameInfo.gameTimer % 60;
    timerElement.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }
  
  const phaseElement = document.getElementById("gamePhase");
  if (phaseElement) {
    phaseElement.textContent = gameInfo.phase || "Waiting";
  }
}

// update all game info every second
setInterval(updateGameInfo, 1000);

async function leave(name) {
  try {
    const response = await fetch('/api/leave', {
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

async function leaveGame() {
  const name = getCookieValue("name");
  if (name) {
    try {
      await leave(name);
    } catch (error) {
      console.error("Error leaving game:", error);
    }
  }
  window.location.href = "/";
}