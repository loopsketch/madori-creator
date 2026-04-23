# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 開発環境構築

### 環境の起動

```bash
# すべてのサービスを開始
docker compose up -d

# 確認
docker compose ps
```

### サービスの停止

```bash
# すべて停止
docker compose down

# データを保持しながら停止
docker compose down -v
```

## 開発ワークフロー

### 1. Issue の作成
指示を受けたら、GitHub に issue を作成し、作業内容をまとめる。

### 2. ブランチの作成
依頼者が確認するか、実装開始の指示を受けたら、develop ブランチをベースに以下のようにブランチを切る。

```
git checkout develop
git checkout -b feature/{issue 番号}
```

### 3. 開発
- テストコードもできるだけ書く
- 実装上の課題がないか確認する

### 4. プルリクエスト
実装が完了したら、develop ブランチに向けた PR を作成する。

### 5. GitHub 操作
GitHub の操作は CLI で行う。

## 脆弱性対策

- ライブラリを導入する際は CVE が発行されるような脆弱性に注意
- Web やパッケージツールの診断機能でチェックする
- サプライチェーン攻撃にも配慮し、リリースされたばかりのバージョンは導入しない

## 開発ワークフローの規定

### Issue とブランチ

1. **Issue の作成**: 指示を受けたら、GitHub に issue を作成し、作業内容をまとめる
2. **ブランチの作成**: issue 番号を使用して以下のようにブランチを切る
   ```bash
   git checkout develop
   git checkout -b feature/issue-{issue 番号}
   ```
3. **実装**: feature/issue-{番号} ブランチで実装を行う
4. **PR 作成**: 実装完了後、develop ブランチに向けた PR を作成

### .gitignore の追加

ブランチ作成時に以下を追加する:

```gitignore
# 開発中のファイル
# feature/issue-{番号}/
```

### 注意点

- ブランチ名は `feature/issue-{issue 番号}` の形式で統一
- Issue 番号がない場合は `{issue 番号}` をそのまま使用
- 既存の issue にマージされた場合は新しい issue を作成
