const answerDiv = document.getElementById("answers");

let answers = [];
let currentAnswerIndex = 1;
const maxAnswers = 4;

async function addnewmessage() {
    const answerForm = document.getElementById("answerhere");
    const answerContent = answerForm.value;
    
    if (!answerContent.trim()) {
      return; 
    }
    //ASK JAMES ABT TS
    try {
      const response = await fetch('/api/answers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ answer: answerContent, user: user }),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      answerForm.value = '';
      
      await updateAnswers();
    } catch (error) {
      console.error('Error sending message:', error);
    }
  }
  
  async function updateAnswers() {
    try {
      const response = await fetch('/api/answers');
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      // check if messages have changed 
      if (JSON.stringify(answers) !== JSON.stringify(data.answers)) {
        answers = data.answers || [];
        renderanswers();
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  }

function renderanswers(){
      
    const input = document.querySelector("input");
    const button = document.querySelector("button");
      
    document.getElementById("answerForm").addEventListener("submit", function(e) {
    e.preventDefault(); // Prevent form from reloading the page

    let info = fetch('/api/gameinfo');
    if(info[3] == 'answering'){
        const input = document.getElementById("answerhere");
        const answer = input.value.trim();

        if (answer === "" || currentAnswerIndex > maxAnswers) return;

        const span = document.getElementById("a" + currentAnswerIndex);
        span.textContent = `${answer}`;

        input.value = "";
        currentAnswerIndex++;
    }
  });
}

function clearAnswers(){
    let ans = 1;
    for(let x = ans; x<4; x++){
        const span = document.getElementById("a" + currentAnswerIndex);
        span.textContent = "";
    }
}

