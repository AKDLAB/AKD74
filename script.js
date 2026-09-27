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

  if (document.querySelector(".rs-hero")) initResearchFx(reduced);
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
  var cards = [].slice.call(document.querySelectorAll("[data-person]")).filter(function (c) {
    return people[c.getAttribute("data-person")];
  });
  var lineup = initLineup(people, cards, sound, reduced);
  var panel = document.createElement("div");
  panel.className = "ai-panel";
  panel.innerHTML =
    '<div class="ai-head"><span class="ai-dot"></span>MMST&middot;Profile</div>' +
    '<div class="ai-body"></div>' +
    '<button class="ai-open" type="button">Open full scan &#9656;</button>';
  var body = panel.querySelector(".ai-body");
  var active = null;
  var hideTimer = null;
  var runId = 0;

  cards.forEach(function (card) {
    var key = card.getAttribute("data-person");
    var p = people[key];
    var sr = document.createElement("span");
    sr.className = "sr-only";
    sr.textContent = "Profile. " + profileLines(p).filter(function (l) { return l.k; })
      .map(function (l) { return l.k + ": " + l.v; }).join(". ") + ". Press Enter for the full scan.";
    card.appendChild(sr);
    card.setAttribute("role", "button");

    card.addEventListener("click", function () { launch(card); });
    card.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        launch(card);
      }
    });
    if (canHover) {
      card.addEventListener("mouseenter", function () { open(card); });
      card.addEventListener("mouseleave", scheduleHide);
      card.addEventListener("focus", function () {
        if (card.getAttribute("data-skip-focus")) return card.removeAttribute("data-skip-focus");
        open(card);
      });
      card.addEventListener("blur", function (e) {
        if (!panel.contains(e.relatedTarget)) scheduleHide();
      });
    }
  });

  panel.querySelector(".ai-open").addEventListener("click", function () { if (active) launch(active); });
  panel.addEventListener("mouseenter", cancelHide);
  panel.addEventListener("mouseleave", scheduleHide);
  panel.addEventListener("focusout", function (e) {
    if (!panel.contains(e.relatedTarget) && e.relatedTarget !== active) scheduleHide();
  });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && active) hide(); });
  window.addEventListener("resize", function () { if (active) position(active); });

  function launch(card) {
    hide();
    lineup.open(card.getAttribute("data-person"), card);
  }

  function open(card) {
    cancelHide();
    if (active === card || lineup.isOpen()) return;
    if (active) active.classList.remove("is-active", "is-scanning");
    active = card;
    card.classList.add("is-active");
    if (!reduced) {
      card.classList.remove("is-scanning");
      void card.offsetWidth;
      card.classList.add("is-scanning");
    }
    card.after(panel);
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
    body.style.minHeight = "";
    body.innerHTML = "";
    var nodes = profileLines(p).map(function (l) {
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
    var dots = 0;
    var dotTimer = setInterval(function () {
      if (my !== runId) return clearInterval(dotTimer);
      status.textContent = "› analyzing profile" + ".".repeat(++dots % 4);
    }, 110);

    setTimeout(function () {
      clearInterval(dotTimer);
      if (my !== runId) return;
      status.remove();
      typeRows(nodes, function () { return my === runId; }, sound, function () { sound.done(); });
    }, 480);
  }

  function position(card) {
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

function typeRows(nodes, alive, sound, onDone) {
  var caret = document.createElement("span");
  caret.className = "ai-caret";
  (function next(i) {
    if (!alive()) return;
    if (i >= nodes.length) {
      caret.remove();
      if (onDone) onDone();
      return;
    }
    var n = nodes[i];
    n.row.hidden = false;
    n.v.after(caret);
    var pos = 0;
    (function tick() {
      if (!alive()) return;
      pos = Math.min(pos + 3, n.text.length);
      n.v.textContent = n.text.slice(0, pos);
      if (n.text.charAt(pos - 1) !== " ") sound.blip();
      if (pos < n.text.length) setTimeout(tick, 16);
      else setTimeout(function () { next(i + 1); }, 70);
    })();
  })(0);
}

function dossierLines(p) {
  var rows = [["Designation", p.role]];
  (p.education || []).forEach(function (e) { rows.push([e[0], e[1]]); });
  if (p.research) rows.push(["Research", p.research]);
  if (p.highlight) rows.push(["Highlight", p.highlight]);
  if (p.scholar) {
    rows.push(["Scholar record", p.scholar.citations + " citations · h-index " + p.scholar.h + " · i10-index " + p.scholar.i10]);
  }
  return rows;
}

function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }
function easeOutBack(t) { var c = 1.4; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); }

var PIE_COLORS = ["#2a6389", "#3480ab", "#44a0cd", "#68c1e8", "#a6e8ff"];

function shade(hex, f) {
  var n = parseInt(hex.slice(1), 16);
  var c = [n >> 16, (n >> 8) & 255, n & 255].map(function (v) { return Math.round(v * f); });
  return "rgb(" + c.join(",") + ")";
}

function pieMarkup(scholar) {
  var split = scholar.split;
  var total = split.reduce(function (a, s) { return a + s[1]; }, 0);
  var C = 2 * Math.PI * 40;
  var gap = 1.4;
  var start = 0;
  var segs = [];
  split.forEach(function (s, i) {
    if (!s[1]) return;
    var len = s[1] / total * C;
    segs.push({ i: i, len: Math.max(len - gap, 0.8), off: -start, color: PIE_COLORS[i] });
    start += len;
  });

  function layer(z, f) {
    return '<svg class="pie-layer' + (f ? "" : " pie-top") + '" viewBox="0 0 100 100" style="transform:translateZ(' + z + 'px)">' +
      segs.map(function (s, n) {
        return '<circle class="pie-seg" data-i="' + s.i + '" cx="50" cy="50" r="40" transform="rotate(-90 50 50)" style="stroke:' +
          (f ? shade(s.color, f) : s.color) + ";--val:" + s.len.toFixed(2) + ";--len:" + C.toFixed(2) + ";--off:" + s.off.toFixed(2) + ";--n:" + n + '"/>';
      }).join("") + "</svg>";
  }

  var layers = "";
  for (var z = -14; z < 0; z += 2) layers += layer(z, 0.38 + (z + 14) * 0.012);
  layers += layer(0, 0);

  var label = split.filter(function (s) { return s[1]; }).map(function (s) { return s[0] + ": " + s[1].toLocaleString("en-US"); }).join(", ");
  var legend = split.map(function (s, i) {
    if (!s[1]) return "";
    return '<li data-i="' + i + '"><span class="pie-sw" style="background:' + PIE_COLORS[i] + '"></span>' + s[0] +
      "<b>" + s[1].toLocaleString("en-US") + "</b><em>" + Math.round(s[1] / total * 100) + "%</em></li>";
  }).join("");

  return '<div class="pie" role="img" aria-label="Citations by period, total ' + total.toLocaleString("en-US") + ". " + label + '">' +
      '<div class="pie-stage"><div class="pie-tilt">' + layers + "</div></div>" +
      '<div class="pie-total"><b>' + scholar.citations + "</b><span>citations</span></div>" +
    "</div>" +
    '<div class="pie-badges"><span><b>' + scholar.h + "</b>h-index</span><span><b>" + scholar.i10 + "</b>i10-index</span></div>" +
    '<ul class="pie-legend">' + legend + "</ul>" +
    '<p class="pie-note">* 2026 to date. Undated: citations Scholar lists without a year.</p>';
}

function initLineup(people, cards, sound, reduced) {
  var keys = cards.map(function (c) { return c.getAttribute("data-person"); });
  var photos = {};
  var focus = {};
  var cropStyle = {};
  var ids = {};
  cards.forEach(function (c, i) {
    var k = keys[i];
    var cardImg = c.querySelector("img");
    photos[k] = cardImg.getAttribute("src");
    focus[k] = cardImg.style.objectPosition;
    cropStyle[k] = cardImg.style.cssText;
    var m = (people[k].email || "").match(/\.([a-z]{2}\d+)@/i);
    ids[k] = m ? m[1].toUpperCase() : (k === "akash-deep" ? "MMST-PI" : "MMST-" + String(i + 1).padStart(2, "0"));
  });

  var waveBars = "";
  for (var b = 0; b < 26; b++) {
    waveBars += '<span style="--d:' + (0.35 + Math.random() * 0.6).toFixed(2) + "s;--h:" + Math.round(30 + Math.random() * 70) + '%"></span>';
  }

  var el = document.createElement("div");
  el.className = "lineup";
  el.setAttribute("role", "dialog");
  el.setAttribute("aria-modal", "true");
  el.setAttribute("aria-labelledby", "lu-name");
  el.hidden = true;
  el.innerHTML =
    '<div class="lu-wall" aria-hidden="true">' +
      '<div class="lu-bar" style="--y:16%"><i>7</i></div>' +
      '<div class="lu-bar" style="--y:36%"><i>6</i></div>' +
      '<div class="lu-bar" style="--y:56%"><i>5</i></div>' +
      '<div class="lu-bar" style="--y:76%"><i>4</i></div>' +
      '<div class="lu-floor"></div>' +
    "</div>" +
    '<div class="lu-top">' +
      '<div class="lu-brand"><span class="lu-reticle"></span>MMST&middot;Corps &mdash; member identification</div>' +
      '<div class="lu-top-right">' +
        '<div class="lu-assoc"><span class="lu-label">Associates</span><div class="lu-assoc-list"></div></div>' +
      "</div>" +
    "</div>" +
    '<div class="lu-stage">' +
      '<div class="lu-left">' +
        '<div class="lu-subject">Identification No.: <b class="lu-id"></b></div>' +
        '<h2 class="lu-name" id="lu-name"></h2>' +
        '<dl class="lu-data"></dl>' +
        '<div class="lu-links"></div>' +
      "</div>" +
      '<div class="lu-figure"><div class="lu-photo"><img alt=""></div><div class="lu-beam"></div>' +
        '<div class="lu-status" aria-live="polite"></div></div>' +
      '<div class="lu-right">' +
        '<div class="lu-panel lu-panel-pie" hidden><div class="lu-ptitle">Citations by period &middot; Google Scholar</div><div class="lu-pie"></div></div>' +
        '<div class="lu-panel" aria-hidden="true"><div class="lu-ptitle">Sequencing</div><canvas class="lu-dna" width="300" height="90"></canvas></div>' +
        '<div class="lu-panel" aria-hidden="true"><div class="lu-ptitle">Signal</div><div class="lu-wave">' + waveBars + "</div></div>" +
        '<div class="lu-panel lu-panel-hex" aria-hidden="true"><div class="lu-ptitle">Data stream</div><pre class="lu-hex"></pre></div>' +
      "</div>" +
    "</div>" +
    '<div class="lu-controls">' +
      '<button class="lu-btn lu-prev" type="button" aria-label="Previous member">&#9664;</button>' +
      '<span class="lu-count"></span>' +
      '<button class="lu-btn lu-next" type="button" aria-label="Next member">&#9654;</button>' +
      '<button class="lu-btn lu-sound" type="button"></button>' +
      '<button class="lu-btn lu-close" type="button">Close &#10005;</button>' +
    "</div>" +
    '<button class="lu-start" type="button" hidden>&#9654; Begin scan</button>';
  document.body.appendChild(el);

  var q = function (s) { return el.querySelector(s); };
  var img = q(".lu-photo img");
  var dl = q(".lu-data");
  var status = q(".lu-status");
  var soundBtn = q(".lu-sound");
  var startBtn = q(".lu-start");
  var canvas = q(".lu-dna");
  var g2 = canvas.getContext("2d");
  var hexEl = q(".lu-hex");
  var current = -1;
  var run = 0;
  var origin = null;
  var raf = 0;
  var hexTimer = 0;
  var lockTimer = 0;
  var pieWatch = null;
  var pieRaf = 0;

  q(".lu-close").addEventListener("click", close);
  q(".lu-prev").addEventListener("click", function () { step(-1); });
  q(".lu-next").addEventListener("click", function () { step(1); });
  soundBtn.addEventListener("click", function () { sound.toggle(); });
  sound.onChange(updateSound);
  updateSound();
  startBtn.addEventListener("click", function () {
    startBtn.hidden = true;
    sound.unlock();
    begin();
    show(keys[current]);
  });

  el.addEventListener("keydown", function (e) {
    if (e.key === "Escape") { e.preventDefault(); close(); }
    else if (e.key === "ArrowRight") step(1);
    else if (e.key === "ArrowLeft") step(-1);
    else if (e.key === "Tab") trapFocus(e);
  });

  var initial = decodeURIComponent(location.hash.slice(1));
  if (keys.indexOf(initial) >= 0) openGated(initial);

  function updateSound() {
    var on = sound.isOn();
    soundBtn.setAttribute("aria-pressed", on ? "true" : "false");
    soundBtn.textContent = on ? "Sound: on" : "Sound: off";
    if (on && isOpen() && startBtn.hidden) sound.hum(true);
  }

  function trapFocus(e) {
    var f = [].slice.call(el.querySelectorAll("a[href], button:not([hidden])")).filter(function (n) { return n.offsetParent !== null; });
    if (!f.length) return;
    if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
    else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
  }

  function isOpen() { return !el.hidden; }

  function reveal() {
    el.hidden = false;
    document.documentElement.classList.add("lu-lock");
    requestAnimationFrame(function () { el.classList.add("is-open"); });
  }

  function begin() {
    sound.boom();
    sound.hum(true);
    if (reduced) {
      drawDna(0);
    } else {
      cancelAnimationFrame(raf);
      (function loop(t) { drawDna(t); raf = requestAnimationFrame(loop); })(0);
    }
    clearInterval(hexTimer);
    hexTimer = setInterval(fillHex, reduced ? 2000 : 140);
    fillHex();
  }

  function open(key, card) {
    origin = card || null;
    if (isOpen()) return show(key);
    current = keys.indexOf(key);
    reveal();
    sound.unlock();
    begin();
    show(key);
    q(".lu-close").focus();
  }

  function openGated(key) {
    current = keys.indexOf(key);
    reveal();
    startBtn.hidden = false;
    startBtn.focus();
  }

  function close() {
    run++;
    clearTimeout(lockTimer);
    clearInterval(hexTimer);
    cancelAnimationFrame(raf);
    stopPie();
    sound.hum(false);
    el.classList.remove("is-open", "is-scanning", "is-locked");
    el.hidden = true;
    startBtn.hidden = true;
    document.documentElement.classList.remove("lu-lock");
    history.replaceState(null, "", location.pathname + location.search);
    if (origin) {
      origin.setAttribute("data-skip-focus", "1");
      origin.focus();
    }
  }

  function step(d) {
    if (!startBtn.hidden) return;
    show(keys[(current + d + keys.length) % keys.length]);
  }

  function show(key) {
    var i = keys.indexOf(key);
    if (i < 0) return;
    current = i;
    var p = people[key];
    var my = ++run;
    clearTimeout(lockTimer);

    q(".lu-id").textContent = ids[key];
    q(".lu-name").textContent = p.name;
    img.src = photos[key];
    img.style.objectPosition = focus[key];
    img.alt = p.name;
    q(".lu-count").textContent = (i + 1) + " / " + keys.length;
    status.textContent = "Scanning…";
    history.replaceState(null, "", "#" + key);

    var list = q(".lu-assoc-list");
    list.innerHTML = "";
    keys.forEach(function (k) {
      if (k === key) return;
      var btn = document.createElement("button");
      btn.type = "button";
      btn.setAttribute("aria-label", "Scan " + people[k].name);
      btn.title = people[k].name;
      btn.innerHTML = '<img alt="" src="' + photos[k] + '">';
      btn.firstChild.style.cssText = cropStyle[k];
      btn.addEventListener("click", function () { show(k); });
      list.appendChild(btn);
    });

    renderPie(p.scholar);

    var links = q(".lu-links");
    links.innerHTML = "";
    if (p.scholar) addLink(links, p.scholar.url, "Google Scholar ↗", true);
    if (p.email) addLink(links, "mailto:" + p.email, p.email, false);

    dl.innerHTML = "";
    var nodes = dossierLines(p).map(function (r) {
      var row = document.createElement("div");
      row.className = "lu-row";
      var dt = document.createElement("dt");
      dt.textContent = r[0];
      var dd = document.createElement("dd");
      dd.textContent = r[1];
      row.appendChild(dt);
      row.appendChild(dd);
      dl.appendChild(row);
      return { row: row, v: dd, text: r[1] };
    });

    el.classList.remove("is-scanning", "is-locked");
    void el.offsetWidth;
    el.classList.add("is-scanning");
    sound.whoosh();
    sound.scan();

    var lockAfter = reduced ? 0 : 1300;
    lockTimer = setTimeout(function () {
      if (my !== run) return;
      el.classList.add("is-locked");
      status.textContent = "Identity confirmed";
      sound.lock();
    }, lockAfter);

    if (reduced) return;
    nodes.forEach(function (n) { n.row.hidden = true; n.v.textContent = ""; });
    setTimeout(function () {
      typeRows(nodes, function () { return my === run; }, sound);
    }, 450);
  }

  function renderPie(scholar) {
    var panel = q(".lu-panel-pie");
    var box = q(".lu-pie");
    var has = !!(scholar && scholar.split);
    panel.hidden = !has;
    el.classList.toggle("has-pie", has);
    box.innerHTML = "";
    if (!has) return;
    box.innerHTML = pieMarkup(scholar);
    var pie = box.querySelector(".pie");
    var items = box.querySelectorAll("[data-i]");
    items.forEach(function (n) {
      n.addEventListener("mouseenter", function () {
        var i = n.getAttribute("data-i");
        pie.classList.add("has-focus");
        items.forEach(function (m) { m.classList.toggle("is-hot", m.getAttribute("data-i") === i); });
      });
      n.addEventListener("mouseleave", function () {
        pie.classList.remove("has-focus");
        items.forEach(function (m) { m.classList.remove("is-hot"); });
      });
    });
    stopPie();
    if (reduced) return;
    var segs = [].map.call(pie.querySelectorAll(".pie-seg"), function (seg) {
      return {
        el: seg,
        val: parseFloat(seg.style.getPropertyValue("--val")),
        len: parseFloat(seg.style.getPropertyValue("--len")),
        n: parseFloat(seg.style.getPropertyValue("--n"))
      };
    });
    var stage = pie.querySelector(".pie-stage");
    var tilt = pie.querySelector(".pie-tilt");
    segs.forEach(function (s) { s.el.style.strokeDasharray = "0px " + s.len + "px"; });
    stage.style.opacity = "0";
    stage.style.transform = "scale(0.6)";

    var paused = false;
    if (window.matchMedia("(hover: hover)").matches) {
      pie.addEventListener("mouseenter", function () { paused = true; });
      pie.addEventListener("mouseleave", function () { paused = false; });
    }

    function play() {
      var t0 = performance.now();
      var last = t0;
      var angle = 0;
      var grown = false;
      (function frame(now) {
        var e = now - t0;
        if (!paused) angle = (angle + (now - last) * 360 / 26000) % 360;
        last = now;
        tilt.style.transform = "rotateX(52deg) rotateZ(" + angle.toFixed(2) + "deg)";
        if (!grown) {
          var p = Math.min(e / 700, 1);
          stage.style.opacity = p.toFixed(3);
          stage.style.transform = "scale(" + (0.6 + 0.4 * easeOutBack(p)).toFixed(4) + ")";
          grown = p === 1;
          segs.forEach(function (s) {
            var d = Math.min(Math.max((e - 450 - s.n * 180) / 900, 0), 1);
            if (d < 1) grown = false;
            s.el.style.strokeDasharray = (s.val * easeOutCubic(d)).toFixed(2) + "px " + s.len + "px";
          });
        }
        pieRaf = requestAnimationFrame(frame);
      })(t0);
    }

    if (!("IntersectionObserver" in window)) return play();
    pieWatch = new IntersectionObserver(function (entries) {
      if (!entries[0].isIntersecting) return;
      pieWatch.disconnect();
      play();
    }, { threshold: 0.4 });
    pieWatch.observe(pie);
  }

  function stopPie() {
    if (pieWatch) pieWatch.disconnect();
    cancelAnimationFrame(pieRaf);
  }

  function addLink(parent, href, text, external) {
    var a = document.createElement("a");
    a.className = "lu-link";
    a.href = href;
    a.textContent = text;
    if (external) { a.target = "_blank"; a.rel = "noopener"; }
    parent.appendChild(a);
  }

  function fillHex() {
    var out = [];
    for (var r = 0; r < 6; r++) {
      var row = [];
      for (var c = 0; c < 8; c++) row.push(Math.floor(Math.random() * 256).toString(16).toUpperCase().padStart(2, "0"));
      out.push(row.join(" "));
    }
    hexEl.textContent = out.join("\n");
  }

  function drawDna(t) {
    var w = canvas.width;
    var h = canvas.height;
    g2.clearRect(0, 0, w, h);
    for (var x = 4; x < w; x += 9) {
      var ph = x * 0.055 + t * 0.0025;
      var s = Math.sin(ph);
      var depth = (Math.cos(ph) + 1) / 2;
      var y1 = h / 2 + s * h * 0.36;
      var y2 = h / 2 - s * h * 0.36;
      g2.strokeStyle = "rgba(127,224,255," + (0.12 + depth * 0.3).toFixed(2) + ")";
      g2.lineWidth = 1;
      g2.beginPath();
      g2.moveTo(x, y1);
      g2.lineTo(x, y2);
      g2.stroke();
      g2.fillStyle = "rgba(95,211,255," + (0.35 + depth * 0.65).toFixed(2) + ")";
      g2.beginPath();
      g2.arc(x, y1, 1.4 + depth * 1.6, 0, 6.283);
      g2.fill();
      g2.fillStyle = "rgba(212,107,255," + (1 - depth * 0.65).toFixed(2) + ")";
      g2.beginPath();
      g2.arc(x, y2, 1.4 + (1 - depth) * 1.6, 0, 6.283);
      g2.fill();
    }
  }

  return { open: open, isOpen: isOpen };
}

function createAiSound() {
  var btn = document.querySelector(".ai-sound-toggle");
  var ctx = null;
  var noise = null;
  var humNodes = null;
  var lastBlip = 0;
  var listeners = [];
  var on = true;
  try { on = localStorage.getItem("mmst-ai-sound") !== "off"; } catch (e) {}

  function running() { return ctx && ctx.state === "running"; }

  function ensure() {
    if (!ctx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      ctx.onstatechange = notify;
    }
    if (ctx.state === "suspended") ctx.resume();
  }

  function notify() {
    if (btn) {
      var live = on && running();
      btn.setAttribute("aria-pressed", live ? "true" : "false");
      btn.querySelector(".label").textContent = !on ? "Sound: off" : live ? "Sound: on" : "Enable sound";
    }
    listeners.forEach(function (fn) { fn(); });
  }

  function unlock() { if (on) ensure(); }
  function firstGesture() {
    unlock();
    ["pointerdown", "keydown", "touchstart"].forEach(function (t) { document.removeEventListener(t, firstGesture); });
  }
  ["pointerdown", "keydown", "touchstart"].forEach(function (t) { document.addEventListener(t, firstGesture); });

  function toggle() {
    if (on && !running()) {
      ensure();
    } else {
      on = !on;
      if (on) ensure();
      else hum(false);
    }
    try { localStorage.setItem("mmst-ai-sound", on ? "on" : "off"); } catch (e) {}
    notify();
    if (on) setTimeout(done, 60);
  }

  if (btn) {
    btn.hidden = false;
    btn.addEventListener("click", toggle);
    notify();
  }

  function audible() { return on && ctx && ctx.state !== "closed"; }

  function tone(f1, f2, dur, type, vol, delay) {
    if (!audible()) return;
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

  function lock() {
    tone(880, null, 0.07, "square", 0.02);
    tone(1175, null, 0.07, "square", 0.02, 0.08);
    tone(1568, null, 0.16, "sine", 0.04, 0.16);
  }

  function boom() {
    tone(120, 34, 0.9, "sine", 0.35);
    tone(60, 30, 1.1, "triangle", 0.12, 0.02);
  }

  function whoosh() {
    if (!audible()) return;
    if (!noise) {
      noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      var d = noise.getChannelData(0);
      for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    var t = ctx.currentTime;
    var src = ctx.createBufferSource();
    var f = ctx.createBiquadFilter();
    var g = ctx.createGain();
    src.buffer = noise;
    f.type = "bandpass";
    f.Q.value = 1.2;
    f.frequency.setValueAtTime(300, t);
    f.frequency.exponentialRampToValueAtTime(3200, t + 0.55);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.09, t + 0.2);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
    src.connect(f);
    f.connect(g);
    g.connect(ctx.destination);
    src.start(t);
    src.stop(t + 0.75);
  }

  function hum(start) {
    if (!start) {
      if (humNodes && ctx) {
        var t = ctx.currentTime;
        humNodes.g.gain.cancelScheduledValues(t);
        humNodes.g.gain.setTargetAtTime(0.0001, t, 0.15);
        var n = humNodes;
        setTimeout(function () { n.o1.stop(); n.o2.stop(); }, 800);
      }
      humNodes = null;
      return;
    }
    if (humNodes || !audible()) return;
    var o1 = ctx.createOscillator();
    var o2 = ctx.createOscillator();
    var lp = ctx.createBiquadFilter();
    var g = ctx.createGain();
    o1.type = o2.type = "sawtooth";
    o1.frequency.value = 55;
    o2.frequency.value = 55.6;
    lp.type = "lowpass";
    lp.frequency.value = 380;
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.setTargetAtTime(0.018, ctx.currentTime, 0.6);
    o1.connect(lp);
    o2.connect(lp);
    lp.connect(g);
    g.connect(ctx.destination);
    o1.start();
    o2.start();
    humNodes = { o1: o1, o2: o2, g: g };
  }

  return {
    blip: blip, scan: scan, done: done, lock: lock, boom: boom, whoosh: whoosh, hum: hum,
    unlock: unlock, toggle: toggle,
    isOn: function () { return on; },
    onChange: function (fn) { listeners.push(fn); }
  };
}

function initResearchFx(reduced) {
  var sound = createAiSound();
  initLattice(document.querySelector(".rs-lattice"), reduced);
  document.querySelectorAll(".mol[data-mol]").forEach(function (fig) { initMolecule(fig, reduced); });

  var bands = document.querySelectorAll(".mech-band");
  if (reduced || !("IntersectionObserver" in window)) {
    bands.forEach(function (b) {
      b.classList.add("is-live");
      b.querySelectorAll(".mech-step").forEach(function (s) { s.classList.add("is-active"); });
    });
    return;
  }

  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (!e.isIntersecting) return;
      io.unobserve(e.target);
      power(e.target);
    });
  }, { threshold: 0.35 });

  bands.forEach(function (b) {
    b.classList.add("is-armed");
    io.observe(b);
  });

  function power(band) {
    var steps = band.querySelectorAll(".mech-step");
    band.classList.add("is-live");
    sound.scan();
    steps.forEach(function (s, i) {
      setTimeout(function () {
        s.classList.add("is-active");
        if (i === steps.length - 1) sound.lock();
        else sound.done();
      }, 650 + i * 700);
    });
  }
}

