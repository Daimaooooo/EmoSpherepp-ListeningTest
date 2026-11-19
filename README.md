# EmoSphere++ 聴取評価サイト（予備実験）

卒業研究の [addexp-SBV2JEtest](https://github.com/Daimaooooo/addexp-SBV2JEtest) とは**独立した**、GitHub Pages 向け静的サイトです。旧リポジトリ・旧Google Apps Script・旧スプレッドシートには手を加えません。

## 実験仕様

- 対象：EmoSphere++ の同一英文・同一感情（喜び）で生成した **9音声**。音声長は約2.4〜2.6秒。
- 参加者ごとに提示順をランダム化（全員9条件を1回ずつ評価）。
- 1試行あたり再生開始は**最大2回**、少なくとも1回最後まで聴くと回答可能。
- 喜びの強さ：5件法（1=まったく感じない、5=非常に強く感じる）。
- 自然さ：5件法（1=非常に不自然、5=非常に自然）。
- 再生機器・合成音声への親しみ、提示順、再生回数、回答時間も記録。
- 参加者IDと回答IDを自動生成。18歳以上を対象として、開始時に個人情報の収集・研究利用への同意を得ます。最後に氏名・年齢・性別（回答しない可）を入力し、研究用Google Sheetsへ送信。氏名等はlocalStorageに保存しません。
- 通信障害時は同一回答IDで再送可能。CSVを参加者の端末へ保存する機能あり。

この構成は**予備実験**です。単一英文／単一話者／単一感情なので、別英文や別話者への一般化を主張するための実験ではありません。

## ディレクトリ

| 場所 | 内容 | GitHubに公開？ |
|---|---|---|
| `docs/index.html`, `docs/app.js`, `docs/styles.css` | 実験サイト | はい |
| `docs/lib/experiment.mjs` | ランダム化・回答検証 | はい |
| `docs/config.js` | 受信先の公開URL設定 | はい |
| `docs/conditions.json` | 匿名化した刺激IDと音声ファイル名 | はい |
| `docs/audio/*.wav` | 実験音声9本 | **権利確認後のみ** |
| `gas/Code.gs` | 新しい回答受信プログラム | コードは公開可 |
| `tests/` | 動作チェック | はい |
| `scripts/export_responses.py` | 集計用CSV変換 | はい |
| `EmoSpherepp_PRIVATE_STIMULUS_KEY.csv` | 刺激ID→r値の対応表 | **絶対に公開しない** |

## 公開する前に必ず確認

1. **音声の公開権利**：素材や学習元のESDなどについて、研究用音声を第三者がダウンロード可能なGitHub Pagesに公開してよいか、利用条件・許諾を確認する。許諾が不明なら公開を保留する。
2. **倫理・個人情報**：学内の研究倫理手続き、説明・同意文、問い合わせ先、回答の保持期間、公開範囲を研究担当者が確認する。公開ページの説明文は仮の予備実験用文面。
3. **本番前の動作確認**：研究担当者がスマートフォン／PC両方で9条件・再生制限・送信・再送を確認し、スプレッドシートに正しく1行で保存されることを確認。
4. **再生回数制限の性質**：回数制限はブラウザ画面上のもの。静的サイトのWAVファイルはURLを直接開けるため、厳格なダウンロード制御・再生回数制限はできません。厳密な制限が必須なら音声の認証付き配信サーバーが必要です。
5. **ブラインド化**：公開リポジトリに刺激IDとr値の対応表や分析用データを追加しない。

## 1. 新しいGitHubリポジトリを作る

GitHubで **Daimaooooo/EmoSpherepp-ListeningTest** という新規リポジトリを作ります。卒研用リポジトリをコピーしたり上書きしたりしません。

手元でGitが使える場合の例：

```bash
cd EmoSpherepp-ListeningTest
git init
git add README.md .gitignore docs gas tests scripts
git commit -m "Add randomized listening experiment pilot"
git branch -M main
git remote add origin https://github.com/Daimaooooo/EmoSpherepp-ListeningTest.git
git push -u origin main
```

ZIPから展開する場合は、ZIP自体でなく**中身**をリポジトリのルートへ置いてください。

## 2. 回答保存先の設定（v3への移行）

**既存v2から更新する場合**：同じApps Scriptプロジェクトの `Code.gs` を新版に置き換え、「デプロイを管理」から既存デプロイを編集して「新バージョン」を選択して再デプロイします。既存の `SPREADSHEET_ID` は変更不要。旧 `Submissions` タブは変更せず、新版は `Submissions_v3` タブに保存されます。デプロイ後、同じ `/exec` URL を使うことを確認し、`studyOpen` を有効化します。氏名を含むためスプレッドシートを一般公開せず、アクセスを研究担当者に限定してください。

1. Google Sheetsで**新しいスプレッドシート**を作り、URLの `/d/` と `/edit` の間のIDを控えます。
2. Google Apps Scriptで**新しいプロジェクト**を作り、`gas/Code.gs` の中身を貼ります。
3. Apps Scriptの「プロジェクトの設定」→「スクリプト プロパティ」で `SPREADSHEET_ID` を作り、値を新しいシートIDにします。
4. 「デプロイ」→「新しいデプロイ」→「ウェブアプリ」を選択。**次のユーザーとして実行：自分**、**アクセスできるユーザー：全員**。研究担当者が権限表示を確認し、許可します。
5. ウェブアプリURLの `https://script.google.com/macros/s/.../exec` を `docs/config.js` の `gasEndpoint` に設定します。
6. テスト送信して `Submissions_v3` シートに1回答=1行で保存されることを確認。失敗時はApps Scriptの「実行数」ログを確認。

**注意**：受信先は意図的に未設定で、`studyOpen: false` の間は実験を開始できません。音声公開範囲・参加説明文・受信先を確認し、`docs/config.js` に新しい `/exec` URL を設定してから `studyOpen: true` に変更してください。卒研当時の受信先URLを流用しないでください。公開ページで担当者が9試行の模擬回答、送信成功表示とシートの1行保存、再送時の重複防止を確認し、模擬回答を本番から除外してから参加者に案内します。

送信はフォームPOSTと非表示iframeを使い、受信側の保存完了メッセージをチェックします。通信が途切れた際は「保存されたか不明」と表示し、同じ `submission_id` で再試行します。受信側で重複IDの二重保存を防ぎます。

## 3. GitHub Pagesを有効化する

GitHubの新しいリポジトリの **Settings → Pages** で、Sourceを **Deploy from a branch**、Branchを **main**、Folderを **/docs** に設定して保存します。

ページURL（公開後）：

`https://daimaooooo.github.io/EmoSpherepp-ListeningTest/`

公開サイトでテスト回答し、Google Sheets側の受信行を確認してから参加者にURLを送ってください。受信確認は GitHub Pages のオリジン宛ての postMessage を使用するため、ローカルプレビューでは確認できません。URLはリポジトリのPages設定画面でも確認できます。

## 4. ローカルチェック

Node.js と Python 3 があれば追加ライブラリなしで確認できます。

```bash
node --test tests/experiment.test.mjs
python3 tests/check_assets.py
python3 -m http.server 8000 --directory docs
```

ブラウザで `http://localhost:8000/` を開きます。 `file://` で `index.html` を直接開くと、通常 `conditions.json` の取得が拒否されます。

## 5. 回答データを分析用に変換する

Google Sheetsの `Submissions_v3` タブ（旧版は `Submissions`）を **CSV** としてエクスポートし、次を実行：

```bash
python3 scripts/export_responses.py submissions.csv trials.csv
```

結果は1行=1試行（参加者あたり9行）になります。既定では氏名を除外し、年齢・性別を保持します。氏名が必要な管理用途に限り `--include-names` を指定し、出力は非公開で保管してください。参加者が保存するバックアップCSVには氏名等が含まれます。

r値の対応を加える場合は、公開リポジトリに入れずに保管している**私用の対応表**を指定します：

```bash
python3 scripts/export_responses.py submissions.csv trials.csv --key /private/path/EmoSpherepp_PRIVATE_STIMULUS_KEY.csv
```

## 統計分析上の注意

同じ参加者が全9条件を評価する**反復測定**です。条件ごとの平均と信頼区間に加えて、参加者内の対応を考慮したモデル（例：被験者をランダム効果とする混合効果モデル）を検討してください。順序効果を調べられるように `trial_index` も保存しています。自然さとのトレードオフも別途確認できます。

## 使用技術

HTML/CSS/Vanilla JavaScript, GitHub Pages, Google Apps Script, Google Sheets. 配信用サーバーや外部JavaScriptライブラリは使いません。
