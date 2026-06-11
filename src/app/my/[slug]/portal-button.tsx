'use client'

export function PortalButton({ slug, label }: { slug: string; label: string }) {
  async function go() {
    try {
      const res = await fetch('/api/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug }),
      })
      const j = await res.json()
      if (j.redirect) {
        window.location.href = j.redirect
      } else {
        alert(
          j.error === 'no membership'
            ? 'No billing on file yet.'
            : 'Ask your teacher to enable the customer portal in Stripe.'
        )
      }
    } catch {
      alert('Network error — try again')
    }
  }
  return (
    <button onClick={go} className="block w-full py-3 text-left">
      {label} ›
    </button>
  )
}
