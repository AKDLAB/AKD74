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

function narrationFor(p, id) {
  function spoken(s) {
    return s.replace(/\bMMST\b/g, "M M S T").replace(/\bINST\b/g, "I N S T")
      .replace(/\bDST\b/g, "D S T").replace(/\bMOF(s?)\b/g, "M O F$1").replace(/WISE-SCOPE/g, "Wise Scope");
  }
  var eduWords = { "Graduation": "Graduated from", "M.Sc.": "Master of Science,", "M.Tech.": "Master of Technology,", "Ph.D.": "Doctorate," };
  var parts = ["Namaste.", "Identification number " + id.replace(/-/g, " ").split("").join(" ") + ".", p.name + ".", spoken(p.role) + "."];
  (p.education || []).forEach(function (e) {
    parts.push((eduWords[e[0]] || e[0] + ",") + " " + e[1] + ".");
  });
  if (p.research) parts.push("Research focus: " + spoken(p.research) + ".");
  if (p.scholar) parts.push("Google Scholar record: " + p.scholar.citations.replace(/,/g, "") + " citations, h-index " + p.scholar.h + ".");
  return parts.join(" ");
}

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
        '<label class="lu-voice-pick" hidden><span class="lu-label">Voice</span><select class="lu-select"></select></label>' +
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
        '<div class="lu-status" aria-live="polite"></div>' +
        '<div class="lu-namaste" aria-hidden="true"><span class="lu-hands">&#128591;</span>Namaste</div></div>' +
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
      '<button class="lu-btn lu-voice" type="button"></button>' +
      '<button class="lu-btn lu-close" type="button">Close &#10005;</button>' +
    "</div>" +
    '<button class="lu-start" type="button" hidden>&#9654; Begin scan</button>';
  document.body.appendChild(el);

  var q = function (s) { return el.querySelector(s); };
  var img = q(".lu-photo img");
  var dl = q(".lu-data");
  var status = q(".lu-status");
  var voiceBtn = q(".lu-voice");
  var voicePick = q(".lu-voice-pick");
  var select = q(".lu-select");
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
  var speakTimer = 0;
  var greetTimer = 0;

  q(".lu-close").addEventListener("click", close);
  q(".lu-prev").addEventListener("click", function () { step(-1); });
  q(".lu-next").addEventListener("click", function () { step(1); });
  voiceBtn.addEventListener("click", function () { sound.toggle(); });
  sound.onChange(updateVoice);
  updateVoice();
  sound.onVoices(fillVoices);
  fillVoices();
  select.addEventListener("change", function () {
    sound.setVoice(select.value);
    if (current >= 0 && startBtn.hidden && isOpen()) {
      var k = keys[current];
      sound.speak(narrationFor(people[k], ids[k]));
    }
  });
  startBtn.addEventListener("click", function () {
    startBtn.hidden = true;
    sound.unlock();
    begin();
    show(keys[current]);
  });

  el.addEventListener("keydown", function (e) {
    if (e.key === "Escape") { e.preventDefault(); close(); }
    else if (e.target === select) return;
    else if (e.key === "ArrowRight") step(1);
    else if (e.key === "ArrowLeft") step(-1);
    else if (e.key === "Tab") trapFocus(e);
  });

  var initial = decodeURIComponent(location.hash.slice(1));
  if (keys.indexOf(initial) >= 0) openGated(initial);

  function updateVoice() {
    var on = sound.isOn();
    voiceBtn.setAttribute("aria-pressed", on ? "true" : "false");
    voiceBtn.textContent = on ? "Sound & voice: on" : "Sound & voice: off";
    if (!on) sound.stopSpeaking();
    else if (isOpen() && startBtn.hidden) sound.hum(true);
  }

  function fillVoices() {
    var vs = sound.voices();
    voicePick.hidden = !vs.length;
    if (!vs.length) return;
    var names = { "en-GB": "English (UK)", "en-US": "English (US)", "en-IN": "English (India)", "en-AU": "English (Australia)", "en-IE": "English (Ireland)", "en-ZA": "English (South Africa)" };
    var order = ["en-GB", "en-US", "en-IN", "en-AU"];
    var groups = {};
    vs.forEach(function (v) {
      var lang = v.lang.replace("_", "-");
      (groups[lang] = groups[lang] || []).push(v);
    });
    var langs = Object.keys(groups).sort(function (a, b) {
      var ia = order.indexOf(a), ib = order.indexOf(b);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.localeCompare(b);
    });
    select.innerHTML = "";
    var auto = document.createElement("option");
    auto.value = "";
    auto.textContent = "Auto (" + (sound.activeVoice() && !sound.chosenVoice() ? sound.activeVoice() : "recommended") + ")";
    select.appendChild(auto);
    langs.forEach(function (lang) {
      var og = document.createElement("optgroup");
      og.label = names[lang] || "English (" + lang + ")";
      groups[lang].sort(function (a, b) { return a.name.localeCompare(b.name); }).forEach(function (v) {
        var o = document.createElement("option");
        o.value = v.name;
        o.textContent = v.name.replace(/\s*\(.*\)$/, "");
        og.appendChild(o);
      });
      select.appendChild(og);
    });
    select.value = sound.chosenVoice();
    if (select.value !== sound.chosenVoice()) select.value = "";
  }

  function trapFocus(e) {
    var f = [].slice.call(el.querySelectorAll("a[href], button:not([hidden]), select")).filter(function (n) { return n.offsetParent !== null; });
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
    clearTimeout(speakTimer);
    clearTimeout(greetTimer);
    clearInterval(hexTimer);
    cancelAnimationFrame(raf);
    sound.stopSpeaking();
    sound.hum(false);
    el.classList.remove("is-open", "is-scanning", "is-locked", "is-greeting");
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
    clearTimeout(speakTimer);
    clearTimeout(greetTimer);
    sound.stopSpeaking();

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

    el.classList.remove("is-scanning", "is-locked", "is-greeting");
    void el.offsetWidth;
    el.classList.add("is-scanning");
    greetTimer = setTimeout(function () {
      if (my !== run) return;
      el.classList.add("is-greeting");
      sound.bell();
    }, reduced ? 0 : 650);
    sound.whoosh();
    sound.scan();

    var lockAfter = reduced ? 0 : 1300;
    lockTimer = setTimeout(function () {
      if (my !== run) return;
      el.classList.add("is-locked");
      status.textContent = "Identity confirmed";
      sound.lock();
    }, lockAfter);
    speakTimer = setTimeout(function () {
      if (my === run) sound.speak(narrationFor(p, ids[key]));
    }, reduced ? 200 : 700);

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
    requestAnimationFrame(function () { requestAnimationFrame(function () { pie.classList.add("is-drawn"); }); });
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
  var voice = null;
  var on = true;
  try { on = localStorage.getItem("mmst-ai-sound") !== "off"; } catch (e) {}

  var synth = window.speechSynthesis;
  var chosen = "";
  var voiceListeners = [];
  try { chosen = localStorage.getItem("mmst-ai-voice") || ""; } catch (e) {}

  function englishVoices() {
    if (!synth) return [];
    var novelty = /^(Albert|Bad News|Bahh|Bells|Boing|Bubbles|Cellos|Good News|Jester|Organ|Superstar|Trinoids|Whisper|Wobble|Zarvox|Grandma|Grandpa|Junior|Ralph|Fred|Kathy)\b/;
    return synth.getVoices().filter(function (v) { return /^en/i.test(v.lang) && !novelty.test(v.name); });
  }

  function pickVoice() {
    var vs = englishVoices();
    voice = chosen ? vs.filter(function (v) { return v.name === chosen; })[0] || null : null;
    var prefer = ["Google UK English Male", "Daniel", "Microsoft Ryan", "Microsoft Guy", "Google US English", "Alex"];
    for (var i = 0; i < prefer.length && !voice; i++) {
      voice = vs.filter(function (v) { return v.name.indexOf(prefer[i]) === 0; })[0] || null;
    }
    if (!voice) voice = vs.filter(function (v) { return /en-GB/i.test(v.lang); })[0] || vs[0] || null;
    voiceListeners.forEach(function (fn) { fn(); });
  }

  function setVoice(name) {
    chosen = name;
    try {
      if (name) localStorage.setItem("mmst-ai-voice", name);
      else localStorage.removeItem("mmst-ai-voice");
    } catch (e) {}
    pickVoice();
  }

  if (synth) {
    pickVoice();
    synth.addEventListener && synth.addEventListener("voiceschanged", pickVoice);
  }

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
      else { stopSpeaking(); hum(false); }
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

  function bell() {
    tone(528, null, 1.6, "sine", 0.05);
    tone(792, null, 1.2, "sine", 0.022, 0.02);
    tone(1056, null, 0.8, "sine", 0.012, 0.04);
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

  function speak(text) {
    if (!on || !synth) return;
    synth.cancel();
    var u = new SpeechSynthesisUtterance(text);
    if (voice) u.voice = voice;
    u.lang = voice ? voice.lang : "en-GB";
    u.rate = 1.1;
    u.pitch = 0.85;
    synth.speak(u);
  }

  function stopSpeaking() { if (synth) synth.cancel(); }

  return {
    blip: blip, scan: scan, done: done, lock: lock, boom: boom, whoosh: whoosh, hum: hum, bell: bell,
    speak: speak, stopSpeaking: stopSpeaking, unlock: unlock, toggle: toggle,
    voices: englishVoices, setVoice: setVoice,
    chosenVoice: function () { return chosen; },
    activeVoice: function () { return voice ? voice.name : ""; },
    onVoices: function (fn) { voiceListeners.push(fn); },
    isOn: function () { return on; },
    onChange: function (fn) { listeners.push(fn); }
  };
}
