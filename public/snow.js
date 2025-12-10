const snowContainer = document.querySelector(".snow");
const snowflakes = 50;

function createSnowflake() {
  const flake = document.createElement("div");
  flake.classList.add("snowflake");
  flake.style.left = Math.random() * 100 + "vw";
  flake.style.fontSize = (Math.random() * 10 + 10) + "px";
  flake.style.animationDuration = (Math.random() * 5 + 5) + "s";
  flake.style.opacity = Math.random();
  flake.innerText = "❄";

  snowContainer.appendChild(flake);

  // remove the snowflake after it falls (same duration as animation)
  setTimeout(() => {
    flake.remove();
  }, parseFloat(flake.style.animationDuration) * 1000);
}

// create an initial batch of snowflakes
for (let i = 0; i < snowflakes; i++) {
  createSnowflake();
}

// continuously create new snowflakes
setInterval(createSnowflake, 200);
