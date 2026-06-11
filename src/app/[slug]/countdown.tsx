'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

export function Countdown({ targetIso }: { targetIso: string }) {
  const router = useRouter()
  const [now, setNow] = useState(() => Date.now())
  // Guard: track whether countdown was > 0 after mount, to avoid refresh-loop
  // when the page renders with an already-past target.
  const wasCounting = useRef(false)

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  const remaining = Math.max(0, new Date(targetIso).getTime() - now)

  // Track countdown state in an effect (not during render): mark when we
  // observe a positive remaining value; refresh exactly once on reaching zero.
  useEffect(() => {
    if (remaining > 0) {
      wasCounting.current = true
      return
    }
    if (wasCounting.current) {
      wasCounting.current = false
      router.refresh()
    }
  }, [remaining === 0]) // eslint-disable-line react-hooks/exhaustive-deps

  const h = Math.floor(remaining / 3_600_000)
  const m = Math.floor(remaining / 60_000) % 60
  const s = Math.floor(remaining / 1000) % 60
  const pad = (n: number) => String(n).padStart(2, '0')

  return (
    <div className="flex items-end gap-3 font-mono">
      {([[h, 'HRS'], [m, 'MIN'], [s, 'SEC']] as [number, string][]).map(([v, label]) => (
        <div key={label} className="text-center">
          <div className="text-5xl font-bold tabular-nums">{pad(v)}</div>
          <div className="text-xs tracking-widest text-neutral-500">{label}</div>
        </div>
      ))}
    </div>
  )
}
