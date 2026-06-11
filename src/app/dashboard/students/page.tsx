import { loadDashboard } from '../lib'

export const dynamic = 'force-dynamic'

export default async function StudentsTab({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  const { c } = await searchParams
  const { classroom, db } = await loadDashboard(c)
  const { data: members } = await db.from('memberships')
    .select('status, created_at, students!inner(name, email)')
    .eq('classroom_id', classroom.id).order('created_at', { ascending: false })
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Students</h1>
      <table className="w-full text-left text-sm">
        <thead><tr className="border-b font-mono text-xs uppercase text-neutral-500">
          <th className="py-2">Email</th><th>Status</th><th>Joined</th></tr></thead>
        <tbody>{(members ?? []).map((m: any, i) => (
          <tr key={i} className="border-b">
            <td className="py-2">{m.students.email}</td>
            <td>{m.status}</td>
            <td>{new Date(m.created_at).toLocaleDateString()}</td>
          </tr>))}</tbody>
      </table>
      {!members?.length && <p className="text-neutral-500">No students yet &mdash; share your classroom link.</p>}
    </div>
  )
}
