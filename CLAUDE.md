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
