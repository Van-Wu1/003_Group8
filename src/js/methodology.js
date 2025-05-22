document.addEventListener("DOMContentLoaded", () => {
  const exploreBtn = document.getElementById("exploreBtn");
  const extra = document.getElementById("methodology-extra");
  const introScreen = document.getElementById("intro-screen"); // ✅ 改成整个块

  if (!exploreBtn || !extra || !introScreen) return;

  exploreBtn.addEventListener("click", () => {
    console.log("🎯 点击了 Explore");

    // 让 intro 整块上滑消失
    introScreen.classList.add("slide-up");

    // 等待动画结束后再展示新内容
    setTimeout(() => {
      introScreen.style.display = "none";
      extra.classList.remove("hidden");
      extra.classList.add("reveal");
    }, 800);  // 和 transition 一致
  });
});






