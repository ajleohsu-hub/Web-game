      (() => {
        const canvas = document.querySelector("#game"),
          ctx = canvas.getContext("2d");
        const el = (id) => document.getElementById(id);
        const backgroundImage = new Image();
        backgroundImage.src =
          "https://i.ibb.co/67ThWfM3/a-wide-seamless-panoramic-ultra-wide-sky-and.png";
        const hazardImage = new Image();
        hazardImage.src = "hazard-spike-transparent.png";
        const platformImage = new Image();
        platformImage.src = "platform-transparent.png";
        // New keys start the infinite-mode high-score table from zero.
        const BEST_SCORE_KEY = "neonRunInfiniteBestV5";
        const LEADERBOARD_KEY = "neonRunInfiniteLeaderboardV5";
        let W,
          H,
          DPR,
          running = false,
          last = 0,
          time = 0,
          distance = 0,
          best = +localStorage.getItem(BEST_SCORE_KEY) || 0,
          bestName = loadLeaderboard()[0]?.name || "—",
          speed = 330;
        let level = 1,
          nextCheckpoint = 1000,
          levelNoticeTimer = 0;
        const p = {
          x: 150,
          y: 0,
          w: 28,
          h: 46,
          vy: 0,
          onGround: true,
          jumps: 0,
          dash: 0,
          wall: 0,
          energy: 100,
          combo: 0,
          comboTimer: 0,
          dead: 0,
        };
        let platforms = [],
          hazards = [],
          orbs = [],
          particles = [],
          spawnX = 0;
        const heldKeys = new Set();
        let skipReady = true;
        function resize() {
          DPR = Math.min(devicePixelRatio, 2);
          W = innerWidth;
          H = innerHeight;
          canvas.width = W * DPR;
          canvas.height = H * DPR;
          ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
        }
        addEventListener("resize", resize);
        resize();
        function reset() {
          distance = 0;
          speed = 330;
          time = 0;
          level = 1;
          nextCheckpoint = 1000;
          levelNoticeTimer = 0;
          el("brand").textContent = "LEVEL 1 // NEON RUN";
          el("status").textContent = "ROOFTOP CIRCUIT";
          el("levelNotice").classList.remove("show");
          platforms = [];
          hazards = [];
          orbs = [];
          particles = [];
          spawnX = 0;
          Object.assign(p, {
            y: H * 0.68 - 46,
            vy: 0,
            onGround: true,
            jumps: 0,
            dash: 0,
            wall: 0,
            energy: 100,
            combo: 0,
            comboTimer: 0,
            dead: 0,
          });
          beginRestPlatform(false, true);
          while (spawnX < W + 350) spawn();
          updateHud();
        }
        function beginRestPlatform(showNotice = true, atStart = false) {
          const restY = atStart ? H * 0.68 : H * 0.68 - 76;
          // Level-rest platforms enter visibly from the right as soon as the level banner appears.
          const restX = atStart ? p.x - 44 : W - 80;
          if (!atStart) {
            // Reserve this whole 100M stretch for the rest platform alone.
            platforms = platforms.filter((platform) => platform.x + platform.w < restX);
            hazards = hazards.filter((hazard) => hazard.x + hazard.w < restX);
            orbs = orbs.filter((orb) => orb.x < restX);
          }
          platforms.push({
            x: restX,
            y: restY,
            w: 1000,
            h: 24,
            risk: false,
            rest: true,
            visited: atStart,
          });
          spawnX = restX + 1000;
          if (showNotice) {
            levelNoticeTimer = 2.1;
            el("levelNotice").textContent = "LEVEL " + level;
            el("levelNotice").classList.add("show");
          }
          el("brand").textContent = "LEVEL " + level + " // NEON RUN";
          el("status").textContent = atStart
            ? "100M START PLATFORM"
            : "100M REST PLATFORM AHEAD · JUMP UP";
          if (showNotice) burst(restX, restY, "#46f6ff", 22);
        }
        function escapeHtml(value) {
          return value.replace(/[&<>'"]/g, (character) =>
            ({
              "&": "&amp;",
              "<": "&lt;",
              ">": "&gt;",
              "'": "&#39;",
              '"': "&quot;",
            })[character],
          );
        }
        function loadLeaderboard() {
          try {
            const saved = JSON.parse(localStorage.getItem(LEADERBOARD_KEY) || "[]");
            return Array.isArray(saved) ? saved : [];
          } catch {
            return [];
          }
        }
        function leaderboardHtml(entries) {
          if (!entries.length) return '<div><span>尚無完成紀錄</span><b>—</b></div>';
          return entries
            .map(
              (entry, index) =>
                "<div><span>" +
                String(index + 1).padStart(2, "0") +
                ". " +
                escapeHtml(entry.name) +
                "</span><b>" +
                entry.score +
                " M</b></div>",
            )
            .join("");
        }
        function showNewRecord(score) {
          running = false;
          best = score;
          localStorage.setItem(BEST_SCORE_KEY, best);
          el("status").textContent = "NEW HIGH SCORE · " + score + "M";
          el("brand").textContent = "NEON RUN // NEW RECORD";
          el("overlay").innerHTML =
            '<div class="card"><h1>NEW <em>RECORD</em></h1><p>你打破了最高紀錄！<br />最終距離：<b>' +
            score +
            ' M</b></p><input class="name-input" id="playerName" maxlength="18" placeholder="輸入你的名稱" autocomplete="off" /><button class="start" id="saveScore">儲存紀錄　↗</button><div class="leaderboard" id="leaderboard"></div></div>';
          const leaderboard = el("leaderboard");
          leaderboard.innerHTML = leaderboardHtml(loadLeaderboard());
          el("overlay").style.display = "grid";
          el("saveScore").onclick = () => {
            const input = el("playerName");
            const name = input.value.trim().slice(0, 18) || "ANONYMOUS";
            const entries = loadLeaderboard();
            entries.push({ name, score, createdAt: Date.now() });
            entries.sort((a, b) => b.score - a.score || a.createdAt - b.createdAt);
            localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(entries.slice(0, 30)));
            bestName = entries[0].name;
            updateHud();
            leaderboard.innerHTML = leaderboardHtml(entries.slice(0, 30));
            input.remove();
            el("saveScore").textContent = "再跑一次　↻";
            el("saveScore").onclick = restart;
          };
        }
        function spawn() {
          const gap = spawnX ? 85 + Math.random() * 75 : 0;
          const prev = platforms.at(-1);
          let y = H * 0.68;
          if (prev && Math.random() < 0.32)
            y = prev.y - (65 + Math.random() * 70);
          y = Math.max(H * 0.32, y);
          const w = 180 + Math.random() * 190;
          const x = spawnX + gap;
          platforms.push({ x, y, w, h: 24, risk: y < H * 0.6 });
          if (Math.random() < 0.64 && x > 400)
            hazards.push({ x: x + w * 0.55, y: y - 30, w: 34, h: 30 });
          if (y < H * 0.6 || Math.random() < 0.22)
            orbs.push({ x: x + w * 0.7, y: y - 55, r: 9, taken: false });
          spawnX = x + w;
        }
        function rectHit(a, b) {
          return (
            a.x < b.x + b.w &&
            a.x + a.w > b.x &&
            a.y < b.y + b.h &&
            a.y + a.h > b.y
          );
        }
        function burst(x, y, color, n = 10) {
          for (let i = 0; i < n; i++)
            particles.push({
              x,
              y,
              vx: (Math.random() - 0.5) * 230,
              vy: (Math.random() - 0.5) * 220,
              life: 0.35 + Math.random() * 0.35,
              color,
            });
        }
        function action(type) {
          if (!running || p.dead) return;
          if (type === "jump") {
            if (p.onGround || p.jumps < 2) {
              p.vy = -570;
              p.onGround = false;
              p.jumps++;
              burst(p.x + p.w / 2, p.y + p.h, "#46f6ff", 7);
            } else if (p.wall) {
              p.vy = -510;
              p.wall = 0;
              p.jumps = 1;
            }
          }
          if (type === "dash" && p.energy > 17) {
            p.dash = 0.2;
            p.energy -= 17;
            burst(p.x + p.w, p.y + p.h / 2, "#ff3c93", 15);
          }
        }
        function checkCheckpoint() {
          while (distance >= nextCheckpoint) {
            level++;
            nextCheckpoint += 1000;
            beginRestPlatform();
          }
          return false;
        }
        function skipAhead() {
          if (!running || p.dead || !skipReady) return;
          skipReady = false;
          const skipDistance = 500;
          const worldShift = skipDistance * 10;
          distance += skipDistance;
          platforms.forEach((q) => (q.x -= worldShift));
          hazards.forEach((q) => (q.x -= worldShift));
          orbs.forEach((q) => (q.x -= worldShift));
          spawnX -= worldShift;
          platforms = platforms.filter((q) => q.x + q.w > -100);
          hazards = hazards.filter((q) => q.x + q.w > -100);
          orbs = orbs.filter((q) => q.x > -50);
          while (spawnX < W + 350) spawn();
          p.y = 18;
          p.onGround = false;
          p.vy = 0;
          p.jumps = 2;
          el("status").textContent = "CHEAT ACTIVATED · +500M SKY DROP";
          burst(p.x + p.w / 2, p.y + p.h / 2, "#ffd166", 28);
          checkCheckpoint();
        }
        addEventListener("keydown", (e) => {
          heldKeys.add(e.code);
          if (heldKeys.has("KeyA") && heldKeys.has("KeyL")) skipAhead();
          if (["Space", "ArrowUp", "KeyW"].includes(e.code)) {
            e.preventDefault();
            action("jump");
          }
          if (["ShiftLeft", "ShiftRight", "KeyD"].includes(e.code))
            action("dash");
          if (e.code === "KeyR" && p.dead) restart();
        });
        addEventListener("keyup", (e) => {
          heldKeys.delete(e.code);
          if (!heldKeys.has("KeyA") || !heldKeys.has("KeyL")) skipReady = true;
        });
        [
          ["jump", "jump"],
          ["dash", "dash"],
        ].forEach(([id, a]) => {
          el(id).addEventListener("pointerdown", (e) => {
            e.preventDefault();
            action(a);
          });
        });
        function restart() {
          reset();
          running = true;
          el("overlay").style.display = "none";
          levelNoticeTimer = 2.1;
          el("levelNotice").textContent = "LEVEL 1";
          el("levelNotice").classList.add("show");
          last = performance.now();
          requestAnimationFrame(loop);
        }
        el("start").onclick = restart;
        function die() {
          if (p.dead) return;
          p.dead = 1;
          const score = Math.floor(distance);
          if (score > best) {
            showNewRecord(score);
            return;
          }
          el("overlay").innerHTML =
            '<div class="card"><h1>SIGNAL <em>LOST</em></h1><p>距離 ' +
            score +
            " M　·　最高 " +
            best +
            " M　·　紀錄者 " +
            escapeHtml(bestName) +
            ' <br>按下 <b>R</b> 或點擊下方再次嘗試。</p><button class="start" id="again">重新連線　↻</button></div>';
          el("overlay").style.display = "grid";
          el("again").onclick = restart;
        }
        function update(dt) {
          time += dt;
          let move = speed * (p.dash ? 1.72 : 1) * dt;
          distance += move / 10;
          checkCheckpoint();
          levelNoticeTimer = Math.max(0, levelNoticeTimer - dt);
          if (!levelNoticeTimer) el("levelNotice").classList.remove("show");
          speed = Math.min(650, speed + dt * 2.7);
          p.vy += 1450 * dt;
          p.y += p.vy * dt;
          p.onGround = false;
          p.wall = 0;
          p.dash = Math.max(0, p.dash - dt);
          p.comboTimer -= dt;
          platforms.forEach((q) => (q.x -= move));
          hazards.forEach((q) => (q.x -= move));
          orbs.forEach((q) => (q.x -= move));
          spawnX -= move;
          while (spawnX < W + 350) spawn();
          platforms = platforms.filter((q) => q.x + q.w > -100);
          hazards = hazards.filter((q) => q.x + q.w > -100);
          orbs = orbs.filter((q) => q.x > -50);
          const box = { x: p.x, y: p.y, w: p.w, h: p.h };
          for (const q of platforms) {
            if (
              p.vy >= 0 &&
              box.x + box.w > q.x + 5 &&
              box.x < q.x + q.w - 5 &&
              box.y + box.h >= q.y &&
              box.y + box.h <= q.y + 33
            ) {
              p.y = q.y - p.h;
              p.vy = 0;
              p.onGround = true;
              p.jumps = 0;
              if (q.rest && !q.visited) {
                q.visited = true;
                p.energy = 100;
                burst(p.x + p.w / 2, q.y, "#ffd166", 20);
                el("status").textContent = "REST ZONE · FLOW ENERGY RESTORED";
              }
            }
            if (
              !p.onGround &&
              box.y + box.h > q.y + 8 &&
              box.y < q.y + q.h &&
              Math.abs(box.x + box.w - q.x) < 15
            ) {
              p.wall = 0.12;
              p.vy = Math.min(p.vy, 90);
            }
          }
          if (p.y > H + 100) die();
          for (const h of hazards) {
            let hb = { x: h.x, y: h.y, w: h.w, h: h.h };
            if (rectHit(box, hb)) {
              if (p.dash) {
                burst(h.x, h.y, "#ff3c93", 18);
                h.x = -999;
              } else die();
            }
          }
          for (const o of orbs) {
            if (
              !o.taken &&
              Math.hypot(p.x + p.w / 2 - o.x, p.y + p.h / 2 - o.y) < 38
            ) {
              o.taken = true;
              p.energy = Math.min(100, p.energy + 19);
              p.combo++;
              p.comboTimer = 3;
              burst(o.x, o.y, "#46f6ff", 15);
            }
          }
          if (p.comboTimer < 0) p.combo = 0;
          p.energy = Math.max(0, p.energy - dt * (p.dash ? 6 : 1.15));
          if (p.energy <= 0 && !p.onGround) die();
          particles.forEach((v) => {
            v.x += v.vx * dt;
            v.y += v.vy * dt;
            v.vy += 450 * dt;
            v.life -= dt;
          });
          particles = particles.filter((v) => v.life > 0);
          updateHud();
        }
        function updateHud() {
          el("distance").textContent = String(Math.floor(distance)).padStart(
            4,
            "0",
          );
          el("best").textContent = String(best).padStart(4, "0");
          el("bestName").textContent = bestName;
          el("energy").style.width = p.energy + "%";
          el("energyText").textContent = Math.ceil(p.energy) + "%";
          el("combo").textContent = p.combo > 1 ? "×" + p.combo + " FLOW" : "";
          el("comboHint").textContent = p.combo > 1 ? "高風險路線已鎖定" : "";
          const restPlatformAhead = platforms.some((q) => q.rest && !q.visited);
          if (!levelNoticeTimer && !restPlatformAhead)
            el("status").textContent = "ROOFTOP CIRCUIT";
        }
        function draw() {
          ctx.clearRect(0, 0, W, H);
          if (backgroundImage.complete && backgroundImage.naturalWidth) {
            const scale =
              Math.max(
                W / backgroundImage.naturalWidth,
                H / backgroundImage.naturalHeight,
              ) * 1.45;
            const imageW = backgroundImage.naturalWidth * scale;
            const imageH = backgroundImage.naturalHeight * scale;
            // One oversized image: horizontal camera pan only, never tiled.
            const imageY = (H - imageH) / 2;
            const maxPan = imageW - W;
            const imageX = -Math.min(distance * 0.32, maxPan);
            ctx.drawImage(backgroundImage, imageX, imageY, imageW, imageH);
            ctx.fillStyle = "rgba(2, 7, 17, 0.16)";
          } else {
            const g = ctx.createLinearGradient(0, 0, 0, H);
            g.addColorStop(0, "#071d36");
            g.addColorStop(0.62, "#081126");
            g.addColorStop(1, "#020611");
            ctx.fillStyle = g;
          }
          ctx.fillRect(0, 0, W, H);
          for (const q of platforms) {
            // Platform width can grow, but its thickness always stays the same.
            const visualHeight = 66;
            const visualY = q.y - visualHeight * 0.28;
            if (platformImage.complete && platformImage.naturalWidth) {
              ctx.drawImage(platformImage, q.x, visualY, q.w, visualHeight);
            } else {
              ctx.fillStyle = "#6f4929";
              ctx.fillRect(q.x, q.y, q.w, q.h);
              ctx.fillStyle = "#92c83d";
              ctx.fillRect(q.x, q.y, q.w, 4);
            }
            if (q.rest) {
              ctx.fillStyle = "#fffbe1";
              ctx.font = "700 10px ui-monospace, monospace";
              ctx.fillText("REST ZONE // 100M", q.x + 22, q.y - 8);
            }
          }
          for (const h of hazards) {
            const drawWidth = 72;
            const drawHeight = 48;
            const drawX = h.x - (drawWidth - h.w) / 2;
            const drawY = h.y + h.h - drawHeight + 7;
            if (hazardImage.complete && hazardImage.naturalWidth) {
              ctx.drawImage(hazardImage, drawX, drawY, drawWidth, drawHeight);
            } else {
              // Simple fallback while the supplied danger image is loading.
              ctx.fillStyle = "#000000";
              ctx.beginPath();
              ctx.moveTo(drawX, h.y + h.h);
              ctx.lineTo(drawX + drawWidth / 2, drawY);
              ctx.lineTo(drawX + drawWidth, h.y + h.h);
              ctx.fill();
            }
          }
          for (const o of orbs)
            if (!o.taken) {
              ctx.shadowBlur = 18;
              ctx.shadowColor = "#46f6ff";
              ctx.fillStyle = "#bfffff";
              ctx.beginPath();
              ctx.arc(o.x, o.y, o.r, 0, 7);
              ctx.fill();
              ctx.shadowBlur = 0;
            }
          for (const v of particles) {
            ctx.globalAlpha = Math.max(0, v.life * 2);
            ctx.fillStyle = v.color;
            ctx.fillRect(v.x, v.y, 3, 3);
          }
          ctx.globalAlpha = 1;
          const ph = p.h,
            py = p.y;
          ctx.save();
          ctx.translate(p.x + p.w / 2, py + ph / 2);
          if (p.dash) {
            const flicker = Math.sin(time * 48) * 7;
            // A layered exhaust flame sits behind the runner while dashing.
            ctx.shadowBlur = 22;
            ctx.shadowColor = "#ff3c93";
            ctx.fillStyle = "#ff3c93";
            ctx.beginPath();
            ctx.moveTo(-p.w / 2 + 3, -ph * 0.28);
            ctx.quadraticCurveTo(-p.w / 2 - 24, -ph * 0.48, -56 - flicker, 0);
            ctx.quadraticCurveTo(-p.w / 2 - 23, ph * 0.48, -p.w / 2 + 3, ph * 0.28);
            ctx.closePath();
            ctx.fill();
            ctx.shadowBlur = 12;
            ctx.shadowColor = "#ff9b37";
            ctx.fillStyle = "#ff8c31";
            ctx.beginPath();
            ctx.moveTo(-p.w / 2 + 3, -ph * 0.19);
            ctx.quadraticCurveTo(-p.w / 2 - 16, -ph * 0.25, -43 - flicker * 0.6, 0);
            ctx.quadraticCurveTo(-p.w / 2 - 16, ph * 0.25, -p.w / 2 + 3, ph * 0.19);
            ctx.closePath();
            ctx.fill();
            ctx.fillStyle = "#fff2ad";
            ctx.beginPath();
            ctx.moveTo(-p.w / 2 + 4, -ph * 0.1);
            ctx.lineTo(-27 - flicker * 0.25, 0);
            ctx.lineTo(-p.w / 2 + 4, ph * 0.1);
            ctx.closePath();
            ctx.fill();
            ctx.shadowBlur = 0;
          }
          ctx.fillStyle = "#e9fbff";
          ctx.shadowBlur = 16;
          ctx.shadowColor = "#46f6ff";
          ctx.fillRect(-p.w / 2, -ph / 2, p.w, ph);
          ctx.shadowBlur = 0;
          ctx.fillStyle = "#07101e";
          ctx.fillRect(2, -ph / 2 + 8, 8, 7);
          ctx.fillStyle = "#46f6ff";
          ctx.fillRect(-p.w / 2 + 3, ph / 2 - 7, p.w - 6, 4);
          ctx.restore();
        }
        function loop(now) {
          if (!running || p.dead) return;
          let dt = Math.min(0.033, (now - last) / 1000 || 0);
          last = now;
          update(dt);
          draw();
          if (!p.dead) requestAnimationFrame(loop);
        }
        reset();
        draw();
      })();
