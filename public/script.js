let currentQuestionId = null;

async function loadQuestion() {
  try {
    const res = await fetch("/question");
    const data = await res.json();
    currentQuestionId = data.id;
    document.getElementById("question").innerText = data.question;
    const choicesDiv = document.getElementById("choices");
    choicesDiv.innerHTML = "";
    if (data.choices) {
      data.choices.split(",").forEach(choice => {
        const btn = document.createElement("button");
        btn.innerText = choice.trim();
        btn.onclick = () => document.getElementById("answer").value = choice.trim();
        choicesDiv.appendChild(btn);
      });
    }
  } catch (err) {
    console.error("Failed to load question:", err);
  }
}

async function loadAnnouncement() {
  try {
    const res = await fetch("/announcement");
    const data = await res.json();
    document.getElementById("noteArea").value = data.text;
  } catch (err) {
    console.error(err);
  }
}

async function submitAnswer() {
  const user = document.getElementById("username").value.trim();
  const answer = document.getElementById("answer").value.trim();
  if (!user || !answer) return alert("Please enter your name and answer!");

  try {
    const res = await fetch("/answer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_name: user, answer }),
    });
    if (res.ok) {
      alert("Answer submitted!");
      document.getElementById("username").value = "";
      document.getElementById("answer").value = "";
    }
  } catch (err) {
    console.error(err);
    alert("Failed to submit answer.");
  }
}

loadQuestion();
loadAnnouncement();
