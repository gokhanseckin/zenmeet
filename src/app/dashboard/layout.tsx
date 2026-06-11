import { Suspense } from 'react'
import { NavTabs } from './nav-tabs'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex max-w-5xl gap-8 px-6 py-8">
      <nav className="w-44 shrink-0 space-y-1">
        <p className="mb-4 font-bold">&#9632; Zenmeet</p>
        {/* NavTabs is a client component using useSearchParams — wrapped in Suspense so the layout can prerender */}
        <Suspense fallback={null}>
          <NavTabs />
        </Suspense>
        <form action="/auth/sign-out" method="post"><button className="px-3 py-2 text-sm text-neutral-500">Sign out</button></form>
      </nav>
      <section className="min-w-0 flex-1">{children}</section>
    </div>
  )
}
