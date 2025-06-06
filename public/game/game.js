const messageDiv = document.getElementById("messages");

messages = [
  { user: "asdlkl;,", message: "Hi" },
  { user: "alex", message: "Hi" },
  { user: "james", message: "Nope" },
];
renderMessages();
var name = getCookieValue("name");
if(!name){
    // update cookie with guest name
    const guestName = "Guest" + Math.round(Math.random() * 1000000);
    console.log(guestName);
    document.cookie = "name=" + guestName;
    name = guestName;
}
console.log(name);

function addnewmessage() {
  const user = getCookieValue("name");
  const messageForm = document.getElementById("messagehere");
  const messageContent = messageForm.value;
  messages.push({ user: user, message: messageContent });
  renderMessages();
  removeFirstMessage();
}
function removeFirstMessage() {
  if (messages.length > 7) {
    messages.splice(0, 1);
  }
  renderMessages();
}
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
  });
function getCookieValue(name) {
  const value = document.cookie
    .split("; ")
    .find((row) => row.startsWith(name + "="))
    ?.split("=")[1];
  return value ? decodeURIComponent(value) : null;
}

answers = {
    content: "",
    content: "",
    content: ""
}

let answernum = 0;

function addanswers(){
    const user = getCookieValue("name");
    const answerForm = document.getElementById("answerhere");
    const answerContent = answerForm.value;
    messages.push({ user: user, message: messageContent });
    renderAnswers();
    removeFirstMessage();
}
function renderAnswers() {
    messageDiv.innerHTML = "";
    for (let i = 0; i < messages.length; i++) {
      let MessageHTML = ` <p><span class="sender">${messages[i].user}</span> : <span class="message">${messages[i].message}</span></p>`;
      messageDiv.insertAdjacentHTML("beforeend", MessageHTML);
    }
  }
console.log(name);
document.getElementById("currentPlayer").innerHTML = name;

