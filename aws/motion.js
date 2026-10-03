(() => {
  // The examples change only on request, so reading is never interrupted.
  const scenarioButtons = [...document.querySelectorAll("[data-scenario]")];
  const services = [...document.querySelectorAll("[data-service]")];
  const scenarios = [
    {
      text: "ユーザーIDをキーに、<br>プロフィールを<strong>高速に取得。</strong>",
      detail: "テーブルの結合（JOIN）は不要。",
      insight: "キー中心のアクセスなら、DynamoDB。",
    },
    {
      text: "注文・顧客・明細の表を、<br><strong>結合して検索したい。</strong>",
      detail: "データ同士の関係を使って、検索・更新する。",
      insight: "表の関係を扱うなら、RDSなどのRDB。",
    },
  ];
  scenarioButtons.forEach((button, index) => {
    button.addEventListener("click", () => {
      scenarioButtons.forEach((item, i) =>
        item.setAttribute("aria-pressed", String(i === index)),
      );
      services.forEach((item, i) =>
        item.classList.toggle("is-selected", i === index),
      );
      document.querySelector("#scenario-text").innerHTML =
        scenarios[index].text;
      document.querySelector("#scenario-detail").textContent =
        scenarios[index].detail;
      document.querySelector("#scenario-insight").textContent =
        "↳ " + scenarios[index].insight;
      document.querySelector(".path-left").style.stroke =
        index === 0 ? "var(--orange)" : "#53616c";
      document.querySelector(".path-right").style.stroke =
        index === 1 ? "var(--orange)" : "#53616c";
    });
  });

  const tabs = [...document.querySelectorAll('[role="tab"]')];
  const panels = [...document.querySelectorAll('[role="tabpanel"]')];
  const screen = document.querySelector("#app-screen");
  const screens = [
    [
      "screen-basics.png",
      "基本の図解画面。KMSキーの状態とアプリへの影響を図で確認。",
    ],
    [
      "screen-rules.png",
      "判断ルール画面。DynamoDBとRDSを場面ごとに選び分ける。",
    ],
    [
      "screen-practice.png",
      "演習の解答後画面。問題文の可用性と費用の条件を強調。",
    ],
    ["screen-memory.png", "記憶画面。まだ、覚えた、自信ありで学習状態を確認。"],
  ];
  let currentStep = 0;
  const showStep = (index, focus = false) => {
    currentStep = index;
    tabs.forEach((tab, i) => {
      tab.setAttribute("aria-selected", String(i === index));
      tab.tabIndex = i === index ? 0 : -1;
    });
    panels.forEach((panel, i) => {
      panel.hidden = i !== index;
    });
    screen.src = "./assets/" + screens[index][0];
    screen.alt = screens[index][1];
    document.querySelector("#journey-index").textContent = `0${index + 1} / 04`;
    if (focus) tabs[index].focus();
  };
  tabs.forEach((tab, index) => {
    tab.addEventListener("click", () => showStep(index));
    tab.addEventListener("keydown", (event) => {
      let next;
      if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
      if (event.key === "ArrowLeft")
        next = (index + tabs.length - 1) % tabs.length;
      if (event.key === "Home") next = 0;
      if (event.key === "End") next = tabs.length - 1;
      if (next !== undefined) {
        event.preventDefault();
        showStep(next, true);
      }
    });
  });
  document
    .querySelector("#next-step")
    .addEventListener("click", () => showStep((currentStep + 1) % tabs.length));
})();
