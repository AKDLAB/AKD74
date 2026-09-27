document.addEventListener("DOMContentLoaded", function () {
  var toggle = document.querySelector(".nav-toggle");
  var nav = document.querySelector(".main-nav");
  if (toggle && nav) {
    toggle.addEventListener("click", function () {
      nav.classList.toggle("open");
    });
  }

  var panel = document.querySelector(".stats-row");
  if (panel) initStats(panel);
});

function initStats(panel) {
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var cards = panel.querySelectorAll(".stat");
  var counters = panel.querySelectorAll("[data-count]");

  cards.forEach(function (card, i) { card.style.setProperty("--n", i); });

  if (!reduced && "IntersectionObserver" in window) {
    panel.classList.add("anim-armed");
    counters.forEach(function (el) { el.textContent = "0"; });
    var io = new IntersectionObserver(function (entries) {
      if (!entries[0].isIntersecting) return;
      io.disconnect();
      panel.classList.add("in-view");
      counters.forEach(countUp);
    }, { threshold: 0.25 });
    io.observe(panel);
  }

  if (!reduced && window.matchMedia("(hover: hover)").matches) {
    cards.forEach(function (card) {
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

  initColumnTips(panel);
  initDonutLinks(panel);
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
