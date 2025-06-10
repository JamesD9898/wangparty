const messageDiv = document.getElementById("messages");

let messages = [];
let updateInterval;

// start the game --> check if the user has a name, if not, create a guest name and update the cookie
// --> load initial messages, start polling for new messages
async function initializeGame() {
  var name = getCookieValue("name");
  if(!name){
    // update cookie with guest name
    const guestName = "Guest" + Math.round(Math.random() * 1000000);
    console.log(guestName);
    document.cookie = "name=" + guestName + "; path=/";
    name = guestName;
  }
  console.log(name);
  document.getElementById("currentPlayer").innerHTML = name;
  
  await updateMessages();
  
  updateInterval = setInterval(updateMessages, 1000);
}

// function to send a new message, adds to server array. 
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
    
    // check if messages have changed 
    if (JSON.stringify(messages) !== JSON.stringify(data.gameChat)) {
      messages = data.gameChat || [];
      renderMessages();
    }
  } catch (error) {
    console.error('Error fetching messages:', error);
  }
}

//render messages to the page loop
function renderMessages() {
  messageDiv.innerHTML = "";
  for (let i = 0; i < messages.length; i++) {
    let MessageHTML = ` <p><span class="sender">${messages[i].user}</span> : <span class="message">${messages[i].message}</span></p>`;
    messageDiv.insertAdjacentHTML("beforeend", MessageHTML);
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

initializeGame();

window.addEventListener('beforeunload', () => {
  if (updateInterval) {
    clearInterval(updateInterval);
  }
});