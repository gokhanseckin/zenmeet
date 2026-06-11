export function ClassroomSwitcher({ classrooms, currentId, basePath }: {
  classrooms: { id: string; title: string }[]; currentId: string; basePath: string
}) {
  if (classrooms.length < 2) return null
  return (
    <p className="text-sm">{classrooms.map(cl => (
      <a key={cl.id} href={`${basePath}?c=${cl.id}`} className={cl.id === currentId ? 'font-bold mr-3' : 'underline mr-3'}>{cl.title}</a>
    ))}</p>
  )
}
