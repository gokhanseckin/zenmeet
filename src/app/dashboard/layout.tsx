import Link from 'next/link'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const tabs = [['Classroom', '/dashboard'], ['Schedule', '/dashboard/schedule'],
    ['Students', '/dashboard/students'], ['Payments', '/dashboard/payments']] as const
  return (
    <div className="mx-auto flex max-w-5xl gap-8 px-6 py-8">
      <nav className="w-44 shrink-0 space-y-1">
        <p className="mb-4 font-bold">&#9632; Zenmeet</p>
        {tabs.map(([label, href]) => (
          <Link key={href} href={href} className="block rounded px-3 py-2 hover:bg-neutral-100">{label}</Link>
        ))}
        <form action="/auth/sign-out" method="post"><button className="px-3 py-2 text-sm text-neutral-500">Sign out</button></form>
      </nav>
      <section className="min-w-0 flex-1">{children}</section>
    </div>
  )
}
