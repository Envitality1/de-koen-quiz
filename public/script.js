let currentQuestionId = null;

// Load the latest question
async function loadQuestion() {
  try {
    const res = await fetch("/question");
    const data = await res.json();
    currentQuestionId = data.id;
    document.getElementById("question").innerText = data.question || "No question found.";

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
    console.error(err);
  }
}

// Submit the user's answer
async function submitAnswer() {
  const user = document.getElementById("username").value.trim();
  const answer = document.getElementById("answer").value.trim();
  if (!user || !answer) { alert("Fill everything in."); return; }

  const res = await fetch("/answer", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_name: user, answer, question_id: currentQuestionId })
  });

  alert(res.ok ? "Submitted!" : "Failed.");
}

// Notepad persistence
const noteArea = document.getElementById("noteArea");
noteArea.value = localStorage.getItem("announcement_text") || "";

noteArea.addEventListener("input", () => {
  localStorage.setItem("announcement_text", noteArea.value);
});


loadQuestion();
