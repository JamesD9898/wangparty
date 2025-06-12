const messageDiv = document.getElementById("messages");

var hasVoted = false;

let messages = [];
let updateInterval;
let currentServerID = null;

// messages = [
//   { user: "asdlkl;,", message: "Hi" },
//   { user: "alex", message: "Hi" },
//   { user: "james", message: "Nope" },
// ];

// Initialize the game and start polling
async function initializeGame() {
  var name = getCookieValue("name");
  if(!name){
    window.location.href = "/";
  }
  
  // Get current server ID
  currentServerID = getCurrentServerID();
  if (!currentServerID) {
    return; // Will redirect to home
  }
  
  console.log(`Joining game on server ${currentServerID} as ${name}`);
  document.getElementById("currentPlayer").innerHTML = name;
  
  // Initial update
  await updateGameState();
}

async function addnewmessage() {
  const user = getCookieValue("name");
  const messageForm = document.getElementById("messagehere");
  const messageContent = messageForm.value;
  
  if (!messageContent.trim() || !currentServerID) {
    return; 
  }
  
  try {
    const response = await fetch(`/api/gamechat/${currentServerID}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message: messageContent, user: user }),
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    messageForm.value = '';
    
    //  immediate update to show new message
    await updateGameState();
  } catch (error) {
    console.error('Error sending message:', error);
  }
}

function renderMessages() {
  messageDiv.innerHTML = "";
  for (let i = 0; i < messages.length; i++) {
    const message = messages[i];
    let MessageHTML;
    
    if (message.user === "Server") {
      MessageHTML = `<p class="server-message"><span class="server-sender">${message.user}</span>: <span class="server-text">${message.message}</span></p>`;
    } else {
      MessageHTML = `<p><span class="sender">${message.user}</span> : <span class="message">${message.message}</span></p>`;
    }
    
    messageDiv.insertAdjacentHTML("beforeend", MessageHTML);
  }
  
  messageDiv.scrollTop = messageDiv.scrollHeight;
}

let gameState = {
  phase: "waiting",
  questionAsker: "",
  answerGiver: "",
  currentAnswerBeingVoted: "",
  gameTimer: 0,
  votes: [0, 0],
  playersanswers: []
};

let currentFormState = {
  type: "", // "question", "answer", "voting", "none"
  initialized: false
};

//  game state from server
async function updateGameState() {
  if (!currentServerID) {
    return;
  }
  
  try {
    const response = await fetch(`/api/gamestate/${currentServerID}`);
    if (response.ok) {
      const data = await response.json();
      
      // change game state
      gameState = {
        phase: data.phase,
        questionAsker: data.questionAsker,
        answerGiver: data.answerGiver,
        currentAnswerBeingVoted: data.currentAnswerBeingVoted,
        gameTimer: data.gameTimer,
        votes: data.votes || [0, 0],
        playersanswers: data.playersanswers || []
      };
      
      if (JSON.stringify(messages) !== JSON.stringify(data.gameChat)) {
        messages = data.gameChat || [];
        renderMessages();
      }
      
      updateUI();
    }
  } catch (error) {
    console.error('Error fetching game state:', error);
  }
}

let gameStateInterval;

function startAdaptivePolling() {
  if (gameStateInterval) {
    clearInterval(gameStateInterval);
  }
  
  let pollRate = 1000;
  
  if (gameState.phase === "voting" || gameState.phase.startsWith('answer')) {
    pollRate = 500; // 0.5 seconds for important phases
  } else if (gameState.phase === "buffer" || gameState.phase === "waiting") {
    pollRate = 2000; // 2 seconds for less important phases
  }
  
  gameStateInterval = setInterval(updateGameState, pollRate);
}

function updateUI() {
  const currentUser = getCookieValue("name");
  const timerElement = document.getElementById("time");
  const questionElement = document.getElementById("question");
  const answerForm = document.getElementById("answerForm");
  const voteSection = document.getElementById("voteSection");
  const answerSection = document.querySelector(".answerSection");
  const previousPhase = gameState.phase;
  
  if (timerElement) {
    const minutes = Math.floor(gameState.gameTimer / 60);
    const seconds = gameState.gameTimer % 60;
    timerElement.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }
  
  updateAnswerSlots();
  
  let requiredFormType = "none";
  if (gameState.phase === "questioning" && gameState.questionAsker === currentUser) {
    requiredFormType = "question";
  } else if (gameState.phase.startsWith('answer') && gameState.answerGiver === currentUser) {
    requiredFormType = "answer";
  } else if (gameState.phase === "voting") {
    requiredFormType = "voting";
  } else if (gameState.phase === "buffer") {
    requiredFormType = "none"; r
  }
  
  if (answerSection) {
    if ((gameState.phase === "questioning" && gameState.questionAsker === currentUser) ||
        (gameState.phase.startsWith('answer') && gameState.answerGiver === currentUser)) {
      answerSection.style.display = "block";
    } else {
      answerSection.style.display = "none";
    }
  }
  
  if (currentFormState.type !== requiredFormType || !currentFormState.initialized) {
    currentFormState.type = requiredFormType;
    currentFormState.initialized = true;
    
    // show/hide sections based on phase and user role
    if (requiredFormType === "question") {
      showQuestionInput();
    } else if (requiredFormType === "answer") {
      showAnswerForm();
    } else if (requiredFormType === "voting") {
      showVotingInterface();
    } else {
      hideAllInteractiveElements();
    }
  } else if (requiredFormType === "voting") {
    updateVotingInterface();
  }
  
  if (gameState.phase !== previousPhase) {
    startAdaptivePolling();
  }
}

function showQuestionInput() {
  const answerForm = document.getElementById("answerForm");
  const answerSection = document.querySelector(".answerSection");
  const input = document.getElementById("answerhere");
  const button = answerForm.querySelector("button");
  
  input.placeholder = "Ask a question...";
  button.textContent = "Submit Question";
  answerForm.style.display = "block";
  answerSection.style.display = "block";
  document.getElementById("voteSection").style.display = "none";
  
  const answersGrid = document.querySelector(".answersGrid");
  if (answersGrid) {
    answersGrid.style.display = "none";
  }
  
  const sectionHeader = answerSection.querySelector(".sectionHdr h2");
  if (sectionHeader) {
    sectionHeader.textContent = "Ask Your Question";
  }
  
  const newForm = answerForm.cloneNode(true);
  answerForm.parentNode.replaceChild(newForm, answerForm);
  
  newForm.addEventListener("submit", async function(e) {
    e.preventDefault();
    const question = newForm.querySelector("input").value.trim();
    if (question) {
      await submitQuestion(question);
      newForm.querySelector("input").value = "";
    }
  });
}

function showAnswerForm() {
  const answerForm = document.getElementById("answerForm");
  const answerSection = document.querySelector(".answerSection");
  const input = document.getElementById("answerhere");
  const button = answerForm.querySelector("button");
  
  let answerNumber = 1;
  if (gameState.phase === "answer1") answerNumber = 1;
  else if (gameState.phase === "answer2") answerNumber = 2;
  else if (gameState.phase === "answer3") answerNumber = 3;
  else if (gameState.phase === "answer4") answerNumber = 4;
  
  const timeIsUp = gameState.gameTimer <= 0;
  
  if (timeIsUp) {
    input.placeholder = `Time's up for Answer ${answerNumber}! Moving to next...`;
    input.disabled = true;
    button.disabled = true;
    button.textContent = `Time's Up!`;
    
    const currentAnswerSlot = document.getElementById(`a${answerNumber}`);
    if (currentAnswerSlot && currentAnswerSlot.textContent === "Empty") {
      currentAnswerSlot.textContent = "Missed";
      currentAnswerSlot.style.backgroundColor = "#ffebee";
      currentAnswerSlot.style.color = "#d32f2f";
    }
  } else {
    input.placeholder = `Answer ${answerNumber}: Type your answer here...`;
    input.disabled = false;
    button.disabled = false;
    button.textContent = `Submit Answer ${answerNumber}`;
  }
  
  answerForm.style.display = "block";
  answerSection.style.display = "block";
  document.getElementById("voteSection").style.display = "none";
  
  const answersGrid = document.querySelector(".answersGrid");
  if (answersGrid) {
    answersGrid.style.display = "grid";
  }
  
  const sectionHeader = answerSection.querySelector(".sectionHdr h2");
  if (sectionHeader) {
    if (timeIsUp) {
      sectionHeader.textContent = `Answer ${answerNumber} - Time's Up! Moving to next...`;
    } else {
      sectionHeader.textContent = `Submit Answer ${answerNumber} of 4 (${gameState.gameTimer}s left)`;
    }
  }
  
  for (let i = 1; i <= 4; i++) {
    const answerSlot = document.getElementById(`a${i}`);
    if (answerSlot) {
      if (i === answerNumber) {
        if (timeIsUp) {
          answerSlot.style.border = "3px solid #d32f2f";
          answerSlot.style.backgroundColor = "#ffebee";
        } else {
          answerSlot.style.border = "3px solid #007bff";
          answerSlot.style.backgroundColor = "#e3f2fd";
        }
      } else if (i < answerNumber) {
        if (answerSlot.textContent !== "Empty" && answerSlot.textContent !== "Missed") {
          answerSlot.style.border = "2px solid #4caf50";
          answerSlot.style.backgroundColor = "#e8f5e8";
        } else {
          answerSlot.style.border = "2px solid #f44336";
          answerSlot.style.backgroundColor = "#ffebee";
        }
      } else {
        answerSlot.style.border = "2px solid #ddd";
        answerSlot.style.backgroundColor = "#f8f9fa";
        answerSlot.style.color = "#666";
      }
    }
  }
  
  const newForm = answerForm.cloneNode(true);
  answerForm.parentNode.replaceChild(newForm, answerForm);
  
  newForm.addEventListener("submit", async function(e) {
    e.preventDefault();
    const answer = newForm.querySelector("input").value.trim();
    if (answer && !timeIsUp) {
      await submitAnswer(answer);
      newForm.querySelector("input").value = "";
      
      const currentAnswerSlot = document.getElementById(`a${answerNumber}`);
      if (currentAnswerSlot) {
        currentAnswerSlot.style.border = "3px solid #4caf50";
        currentAnswerSlot.style.backgroundColor = "#e8f5e8";
        currentAnswerSlot.style.color = "#2e7d32";
      }
      
      await updateGameState();
    }
  });
}

function showVotingInterface() {
  const voteSection = document.getElementById("voteSection");
  const voteAnswerText = document.getElementById("voteAnswerText");
  
  if (voteAnswerText) {
    voteAnswerText.textContent = gameState.currentAnswerBeingVoted;
  }
  
  const voteButtons = document.querySelectorAll('.voteBtn');
  voteButtons.forEach(button => {
    button.disabled = false;
    button.style.opacity = '1';
    button.style.cursor = 'pointer';
  });
  
  voteSection.style.display = "block";
  document.getElementById("answerForm").style.display = "none";
}

function updateVotingInterface() {
  const voteAnswerText = document.getElementById("voteAnswerText");
  if (voteAnswerText && voteAnswerText.textContent !== gameState.currentAnswerBeingVoted) {
    voteAnswerText.textContent = gameState.currentAnswerBeingVoted;
    
    const voteButtons = document.querySelectorAll('.voteBtn');
    voteButtons.forEach(button => {
      button.disabled = false;
      button.style.opacity = '1';
      button.style.cursor = 'pointer';
    });
  }
}

function hideAllInteractiveElements() {
  document.getElementById("answerForm").style.display = "none";
  document.getElementById("voteSection").style.display = "none";
  const answerSection = document.querySelector(".answerSection");
  if (answerSection) {
    answerSection.style.display = "none";
  }
  const answersGrid = document.querySelector(".answersGrid");
  if (answersGrid) {
    answersGrid.style.display = "none";
  }
}

// gme actions
async function submitQuestion(question) {
  if (!currentServerID) {
    return;
  }
  
  try {
    const response = await fetch(`/api/submit-question/${currentServerID}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ question, user: getCookieValue("name") }),
    });
    
    if (!response.ok) {
      const error = await response.json();
      console.error('Error submitting question:', error.error);
    }
  } catch (error) {
    console.error('Error submitting question:', error);
  }
}

async function submitAnswer(answer) {
  if (!currentServerID) {
    return;
  }
  
  try {
    const response = await fetch(`/api/submit-answer/${currentServerID}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ answer, user: getCookieValue("name") }),
    });
    
    if (!response.ok) {
      const error = await response.json();
      console.error('Error submitting answer:', error.error);
    }
  } catch (error) {
    console.error('Error submitting answer:', error);
  }
}

