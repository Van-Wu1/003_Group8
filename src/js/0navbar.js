document.addEventListener('DOMContentLoaded', function () {
  const sidebar = document.getElementById('sidebar');
  const toggle = document.querySelector('.menu-toggle');

  // 绑定菜单点击事件
  toggle.addEventListener('click', function () {
    sidebar.classList.toggle('show');
  });

  // 点击其他区域时关闭菜单
  document.addEventListener('click', function (event) {
    const isClickInside = sidebar.contains(event.target) || toggle.contains(event.target);
    console.log("click了");

    if (!isClickInside && sidebar.classList.contains('show')) {
      sidebar.classList.remove('show');
      console.log("右侧折叠菜单没拦截");
    }
  });
});
