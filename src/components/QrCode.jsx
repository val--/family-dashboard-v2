import { useMemo } from 'react'
import qrcode from 'qrcode-generator'

// Drawn as one SVG path: crisp at any size, no image to load
export default function QrCode({ value, className }) {
  const { count, path } = useMemo(() => {
    const qr = qrcode(0, 'M')
    qr.addData(value)
    qr.make()
    const n = qr.getModuleCount()
    let d = ''
    for (let row = 0; row < n; row++) {
      for (let col = 0; col < n; col++) {
        if (qr.isDark(row, col)) d += `M${col},${row}h1v1h-1z`
      }
    }
    return { count: n, path: d }
  }, [value])

  const quiet = 3
  return (
    <svg
      className={className}
      viewBox={`${-quiet} ${-quiet} ${count + quiet * 2} ${count + quiet * 2}`}
      shapeRendering="crispEdges"
      role="img"
      aria-label={`QR code : ${value}`}
    >
      <rect x={-quiet} y={-quiet} width={count + quiet * 2} height={count + quiet * 2} fill="#fff" />
      <path d={path} fill="#000" />
    </svg>
  )
}
