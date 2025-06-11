const messageDiv = document.getElementById("messages");

var hasVoted = false;

let messages = [];
let updateInterval;

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
  console.log(name);
  document.getElementById("currentPlayer").innerHTML = name;
  
  // Initial update
  await updateGameState();
}

async function addnewmessage() {
  const user = getCookieValue("name");
  const messageForm = document.getElementById("messagehere");
  const messageContent = messageForm.value;
  
  if (!messageContent.trim()) {
    return; 
  }
  
  try {
    const response = await fetch('/api/gamechat', {
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
    
    // Trigger immediate update to show new message
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
      // Server messages get special styling
      MessageHTML = `<p class="server-message"><span class="server-sender">${message.user}</span>: <span class="server-text">${message.message}</span></p>`;
    } else {
      // Regular player messages
      MessageHTML = `<p><span class="sender">${message.user}</span> : <span class="message">${message.message}</span></p>`;
    }
    
    messageDiv.insertAdjacentHTML("beforeend", MessageHTML);
  }
  
  // Auto-scroll to the bottom of the chat
  messageDiv.scrollTop = messageDiv.scrollHeight;
}

// Game state management
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
  type: "", // "question", "answer", "voting", or "none"
  initialized: false
};

//  game state from server
async function updateGameState() {
  try {
    const response = await fetch('/api/gamestate');
    if (response.ok) {
      const data = await response.json();
      
      // Update game state
      gameState = {
        phase: data.phase,
        questionAsker: data.questionAsker,
        answerGiver: data.answerGiver,
        currentAnswerBeingVoted: data.currentAnswerBeingVoted,
        gameTimer: data.gameTimer,
        votes: data.votes || [0, 0],
        playersanswers: data.playersanswers || []
      };
      
      // Update chat messages if they've changed
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

// Start game state updates with adaptive polling
let gameStateInterval;

function startAdaptivePolling() {
  if (gameStateInterval) {
    clearInterval(gameStateInterval);
  }
  
  // Determine polling rate based on game phase
  let pollRate = 1000; // Default 1 second
  
  if (gameState.phase === "voting" || gameState.phase.startsWith('answer')) {
    pollRate = 500; // 0.5 seconds for time-critical phases
  } else if (gameState.phase === "buffer" || gameState.phase === "waiting") {
    pollRate = 2000; // 2 seconds for less critical phases
  }
  
  gameStateInterval = setInterval(updateGameState, pollRate);
}

// Update UI based on game state
function updateUI() {
  const currentUser = getCookieValue("name");
  const timerElement = document.getElementById("time");
  const questionElement = document.getElementById("question");
  const answerForm = document.getElementById("answerForm");
  const voteSection = document.getElementById("voteSection");
  const answerSection = document.querySelector(".answerSection");
  const previousPhase = gameState.phase;
  
  // Update timer
  if (timerElement) {
    const minutes = Math.floor(gameState.gameTimer / 60);
    const seconds = gameState.gameTimer % 60;
    timerElement.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }
  
  // Update answer slots with submitted answers
  updateAnswerSlots();
  
  // Determine what form type should be shown
  let requiredFormType = "none";
  if (gameState.phase === "questioning" && gameState.questionAsker === currentUser) {
    requiredFormType = "question";
  } else if (gameState.phase.startsWith('answer') && gameState.answerGiver === currentUser) {
    requiredFormType = "answer";
  } else if (gameState.phase === "voting") {
    requiredFormType = "voting";
  } else if (gameState.phase === "buffer") {
    requiredFormType = "none"; // Hide all interactive elements during buffer
  }
  
  // Show/hide the entire answer section based on whether current user is asking or answering
  if (answerSection) {
    if ((gameState.phase === "questioning" && gameState.questionAsker === currentUser) ||
        (gameState.phase.startsWith('answer') && gameState.answerGiver === currentUser)) {
      answerSection.style.display = "block";
    } else {
      answerSection.style.display = "none";
    }
  }
  
  // Only update forms if the required type has changed
  if (currentFormState.type !== requiredFormType || !currentFormState.initialized) {
    currentFormState.type = requiredFormType;
    currentFormState.initialized = true;
    
    // Show/hide sections based on phase and user role
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
    // Update voting interface content without recreating it
    updateVotingInterface();
  }
  
  // Restart polling with new rate if phase changed
  if (gameState.phase !== previousPhase) {
    startAdaptivePolling();
  }
}

function showQuestionInput() {
  // Convert answer form to question form temporarily
  const answerForm = document.getElementById("answerForm");
  const answerSection = document.querySelector(".answerSection");
  const input = document.getElementById("answerhere");
  const button = answerForm.querySelector("button");
  
  input.placeholder = "Ask a question...";
  button.textContent = "Submit Question";
  answerForm.style.display = "block";
  answerSection.style.display = "block"; // Show the section for question input
  document.getElementById("voteSection").style.display = "none";
  
  // Hide the answer grid during questioning
  const answersGrid = document.querySelector(".answersGrid");
  if (answersGrid) {
    answersGrid.style.display = "none";
  }
  
  // Update section header for questioning
  const sectionHeader = answerSection.querySelector(".sectionHdr h2");
  if (sectionHeader) {
    sectionHeader.textContent = "Ask Your Question";
  }
  
  // Remove old event listeners and add new one for question submission
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
  
  // Determine which answer number we're on
  let answerNumber = 1;
  if (gameState.phase === "answer1") answerNumber = 1;
  else if (gameState.phase === "answer2") answerNumber = 2;
  else if (gameState.phase === "answer3") answerNumber = 3;
  else if (gameState.phase === "answer4") answerNumber = 4;
  
  // Check if time is up (timer at 0) and show appropriate message
  const timeIsUp = gameState.gameTimer <= 0;
  
  if (timeIsUp) {
    input.placeholder = `Time's up for Answer ${answerNumber}! Moving to next...`;
    input.disabled = true;
    button.disabled = true;
    button.textContent = `Time's Up!`;
    
    // Show which answer we missed
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
  
  // Show the answer grid during answering
  const answersGrid = document.querySelector(".answersGrid");
  if (answersGrid) {
    answersGrid.style.display = "grid";
  }
  
  // Update section header for answering with current answer number and timer info
  const sectionHeader = answerSection.querySelector(".sectionHdr h2");
  if (sectionHeader) {
    if (timeIsUp) {
      sectionHeader.textContent = `Answer ${answerNumber} - Time's Up! Moving to next...`;
    } else {
      sectionHeader.textContent = `Submit Answer ${answerNumber} of 4 (${gameState.gameTimer}s left)`;
    }
  }
  
  // Style the answer slots based on current state
  for (let i = 1; i <= 4; i++) {
    const answerSlot = document.getElementById(`a${i}`);
    if (answerSlot) {
      if (i === answerNumber) {
        if (timeIsUp) {
          // Current answer time is up - show red/warning style
          answerSlot.style.border = "3px solid #d32f2f";
          answerSlot.style.backgroundColor = "#ffebee";
        } else {
          // Current answer - show active blue style
          answerSlot.style.border = "3px solid #007bff";
          answerSlot.style.backgroundColor = "#e3f2fd";
        }
      } else if (i < answerNumber) {
        // Previous answers - show completed or missed style
        if (answerSlot.textContent !== "Empty" && answerSlot.textContent !== "Missed") {
          // Completed answer
          answerSlot.style.border = "2px solid #4caf50";
          answerSlot.style.backgroundColor = "#e8f5e8";
        } else {
          // Missed answer
          answerSlot.style.border = "2px solid #f44336";
          answerSlot.style.backgroundColor = "#ffebee";
        }
      } else {
        // Future answers - show default style
        answerSlot.style.border = "2px solid #ddd";
        answerSlot.style.backgroundColor = "#f8f9fa";
        answerSlot.style.color = "#666";
      }
    }
  }
  
  // Remove old event listeners and add new one for answer submission
  const newForm = answerForm.cloneNode(true);
  answerForm.parentNode.replaceChild(newForm, answerForm);
  
  newForm.addEventListener("submit", async function(e) {
    e.preventDefault();
    const answer = newForm.querySelector("input").value.trim();
    if (answer && !timeIsUp) {
      await submitAnswer(answer);
      newForm.querySelector("input").value = "";
      
      // Show immediate feedback that answer was submitted
      const currentAnswerSlot = document.getElementById(`a${answerNumber}`);
      if (currentAnswerSlot) {
        currentAnswerSlot.style.border = "3px solid #4caf50";
        currentAnswerSlot.style.backgroundColor = "#e8f5e8";
        currentAnswerSlot.style.color = "#2e7d32";
      }
      
      // Immediately update game state to show the new answer
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
  
  // Re-enable voting buttons for new answer
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
  // Update voting interface content without recreating the entire interface
  const voteAnswerText = document.getElementById("voteAnswerText");
  if (voteAnswerText && voteAnswerText.textContent !== gameState.currentAnswerBeingVoted) {
    voteAnswerText.textContent = gameState.currentAnswerBeingVoted;
    
    // Re-enable voting buttons for new answer
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

// API calls for game actions
async function submitQuestion(question) {
  try {
    const response = await fetch('/api/submit-question', {
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
  try {
    const response = await fetch('/api/submit-answer', {
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
  try {
    const response = await fetch('/api/vote', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ vote: approve, user: getCookieValue("name") }),
    });
    
    if (!response.ok) {
      const error = await response.json();
      console.error('Error submitting vote:', error.error);
      
      // Show error message to user if they already voted
      if (error.error === 'You have already voted on this answer') {
        alert('You have already voted on this answer!');
      }
    } else {
      // Disable voting buttons after successful vote
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

// Chat message form handler
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

// Function to update answer slots with submitted answers
function updateAnswerSlots() {
  for (let i = 1; i <= 4; i++) {
    const answerSlot = document.getElementById(`a${i}`);
    if (answerSlot) {
      const currentText = answerSlot.textContent;
      const newText = gameState.playersanswers && gameState.playersanswers[i - 1] ? gameState.playersanswers[i - 1] : "Empty";
      
      // Only update text content, preserve existing styling
      if (currentText !== newText && newText !== "Empty") {
        answerSlot.textContent = newText;
        // If we just got a new answer, apply completed styling
        if (currentText === "Empty" || currentText === "Missed") {
          answerSlot.style.border = "2px solid #4caf50";
          answerSlot.style.backgroundColor = "#e8f5e8";
          answerSlot.style.color = "#2e7d32";
        }
      } else if (currentText !== "Missed" && newText === "Empty") {
        // Only set to Empty if it's not already marked as Missed
        answerSlot.textContent = "Empty";
      }
    }
  }
}

// Initialize adaptive polling
startAdaptivePolling();
initializeGame();


