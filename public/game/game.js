const messageDiv = document.getElementById("messages");

var hasVoted = false;

let messages = [];
let updateInterval;

// messages = [
//   { user: "asdlkl;,", message: "Hi" },
//   { user: "alex", message: "Hi" },
//   { user: "james", message: "Nope" },
// ];

// Initialize the game and start chat polling
async function initializeGame() {
  var name = getCookieValue("name");
  if(!name){
    window.location.href = "/";
  }
  console.log(name);
  document.getElementById("currentPlayer").innerHTML = name;
  
  await updateMessages();
  
  updateInterval = setInterval(updateMessages, 1000);
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
    
    await updateMessages();
  } catch (error) {
    console.error('Error sending message:', error);
  }
}

async function updateMessages() {
  try {
    const response = await fetch('/api/gamechat');
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (JSON.stringify(messages) !== JSON.stringify(data.gameChat)) {
      messages = data.gameChat || [];
      renderMessages();
    }
  } catch (error) {
    console.error('Error fetching messages:', error);
  }
}

// function removeFirstMessage() {
//   if (messages.length > 7) {
//     messages.splice(0, 1);
//   }
//   renderMessages();
// }

function renderMessages() {
  messageDiv.innerHTML = "";
  for (let i = 0; i < messages.length; i++) {
    let MessageHTML = ` <p><span class="sender">${messages[i].user}</span> : <span class="message">${messages[i].message}</span></p>`;
    messageDiv.insertAdjacentHTML("beforeend", MessageHTML);
  }
}

initializeGame();

addAnswers();

window.addEventListener('beforeunload', () => {
  if (updateInterval) {
    clearInterval(updateInterval);
  }
});

function addAnswers(){
    isVoting = false;
    let currentAnswerIndex = 1;
    const maxAnswers = 4;
      
    const input = document.querySelector("input");
    const button = document.querySelector("button");
      
    document.getElementById("answerForm").addEventListener("submit", function(e) {
    e.preventDefault(); // prevent form from reloading the page

    const input = document.getElementById("answerhere");
    const answer = input.value.trim();

    if (answer === "" || currentAnswerIndex > maxAnswers) return;

    const span = document.getElementById("a" + currentAnswerIndex);
    span.textContent = `${answer}`;

    input.value = "";
    currentAnswerIndex++;
  });
  isVoting = true;
}

function clearAnswers(){
    let ans = 1;
    for(let x = ans; x<4; x++){
        const span = document.getElementById("a" + currentAnswerIndex);
        span.textContent = "";
    }
}


document
  .getElementById("messageForm")
  .addEventListener("submit", function (event) {
    event.preventDefault();
    addnewmessage();
  });
function getCookieValue(name) {
  const value = document.cookie
    .split("; ")
    .find((row) => row.startsWith(name + "="))
    ?.split("=")[1];
  return value ? decodeURIComponent(value) : null;
}

async function leave(name){
    try{
        const response = await fetch('/api/leave', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ name: name }),
        });}
        catch (error){
            console.error("Failed to join:" + error);
            //redirect to home page
        }
}

// Add leaveGame function for the new UI
function leaveGame() {
  const name = getCookieValue("name");
  if (name) {
    leave(name);
  }
  window.location.href = "/";
}