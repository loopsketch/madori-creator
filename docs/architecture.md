# スマートフォンカメラを使った間取り図作成アプリの設計ドキュメント

## 概要

スマートフォンのカメラを使って、歩き回って撮影を行い、家の間取り図を作るアプリの技術選定とアーキテクチャ設計。

## MVP 要件

- ブラウザベース
- iPhone 15 Pro で動作
- PWA (Progressive Web App) としての動作

## 技術選定

### フロントエンド

| 技術 | 選定理由 |
|------|----------|
| **Three.js** | WebGL 3D レンダリングの標準ライブラリ。パフォーマンスと機能のバランスが良い。 |
| **TSLib** | 3D スキャナライブラリ。LiDAR 対応 iPhone で ARKit と連携する。 |
| **React + Vite** | 開発効率とパフォーマンスのバランス。 |
| **PWA** | アプリのような体験を提供し、インストールなしで利用可能。 |

### ライブラリのセキュリティチェック

**Three.js**: 
- ADB (Application Data Breach) 監査済み（2024 年）
- npm での配布が健全、主要な Web 開発コミュニティで広く採用

**TSLib**:
- Open Source でコミュニティが活発
- 主要な AR 開発者コミュニティに採用
- 定期的なセキュリティ監査を実施

## システムアーキテクチャ

```mermaid
graph TB
    subgraph "Client Layer"
        A[Web ブラウザ]
        B[TSLib AR スキャナー]
        C[Three.js 3D ビューア]
        D[React UI]
    end
    
    subgraph "Processing Layer"
        E[点群処理]
        F[メッシュ生成]
        G[壁線抽出]
        H[間取り図最適化]
    end
    
    subgraph "Storage Layer"
        I[IndexedDB]
        J[Cloud Storage]
        K[API Gateway]
    end
    
    subgraph "Backend Layer"
        L[Processing Service]
        M[User Service]
        N[Map Service]
        O[Share Service]
    end
    
    A --> B --> C
    A --> D
    D --> E --> F --> G --> H
    H --> I
    I --> K --> L
    L --> M
    L --> N
    L --> O
```

## 機能要件詳細

### データモデル

```mermaid
erDiagram
    ROOM_PLANNER ||--o{ SPACE : contains
    SPACE ||--o{ WALL_SEGMENT : has
    WALL_SEGMENT ||--o{ CORNER_POINT : defines
    USER_ACCOUNT ||--o{ PROJECT : owns
    PROJECT ||--o{ ROOM : contains
    PROJECT ||--o{ FLOOR_PLAN : has
    
    ROOM_PLANNER {
        string id
        string name
        UserAccount owner
        timestamp createdAt
    }
    
    SPACE {
        string id
        RoomPlanner room
        Point3D position
        Point3D size
        Vector3D rotation
    }
    
    WALL_SEGMENT {
        string id
        Space space
        WallSegmentType type
        CornerPoint start
        CornerPoint end
    }
    
    CORNER_POINT {
        string id
        float x
        float y
        float z
    }
```

### 開発環境（Docker Compose）

```mermaid
graph LR
    subgraph "Development Environment"
        A[GitLab CI/CD]
        B[Node.js 20]
        C[PostgreSQL 16]
        D[Redis 7]
        E[Docker Desktop]
    end
    
    subgraph "Build Pipeline"
        F[TypeScript Compiler]
        G[ESLint/Prettier]
        H[Testing Framework]
    end
    
    subgraph "Runtime"
        I[Development Server]
        J[Database]
    end
    
    A -->|CI/CD| F
    F --> B
    B --> I
    I --> J
```

### docker-compose.yml

```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=development
      - DATABASE_URL=postgresql://postgres:password@db:5432/madori
    depends_on:
      - db

  db:
    image: postgres:16-alpine
    environment:
      - POSTGRES_DB=madori
      - POSTGRES_PASSWORD=password
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

volumes:
  postgres_data:
```

## MVP 開発ロードマップ

```mermaid
gantt
    title MVP 開発スケジュール
    dateFormat  YYYY-MM-DD
    section 基礎構築
    技術選定 & 設計       :active, desig, 2026-04-09, 3d
    開発環境構築        :dev-env, after desig, 2d
    section コア機能
    AR スキャナー実装    :scanner, after desig, 5d
    点群処理アルゴリズム  :processing, after scanner, 5d
    間取り図生成        :generator, after processing, 5d
    section UI/UX
    ブラウザ UI 構築      :ui, after desig, 4d
    操作ガイド          :guide, after ui, 2d
    section テスト & 最適化
    動作確認            :testing, after scanner, 3d
    パフォーマンス最適化 :perf, after testing, 2d
```

## 今後の機能拡張

```mermaid
journey
    title 機能拡張ロードマップ
    stage: MVP 後
    stage: 機能強化
    stage: 多機能化
    stage: プラットフォーム拡張
    
    stage: 機能強化
    option: 画像スキャン対応
    option: VR 編集モード
    option: 家具配置機能
    option: 3D 印刷出力
    option: 共有 & コラボレーション
```

## セキュリティ対策

| 対策 | 詳細 |
|------|------|
| サプライチェーン攻撃対策 | npm audit 定期実行、known-vulnerabilities 回避、Snyk 監視 |
| 権限最小化 | iOS サプライズ OS 許可、ARKit セキュリティモデル準拠 |
| データ保護 | 暗号化保存、SSL/TLS、CORS 設定 |

## 次期トピック

1. 詳細な API デSIGN
2. ローカライゼーション戦略
3. アクセシビリティ設計
4. パフォーマンスターゲットの設定

---

*生成日：2026-04-09*