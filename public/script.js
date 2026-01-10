let currentQuestionId = null;

// Load question
async function loadQuestion() {
  try {
    const res = await fetch("/question");
    const data = await res.json();

    currentQuestionId = data.id;
    document.getElementById("question").innerText =
      data.question || "No question available.";

    const choicesDiv = document.getElementById("choices");
    choicesDiv.innerHTML = "";

    if (data.choices) {
      data.choices.split(",").forEach(choice => {
        const btn = document.createElement("button");
        btn.innerText = choice.trim();
        btn.onclick = () =>
          document.getElementById("answer").value = choice.trim();
        choicesDiv.appendChild(btn);
      });
    }
  } catch (err) {
    console.error(err);
  }
}

// Load announcement text
async function loadAnnouncement() {
  const box = document.getElementById("announcementBox");
  try {
    const res = await fetch("/announcements");
    const data = await res.json();
    box.innerText = data.content || "No announcements yet.";
  } catch (err) {
    console.error(err);
    box.innerText = "Failed to load announcement.";
  }
}

// Submit answer
async function submitAnswer() {
  const user = document.getElementById("username").value.trim();
  const answer = document.getElementById("answer").value.trim();

  if (!user || !answer) {
    alert("Fill everything in.");
    return;
  }

  const res = await fetch("/answer", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      user_name: user,
      answer,
      question_id: currentQuestionId
    })
  });

  alert(res.ok ? "Submitted!" : "Failed.");
}

// Init
loadQuestion();
loadAnnouncement();
