const snowContainer = document.querySelector(".snow");
const flakeCount = 50; // change this number for more/less snow

for (let i = 0; i < flakeCount; i++) {
  const flake = document.createElement("div");
  flake.classList.add("snowflake");
  flake.textContent = "❄";

  // random horizontal position
  flake.style.left = Math.random() * 100 + "vw";

  // random size
  flake.style.fontSize = (Math.random() * 10 + 10) + "px";

  // random fall duration
  flake.style.animationDuration = (Math.random() * 5 + 5) + "s";

  // random delay so they don't fall in sync
  flake.style.animationDelay = (Math.random() * 5) + "s";

  snowContainer.appendChild(flake);
}
