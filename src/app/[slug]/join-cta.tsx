'use client'
import { useState } from 'react'

export function JoinCta({ slug, label }: { slug: string; label: string }) {
  const [busy, setBusy] = useState(false)
  async function go() {
    setBusy(true)
    const res = await fetch('/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug }),
    })
    const j = await res.json()
    if (j.redirect) window.location.href = j.redirect
    else { setBusy(false); alert(j.error ?? 'Something went wrong') }
  }
  return (
    <button
      onClick={go}
      disabled={busy}
      className="rounded bg-orange-800 px-8 py-3 text-white font-semibold disabled:opacity-50"
    >
      {busy ? '…' : label}
    </button>
  )
}
