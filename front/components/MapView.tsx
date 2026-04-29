import React from 'react'

// バックエンドから受け取った間取り図 SVG を表示する。
// SVG 文字列はサーバが組み立てた信頼できるコンテンツ前提で、
// dangerouslySetInnerHTML で挿入する。

interface MapViewProps {
  svg?: string
  width?: number
  height?: number
  style?: React.CSSProperties
}

export function MapView({ svg, width = 200, height = 200, style }: MapViewProps) {
  const baseStyle: React.CSSProperties = {
    width,
    height,
    background: '#ffffff',
    borderRadius: '0.25rem',
    boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
    overflow: 'hidden',
    display: 'block',
    ...style,
  }

  if (!svg) {
    return (
      <div
        style={{
          ...baseStyle,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#999',
          fontSize: '0.75rem',
        }}
      >
        待機中
      </div>
    )
  }

  return <div style={baseStyle} dangerouslySetInnerHTML={{ __html: svg }} />
}
