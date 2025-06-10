document.addEventListener("DOMContentLoaded", () => {
  const exploreBtn = document.getElementById("exploreBtn");
  const extra = document.getElementById("methodology-extra");
  const introScreen = document.getElementById("intro-screen"); 

  if (!exploreBtn || !extra || !introScreen) return;

  exploreBtn.addEventListener("click", () => {
    console.log("click Explore");

 
    introScreen.classList.add("slide-up");

    // Wait for the animation to finish before showing new content
    setTimeout(() => {
      introScreen.style.display = "none";
      extra.classList.remove("hidden");
      extra.classList.add("reveal");
    }, 800); 
  });
});