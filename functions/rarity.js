// Public, unauthenticated rules page — /rarity. The written, easy-to-read
// counterpart to the internal design doc: same four layers and confirmed
// Named Sets, explained in plain language instead of formulas + code
// references, so any visitor (not just someone reading _shared.js) can
// actually understand how a Pigeon's rarity number came from. Linked from
// DETAIL's own RARITY SCORE box (see updateDetailRarity in static.js).
function renderRarityHtml() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>RAR!TY :: H0W !T W0RKS</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@400;500;600;700&display=swap');
  *{ margin:0; padding:0; box-sizing:border-box; }
  html, body{ min-height:100%; background:#08080a; }
  body{
    font-family:'Chakra Petch',sans-serif;
    color:#e8e8e8;
    min-height:100vh;
    display:flex;
    justify-content:center;
    padding:8vh 6vw 10vh;
  }
  canvas#staticCanvas{ position:fixed; inset:0; width:100%; height:100%; z-index:0; opacity:0.5; pointer-events:none; }
  .page{ max-width:760px; width:100%; position:relative; z-index:1; }
  .eyebrow{
    font-size:12px; letter-spacing:0.35em; color:#3df3ec; text-transform:uppercase;
    opacity:0.85; text-shadow:0 0 6px rgba(61,243,236,0.5); margin-bottom:0.75rem;
  }
  h1{
    font-size:clamp(26px,4.5vw,42px); letter-spacing:0.06em; color:#fff;
    text-shadow:0 0 10px rgba(61,243,236,0.25); margin-bottom:0.75rem; line-height:1.2;
  }
  .intro{ font-size:14px; line-height:1.8; color:rgba(232,232,232,0.75); margin-bottom:2.5rem; max-width:60ch; }
  h2{
    font-size:18px; letter-spacing:0.05em; color:#3df3ec; text-shadow:0 0 6px rgba(61,243,236,0.4);
    margin:2.5rem 0 0.9rem; text-transform:uppercase;
  }
  h2 .step{ color:rgba(232,232,232,0.35); margin-right:0.5em; }
  p, li{ font-size:13.5px; line-height:1.75; color:rgba(232,232,232,0.75); }
  p{ margin-bottom:0.9rem; max-width:64ch; }
  code{ font-family:'Chakra Petch',sans-serif; color:#ff3fd0; background:rgba(255,63,208,0.08); padding:0.1em 0.4em; border-radius:3px; font-size:0.95em; }

  .layer-card{
    border:1px solid rgba(61,243,236,0.25); padding:1rem 1.2rem; margin-bottom:0.9rem;
    background:rgba(61,243,236,0.03);
  }
  .layer-name{ font-size:14px; font-weight:700; letter-spacing:0.05em; color:#fff; margin-bottom:0.3rem; }
  .layer-name .tag{ font-size:10px; letter-spacing:0.1em; padding:0.2em 0.5em; border:1px solid rgba(52,255,133,0.5); color:#34ff85; margin-left:0.6em; text-transform:uppercase; vertical-align:middle; }
  .layer-name .tag.curated{ border-color:rgba(255,63,208,0.5); color:#ff3fd0; }
  .layer-desc{ font-size:12.5px; line-height:1.65; color:rgba(232,232,232,0.6); }
  .layer-example{ font-size:11px; color:rgba(61,243,236,0.7); margin-top:0.4rem; }

  .set-grid{ display:grid; grid-template-columns:repeat(auto-fill,minmax(220px,1fr)); gap:0.8rem; margin-bottom:1rem; }
  .set-card{ border:1px solid rgba(255,63,208,0.3); padding:0.9rem 1rem; background:rgba(255,63,208,0.03); }
  .set-title{ font-size:13px; font-weight:700; color:#ff3fd0; text-shadow:0 0 5px rgba(255,63,208,0.4); margin-bottom:0.4rem; letter-spacing:0.03em; }
  .set-pieces{ font-size:11px; color:rgba(232,232,232,0.55); line-height:1.6; margin-bottom:0.4rem; }
  .set-proof{ font-size:10.5px; color:rgba(52,255,133,0.75); }

  .bar-box{ border:1px solid rgba(255,176,0,0.4); background:rgba(255,176,0,0.04); padding:1rem 1.2rem; margin:1rem 0; }
  .bar-box li{ margin-bottom:0.4rem; }
  .rejected{ border:1px solid rgba(255,63,63,0.35); background:rgba(255,63,63,0.04); padding:0.9rem 1.1rem; margin-top:1rem; font-size:12px; }
  .rejected .verdict{ color:#ff5b5b; font-weight:700; letter-spacing:0.05em; }

  .back-link{
    display:inline-block; margin-top:3rem; border:1px solid rgba(61,243,236,0.55); color:#3df3ec;
    font-size:12px; letter-spacing:0.12em; text-decoration:none; text-transform:uppercase;
    padding:0.8em 1.6em; transition:background 0.15s ease;
  }
  .back-link:hover{ background:rgba(61,243,236,0.1); }
  @media (max-width:600px){ .set-grid{ grid-template-columns:1fr 1fr; } }
</style>
</head>
<body>
  <canvas id="staticCanvas"></canvas>
  <div class="page">
    <div class="eyebrow">Σκύλλα://RAR!TY</div>
    <h1>H0W RAR!TY W0RKS</h1>
    <p class="intro">Every score here comes from real, disclosed math run against the collection's actual trait data — never a guess, and never hidden. This page explains exactly how a number gets calculated, so you can check our work the same way we did.</p>

    <h2><span class="step">01</span>LAYER 1 :: TRA!T RAR!TY SC0RE</h2>
    <p>Every trait on a Pigeon has a real, published % of the collection. Turn that into a score with one rule &mdash; <code>100 &divide; %</code> &mdash; then ADD every one of that Pigeon's own trait scores together. Never averaged: averaging would punish a Pigeon for having more than one rare trait, and the whole point is that rare traits stack.</p>
    <div class="layer-card">
      <div class="layer-name">W0RKED EXAMPLE &mdash; P!GE0N #727</div>
      <div class="layer-desc">
        Background: Takashi (1.03%) &rarr; 100&divide;1.03 = <strong>97.1</strong><br>
        Feathers: Murakami (0.83%) &rarr; 100&divide;0.83 = <strong>120.5</strong><br>
        Eyewear: Kaws (0.40%) &rarr; 100&divide;0.40 = <strong>250.0</strong><br>
        Beak: Superflat (0.83%) &rarr; 100&divide;0.83 = <strong>120.5</strong><br>
        Clothing: none (10.38%) &rarr; 100&divide;10.38 = <strong>9.6</strong><br>
        Headwear: none (14.73%) &rarr; 100&divide;14.73 = <strong>6.8</strong><br>
        <span style="color:#34ff85;">Sum = 604.5 &mdash; this Pigeon's Layer 1 score.</span>
      </div>
    </div>
    <p>Even "no clothing" or "no headwear" is a real, scored state &mdash; every category always contributes something, however small.</p>

    <h2><span class="step">02</span>LAYER 2 :: MATCHED SET MULT!PL!ER</h2>
    <p>Only ever a HAND-CONFIRMED match &mdash; never inferred by an algorithm. A human looks at the actual artwork and decides a combination is real and meaningful, using one bar: either 3 or fewer other Pigeons share the exact same match, or it's an unambiguous, specific reference (a real name, a brand nod, a literal object pairing) &mdash; never just a vague vibe.</p>
    <p>Once confirmed, the multiplier is the simplest rule there is: <strong>it's just the number of matching pieces.</strong></p>
    <div class="layer-card">
      <div class="layer-name">THE WH0LE RULE</div>
      <div class="layer-desc">
        2 pieces match &rarr; <strong>&times;2</strong><br>
        3 pieces match &rarr; <strong>&times;3</strong><br>
        4 pieces match &rarr; <strong>&times;4</strong><br>
        5 pieces match &rarr; <strong>&times;5</strong> &mdash; no ceiling, it just keeps going
      </div>
    </div>
    <p><strong>Final score = Layer 1 total &times; the multiplier</strong> (&times;1 if no confirmed set applies). #727 above matches all 4 pieces of TAKASH! MURAKAM!, so its real final score is <code>604.5 &times; 4 = 2,418</code>. #1515 matches 5 real gold-themed pieces (G0LD) for &times;5. Every Pigeon's own DETAIL page shows this exact breakdown &mdash; tap RARITY SCORE to open it.</p>

    <h2><span class="step">03</span>C0NF!RMED NAMED SETS</h2>
    <p>Every set below is confirmed real, by hand, against the actual artwork &mdash; not algorithm output.</p>
    <div class="set-grid">
      <div class="set-card">
        <div class="set-title">PR!NCE &mdash; &times;2</div>
        <div class="set-pieces">Prince clothing + Prince Hat headwear</div>
        <div class="set-proof">confirmed on #1195</div>
      </div>
      <div class="set-card">
        <div class="set-title">FULLY SU!TED &mdash; &times;2</div>
        <div class="set-pieces">Hazmat clothing + Biohazard headwear</div>
        <div class="set-proof">confirmed on #92</div>
      </div>
      <div class="set-card">
        <div class="set-title">S0 !T BEG!NS &mdash; &times;2</div>
        <div class="set-pieces">Heart clothing + "So It Begins" headwear</div>
        <div class="set-proof">confirmed on #14</div>
      </div>
      <div class="set-card">
        <div class="set-title">TAKASH! MURAKAM! &mdash; &times;4</div>
        <div class="set-pieces">Takashi background + Murakami feathers + Kaws eyewear + Superflat beak</div>
        <div class="set-proof">confirmed on #727</div>
      </div>
      <div class="set-card">
        <div class="set-title">K!NG & CR0WN &mdash; &times;3</div>
        <div class="set-pieces">King clothing + Crown headwear + a descending Pigeon number</div>
        <div class="set-proof">confirmed on #321</div>
      </div>
      <div class="set-card">
        <div class="set-title">T0P HAT & TA!LS &mdash; &times;3</div>
        <div class="set-pieces">Top Hat headwear + Famous Tuxedo clothing + an ascending Pigeon number</div>
        <div class="set-proof">confirmed on #123</div>
      </div>
      <div class="set-card">
        <div class="set-title">ASTR0NAUT &mdash; &times;3</div>
        <div class="set-pieces">Moon Walker clothing + Rocket beak + Interstellion headwear</div>
        <div class="set-proof">confirmed on #11</div>
      </div>
      <div class="set-card">
        <div class="set-title">SANTA &mdash; &times;2</div>
        <div class="set-pieces">Santa clothing + "Merry Christmas" headwear</div>
        <div class="set-proof">confirmed on #973</div>
      </div>
      <div class="set-card">
        <div class="set-title">JESTER &mdash; &times;2</div>
        <div class="set-pieces">Court Jester clothing + Jester headwear</div>
        <div class="set-proof">confirmed on #610</div>
      </div>
      <div class="set-card">
        <div class="set-title">B!NARY C0DE &mdash; &times;2</div>
        <div class="set-pieces">Binary aura + "00100001" clothing</div>
        <div class="set-proof">confirmed on #1320</div>
      </div>
      <div class="set-card">
        <div class="set-title">G0LD &mdash; &times;5</div>
        <div class="set-pieces">Gold aura + Golden feathers + Midas Touch eyewear + 24k Smile beak + Gold Bar headwear</div>
        <div class="set-proof">confirmed on #1515</div>
      </div>
    </div>

    <h2><span class="step">04</span>THE BAR</h2>
    <p>Without a real bar, "matched set" becomes whatever feels thematic. A candidate needs ONE of:</p>
    <div class="bar-box">
      <ol style="margin-left:1.2rem;">
        <li><strong>A genuinely low joint count</strong> &mdash; 3 or fewer other Pigeons share the exact same match.</li>
        <li><strong>An unambiguous, specific reference</strong> &mdash; a real name, a brand nod, a literal object pairing. Not a vague vibe.</li>
      </ol>
    </div>
    <div class="rejected">
      <div class="verdict">REJECTED EXAMPLE</div>
      <p style="margin-top:0.5rem; margin-bottom:0;">#92 also carries Reactor Bite beak + Night Vision eyewear &mdash; sounds thematic, but the real numbers say otherwise: 45 Pigeons have Reactor Bite, 36 have Night Vision, and 4 share both. That's barely above what pure chance predicts, and "sci-fi/military" covers a lot of ground &mdash; pairs like this turn up often by coincidence. It stayed out.</p>
    </div>

    <a class="back-link" href="/static">&larr; BACK T0 Σκύλλα</a>
  </div>

<script>
(function(){
  var c = document.getElementById('staticCanvas');
  if (!c) return;
  function size(){ c.width = window.innerWidth; c.height = window.innerHeight; }
  size();
  window.addEventListener('resize', size);
  var ctx = c.getContext('2d');
  function frame(){
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, c.width, c.height);
    var flecks = Math.floor((c.width * c.height) / 9000);
    for (var i = 0; i < flecks; i++) {
      var x = Math.random() * c.width, y = Math.random() * c.height;
      ctx.fillStyle = Math.random() < 0.5 ? 'rgba(61,243,236,0.55)' : 'rgba(255,63,208,0.5)';
      ctx.fillRect(x, y, 1, 1);
    }
    requestAnimationFrame(frame);
  }
  frame();
})();
</script>
</body>
</html>`;
}

export async function onRequestGet(context) {
  return new Response(renderRarityHtml(), { headers: { 'Content-Type': 'text/html; charset=UTF-8' } });
}
