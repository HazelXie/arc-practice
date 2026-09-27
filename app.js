(function () {
  "use strict";
  var app = document.getElementById("app");
  var badge = document.getElementById("progressBadge");
  var STORE = "arc-practice-done-v1";
  var P = window.PASSAGES;

  // ---- progress (saved on this device only; safe if storage is blocked) ----
  function loadDone() { try { return JSON.parse(localStorage.getItem(STORE)) || {}; } catch (e) { return {}; } }
  function saveDone(d) { try { localStorage.setItem(STORE, JSON.stringify(d)); } catch (e) {} }
  var done = loadDone();
  function isDone(pid, qi) { return !!done[pid + ":" + qi]; }
  function totalQ() { return P.reduce(function (n, p) { return n + p.questions.length; }, 0); }
  function updateBadge() {
    var n = Object.keys(done).length;
    badge.textContent = "⭐ " + n + " / " + totalQ();
  }

  // ---- helpers ----
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]; }); }
  function norm(s) {
    return String(s).toLowerCase().replace(/[‘’]/g, "'").replace(/[“”]/g, '"')
      .replace(/[^a-z0-9' ]+/g, " ").replace(/\s+/g, " ").trim();
  }
  var STOP = "the a an and or of to in on at is are was were be it its this that with for by from as they their them he she his her do does did why how what who which when where use details text story passage".split(" ");
  function keywords(s) {
    return norm(s).split(" ").filter(function (w) { return w.length > 2 && STOP.indexOf(w) === -1; });
  }
  function overlap(q, a) {
    var qk = keywords(q), ak = keywords(a), hit = 0;
    qk.forEach(function (w) { if (ak.indexOf(w) !== -1) hit++; });
    return { hit: hit, total: qk.length };
  }
  function passageText(p) { return norm(p.text.join(" ")); }
  // does the cite box copy at least 4 words in a row from the passage?
  function citeMatch(cite, p) {
    var words = norm(cite).split(" "), full = " " + passageText(p) + " ";
    for (var i = 0; i + 4 <= words.length; i++) {
      if (full.indexOf(" " + words.slice(i, i + 4).join(" ") + " ") !== -1) return true;
    }
    return false;
  }
  function sentenceish(s) { return s.trim().split(/\s+/).filter(Boolean).length >= 5; }

  // ---- views ----
  function home() {
    var html = '<h2>Pick a passage</h2><p class="lead">Read carefully, then answer with ARC.</p>';
    html += '<div class="arcbox"><b>How to write an ARC answer</b><ul>' +
      '<li><span class="chip a">A</span><b>Answer</b> the question in a full sentence. Use words from the question.</li>' +
      '<li><span class="chip r">R</span><b>Reference</b> the text. Explain in your own words what the passage says.</li>' +
      '<li><span class="chip c">C</span><b>Cite</b> exact words from the passage, inside quotation marks.</li>' +
      '</ul></div><div class="grid">';
    P.forEach(function (p, i) {
      var n = p.questions.filter(function (_, qi) { return isDone(p.id, qi); }).length;
      var all = n === p.questions.length;
      html += '<button class="card' + (all ? " done" : "") + '" data-p="' + i + '">' +
        '<div class="emoji">' + p.emoji + '</div><h3>' + esc(p.title) + '</h3>' +
        '<small>' + p.type + ' · ' + n + '/' + p.questions.length + ' questions ' + (all ? '<span class="tick">✓</span>' : "") + '</small></button>';
    });
    html += "</div>";
    app.innerHTML = html;
    Array.prototype.forEach.call(app.querySelectorAll(".card"), function (b) {
      b.addEventListener("click", function () { practice(+b.dataset.p, firstOpen(+b.dataset.p)); });
    });
    updateBadge();
    window.scrollTo(0, 0);
  }
  function firstOpen(pi) {
    var p = P[pi];
    for (var i = 0; i < p.questions.length; i++) if (!isDone(p.id, i)) return i;
    return 0;
  }

  function practice(pi, qi) {
    var p = P[pi], q = p.questions[qi];
    var html = '<div class="passage"><h2>' + p.emoji + " " + esc(p.title) + "</h2>" +
      p.text.map(function (t) { return "<p>" + esc(t) + "</p>"; }).join("") + "</div>";
    html += '<div class="qcount">Question ' + (qi + 1) + " of " + p.questions.length + '</div>' +
      '<div class="question">' + esc(q.q) + "</div>";
    html +=
      '<div class="field"><label for="fa"><span class="chip a">A</span>Answer</label>' +
      '<p class="tip">Write one full sentence that answers the question. Start with words from the question.</p>' +
      '<textarea id="fa" autocapitalize="sentences" spellcheck="true"></textarea></div>' +
      '<div class="field"><label for="fr"><span class="chip r">R</span>Reference the text</label>' +
      '<p class="tip">Explain, in your own words, what the passage tells us. Try: "The passage explains that..."</p>' +
      '<textarea id="fr" autocapitalize="sentences" spellcheck="true"></textarea></div>' +
      '<div class="field"><label for="fc"><span class="chip c">C</span>Cite evidence</label>' +
      '<p class="tip">Copy exact words from the passage. Use quotation marks. Try: The text says, "..."</p>' +
      '<textarea id="fc" autocapitalize="sentences" spellcheck="false"></textarea></div>';
    html += '<div class="btns"><button class="big" id="check">Check my answer</button>' +
      '<button class="big alt" id="back">Back to passages</button></div><div id="out"></div>';
    app.innerHTML = html;
    window.scrollTo(0, 0);

    document.getElementById("back").addEventListener("click", home);
    document.getElementById("check").addEventListener("click", function () { check(pi, qi); });
  }

  function check(pi, qi) {
    var p = P[pi], q = p.questions[qi];
    var a = document.getElementById("fa").value.trim();
    var r = document.getElementById("fr").value.trim();
    var c = document.getElementById("fc").value.trim();
    var ov = overlap(q.q, a);
    var restated = ov.total > 0 && ov.hit >= Math.min(2, ov.total);
    var aOk = sentenceish(a) && restated;
    var rOk = sentenceish(r);
    var hasQuotes = /["“”]/.test(c);
    var copied = citeMatch(c, p);
    var cOk = hasQuotes && copied;

    function line(ok, good, fix) { return '<li class="' + (ok ? "ok" : "no") + '">' + (ok ? "✅ " + good : "💡 " + fix) + "</li>"; }
    var html = '<div class="feedback"><b>Self-check</b><ul>' +
      line(aOk, "<b>A</b>: You answered in a full sentence and used words from the question.",
        "<b>A</b>: Write a full sentence (5+ words) that uses words from the question.") +
      line(rOk, "<b>R</b>: You explained what the passage says.",
        "<b>R</b>: Add a sentence that explains, in your own words, what the passage tells us.") +
      line(copied, "<b>C</b>: Your evidence matches words in the passage.",
        "<b>C</b>: Copy at least 4 words in a row exactly from the passage.") +
      line(hasQuotes || !c, "<b>C</b>: You used quotation marks.",
        "<b>C</b>: Put the exact words inside quotation marks.") +
      "</ul></div>";

    var pass = aOk && rOk && cOk;
    if (pass) {
      done[p.id + ":" + qi] = true; saveDone(done); updateBadge();
      html += "<div class='feedback'><b>🎉 Great ARC answer! You earned a star.</b></div>";
    }
    var assembled = [a, r, c].filter(Boolean).join(" ");
    if (assembled) html += '<div class="assembled"><b>Your full answer</b><br>' + esc(assembled) + "</div>";

    var s = q.sample;
    html += '<details class="sample" ' + (pass ? "open" : "") + "><summary><b>See a sample answer</b></summary>" +
      '<p><b class="a">A</b> ' + esc(s.a) + '</p><p><b class="r">R</b> ' + esc(s.r) + '</p><p><b class="c">C</b> ' + esc(s.c) + "</p></details>";

    html += '<div class="btns" style="margin-top:16px">';
    if (qi + 1 < p.questions.length) html += '<button class="big" id="next">Next question →</button>';
    else if (pi + 1 < P.length) html += '<button class="big" id="nextp">Next passage →</button>';
    html += '<button class="big alt" id="home2">All passages</button></div>';

    var out = document.getElementById("out");
    out.innerHTML = html;
    out.scrollIntoView({ behavior: "smooth", block: "start" });
    var n = document.getElementById("next"); if (n) n.addEventListener("click", function () { practice(pi, qi + 1); });
    var np = document.getElementById("nextp"); if (np) np.addEventListener("click", function () { practice(pi + 1, 0); });
    document.getElementById("home2").addEventListener("click", home);
  }

  document.getElementById("homeBtn").addEventListener("click", home);
  home();
})();
