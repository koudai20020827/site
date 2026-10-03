(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const NS = "http://www.w3.org/2000/svg";
  // Auto-rotation of the lab scenes stops as soon as the visitor touches any lab control.
  const lab = { auto: !reduced, rotate() {} };

  /* ---------- scroll reveal ---------- */
  const revealEls = $$(".reveal");
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io.unobserve(e.target);
          }
        }),
      { threshold: 0.15 },
    );
    revealEls.forEach((el) => io.observe(el));
    const curve = $(".curve-card");
    if (curve) {
      // the curve card is also a .reveal, so "in" starts its drawing
    }
  } else {
    revealEls.forEach((el) => el.classList.add("in"));
  }

  /* ---------- packet travel along SVG paths ---------- */
  // segs: [{el, rev}] — the dot follows each path in turn at a steady speed.
  const SPEED = 240; // px per second in SVG units
  function travel(dot, segs, onDone) {
    const lens = segs.map((s) => s.el.getTotalLength());
    const total = lens.reduce((a, b) => a + b, 0);
    const dur = Math.max(700, (total / SPEED) * 1000);
    const t0 = performance.now();
    let raf;
    const frame = (now) => {
      const k = Math.min(1, (now - t0) / dur);
      let d = k * total;
      let i = 0;
      while (i < segs.length - 1 && d > lens[i]) d -= lens[i++];
      const at = segs[i].rev ? lens[i] - d : d;
      const p = segs[i].el.getPointAtLength(Math.max(0, Math.min(lens[i], at)));
      dot.setAttribute("cx", p.x);
      dot.setAttribute("cy", p.y);
      dot.style.opacity = k < 1 ? 1 : 0;
      if (k < 1) raf = requestAnimationFrame(frame);
      else if (onDone) onDone();
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }

  /* ---------- hero animation ---------- */
  (function hero() {
    const dot = $("#hp");
    const dot2 = $("#hp2");
    if (!dot || reduced) return;
    const P = (id) => $("#" + id);
    const nodes = $$(".h-node");
    const routes = [
      [{ el: P("he1") }, { el: P("he2") }, { el: P("he3a") }],
      [{ el: P("he1") }, { el: P("he2") }, { el: P("he3b") }],
    ];
    let n = 0;
    const run = () => {
      if (document.hidden) return setTimeout(run, 800);
      const r = routes[n++ % 2];
      nodes.forEach((x) => x.classList.remove("on"));
      const d = n % 2 ? dot : dot2;
      const lit = [0, 1, 2, n % 2 ? 3 : 4];
      let step = 0;
      const t = setInterval(() => {
        nodes.forEach((x, i) => x.classList.toggle("on", i === lit[step]));
        if (++step >= lit.length) clearInterval(t);
      }, 650);
      travel(d, r, () => setTimeout(run, 500));
    };
    run();
  })();

  /* ---------- scene engine (step by step) ---------- */
  const scenes = {
    flow: {
      steps: [
        { title: "ユーザーがアクセス", body: "ブラウザからのリクエストは、まず世界中にあるエッジロケーションのCloudFrontに届きます。", point: "画像など変わらないデータは、ここでキャッシュして高速に返せる。", nodes: ["f-user", "f-cf"], edges: ["f-e1"], path: [["f-e1"]] },
        { title: "ロードバランサーが受け取る", body: "ALBが、受けたリクエストを正常なサーバーへ振り分けます。", point: "ヘルスチェックで、異常なEC2には送らない。", nodes: ["f-cf", "f-alb"], edges: ["f-e2"], path: [["f-e2"]] },
        { title: "複数AZのEC2へ分散", body: "AZ（データセンター群）を分けて配置したEC2へ、リクエストを分散して処理します。", point: "AZを分けておくと、片方が止まってもサービスを続けられる。", nodes: ["f-alb", "f-ec1", "f-ec2"], edges: ["f-e3", "f-e4"], path: [["f-e3"]] },
        { title: "アプリがDBへ問い合わせ", body: "EC2上のアプリが、必要なデータをRDSから読み書きします。", point: "DBをEC2の外に置けば、EC2を増減してもデータは残る。", nodes: ["f-ec1", "f-db"], edges: ["f-e5"], path: [["f-e5"]] },
        { title: "レスポンスが同じ道を戻る", body: "結果はDB→EC2→ALB→CloudFrontの順に戻り、ユーザーの画面に表示されます。", point: "この「入口→分散→処理→保存」が、Web構成の基本形。", nodes: ["f-user", "f-cf", "f-alb", "f-ec1", "f-db"], edges: ["f-e1", "f-e2", "f-e3", "f-e5"], path: [["f-e5", 1], ["f-e3", 1], ["f-e2", 1], ["f-e1", 1]] },
      ],
    },
    vpc: {
      steps: [
        { title: "入口は、インターネットゲートウェイ", body: "インターネットからの通信は、IGWを通ってパブリックサブネットのWebサーバーへ届きます。", point: "パブリックサブネット＝IGWへのルートがあるサブネット。", nodes: ["v-user", "v-igw", "v-web"], edges: ["v-e1", "v-e2"], path: [["v-e1"], ["v-e2"]] },
        { title: "守りたいものは、内側へ", body: "AppサーバーとDBはプライベートサブネットに置き、インターネットから直接届かないようにします。", point: "公開する必要がないものは、プライベートに置く。", nodes: ["v-web", "v-app", "v-db"], edges: ["v-e3", "v-e6"], path: [["v-e3"], ["v-e6"]] },
        { title: "外へ出る通信は、NAT経由", body: "プライベートのサーバーがアップデートを取得するなど、外へ出る通信はNAT Gatewayを通します。", point: "NATは外向きの通信用。外から内への接続は受けない。", nodes: ["v-app", "v-nat", "v-igw", "v-user"], edges: ["v-e4", "v-e5", "v-e1"], path: [["v-e4"], ["v-e5"], ["v-e1", 1]] },
        { title: "道を決めるのは、ルートテーブル", body: "サブネットごとのルートテーブルが、通信をどこへ送るかを決めています。", point: "IGWへのルートがあればパブリック、なければプライベート。", nodes: ["v-igw", "v-nat"], edges: ["v-e1", "v-e2", "v-e4", "v-e5"], path: null },
      ],
    },
    s3: {
      steps: [
        { title: "アップロード直後は Standard", body: "頻繁にアクセスされるデータ向け。保管料は高めですが、取り出し料金や待ち時間はありません。", point: "迷ったら、まずStandard。", bin: 0, cost: 1, day: "例：0日目" },
        { title: "アクセスが減ったら Standard-IA", body: "ライフサイクルルールを設定すると、一定日数がたったデータを自動で移せます。", point: "IAは保管料が安い代わりに、取り出し料金がかかる。", bin: 1, cost: 0.55, day: "例：30日目" },
        { title: "めったに読まないなら Glacier", body: "長期保管向け。さらに安い代わりに、取り出しに時間がかかるクラスがあります。", point: "監査用ログなど、ほぼ読まないデータ向け。", bin: 2, cost: 0.2, day: "例：90日目" },
        { title: "不要になったら自動削除", body: "有効期限（Expiration）を設定すると、不要になったデータを自動で消せます。", point: "手作業なしで、コストを下げ続けられる。", bin: 3, cost: 0.02, day: "例：365日目" },
      ],
    },
  };

  function mountScene(panel, key) {
    const def = scenes[key];
    const svg = $("svg", panel);
    const dot = $(".packet", svg);
    const cur = $(".cur", panel);
    const tot = $(".tot", panel);
    const title = $(".step-title", panel);
    const body = $(".step-body", panel);
    const point = $(".step-point", panel);
    const dots = $(".dots", panel);
    const playBtn = $(".play", panel);
    tot.textContent = def.steps.length;
    def.steps.forEach(() => dots.appendChild(document.createElement("li")));
    let i = 0;
    let timer = null;
    let cancel = null;
    let playing = !reduced;
    let visible = false;

    // s3 file markers
    let files = [];
    if (key === "s3") {
      const g = $("#s3-files", svg);
      for (let n = 0; n < 3; n++) {
        const f = document.createElementNS(NS, "g");
        f.setAttribute("class", "s3-file");
        f.innerHTML = `<rect x="${45 + n * 34}" y="${186 + (n % 2) * 8}" width="26" height="32" rx="5"/><path d="M${52 + n * 34} ${198 + (n % 2) * 8}h12M${52 + n * 34} ${206 + (n % 2) * 8}h12"/>`;
        g.appendChild(f);
        files.push(f);
      }
    }

    function show(n) {
      i = (n + def.steps.length) % def.steps.length;
      const s = def.steps[i];
      cur.textContent = i + 1;
      title.textContent = s.title;
      body.textContent = s.body;
      point.textContent = s.point;
      $$("li", dots).forEach((li, k) => li.classList.toggle("on", k <= i));
      if (cancel) cancel();
      if (dot) dot.style.opacity = 0;
      if (key === "s3") {
        $$(".bin", svg).forEach((b, k) => b.classList.toggle("on", k === Math.min(s.bin, 2)));
        files.forEach((f, k) => {
          const bin = Math.min(s.bin, 2);
          f.style.transform = `translateX(${bin * 215}px)`;
          f.style.transitionDelay = k * 0.12 + "s";
          f.style.opacity = s.bin === 3 ? 0 : 1;
        });
        $("#s3-cost", svg).style.transform = `scaleX(${s.cost})`;
        $("#s3-day", svg).textContent = s.day;
        return;
      }
      $$(".node", svg).forEach((nd) => {
        nd.classList.toggle("on", s.nodes.includes(nd.id));
        nd.classList.toggle("dim", !s.nodes.includes(nd.id));
      });
      $$(".edges path", svg).forEach((p) => p.classList.toggle("on", s.edges.includes(p.id)));
      if (s.path && !reduced) {
        const segs = s.path.map(([id, rev]) => ({ el: $("#" + id, svg), rev: !!rev }));
        cancel = travel(dot, segs);
      }
    }
    function schedule() {
      clearTimeout(timer);
      if (playing && visible && !document.hidden)
        timer = setTimeout(() => {
          if (i === def.steps.length - 1 && lab.auto) return lab.rotate();
          show(i + 1);
          schedule();
        }, 4400);
    }
    function setPlaying(v) {
      playing = v;
      playBtn.setAttribute("aria-pressed", String(v));
      playBtn.textContent = v ? "❚❚ 一時停止" : "▶ 自動再生";
      schedule();
    }
    $(".prev", panel).addEventListener("click", () => { show(i - 1); schedule(); });
    $(".next", panel).addEventListener("click", () => { show(i + 1); schedule(); });
    playBtn.addEventListener("click", () => setPlaying(!playing));
    setPlaying(playing);
    show(0);
    return {
      reset() { show(0); },
      activate(v) {
        visible = v;
        if (v) show(i);
        schedule();
      },
    };
  }

  /* ---------- auto scaling scene ---------- */
  function mountScaling(panel) {
    const svg = $("svg", panel);
    const g = $("#sc-nodes", svg);
    const range = $("#sc-range", panel);
    const text = $("#sc-load-text", panel);
    const count = $("#sc-count", panel);
    const autoBtn = $("#sc-auto", panel);
    const fill = $("#sc-fill", svg);
    const slots = [];
    for (let n = 0; n < 6; n++) {
      const x = 200 + (n % 3) * 140;
      const y = 84 + Math.floor(n / 3) * 112;
      const o = document.createElementNS(NS, "g");
      o.setAttribute("transform", `translate(${x} ${y})`);
      const e = document.createElementNS(NS, "g");
      e.setAttribute("class", "sc-ec2" + (n < 2 ? " min" : ""));
      e.innerHTML = `<rect width="104" height="92" rx="16"/><use href="#ic-ec2" x="28" y="10" width="48" height="48"/><text x="52" y="80" text-anchor="middle">EC2 #${n + 1}</text>`;
      o.appendChild(e);
      g.appendChild(o);
      slots.push(e);
    }
    let auto = !reduced;
    let visible = false;
    let load = 20;
    let raf = 0;
    let t = 0;
    function render() {
      const want = 2 + Math.floor(load / 22);
      const n = Math.min(6, want);
      slots.forEach((s, k) => {
        const on = k < n;
        if (on && !s.classList.contains("on")) {
          s.classList.remove("on");
          void s.getBoundingClientRect();
        }
        s.classList.toggle("on", on);
      });
      const h = Math.round(load * 1.5);
      const asg = $("#sc-asg", svg);
      if (asg) asg.classList.toggle("dim", false);
      fill.setAttribute("y", 160 - h);
      fill.setAttribute("height", h);
      fill.style.fill = load > 70 ? "#ff9900" : "";
      text.textContent = auto ? "自動" : Math.round(load) + "%";
      count.textContent = `起動中のEC2：${n}台` + (n >= 6 ? "（最大）" : n <= 2 ? "（最小）" : "");
      range.value = Math.round(load);
    }
    function loop(now) {
      if (auto && visible) {
        t = now / 1000;
        load = 50 + 46 * Math.sin(t * 0.55 - 1.2);
        render();
      }
      raf = requestAnimationFrame(loop);
    }
    range.addEventListener("input", () => {
      auto = false;
      autoBtn.setAttribute("aria-pressed", "false");
      load = +range.value;
      render();
    });
    autoBtn.addEventListener("click", () => {
      auto = true;
      autoBtn.setAttribute("aria-pressed", "true");
    });
    render();
    if (!reduced) raf = requestAnimationFrame(loop);
    let rot = null;
    return {
      reset() {},
      activate(v) {
        visible = v;
        clearTimeout(rot);
        if (v) {
          render();
          if (lab.auto) rot = setTimeout(() => lab.auto && lab.rotate(), 11000);
        }
      },
    };
  }

  /* ---------- lab tabs ---------- */
  (function labTabs() {
    const tabs = $$(".lab-tabs [role=tab]");
    const panels = $$(".lab-panel");
    if (!tabs.length) return;
    const ctrls = [
      mountScene(panels[0], "flow"),
      mountScaling(panels[1]),
      mountScene(panels[2], "s3"),
      mountScene(panels[3], "vpc"),
    ];
    let onScreen = false;
    let current = 0;
    const apply = (n, focus) => {
      current = n;
      tabs.forEach((t, k) => {
        t.setAttribute("aria-selected", String(k === n));
        t.tabIndex = k === n ? 0 : -1;
      });
      panels.forEach((p, k) => (p.hidden = k !== n));
      ctrls.forEach((c, k) => c.activate(onScreen && k === n));
      if (focus) tabs[n].focus();
    };
    tabs.forEach((t, k) => {
      t.addEventListener("click", () => apply(k));
      t.addEventListener("keydown", (e) => {
        let nx;
        if (e.key === "ArrowRight") nx = (k + 1) % tabs.length;
        if (e.key === "ArrowLeft") nx = (k + tabs.length - 1) % tabs.length;
        if (e.key === "Home") nx = 0;
        if (e.key === "End") nx = tabs.length - 1;
        if (nx !== undefined) {
          e.preventDefault();
          apply(nx, true);
        }
      });
    });
    lab.rotate = () => {
      const nx = (current + 1) % tabs.length;
      ctrls[nx].reset();
      apply(nx);
    };
    const card = $(".lab-card");
    ["click", "keydown", "input"].forEach((ev) =>
      card.addEventListener(ev, () => (lab.auto = false)),
    );
    if ("IntersectionObserver" in window) {
      new IntersectionObserver((es) => {
        onScreen = es[0].isIntersecting;
        apply(current);
      }, { threshold: 0.2 }).observe(card);
    } else {
      onScreen = true;
      apply(0);
    }
    document.addEventListener("visibilitychange", () => apply(current));
  })();

  /* ---------- decision quiz ---------- */
  (function quiz() {
    const root = $("#quiz");
    if (!root) return;
    // Rules and basics are taken from the app's own content (aws_judgment_rules.json).
    const Q = [
      { svc: "dynamodb", ruleId: "dynamodb-key", q: "ユーザーIDをキーに、プロフィールを高速に取得したい。表の結合は不要。", tags: ["キー検索", "JOIN不要", "高速"], opts: [["DynamoDB", "NoSQL", "dynamodb"], ["RDS", "リレーショナルDB", "rds"], ["Redshift", "データウェアハウス", "redshift"]], a: 0, why: "キーでの取得が中心でJOINが不要なら、キーバリュー型のDynamoDBが向きます。", rule: ["キーで高速に引くならDynamoDB", "キー中心の大量アクセスでJOINが不要なら、DynamoDBを検討する。"], basic: ["dynamodb", "Amazon DynamoDB", "キーで高速に取得するNoSQL"] },
      { svc: "rds", ruleId: "database-transaction-analysis", q: "注文・顧客・明細の表を結合して、条件検索や更新をしたい。", tags: ["表の結合", "SQL", "更新"], opts: [["DynamoDB", "NoSQL", "dynamodb"], ["RDS", "リレーショナルDB", "rds"], ["S3", "オブジェクトストレージ", "s3"]], a: 1, why: "表同士の関係をSQLで扱うなら、RDSなどのリレーショナルデータベースです。", rule: ["データの形と処理からDBを選ぶ", "注文などの関係データを更新する基盤にはRDS、大量の履歴データを集計・分析するデータウェアハウスにはRedshiftを比較する。"], basic: ["rds", "Amazon RDS", "運用を任せるリレーショナルDB"] },
      { svc: "s3", ruleId: "storage-access-shape", q: "画像やログをオブジェクトとして大量に保存し、取得したい。", tags: ["オブジェクト", "大量", "低コスト"], opts: [["EBS", "EC2用ブロックストレージ", "ebs"], ["S3", "オブジェクトストレージ", "s3"], ["EFS", "共有ファイルシステム", "efs"]], a: 1, why: "オブジェクトとして保存・取得するならS3。EBSはEC2のディスク、EFSは複数のLinuxで共有するファイルです。", rule: ["保存形式と保持の必要性からストレージを選ぶ", "オブジェクトとして保存するならS3、EC2のディスクならEBS、複数のLinux環境で同じファイルを共有するならEFS。"], basic: ["s3", "Amazon S3", "ファイルをオブジェクトとして保存"] },
      { svc: "autoscaling", ruleId: "scale-vs-distribute", q: "昼間はEC2の台数を増やし、夜間は減らしたい。", tags: ["台数を変える", "需要に合わせる", "コスト"], opts: [["Auto Scaling", "台数を自動調整", "autoscaling"], ["CloudFront", "コンテンツ配信", "cloudfront"], ["Route 53", "DNS", "route53"]], a: 0, why: "需要に合わせてEC2の台数を変えるのはAuto Scaling。リクエストを振り分けるのはELBの役割です。", rule: ["台数を変えるか、リクエストを分けるか", "需要に合わせてEC2台数を変えるのはAuto Scaling、リクエストを複数の宛先へ振り分けるのはELB。"], basic: ["autoscaling", "Amazon EC2 Auto Scaling", "メトリクスや時刻に応じて、EC2の台数を自動で増減"] },
      { svc: "s3", ruleId: "s3-class", q: "バックアップを数年残したい。読むのは監査のときだけで、取り出しは待てる。", tags: ["長期保存", "低頻度", "復元を待てる"], opts: [["S3 Standard", "頻繁に使う", "s3-standard"], ["S3 Glacier", "アーカイブ", "s3-glacier"], ["EBS", "ブロックストレージ", "ebs"]], a: 1, why: "長期保存で復元を待てるなら、保管料が安いGlacier系のクラスを比較します。", rule: ["S3は取得の待ち時間とアクセス頻度で選ぶ", "即時取得が必要なら、低頻度はStandard-IA、頻度が変わるならIntelligent-Tiering。長期保存で復元を待てるならGlacier系を比較する。"], basic: ["s3", "Amazon S3", "ファイルをオブジェクトとして保存"] },
    ];
    const el = {
      n: $("#quiz-n"), q: $("#quiz-q"), tags: $("#quiz-tags"), opts: $("#quiz-opts"), auto: $("#quiz-auto"),
      idle: $("#qr-idle"), body: $("#qr-body"), verdict: $("#quiz-verdict"), why: $("#quiz-why"),
      rule: $("#qr-rule"), ruleSum: $("#qr-rule-sum"), basicIcon: $("#qr-basic-icon"), basicName: $("#qr-basic-name"),
      basicDesc: $("#qr-basic-desc"), next: $("#quiz-next"), prog: $("#quiz-prog"),
    };
    const icon = (id) => `<svg class="ico" viewBox="0 0 80 80" aria-hidden="true"><use href="#ic-${id}" width="80" height="80"/></svg>`;
    let i = 0;
    let score = 0;
    let phase = "ask";
    let lastTouch = 0; // 0 = never touched; auto demo resumes after the visitor goes idle
    let visible = false;
    let timer = null;
    let finished = false;
    const IDLE = 25000;
    const touched = () => lastTouch && Date.now() - lastTouch < IDLE;

    function render() {
      const d = Q[i];
      phase = "ask";
      finished = false;
      el.n.textContent = `${i + 1} / ${Q.length}`;
      el.q.textContent = d.q;
      el.tags.innerHTML = "";
      d.tags.forEach((t) => {
        const s = document.createElement("span");
        s.textContent = t;
        el.tags.appendChild(s);
      });
      el.opts.innerHTML = "";
      d.opts.forEach(([name, sub, ic], k) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "opt";
        b.innerHTML = `${icon(ic)}<span></span><small></small>`;
        b.children[1].textContent = name;
        b.lastChild.textContent = sub;
        b.addEventListener("click", () => pick(k));
        el.opts.appendChild(b);
      });
      el.body.hidden = true;
      el.idle.hidden = false;
      el.prog.style.width = (i / Q.length) * 100 + "%";
    }
    function pick(k) {
      if (phase !== "ask") return;
      phase = "result";
      const d = Q[i];
      const ok = k === d.a;
      if (ok) score++;
      $$(".opt", el.opts).forEach((b, j) => {
        b.disabled = true;
        b.classList.remove("pre");
        if (j === d.a) b.classList.add("ok");
        else if (j === k) b.classList.add("ng");
        else b.classList.add("faded");
      });
      el.verdict.textContent = ok ? "正解！" : "おしい。正解は " + d.opts[d.a][0];
      el.verdict.className = "quiz-verdict " + (ok ? "ok" : "ng");
      el.why.textContent = d.why;
      el.rule.textContent = d.rule[0];
      el.ruleSum.textContent = d.rule[1];
      el.basicIcon.innerHTML = icon(d.basic[0]);
      el.basicName.textContent = d.basic[1];
      el.basicDesc.textContent = d.basic[2];
      el.next.textContent = i === Q.length - 1 ? "結果を見る" : "次の問題へ";
      el.idle.hidden = true;
      el.body.hidden = false;
      el.body.classList.remove("fresh");
      void el.body.offsetWidth;
      el.body.classList.add("fresh");
      el.prog.style.width = ((i + 1) / Q.length) * 100 + "%";
    }
    function advance(auto) {
      if (finished) {
        i = 0;
        score = 0;
        return render();
      }
      if (i === Q.length - 1) {
        if (auto) {
          i = 0;
          score = 0;
          return render();
        }
        finished = true;
        phase = "result";
        el.n.textContent = "RESULT";
        el.q.textContent = `${Q.length}問中 ${score}問 正解`;
        el.tags.innerHTML = "";
        el.opts.innerHTML = "";
        el.verdict.textContent = score >= 4 ? "条件から選べています。" : "条件を見る練習をもう少し。";
        el.verdict.className = "quiz-verdict ok";
        el.why.textContent = "アプリでは64の判断ルールと650問の模試で、この「条件→選択」を繰り返し練習できます。";
        el.rule.textContent = "判断ルール 64件";
        el.ruleSum.textContent = "条件から候補を選ぶ分岐図つき。";
        el.basicIcon.innerHTML = icon("ec2");
        el.basicName.textContent = "基本知識 152テーマ";
        el.basicDesc.textContent = "全カードに状態を切り替える図解。";
        el.next.textContent = "もう一度";
        el.prog.style.width = "100%";
        return;
      }
      i++;
      render();
    }
    function schedule() {
      clearTimeout(timer);
      if (reduced || !visible || document.hidden) return;
      if (touched()) {
        timer = setTimeout(schedule, 2000);
        return;
      }
      const wait = phase === "ask" ? 2600 : 7500;
      timer = setTimeout(() => {
        if (touched()) return schedule();
        if (phase === "ask") {
          const b = $$(".opt", el.opts)[Q[i].a];
          if (b) b.classList.add("pre");
          timer = setTimeout(() => {
            if (touched() || phase !== "ask") return schedule();
            pick(Q[i].a);
            schedule();
          }, 900);
          return;
        }
        if (el.auto && !reduced) el.auto.hidden = false;
        advance(true);
        schedule();
      }, wait);
    }
    el.next.addEventListener("click", () => advance(false));
    $("#qr-rule-btn").addEventListener("click", () => {
      if (!finished) window.openTrial && window.openTrial(Q[i].svc, { tab: "rules", rule: Q[i].ruleId });
    });
    $("#qr-basic-btn").addEventListener("click", () => {
      if (!finished) window.openTrial && window.openTrial(Q[i].svc, { tab: "basics" });
    });
    ["click", "keydown"].forEach((ev) =>
      root.addEventListener(ev, () => {
        lastTouch = Date.now();
        $$(".opt", el.opts).forEach((b) => b.classList.remove("pre"));
        if (el.auto) el.auto.hidden = true;
      }),
    );
    if (el.auto && (reduced || !("IntersectionObserver" in window))) el.auto.hidden = true;
    render();
    if ("IntersectionObserver" in window) {
      new IntersectionObserver((es) => {
        visible = es[0].isIntersecting;
        schedule();
      }, { threshold: 0.45 }).observe(root);
      document.addEventListener("visibilitychange", schedule);
    }
  })();


  /* ---------- trial panel: app basics + judgment rules for a clicked icon ---------- */
  (function trial() {
    const dlg = $("#trial");
    if (!dlg || typeof dlg.showModal !== "function") return;
    const inner = $("#trial-inner");
    // sprite symbol id -> service id in trial.json
    const SVC = {
      cloudfront: "cloudfront", elb: "elb", ec2: "ec2", rds: "rds", dynamodb: "dynamodb",
      s3: "s3", "s3-standard": "s3", "s3-ia": "s3", "s3-glacier": "s3",
      autoscaling: "autoscaling", "grp-asg": "autoscaling",
      igw: "vpc", nat: "vpc", "grp-vpc": "vpc",
      redshift: "redshift", ebs: "ebs", efs: "efs", route53: "route53",
    };
    const ICON = { vpc: "grp-vpc" };
    const LABEL = { cloudfront: "CloudFront", elb: "Elastic Load Balancing", ec2: "EC2", rds: "RDS", dynamodb: "DynamoDB", s3: "S3", autoscaling: "Auto Scaling", vpc: "VPC", redshift: "Redshift", ebs: "EBS", efs: "EFS", route53: "Route 53" };
    let data = null;
    let loading = null;
    const load = () =>
      loading ||
      (loading = fetch("./data/trial.json")
        .then((r) => {
          if (!r.ok) throw new Error(r.status);
          return r.json();
        })
        .then((d) => (data = d))
        .catch((e) => {
          loading = null;
          throw e;
        }));

    const h = (tag, cls, text) => {
      const e = document.createElement(tag);
      if (cls) e.className = cls;
      if (text != null) e.textContent = text;
      return e;
    };
    const ul = (items, cls) => {
      const u = h("ul", cls);
      items.forEach((t) => u.appendChild(h("li", null, t)));
      return u;
    };

    function basics(s, topicIdx) {
      const wrap = h("div", "tr-panel");
      const t = s.topics[topicIdx];
      if (!t) {
        wrap.appendChild(h("p", "tr-empty", "このサービスの基本知識は、アプリで確認できます。"));
        return wrap;
      }
      if (s.topics.length > 1) {
        const chips = h("div", "tr-chips");
        s.topics.forEach((x, k) => {
          const b = h("button", "tr-chip", x.subtitle || x.title);
          b.type = "button";
          b.setAttribute("aria-pressed", String(k === topicIdx));
          b.addEventListener("click", () => render(s, "basics", { topic: k }));
          chips.appendChild(b);
        });
        wrap.appendChild(chips);
      }
      wrap.appendChild(h("h4", "tr-h", t.title));
      t.points.forEach((p) => {
        const box = h("div", "tr-point");
        box.appendChild(h("p", "tr-pt", p.title));
        box.appendChild(ul(p.bullets));
        wrap.appendChild(box);
      });
      if (t.comparisons.length) {
        const cmp = h("div", "tr-cmp");
        t.comparisons.forEach((c) => {
          const row = h("div", "tr-cmp-row");
          row.appendChild(h("strong", null, c.name));
          row.appendChild(h("span", null, c.purpose));
          row.appendChild(h("em", null, "注意：" + c.caution));
          cmp.appendChild(row);
        });
        wrap.appendChild(cmp);
      }
      const tk = h("p", "tr-take");
      tk.appendChild(h("b", null, "ひとことで"));
      tk.appendChild(document.createTextNode(t.takeaway));
      wrap.appendChild(tk);
      if (t.source) {
        const a = h("a", "tr-src", "AWS公式ドキュメント ↗");
        a.href = t.source;
        a.target = "_blank";
        a.rel = "noopener";
        wrap.appendChild(a);
      }
      return wrap;
    }

    function rules(s, focus) {
      const wrap = h("div", "tr-panel");
      if (!s.rules.length) {
        wrap.appendChild(h("p", "tr-empty", "このサービス単独の判断ルールはありません。他のサービスとの使い分けは、アプリの判断ルールで確認できます。"));
        return wrap;
      }
      s.rules.forEach((r) => {
        const card = h("article", "tr-rule" + (r.id === focus ? " is-focus" : ""));
        card.dataset.rule = r.id;
        card.appendChild(h("h4", "tr-h", r.title));
        card.appendChild(h("p", "tr-sum", r.summary));
        const c = h("div", "tr-when");
        c.appendChild(h("span", "tr-k ok", "こんなとき"));
        c.appendChild(ul(r.choose));
        card.appendChild(c);
        if (r.avoid.length) {
          const a = h("div", "tr-when");
          a.appendChild(h("span", "tr-k ng", "注意したいとき"));
          a.appendChild(ul(r.avoid));
          card.appendChild(a);
        }
        if (r.trap.length) {
          const t = h("p", "tr-trap");
          t.appendChild(h("b", null, "ひっかけ"));
          t.appendChild(document.createTextNode(r.trap[0]));
          card.appendChild(t);
        }
        wrap.appendChild(card);
      });
      return wrap;
    }

    function render(s, tab, opt = {}) {
      const id = Object.keys(data).find((k) => data[k] === s);
      inner.textContent = "";
      const head = h("div", "tr-head");
      const ico = document.createElement("div");
      ico.className = "tr-ico";
      ico.innerHTML = `<svg viewBox="0 0 80 80" aria-hidden="true"><use href="#ic-${ICON[id] || id}" width="80" height="80"/></svg>`;
      head.appendChild(ico);
      const hd = h("div", "tr-title");
      hd.appendChild(h("p", "tr-cat", s.category + "・お試し表示"));
      const t = h("h3", null, s.name);
      t.id = "trial-title";
      hd.appendChild(t);
      hd.appendChild(h("p", "tr-desc", s.description));
      head.appendChild(hd);
      const x = h("button", "tr-close", "×");
      x.type = "button";
      x.setAttribute("aria-label", "閉じる");
      x.addEventListener("click", () => dlg.close());
      head.appendChild(x);
      inner.appendChild(head);

      const tabs = h("div", "tr-tabs");
      tabs.setAttribute("role", "tablist");
      [["basics", "基本知識", s.topicsTotal], ["rules", "判断ルール", s.rulesTotal]].forEach(([k, label, n]) => {
        const b = h("button", null, label);
        b.type = "button";
        b.setAttribute("role", "tab");
        b.setAttribute("aria-selected", String(k === tab));
        b.appendChild(h("i", null, String(n)));
        b.addEventListener("click", () => render(s, k));
        tabs.appendChild(b);
      });
      inner.appendChild(tabs);

      const body = h("div", "tr-body");
      body.appendChild(tab === "basics" ? basics(s, opt.topic || 0) : rules(s, opt.rule));
      inner.appendChild(body);

      const foot = h("div", "tr-foot");
      foot.appendChild(h("p", null, `アプリでは「${s.name}」の基本${s.topicsTotal}テーマと判断ルール${s.rulesTotal}件を、図解・演習つきで学べます。ここでは一部のお試し表示です。`));
      const go = h("a", "button button-small", "配信について");
      go.href = "#start";
      go.addEventListener("click", () => dlg.close());
      foot.appendChild(go);
      inner.appendChild(foot);

      if (opt.rule) {
        const f = $(".is-focus", body);
        if (f) requestAnimationFrame(() => f.scrollIntoView({ block: "center" }));
      }
    }

    let lastFocus = null;
    window.openTrial = function (id, opt = {}) {
      if (!SVC[id] && !LABEL[id]) return;
      const key = SVC[id] || id;
      lastFocus = document.activeElement;
      inner.textContent = "";
      inner.appendChild(h("p", "tr-empty", "読み込み中…"));
      if (!dlg.open) dlg.showModal();
      load()
        .then((d) => d[key] && render(d[key], opt.tab || "basics", opt))
        .catch(() => {
          inner.textContent = "";
          const p = h("p", "tr-empty", "お試しデータを読み込めませんでした。時間をおいて再度お試しください。");
          const x = h("button", "button button-small", "閉じる");
          x.type = "button";
          x.addEventListener("click", () => dlg.close());
          inner.append(p, x);
        });
    };
    dlg.addEventListener("click", (e) => {
      if (e.target === dlg) dlg.close();
    });
    dlg.addEventListener("close", () => lastFocus && lastFocus.focus && lastFocus.focus());

    // make every service icon in the diagrams a button
    $$("svg use").forEach((u) => {
      if (u.closest("symbol, .opt, .qr-card, .trial")) return;
      const sym = (u.getAttribute("href") || "").replace("#ic-", "");
      const key = SVC[sym];
      if (!key) return;
      const g = u.closest(".node, .h-node, .sc-ec2, .bin") || u;
      if (g.classList.contains("clickable")) return;
      g.classList.add("clickable");
      g.setAttribute("role", "button");
      g.setAttribute("tabindex", "0");
      g.setAttribute("aria-label", `${LABEL[key]}の基本知識と判断ルールをお試しで見る`);
      const open = (e) => {
        e.stopPropagation();
        window.openTrial(key, {});
      };
      g.addEventListener("click", open);
      g.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          open(e);
        }
      });
    });
  })();

  /* ---------- app tour ---------- */
  (function tour() {
    const tabs = $$('.tour-tabs [role="tab"]');
    const panels = $$(".tour-panel");
    const screen = $("#app-screen");
    if (!tabs.length) return;
    const screens = [
      ["screen-basics.png", "基本の図解画面。KMSキーの状態とアプリへの影響を図で確認。"],
      ["screen-rules.png", "判断ルール画面。DynamoDBとRDSを場面ごとに選び分ける。"],
      ["screen-practice.png", "演習の解答後画面。問題文の可用性と費用の条件を強調。"],
      ["screen-memory.png", "記憶画面。まだ、覚えた、自信ありで学習状態を確認。"],
    ];
    let cur = 0;
    const show = (n, focus) => {
      cur = n;
      tabs.forEach((t, k) => {
        t.setAttribute("aria-selected", String(k === n));
        t.tabIndex = k === n ? 0 : -1;
      });
      panels.forEach((p, k) => (p.hidden = k !== n));
      screen.style.opacity = 0;
      setTimeout(() => {
        screen.src = "./assets/" + screens[n][0];
        screen.alt = screens[n][1];
        screen.style.opacity = 1;
      }, reduced ? 0 : 160);
      if (focus) tabs[n].focus();
    };
    tabs.forEach((t, k) => {
      t.addEventListener("click", () => show(k));
      t.addEventListener("keydown", (e) => {
        let nx;
        if (e.key === "ArrowRight") nx = (k + 1) % tabs.length;
        if (e.key === "ArrowLeft") nx = (k + tabs.length - 1) % tabs.length;
        if (e.key === "Home") nx = 0;
        if (e.key === "End") nx = tabs.length - 1;
        if (nx !== undefined) {
          e.preventDefault();
          show(nx, true);
        }
      });
    });
    $("#next-step").addEventListener("click", () => show((cur + 1) % tabs.length));
    // The tour advances on its own until the visitor touches it.
    const tourEl = $(".tour");
    let touched = false;
    let seen = false;
    ["click", "keydown"].forEach((ev) => tourEl.addEventListener(ev, () => (touched = true)));
    if (!reduced && "IntersectionObserver" in window) {
      new IntersectionObserver((es) => (seen = es[0].isIntersecting), { threshold: 0.4 }).observe(tourEl);
      setInterval(() => {
        if (!touched && seen && !document.hidden) show((cur + 1) % tabs.length);
      }, 6500);
    }
  })();
})();
