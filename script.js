document.addEventListener("DOMContentLoaded", function () {
  var toggle = document.querySelector(".nav-toggle");
  var nav = document.querySelector(".main-nav");
  if (toggle && nav) {
    toggle.addEventListener("click", function () {
      nav.classList.toggle("open");
    });
  }

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!reduced) {
    initReveal();
    if (window.matchMedia("(hover: hover)").matches) initTilt();
  }

  var panel = document.querySelector(".stats-row");
  if (panel) {
    initColumnTips(panel);
    initDonutLinks(panel);
  }
});

function initReveal() {
  if (!("IntersectionObserver" in window)) return;
  var containers = document.querySelectorAll(".reveal");
  if (!containers.length) return;

  var io = new IntersectionObserver(function (entries) {
    var batch = 0;
    entries.forEach(function (e) {
      if (!e.isIntersecting) return;
      io.unobserve(e.target);
      e.target.style.setProperty("--n", batch++);
      e.target.classList.add("in-view");
      var box = e.target.closest(".reveal");
      if (!box.classList.contains("in-view")) {
        box.classList.add("in-view");
        box.querySelectorAll("[data-count]").forEach(countUp);
      }
    });
  }, { threshold: 0.2 });

  containers.forEach(function (box) {
    box.classList.add("anim-armed");
    box.querySelectorAll("[data-count]").forEach(function (el) { el.textContent = "0"; });
    box.querySelectorAll(".tilt").forEach(function (card) { io.observe(card); });
  });
}

function initTilt() {
  document.querySelectorAll(".tilt").forEach(function (card) {
    card.addEventListener("mousemove", function (e) {
      var r = card.getBoundingClientRect();
      var px = (e.clientX - r.left) / r.width;
      var py = (e.clientY - r.top) / r.height;
      card.classList.add("is-tilting");
      card.style.setProperty("--ry", ((px - 0.5) * 12).toFixed(2) + "deg");
      card.style.setProperty("--rx", ((0.5 - py) * 10).toFixed(2) + "deg");
      card.style.setProperty("--mx", (px * 100).toFixed(1) + "%");
      card.style.setProperty("--my", (py * 100).toFixed(1) + "%");
    });
    card.addEventListener("mouseleave", function () {
      card.classList.remove("is-tilting");
      card.style.setProperty("--rx", "0deg");
      card.style.setProperty("--ry", "0deg");
    });
  });
}

function countUp(el) {
  var target = parseInt(el.getAttribute("data-count"), 10);
  var start = null;
  var duration = 1600;
  function step(ts) {
    if (start === null) start = ts;
    var t = Math.min((ts - start) / duration, 1);
    var eased = 1 - Math.pow(1 - t, 3);
    el.textContent = Math.round(target * eased).toLocaleString("en-US");
    if (t < 1) requestAnimationFrame(step);
  }
  setTimeout(function () { requestAnimationFrame(step); }, 300);
}

function initColumnTips(panel) {
  var box = panel.querySelector(".chart-box");
  if (!box) return;
  var tip = box.querySelector(".chart-tip");
  var bars = box.querySelectorAll(".bar");
  box.querySelectorAll(".hit").forEach(function (hit, i) {
    function show() {
      var b = bars[i].getBoundingClientRect();
      var c = box.getBoundingClientRect();
      tip.textContent = hit.getAttribute("data-tip");
      tip.style.left = (b.left - c.left + b.width / 2) + "px";
      tip.style.top = (b.top - c.top - 6) + "px";
      tip.hidden = false;
      bars[i].classList.add("is-hot");
    }
    function hide() {
      tip.hidden = true;
      bars[i].classList.remove("is-hot");
    }
    hit.addEventListener("mouseenter", show);
    hit.addEventListener("focus", show);
    hit.addEventListener("mouseleave", hide);
    hit.addEventListener("blur", hide);
  });
}

function initDonutLinks(panel) {
  var donut = panel.querySelector(".donut");
  if (!donut) return;
  var items = panel.querySelectorAll(".donut-seg, .donut-legend li");
  items.forEach(function (el) {
    var key = el.getAttribute("data-key");
    el.addEventListener("mouseenter", function () {
      donut.classList.add("has-focus");
      items.forEach(function (o) { o.classList.toggle("is-hot", o.getAttribute("data-key") === key); });
    });
    el.addEventListener("mouseleave", function () {
      donut.classList.remove("has-focus");
      items.forEach(function (o) { o.classList.remove("is-hot"); });
    });
  });
}
