document.addEventListener('DOMContentLoaded', function () {
  const sidebar = document.getElementById('sidebar');
  const toggle = document.querySelector('.menu-toggle');

  // Binding menu click events
  toggle.addEventListener('click', function () {
    sidebar.classList.toggle('show');
  });

  // Close menu when clicking on other areas
  document.addEventListener('click', function (event) {
    const isClickInside = sidebar.contains(event.target) || toggle.contains(event.target);
    console.log("click");

    if (!isClickInside && sidebar.classList.contains('show')) {
      sidebar.classList.remove('show');
      console.log("Right side collapsed menu not blocked");
    }
  });
});
