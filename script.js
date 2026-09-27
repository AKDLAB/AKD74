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

  var peopleData = document.getElementById("people-data");
  if (peopleData) initAiProfiles(JSON.parse(peopleData.textContent), reduced);
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

function profileLines(p) {
  var lines = [{ k: "Name", v: p.name }, { k: "Role", v: p.role }];
  (p.education || []).forEach(function (e) { lines.push({ k: e[0], v: e[1] }); });
  if (p.research) lines.push({ k: "Research", v: p.research });
  if (p.highlight) lines.push({ k: "Highlight", v: p.highlight });
  if (p.scholar) {
    lines.push({ k: "Google Scholar", v: p.scholar.citations + " citations · h-index " + p.scholar.h + " · i10-index " + p.scholar.i10 });
    lines.push({ k: "", v: "Open Google Scholar profile ↗", href: p.scholar.url });
  }
  if (p.email) lines.push({ k: "Email", v: p.email, href: "mailto:" + p.email });
  return lines;
}

function initAiProfiles(people, reduced) {
  var canHover = window.matchMedia("(hover: hover)").matches;
  var sound = createAiSound();
  var panel = document.createElement("div");
  panel.className = "ai-panel";
  panel.innerHTML =
    '<div class="ai-head"><span class="ai-dot"></span>MMST&middot;AI profile</div>' +
    '<button class="ai-close" type="button" aria-label="Close profile">&times;</button>' +
    '<div class="ai-body"></div>';
  var body = panel.querySelector(".ai-body");
  var active = null;
  var hideTimer = null;
  var runId = 0;

  document.querySelectorAll("[data-person]").forEach(function (card) {
    var p = people[card.getAttribute("data-person")];
    if (!p) return;
    var sr = document.createElement("span");
    sr.className = "sr-only";
    sr.textContent = "AI profile. " + profileLines(p).filter(function (l) { return l.k; })
      .map(function (l) { return l.k + ": " + l.v; }).join(". ");
    card.appendChild(sr);

    if (canHover) {
      card.addEventListener("mouseenter", function () { open(card); });
      card.addEventListener("mouseleave", scheduleHide);
    } else {
      card.addEventListener("click", function () { active === card ? hide() : open(card); });
    }
    card.addEventListener("focus", function () { open(card); });
    card.addEventListener("blur", function (e) {
      if (!panel.contains(e.relatedTarget)) scheduleHide();
    });
  });

  panel.addEventListener("mouseenter", cancelHide);
  panel.addEventListener("mouseleave", function () { if (canHover) scheduleHide(); });
  panel.addEventListener("focusout", function (e) {
    if (!panel.contains(e.relatedTarget) && e.relatedTarget !== active) scheduleHide();
  });
  panel.querySelector(".ai-close").addEventListener("click", hide);
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && active) hide(); });
  document.addEventListener("click", function (e) {
    if (!canHover && active && !panel.contains(e.target) && !active.contains(e.target)) hide();
  });
  window.addEventListener("resize", function () { if (active) position(active); });

  function open(card) {
    cancelHide();
    if (active === card) return;
    if (active) active.classList.remove("is-active", "is-scanning");
    active = card;
    card.classList.add("is-active");
    if (!reduced) {
      card.classList.remove("is-scanning");
      void card.offsetWidth;
      card.classList.add("is-scanning");
    }
    card.after(panel);
    panel.classList.toggle("is-sheet", !canHover);
    render(people[card.getAttribute("data-person")], card);
    requestAnimationFrame(function () { panel.classList.add("is-open"); });
    sound.scan();
  }

  function hide() {
    cancelHide();
    runId++;
    panel.classList.remove("is-open");
    if (active) active.classList.remove("is-active", "is-scanning");
    active = null;
  }

  function scheduleHide() {
    cancelHide();
    hideTimer = setTimeout(hide, 220);
  }

  function cancelHide() { clearTimeout(hideTimer); }

  function render(p, card) {
    var my = ++runId;
    var lines = profileLines(p);
    body.style.minHeight = "";
    body.innerHTML = "";
    var nodes = lines.map(function (l) {
      var row = document.createElement("div");
      row.className = "ai-line";
      if (l.k) {
        var k = document.createElement("span");
        k.className = "k";
        k.textContent = l.k;
        row.appendChild(k);
      }
      var v = document.createElement(l.href ? "a" : "span");
      v.className = "v";
      if (l.href) {
        v.href = l.href;
        if (l.href.indexOf("http") === 0) { v.target = "_blank"; v.rel = "noopener"; }
      }
      v.textContent = l.v;
      row.appendChild(v);
      body.appendChild(row);
      return { row: row, v: v, text: l.v };
    });

    position(card);
    if (reduced) return;

    body.style.minHeight = body.offsetHeight + "px";
    nodes.forEach(function (n) { n.row.hidden = true; n.v.textContent = ""; });
    var status = document.createElement("div");
    status.className = "ai-status";
    status.textContent = "› analyzing profile";
    body.insertBefore(status, body.firstChild);
    var caret = document.createElement("span");
    caret.className = "ai-caret";

    var dots = 0;
    var dotTimer = setInterval(function () {
      if (my !== runId) return clearInterval(dotTimer);
      status.textContent = "› analyzing profile" + ".".repeat(++dots % 4);
    }, 110);

    setTimeout(function () {
      clearInterval(dotTimer);
      if (my !== runId) return;
      status.remove();
      typeLine(0);
    }, 480);

    function typeLine(i) {
      if (my !== runId) return;
      if (i >= nodes.length) {
        caret.remove();
        sound.done();
        return;
      }
      var n = nodes[i];
      n.row.hidden = false;
      n.row.appendChild(caret);
      var pos = 0;
      (function tick() {
        if (my !== runId) return;
        pos = Math.min(pos + 3, n.text.length);
        n.v.textContent = n.text.slice(0, pos);
        if (n.text.charAt(pos - 1) !== " ") sound.blip();
        if (pos < n.text.length) setTimeout(tick, 16);
        else setTimeout(function () { typeLine(i + 1); }, 70);
      })();
    }
  }

  function position(card) {
    if (panel.classList.contains("is-sheet")) {
      panel.style.left = panel.style.top = "";
      return;
    }
    var r = card.getBoundingClientRect();
    var w = panel.offsetWidth;
    var h = panel.offsetHeight;
    var gap = 14;
    var vw = document.documentElement.clientWidth;
    var left;
    var top = r.top + window.scrollY;
    if (r.right + gap + w <= vw - 8) {
      left = r.right + gap;
    } else if (r.left - gap - w >= 8) {
      left = r.left - gap - w;
    } else {
      left = Math.max(8, Math.min(vw - w - 8, r.left + r.width / 2 - w / 2));
      top = r.bottom + window.scrollY + gap;
    }
    var maxTop = window.scrollY + window.innerHeight - h - 8;
    if (top > maxTop) top = Math.max(window.scrollY + 8, maxTop);
    panel.style.left = left + window.scrollX + "px";
    panel.style.top = top + "px";
  }
}

