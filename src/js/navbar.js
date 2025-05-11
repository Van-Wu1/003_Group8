function toggleMenu() {
  document.getElementById('sidebar').classList.toggle('show');
}

document.addEventListener('click', function (event) {
  const sidebar = document.getElementById('sidebar');
  const toggle = document.querySelector('.menu-toggle');
  const isClickInside = sidebar.contains(event.target) || toggle.contains(event.target);

  if (!isClickInside && sidebar.classList.contains('show')) {
    sidebar.classList.remove('show');
  }
});
