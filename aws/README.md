# AWS判断ルールラボ LP

AWS学習アプリの紹介サイト。Webサイトは `audio_codex/site/aws/` に集約し、アプリ本体は隣の `aws_codex/` で管理します。静的HTML / CSS / JavaScriptで、`site/` の既存GitHub Pagesワークフローから `/aws/` に配信する構成です。

```sh
python3 -m http.server 8765 --directory site
# http://localhost:8765/aws/
```

## デザインと構成（2026-10-04改訂）

- `en/`・`ko/` と同じ方向（鮮やかな青・Noto Sans JP・スクロール演出）に統一し、AWS学習向けの「動く図解」を中心に再構成。
- 動く図解・クイズ・アプリ画面ツアーは、操作しなくても自動で進む（触ると自動送りが止まる）。
- 図のサービスアイコンをタップすると、アプリの基本知識と判断ルールをお試し表示（`data/trial.json`、アプリの実データから生成。クリック時に読み込み）。
- 口コミ・FAQは `en/` と同じ形式（ペルソナの声・チャット形式）。口コミは想定ペルソナであることを明記。
- クイズの回答後は、アプリの判断ルール・基本知識（`aws_judgment_rules.json` の実データ）を表示。
- 動く図解（ブラウザで操作可）：リクエストの流れ / Auto Scaling（スライダー） / S3のコスト最適化 / VPCの通り道。ステップ送り・自動再生・一時停止に対応。
- 条件から選ぶ体験版クイズ（5問）、実画面ツアー、復習タイミングの曲線アニメ、料金、FAQ。
- `prefers-reduced-motion` で自動再生・アニメを停止。JavaScript無効時も本文・料金・FAQは読める。
- 図は学習用の簡略版。具体的な再確認日数など、未確認の数値は掲載しない。

## ファイル

- `index.html`: 情報構成、選択例、実画面の説明、料金、FAQ
- `styles.css`: 共通色、文字組み、レスポンシブレイアウト、状態表示
- `motion.js`: 学習例の条件切替、実画面の切替、タブのキーボード操作
- `assets/`: アプリアイコンと実画面。配信時に隣のリポジトリへの依存はありません。

## 内容の根拠（2026-09-27確認）

隣の `aws_codex/` の以下を参照：

- `README.md`、`assets/json/aws_study_library.json`: 152テーマ、64判断ルール、模試10回・650問、304用語
- `docs/authoring/learning-commerce-20260926.md`: 171場面、公式資料へのリンク、無料範囲
- `docs/authoring/learning-release-20260927.md`: 記憶状態の扱い、買い切り課金、予定価格、公開前の状態
- `native/AWSCodex/AWSCodex/Resources/learning_catalog.json`: CP基本・判断・模試1/2が無料、CP追加100円・SAA1,000円（予定）

実画面のコピー元：

- `docs/screenshots/basic-kms-diagram.png`
- `docs/screenshots/learning-commerce-20260926/commerce-scene-first.png`
- `docs/screenshots/feedback-20260926/kaizen26-legacy-highlight.png`
- `docs/screenshots/v4/07-memory-v4.png`

画像はsipsで長辺1,200pxに縮小。アイコンは `assets/app-icons/icon-1.png` を256pxに縮小。

## 公開時の更新

App Store配信前のため、配信CTAはページ内の案内へ接続しています。配信開始時は `#start` の「公開準備中」を実リンクに差し替え、価格と提供内容も確定情報に更新してください。未確認の合格者数・合格率・口コミは掲載していません。

今回の改修はローカルファイルへの反映です。GitHub Pagesへの公開は、別途既存ワークフローで行います。

## ブラウザ検証

```sh
npm i --no-save playwright
npx playwright install chromium
node test/site/aws_site_e2e.mjs
```

320 / 390 / 680 / 768 / 1024 / 1440 / 1920pxで、全4画面のはみ出し・画像読込み、条件切替、キーボード操作、主要操作の44pxタップ領域、FAQ、動きを減らす設定、JavaScript無効時の本文、アンカーとトップ一覧からの導線を確認します。

`SITE_URL` で既存サーバーを指定可能。既存Chromiumを使う場合は `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` を指定します。
