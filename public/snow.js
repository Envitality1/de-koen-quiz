const snowContainer = document.querySelector(".snow");
const snowflakes = 50;

for (let i = 0; i < snowflakes; i++) {
  const flake = document.createElement("div");
  flake.classList.add("snowflake");
  flake.style.left = Math.random() * 100 + "vw";
  flake.style.fontSize = (Math.random() * 10 + 10) + "px";
  flake.style.animationDuration = (Math.random() * 5 + 5) + "s";
  flake.style.opacity = Math.random();
  flake.innerText = "❄";
  snowContainer.appendChild(flake);
}