function initLattice(canvas, reduced) {
  if (!canvas) return;
  var g = canvas.getContext("2d");
  var pts = [];
  var edges = [];
  var mx = 0;
  var my = 0;
  var raf = 0;
  var visible = true;

  for (var x = -1; x <= 1; x++) {
    for (var y = -1; y <= 1; y++) {
      for (var z = -1; z <= 1; z++) pts.push([x, y, z]);
    }
  }
  pts.forEach(function (a, i) {
    pts.forEach(function (b, j) {
      if (j <= i) return;
      var d = Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);
      if (d === 1) edges.push([i, j]);
    });
  });

  function size() {
    var r = window.devicePixelRatio || 1;
    canvas.width = canvas.clientWidth * r;
    canvas.height = canvas.clientHeight * r;
  }

  function project(p, ay, ax) {
    var x = p[0] * Math.cos(ay) - p[2] * Math.sin(ay);
    var z = p[0] * Math.sin(ay) + p[2] * Math.cos(ay);
    var y = p[1] * Math.cos(ax) - z * Math.sin(ax);
    z = p[1] * Math.sin(ax) + z * Math.cos(ax);
    var s = Math.min(canvas.width, canvas.height) * 0.26;
    var f = 4 / (z + 4.6);
    return { x: canvas.width / 2 + x * s * f, y: canvas.height / 2 + y * s * f, d: (z + 1.8) / 3.6 };
  }

  function draw(t) {
    var ay = t * 0.00022 + mx * 0.6;
    var ax = 0.45 + my * 0.35;
    var pr = pts.map(function (p) { return project(p, ay, ax); });
    var r = window.devicePixelRatio || 1;
    g.clearRect(0, 0, canvas.width, canvas.height);
    g.lineCap = "round";
    edges.forEach(function (e) {
      var a = pr[e[0]];
      var b = pr[e[1]];
      var near = 1 - (a.d + b.d) / 2;
      g.strokeStyle = "rgba(127,224,255," + (0.12 + near * 0.45).toFixed(2) + ")";
      g.lineWidth = (1 + near * 1.6) * r;
      g.beginPath();
      g.moveTo(a.x, a.y);
      g.lineTo(b.x, b.y);
      g.stroke();
      var mxp = (a.x + b.x) / 2;
      var myp = (a.y + b.y) / 2;
      g.fillStyle = "rgba(212,107,255," + (0.25 + near * 0.55).toFixed(2) + ")";
      g.beginPath();
      g.arc(mxp, myp, (1.2 + near * 1.8) * r, 0, 6.283);
      g.fill();
    });
    pr.map(function (p, i) { return { p: p, i: i }; })
      .sort(function (a, b) { return b.p.d - a.p.d; })
      .forEach(function (o) {
        var near = 1 - o.p.d;
        var rad = (3 + near * 5) * r;
        var glow = g.createRadialGradient(o.p.x, o.p.y, 0, o.p.x, o.p.y, rad * 3);
        glow.addColorStop(0, "rgba(127,224,255," + (0.35 + near * 0.4).toFixed(2) + ")");
        glow.addColorStop(1, "rgba(127,224,255,0)");
        g.fillStyle = glow;
        g.beginPath();
        g.arc(o.p.x, o.p.y, rad * 3, 0, 6.283);
        g.fill();
        g.fillStyle = "rgba(225,247,255," + (0.55 + near * 0.45).toFixed(2) + ")";
        g.beginPath();
        g.arc(o.p.x, o.p.y, rad * 0.55, 0, 6.283);
        g.fill();
      });
  }

  function loop(t) {
    draw(t);
    raf = visible ? requestAnimationFrame(loop) : 0;
  }

  size();
  window.addEventListener("resize", function () { size(); if (reduced) draw(0); });
  if (reduced) return draw(0);

  canvas.parentElement.addEventListener("mousemove", function (e) {
    var b = canvas.parentElement.getBoundingClientRect();
    mx = (e.clientX - b.left) / b.width - 0.5;
    my = (e.clientY - b.top) / b.height - 0.5;
  });
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (en) {
      visible = en[0].isIntersecting;
      if (visible && !raf) raf = requestAnimationFrame(loop);
    }).observe(canvas);
  }
  raf = requestAnimationFrame(loop);
}