async function countvote(approve) {
  if (!currentServerID) {
    return;
  }
  
  try {
    const response = await fetch(`/api/vote/${currentServerID}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ vote: approve, user: getCookieValue("name") }),
    });
    
    if (!response.ok) {
      const error = await response.json();
      console.error('Error submitting vote:', error.error);
      
      if (error.error === 'You have already voted on this answer') {
        alert('You have already voted on this answer!');
      }
    } else {
      const voteButtons = document.querySelectorAll('.voteBtn');
      voteButtons.forEach(button => {
        button.disabled = true;
        button.style.opacity = '0.5';
        button.style.cursor = 'not-allowed';
      });
    }
  } catch (error) {
    console.error('Error submitting vote:', error);
  }
}

document
  .getElementById("messageForm")
  .addEventListener("submit", function (event) {
    event.preventDefault();
    addnewmessage();
  });

window.addEventListener('beforeunload', () => {
  if (updateInterval) {
    clearInterval(updateInterval);
  }
});

function getCookieValue(name) {
  const value = document.cookie
    .split("; ")
    .find((row) => row.startsWith(name + "="))
    ?.split("=")[1];
  return value ? decodeURIComponent(value) : null;
}

function updateAnswerSlots() {
  for (let i = 1; i <= 4; i++) {
    const answerSlot = document.getElementById(`a${i}`);
    if (answerSlot) {
      const currentText = answerSlot.textContent;
      const newText = gameState.playersanswers && gameState.playersanswers[i - 1] ? gameState.playersanswers[i - 1] : "Empty";
      
      if (currentText !== newText && newText !== "Empty") {
        answerSlot.textContent = newText;
        if (currentText === "Empty" || currentText === "Missed") {
          answerSlot.style.border = "2px solid #4caf50";
          answerSlot.style.backgroundColor = "#e8f5e8";
          answerSlot.style.color = "#2e7d32";
        }
      } else if (currentText !== "Missed" && newText === "Empty") {
        answerSlot.textContent = "Empty";
      }
    }
  }
}

//  adaptive polling
startAdaptivePolling();
initializeGame();

function getCurrentServerID() {
  const urlParams = new URLSearchParams(window.location.search);
  const serverIDFromURL = urlParams.get('serverID');
  
  if (serverIDFromURL) {
    currentServerID = parseInt(serverIDFromURL);
    document.cookie = `serverID=${currentServerID}; path=/`;
    return currentServerID;
  }
  
  const serverIDFromCookie = getCookieValue("serverID");
  if (serverIDFromCookie) {
    currentServerID = parseInt(serverIDFromCookie);
    return currentServerID;
  }
  
  console.error("No server ID found, redirecting to home");
  window.location.href = "/";
  return null;
}


