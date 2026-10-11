      (() => {
        const canvas = document.querySelector("#game"),
          ctx = canvas.getContext("2d");
        const el = (id) => document.getElementById(id);
        const backgroundImage = new Image();
        backgroundImage.src =
          "https://i.ibb.co/67ThWfM3/a-wide-seamless-panoramic-ultra-wide-sky-and.png";
        let W,
          H,
          DPR,
          running = false,
          last = 0,
          time = 0,
          distance = 0,
          best = Math.min(10000, +localStorage.neonRunBest || 0),
          speed = 330;
        let level = 1,
          nextCheckpoint = 1000,
          won = false,
          levelNoticeTimer = 0;
        const p = {
          x: 150,
          y: 0,
          w: 28,
          h: 46,
          vy: 0,
          onGround: true,
          jumps: 0,
          slide: 0,
          dash: 0,
          wall: 0,
          energy: 100,
          combo: 0,
          comboTimer: 0,
          flight: 0,
          dead: 0,
        };
        let platforms = [],
          hazards = [],
          orbs = [],
          particles = [],
          spawnX = 0;
        const heldKeys = new Set();
        let flightReady = true;
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
          won = false;
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
            slide: 0,
            dash: 0,
            wall: 0,
            energy: 100,
            combo: 0,
            comboTimer: 0,
            flight: 0,
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
            const saved = JSON.parse(localStorage.neonRunLeaderboard || "[]");
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
        function win() {
          if (won) return;
          won = true;
          p.dead = 1;
          running = false;
          distance = 10000;
          best = 10000;
          localStorage.neonRunBest = best;
          el("status").textContent = "MISSION COMPLETE · 10000M";
          el("brand").textContent = "NEON RUN // COMPLETE";
          el("overlay").innerHTML =
            '<div class="card"><h1>MISSION <em>COMPLETE</em></h1><p>你已穿越全部 10 個區域。<br />最終距離：<b>10000 M</b></p><input class="name-input" id="playerName" maxlength="18" placeholder="輸入你的名稱" autocomplete="off" /><button class="start" id="saveScore">儲存紀錄　↗</button><div class="leaderboard" id="leaderboard"></div></div>';
          const leaderboard = el("leaderboard");
          leaderboard.innerHTML = leaderboardHtml(loadLeaderboard());
          el("overlay").style.display = "grid";
          el("saveScore").onclick = () => {
            const input = el("playerName");
            const name = input.value.trim().slice(0, 18) || "ANONYMOUS";
            const entries = loadLeaderboard();
            entries.push({ name, score: 10000, createdAt: Date.now() });
            entries.sort((a, b) => b.score - a.score || a.createdAt - b.createdAt);
            localStorage.neonRunLeaderboard = JSON.stringify(entries.slice(0, 30));
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
          if (Math.random() < 0.64 && x > 400) {
            if (Math.random() < 0.45)
              hazards.push({ x: x + w * 0.55, y: y - 24, w: 22, h: 24 });
            else
              hazards.push({
                x: x + w * 0.48,
                y: y - 16,
                w: 48,
                h: 16,
                low: true,
              });
          }
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
          if (type === "slide" && p.onGround) p.slide = 0.42;
        }
        function flyToTop() {
          if (!running || p.dead || !flightReady) return;
          flightReady = false;
          p.flight = 0.8;
          p.onGround = false;
          p.vy = -920;
          el("status").textContent = "CHEAT ACTIVATED · SKY LIFT";
          burst(p.x + p.w / 2, p.y + p.h / 2, "#ffd166", 28);
        }
        addEventListener("keydown", (e) => {
          heldKeys.add(e.code);
          if (heldKeys.has("KeyA") && heldKeys.has("KeyL")) flyToTop();
          if (["Space", "ArrowUp", "KeyW"].includes(e.code)) {
            e.preventDefault();
            action("jump");
          }
          if (["ShiftLeft", "ShiftRight", "KeyD"].includes(e.code))
            action("dash");
          if (["KeyS", "ArrowDown"].includes(e.code)) action("slide");
          if (e.code === "KeyR" && p.dead && !won) restart();
        });
        addEventListener("keyup", (e) => {
          heldKeys.delete(e.code);
          if (!heldKeys.has("KeyA") || !heldKeys.has("KeyL")) flightReady = true;
        });
        [
          ["jump", "jump"],
          ["dash", "dash"],
          ["slide", "slide"],
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
          best = Math.max(best, Math.floor(distance));
          localStorage.neonRunBest = best;
          el("overlay").innerHTML =
            '<div class="card"><h1>SIGNAL <em>LOST</em></h1><p>距離 ' +
            Math.floor(distance) +
            " M　·　最高 " +
            best +
            ' M<br>按下 <b>R</b> 或點擊下方再次嘗試。</p><button class="start" id="again">重新連線　↻</button></div>';
          el("overlay").style.display = "grid";
          el("again").onclick = restart;
        }
        function update(dt) {
          time += dt;
          let move = speed * (p.dash ? 1.72 : 1) * dt;
          distance = Math.min(10000, distance + move / 10);
          if (distance >= nextCheckpoint) {
            if (nextCheckpoint === 10000) {
              win();
              return;
            }
            level++;
            nextCheckpoint += 1000;
            beginRestPlatform();
          }
          levelNoticeTimer = Math.max(0, levelNoticeTimer - dt);
          if (!levelNoticeTimer) el("levelNotice").classList.remove("show");
          speed = Math.min(650, speed + dt * 2.7);
          if (p.flight > 0) {
            p.flight = Math.max(0, p.flight - dt);
            p.vy = -920;
          } else {
            p.vy += 1450 * dt;
          }
          p.y += p.vy * dt;
          if (p.y < 22) {
            p.y = 22;
            if (p.flight > 0) p.vy = 0;
          }
          p.onGround = false;
          p.wall = 0;
          p.slide = Math.max(0, p.slide - dt);
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
          const ph = p.slide ? 24 : p.h;
          const box = { x: p.x, y: p.y + (p.h - ph), w: p.w, h: ph };
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
            if (rectHit(box, hb) && !(h.low && p.slide)) {
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
          el("energy").style.width = p.energy + "%";
          el("energyText").textContent = Math.ceil(p.energy) + "%";
          el("combo").textContent = p.combo > 1 ? "×" + p.combo + " FLOW" : "";
          el("comboHint").textContent = p.combo > 1 ? "高風險路線已鎖定" : "";
          const restPlatformAhead = platforms.some((q) => q.rest && !q.visited);
          if (!levelNoticeTimer && !won && !restPlatformAhead)
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
          ctx.strokeStyle = "#15344e";
          ctx.lineWidth = 1;
          for (let y = H * 0.73; y < H; y += 32) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(W, y);
            ctx.stroke();
          }
          for (const q of platforms) {
            ctx.fillStyle = q.rest ? "#263e43" : q.risk ? "#26336a" : "#172b45";
            ctx.fillRect(q.x, q.y, q.w, q.h);
            ctx.fillStyle = q.rest ? "#ffd166" : q.risk ? "#ff3c93" : "#46f6ff";
            ctx.fillRect(q.x, q.y, q.w, 3);
            ctx.globalAlpha = 0.25;
            ctx.fillRect(q.x + 5, q.y + 6, q.w - 10, 2);
            ctx.globalAlpha = 1;
            if (q.rest) {
              ctx.fillStyle = "#fff1bd";
              ctx.font = "700 10px ui-monospace, monospace";
              ctx.fillText("REST ZONE // 100M", q.x + 22, q.y + 18);
            }
          }
          for (const h of hazards) {
            ctx.fillStyle = "#ff3c93";
            if (h.low) {
              ctx.fillRect(h.x, h.y, h.w, h.h);
              ctx.fillStyle = "#201025";
              for (let i = 4; i < h.w; i += 12) {
                ctx.beginPath();
                ctx.moveTo(h.x + i, h.y);
                ctx.lineTo(h.x + i + 5, h.y - h.h * 0.7);
                ctx.lineTo(h.x + i + 10, h.y);
                ctx.fill();
              }
            } else {
              ctx.beginPath();
              ctx.moveTo(h.x, h.y + h.h);
              ctx.lineTo(h.x + h.w / 2, h.y);
              ctx.lineTo(h.x + h.w, h.y + h.h);
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
          const ph = p.slide ? 24 : p.h,
            py = p.y + p.h - ph;
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
