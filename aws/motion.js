(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const NS = "http://www.w3.org/2000/svg";

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
      if (playing && visible && !document.hidden) timer = setTimeout(() => { show(i + 1); schedule(); }, 4800);
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
      e.innerHTML = `<rect width="104" height="92" rx="16"/><image href="./assets/aws-icons/ec2.svg" x="28" y="10" width="48" height="48" alt=""/><text x="52" y="80" text-anchor="middle">EC2 #${n + 1}</text>`;
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
      fill.setAttribute("y", 170 - h);
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
    return {
      activate(v) {
        visible = v;
        if (v) render();
      },
    };
  }

  /* ---------- lab tabs ---------- */
  (function lab() {
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
    const card = $(".lab-card");
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
    const Q = [
      { q: "ユーザーIDをキーに、プロフィールを高速に取得したい。表の結合は不要。", tags: ["キー検索", "JOIN不要", "高速"], opts: [["DynamoDB", "NoSQL", "dynamodb"], ["RDS", "リレーショナルDB", "rds"], ["Redshift", "データウェアハウス", "redshift"]], a: 0, why: "キーでの取得が中心でJOINが不要なら、キーバリュー型のDynamoDBが向きます。" },
      { q: "注文・顧客・明細の表を結合して、条件検索や集計をしたい。", tags: ["表の結合", "SQL", "トランザクション"], opts: [["DynamoDB", "NoSQL", "dynamodb"], ["RDS", "リレーショナルDB", "rds"], ["S3", "オブジェクトストレージ", "s3"]], a: 1, why: "表同士の関係をSQLで扱うなら、RDSなどのリレーショナルデータベースです。" },
      { q: "画像や動画を大量に、安く、耐久性高く保存してWebで配信したい。", tags: ["大量", "低コスト", "静的コンテンツ"], opts: [["EBS", "EC2用ブロックストレージ", "ebs"], ["S3", "オブジェクトストレージ", "s3"], ["EFS", "共有ファイルシステム", "efs"]], a: 1, why: "容量を気にせず保存でき、静的コンテンツ配信にも使えるのがS3です。" },
      { q: "アクセス数の増減に合わせて、EC2の台数を自動で増減したい。", tags: ["自動増減", "可用性", "コスト最適化"], opts: [["Auto Scaling", "台数を自動調整", "autoscaling"], ["CloudFront", "コンテンツ配信", "cloudfront"], ["Route 53", "DNS", "route53"]], a: 0, why: "負荷に応じてインスタンス数を増減するのはAuto Scalingの役割です。" },
      { q: "監査用の古いログを何年も保管したい。取り出しに数時間かかってもよい。", tags: ["長期保管", "最安", "低頻度"], opts: [["S3 Standard", "頻繁に使う", "s3-standard"], ["S3 Glacier", "アーカイブ", "s3-glacier"], ["EBS", "ブロックストレージ", "ebs"]], a: 1, why: "めったに取り出さない長期保管データは、保管料が安いGlacier系のクラスが向きます。" },
    ];
    const el = {
      n: $("#quiz-n"), q: $("#quiz-q"), tags: $("#quiz-tags"), opts: $("#quiz-opts"),
      res: $("#quiz-result"), verdict: $("#quiz-verdict"), why: $("#quiz-why"), next: $("#quiz-next"), prog: $("#quiz-prog"),
    };
    let i = 0;
    let score = 0;
    function render() {
      const d = Q[i];
      el.n.textContent = `${i + 1} / ${Q.length}`;
      el.q.textContent = d.q;
      el.tags.innerHTML = "";
      d.tags.forEach((t) => {
        const s = document.createElement("span");
        s.textContent = t;
        el.tags.appendChild(s);
      });
      el.opts.innerHTML = "";
      d.opts.forEach(([name, sub, icon], k) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "opt";
        b.innerHTML = `<img src="./assets/aws-icons/${icon}.svg" alt="" /><span></span><small></small>`;
        b.children[1].textContent = name;
        b.lastChild.textContent = sub;
        b.addEventListener("click", () => pick(k));
        el.opts.appendChild(b);
      });
      el.res.hidden = true;
      el.prog.style.width = (i / Q.length) * 100 + "%";
    }
    function pick(k) {
      const d = Q[i];
      const btns = $$(".opt", el.opts);
      const ok = k === d.a;
      if (ok) score++;
      btns.forEach((b, j) => {
        b.disabled = true;
        if (j === d.a) b.classList.add("ok");
        else if (j === k) b.classList.add("ng");
        else b.classList.add("faded");
      });
      el.verdict.textContent = ok ? "正解！" : "おしい。正解は " + d.opts[d.a][0];
      el.verdict.className = "quiz-verdict " + (ok ? "ok" : "ng");
      el.why.textContent = d.why;
      el.next.textContent = i === Q.length - 1 ? "結果を見る" : "次の問題へ";
      el.res.hidden = false;
      el.prog.style.width = ((i + 1) / Q.length) * 100 + "%";
    }
    el.next.addEventListener("click", () => {
      if (i === Q.length - 1) {
        el.n.textContent = "RESULT";
        el.q.textContent = `${Q.length}問中 ${score}問 正解`;
        el.tags.innerHTML = "";
        el.opts.innerHTML = "";
        el.verdict.textContent = score >= 4 ? "条件から選べています。" : "条件を見る練習をもう少し。";
        el.verdict.className = "quiz-verdict ok";
        el.why.textContent = "アプリでは64のルールと650問の模試で、この「条件→選択」を繰り返し練習できます。";
        el.next.textContent = "もう一度";
        i = -1;
        score = 0;
        el.res.hidden = false;
        el.prog.style.width = "100%";
        return;
      }
      i++;
      render();
    });
    render();
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
  })();
})();
