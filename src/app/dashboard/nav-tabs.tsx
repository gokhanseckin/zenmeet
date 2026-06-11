'use client'
import Link from 'next/link'
import { useSearchParams, usePathname } from 'next/navigation'

const TABS = [['Classroom', '/dashboard'], ['Schedule', '/dashboard/schedule'],
  ['Students', '/dashboard/students'], ['Payments', '/dashboard/payments']] as const

export function NavTabs() {
  const c = useSearchParams().get('c')
  const pathname = usePathname()
  return (
    <>
      {TABS.map(([label, href]) => (
        <Link key={href} href={c ? `${href}?c=${c}` : href}
          className={`block rounded px-3 py-2 hover:bg-neutral-100 ${pathname === href ? 'font-semibold' : ''}`}>{label}</Link>
      ))}
    </>
  )
}
