# CA Script Generator

キャリアアドバイザー向けスクリプト生成ツール

## デプロイ手順

### 1. GitHubにアップロード

1. GitHub（github.com）にログイン
2. 右上「+」→「New repository」
3. Repository name: `ca-script-tool`
4. 「Create repository」をクリック
5. 表示されたコマンドに従ってこのフォルダをpush

```bash
git init
git add .
git commit -m "first commit"
git branch -M main
git remote add origin https://github.com/あなたのユーザー名/ca-script-tool.git
git push -u origin main
```

### 2. Vercelにデプロイ

1. vercel.com にアクセス
2. 「Sign up」→「Continue with GitHub」でログイン
3. 「Add New Project」
4. `ca-script-tool` リポジトリを選択して「Import」
5. 設定はデフォルトのまま「Deploy」をクリック
6. 数分でURLが発行される

### 3. 使い方

- 発行されたURLにアクセス
- 右上「⚙️ 管理」からGemini APIキーを設定
- APIキーはブラウザのlocalStorageに保存されるため、次回以降入力不要