var MOLS = {"nh2bdc":{"atoms":[["C",1.39,0.0,0.0],["C",0.695,1.204,0.0],["C",-0.695,1.204,0.0],["C",-1.39,0.0,0.0],["C",-0.695,-1.204,0.0],["C",0.695,-1.204,0.0],["C",2.88,0.0,0.0],["O",3.485,1.048,0.0],["O",3.55,-1.16,0.0],["H",2.876,-1.858,0.0],["C",-2.88,0.0,0.0],["O",-3.485,-1.048,0.0],["O",-3.55,1.16,0.0],["H",-2.876,1.858,0.0],["N",1.395,2.416,0.0],["H",0.89,3.291,0.0],["H",2.405,2.416,0.0],["H",-1.235,2.139,0.0],["H",-1.235,-2.139,0.0],["H",1.235,-2.139,0.0]],"bonds":[[0,1,2],[1,2,1],[2,3,2],[3,4,1],[4,5,2],[5,0,1],[0,6,1],[6,7,2],[6,8,1],[8,9,1],[3,10,1],[10,11,2],[10,12,1],[12,13,1],[1,14,1],[14,15,1],[14,16,1],[2,17,1],[4,18,1],[5,19,1]]},"dpa":{"atoms":[["N",0.0,1.38,0.0],["C",1.195,0.69,0.0],["C",1.195,-0.69,0.0],["C",0.0,-1.38,0.0],["C",-1.195,-0.69,0.0],["C",-1.195,0.69,0.0],["C",2.485,1.435,0.0],["O",2.485,2.645,0.0],["O",3.646,0.765,0.0],["H",3.411,-0.176,0.0],["C",-2.485,1.435,0.0],["O",-3.533,0.83,0.0],["O",-2.485,2.775,0.0],["H",-1.553,3.042,0.0],["H",2.13,-1.23,0.0],["H",0.0,-2.46,0.0],["H",-2.13,-1.23,0.0]],"bonds":[[0,1,2],[1,2,1],[2,3,2],[3,4,1],[4,5,2],[5,0,1],[1,6,1],[6,7,2],[6,8,1],[8,9,1],[5,10,1],[10,11,2],[10,12,1],[12,13,1],[2,14,1],[3,15,1],[4,16,1]]},"mim":{"atoms":[["C",0.0,1.157,0.0],["N",1.1,0.357,0.0],["C",0.68,-0.936,0.0],["C",-0.68,-0.936,0.0],["N",-1.1,0.357,0.0],["C",0.0,2.647,0.0],["H",1.027,3.011,0.0],["H",-0.514,3.011,0.89],["H",-0.514,3.011,-0.89],["H",-2.061,0.67,0.0],["H",1.315,-1.81,0.0],["H",-1.315,-1.81,0.0]],"bonds":[[0,1,2],[1,2,1],[2,3,2],[3,4,1],[4,0,1],[0,5,1],[5,6,1],[5,7,1],[5,8,1],[4,9,1],[2,10,1],[3,11,1]]},"nh3":{"atoms":[["N",0,0,0.12],["H",0.938,0.0,-0.253],["H",-0.469,0.812,-0.253],["H",-0.469,-0.812,-0.253]],"bonds":[[0,1,1],[0,2,1],[0,3,1]]},"tmpo":{"atoms":[["P",0,0,0],["O",0,0,1.48],["C",1.644,0.0,-0.732],["H",2.339,0.514,-0.067],["H",1.977,-1.027,-0.88],["H",1.615,0.514,-1.693],["C",-0.822,1.424,-0.732],["H",-1.614,1.769,-0.067],["H",-0.099,2.226,-0.88],["H",-1.252,1.142,-1.693],["C",-0.822,-1.424,-0.732],["H",-0.724,-2.282,-0.067],["H",-1.878,-1.198,-0.88],["H",-0.363,-1.655,-1.693]],"bonds":[[0,1,2],[0,2,1],[2,3,1],[2,4,1],[2,5,1],[0,6,1],[6,7,1],[6,8,1],[6,9,1],[0,10,1],[10,11,1],[10,12,1],[10,13,1]]}};

