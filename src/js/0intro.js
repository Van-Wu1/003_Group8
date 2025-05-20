function countupEffect(el) {
  const value = parseFloat(el.dataset.value);
  const suffix = el.dataset.suffix || '';
  const label = el.querySelector('span')?.innerText || '';
  let start = 0;
  const duration = 1500;
  const step = 20;
  const increment = value / (duration / step);

  const counter = setInterval(() => {
    start += increment;
    if (start >= value) {
      start = value;
      clearInterval(counter);
    }
    el.innerHTML = (value < 10 ? start.toFixed(1) : Math.floor(start)) + suffix + '<br><span>' + label + '</span>';
  }, step);
}

function revealSectionsOnScroll() {
  const animatedEls = document.querySelectorAll('.fade-slide, .zoom-in');

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('active');
        if (entry.target.classList.contains('zoom-in') && !entry.target.classList.contains('counted')) {
          countupEffect(entry.target);
          entry.target.classList.add('counted');
        }
      } else {
        entry.target.classList.remove('active');
      }
    });
  }, { threshold: 0.4 });

  animatedEls.forEach(el => observer.observe(el));
}

window.addEventListener('DOMContentLoaded', () => {
  revealSectionsOnScroll();
});