document.addEventListener("DOMContentLoaded", () => {
  console.log("✅ JS 已加载");

  const exploreBtn = document.getElementById("exploreBtn");
  const extra = document.getElementById("methodology-extra");

  console.log("🔘 按钮：", exploreBtn);
  console.log("📦 内容区：", extra);

  if (!exploreBtn || !extra) {
    console.warn("⚠️ 找不到按钮或内容块");
    return;
  }

  exploreBtn.addEventListener("click", () => {
    console.log("🎯 点击了 Explore");
    extra.classList.remove("hidden");
    extra.classList.add("reveal");
    const intro = document.querySelector(".intro-content");
    if (intro) {
  intro.classList.add("fade-out");
  setTimeout(() => {
    intro.style.display = "none";
  }, 600); // 和 CSS 动画时间保持一致
}

  });
});