var ATOM = {
  H: { c: "#f2f6fa", r: 0.24, name: "Hydrogen" },
  C: { c: "#9fb0bd", r: 0.36, name: "Carbon" },
  N: { c: "#5f86ff", r: 0.35, name: "Nitrogen" },
  O: { c: "#ff5a5a", r: 0.34, name: "Oxygen" },
  P: { c: "#ff9a3c", r: 0.44, name: "Phosphorus" }
};

function initMolecule(fig, reduced) {
  var mol = MOLS[fig.getAttribute("data-mol")];
  var canvas = fig.querySelector("canvas");
  if (!mol || !canvas) return;
  var g = canvas.getContext("2d");
  var mx = 0;
  var my = 0;
  var raf = 0;
  var visible = false;

  var c = [0, 0, 0];
  mol.atoms.forEach(function (a) { for (var k = 0; k < 3; k++) c[k] += a[k + 1] / mol.atoms.length; });
  var atoms = mol.atoms.map(function (a) { return { el: a[0], p: [a[1] - c[0], a[2] - c[1], a[3] - c[2]] }; });
  var reach = Math.max.apply(null, atoms.map(function (a) { return Math.hypot(a.p[0], a.p[1], a.p[2]) + ATOM[a.el].r; }));

  var legend = fig.querySelector(".mol-legend");
  if (legend) {
    var seen = [];
    atoms.forEach(function (a) { if (seen.indexOf(a.el) < 0) seen.push(a.el); });
    legend.innerHTML = seen.map(function (el) {
      return '<span><i style="background:' + ATOM[el].c + '"></i>' + ATOM[el].name + "</span>";
    }).join("");
  }

  function size() {
    var r = window.devicePixelRatio || 1;
    canvas.width = canvas.clientWidth * r;
    canvas.height = canvas.clientHeight * r;
  }

  function draw(t) {
    var ay = t * 0.0005 + mx * 1.2;
    var ax = 0.35 + my * 0.8;
    var W = canvas.width;
    var H = canvas.height;
    var scale = Math.min(W, H) * 0.44 / reach;
    var pr = atoms.map(function (a) {
      var x = a.p[0] * Math.cos(ay) - a.p[2] * Math.sin(ay);
      var z = a.p[0] * Math.sin(ay) + a.p[2] * Math.cos(ay);
      var y = a.p[1] * Math.cos(ax) - z * Math.sin(ax);
      z = a.p[1] * Math.sin(ax) + z * Math.cos(ax);
      var f = 9 / (9 + z);
      return { x: W / 2 + x * scale * f, y: H / 2 - y * scale * f, z: z, f: f, el: a.el };
    });
    g.clearRect(0, 0, W, H);

    var items = [];
    mol.bonds.forEach(function (b) { items.push({ z: (pr[b[0]].z + pr[b[1]].z) / 2 + 0.01, bond: b }); });
    pr.forEach(function (p, i) { items.push({ z: p.z, atom: i }); });
    items.sort(function (a, b) { return b.z - a.z; });

    var zs = pr.map(function (p) { return p.z; });
    var zmin = Math.min.apply(null, zs);
    var zmax = Math.max.apply(null, zs);
    function near(z) { return zmax === zmin ? 1 : 1 - (z - zmin) / (zmax - zmin); }

    items.forEach(function (it) {
      if (it.bond) {
        var a = pr[it.bond[0]];
        var b = pr[it.bond[1]];
        var w = scale * 0.07;
        var alpha = (0.45 + near(it.z) * 0.55).toFixed(2);
        g.strokeStyle = "rgba(170,225,255," + alpha + ")";
        g.lineCap = "round";
        if (it.bond[2] === 2) {
          var dx = b.x - a.x;
          var dy = b.y - a.y;
          var L = Math.hypot(dx, dy) || 1;
          var ox = -dy / L * w * 0.9;
          var oy = dx / L * w * 0.9;
          g.lineWidth = w * 0.7;
          [-1, 1].forEach(function (s) {
            g.beginPath();
            g.moveTo(a.x + ox * s, a.y + oy * s);
            g.lineTo(b.x + ox * s, b.y + oy * s);
            g.stroke();
          });
        } else {
          g.lineWidth = w;
          g.beginPath();
          g.moveTo(a.x, a.y);
          g.lineTo(b.x, b.y);
          g.stroke();
        }
      } else {
        var p = pr[it.atom];
        var spec = ATOM[p.el];
        var rad = spec.r * scale * p.f;
        var grad = g.createRadialGradient(p.x - rad * 0.35, p.y - rad * 0.35, rad * 0.1, p.x, p.y, rad);
        grad.addColorStop(0, "#ffffff");
        grad.addColorStop(0.35, spec.c);
        grad.addColorStop(1, "rgba(5,14,26,0.95)");
        g.globalAlpha = 0.55 + near(p.z) * 0.45;
        g.fillStyle = grad;
        g.beginPath();
        g.arc(p.x, p.y, rad, 0, 6.283);
        g.fill();
        g.globalAlpha = 1;
      }
    });
  }

  function loop(t) {
    draw(t);
    raf = visible ? requestAnimationFrame(loop) : 0;
  }

  size();
  window.addEventListener("resize", function () { size(); draw(performance.now()); });
  draw(0);
  if (reduced) return;

  fig.addEventListener("mousemove", function (e) {
    var b = fig.getBoundingClientRect();
    mx = (e.clientX - b.left) / b.width - 0.5;
    my = (e.clientY - b.top) / b.height - 0.5;
  });
  fig.addEventListener("mouseleave", function () { mx = 0; my = 0; });
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (en) {
      visible = en[0].isIntersecting;
      if (visible && !raf) raf = requestAnimationFrame(loop);
    }).observe(canvas);
  } else {
    visible = true;
    raf = requestAnimationFrame(loop);
  }
}
