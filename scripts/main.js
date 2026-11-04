/**
 * Super-Agent 工单自动化编排演示站的全站共享脚本：移动端导航菜单。
 *
 * 桌面端导航始终可见；窄屏（< 768px）时由菜单按钮展开/收起。
 */

function initNavigation() {
  const toggle = document.querySelector("[data-nav-toggle]");
  const nav = document.getElementById("primary-nav");
  if (!toggle || !nav) {
    return;
  }

  const setOpen = (open) => {
    nav.classList.toggle("is-open", open);
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "关闭导航菜单" : "打开导航菜单");
  };

  toggle.addEventListener("click", () => {
    setOpen(toggle.getAttribute("aria-expanded") !== "true");
  });

  nav.addEventListener("click", (event) => {
    if (event.target.closest("a")) {
      setOpen(false);
    }
  });

  document.addEventListener("click", (event) => {
    const open = toggle.getAttribute("aria-expanded") === "true";
    if (
      open &&
      !nav.contains(event.target) &&
      !toggle.contains(event.target)
    ) {
      setOpen(false);
    }
  });

  document.addEventListener("keydown", (event) => {
    if (
      event.key === "Escape" &&
      toggle.getAttribute("aria-expanded") === "true"
    ) {
      setOpen(false);
      toggle.focus();
    }
  });

  const desktopQuery = window.matchMedia("(min-width: 768px)");
  desktopQuery.addEventListener("change", (event) => {
    if (event.matches) {
      setOpen(false);
    }
  });

  setOpen(false);
}

if (typeof document !== "undefined") {
  initNavigation();
}
