// Typing animation
const typeText = (element, text, delay = 60, callback = null) => {
  let i = 0;
  const type = () => {
    if (i < text.length) {
      element.textContent += text.charAt(i);
      i++;
      setTimeout(type, delay);
    } else if (callback) {
      callback();
    }
  };
  type();
};

document.addEventListener("DOMContentLoaded", () => {
  const line1 = document.getElementById("typed-line1");
  const line2 = document.getElementById("typed-line2");

  const text1 = "Connecting Cities,";
  const text2 = "Through Pharmaceutical.";

  // reserve a place in advance
  line1.innerHTML = "&nbsp;";
  line2.innerHTML = "&nbsp;";

  setTimeout(() => {
    line1.innerHTML = "";
    typeText(line1, text1, 50, () => {
      setTimeout(() => {
        line2.innerHTML = "";
        typeText(line2, text2, 50);
      }, 300);
    });
  }, 200);
});


// Scroll Fade Animation
const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("visible");
      }
    });
  },
  {
    threshold: 0.15,
  }
);

document.querySelectorAll(".section").forEach((section) => {
  section.classList.add("fade-in");
  observer.observe(section);
});