function createAiSound() {
  var btn = document.querySelector(".ai-sound-toggle");
  var ctx = null;
  var lastBlip = 0;
  var on = true;
  try { on = localStorage.getItem("mmst-ai-sound") !== "off"; } catch (e) {}

  function running() { return ctx && ctx.state === "running"; }

  function ensure() {
    if (!ctx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      ctx.onstatechange = update;
    }
    if (ctx.state === "suspended") ctx.resume();
  }

  function update() {
    if (!btn) return;
    var live = on && running();
    btn.setAttribute("aria-pressed", live ? "true" : "false");
    btn.querySelector(".label").textContent = !on ? "AI sound: off" : live ? "AI sound: on" : "Enable AI sound";
  }

  function unlock() {
    if (on) ensure();
    ["pointerdown", "keydown", "touchstart"].forEach(function (t) { document.removeEventListener(t, unlock); });
  }
  ["pointerdown", "keydown", "touchstart"].forEach(function (t) { document.addEventListener(t, unlock); });

  if (btn) {
    btn.hidden = false;
    btn.addEventListener("click", function () {
      if (on && !running()) {
        ensure();
      } else {
        on = !on;
        if (on) ensure();
      }
      try { localStorage.setItem("mmst-ai-sound", on ? "on" : "off"); } catch (e) {}
      update();
      if (on) setTimeout(done, 60);
    });
    update();
  }

  function tone(f1, f2, dur, type, vol, delay) {
    if (!on || !running()) return;
    var t = ctx.currentTime + (delay || 0);
    var o = ctx.createOscillator();
    var g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f1, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(ctx.destination);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  function blip() {
    var now = Date.now();
    if (now - lastBlip < 45) return;
    lastBlip = now;
    tone(1100 + Math.random() * 500, null, 0.03, "triangle", 0.025);
  }

  function scan() {
    tone(260, 1300, 0.3, "sine", 0.045);
    tone(1500, 900, 0.12, "triangle", 0.02, 0.18);
  }

  function done() {
    tone(1320, null, 0.08, "sine", 0.035);
    tone(1760, null, 0.12, "sine", 0.03, 0.09);
  }

  return { blip: blip, scan: scan, done: done };
}
