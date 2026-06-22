export function fechaHoy() {
  const hoy = new Date()
  return `${hoy.getFullYear()}-${String(hoy.getMonth()+1).padStart(2,'0')}-${String(hoy.getDate()).padStart(2,'0')}`
}

export function formatearFecha(fechaStr) {
  if (!fechaStr) return ''
  const [y, m, d] = fechaStr.substring(0,10).split('-')
  return `${d}/${m}/${y}`
}

export function formatearFechaHora(fechaStr) {
  if (!fechaStr) return ''
  const fecha = new Date(fechaStr)
  return fecha.toLocaleString('es-CL', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  })
}

export function formatearFechaLarga(fechaStr) {
  if (!fechaStr) return 'Sin fecha'
  const [y, m, d] = fechaStr.substring(0,10).split('-').map(Number)
  const fecha = new Date(y, m - 1, d)
  const partes = new Intl.DateTimeFormat('es-CL', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  }).formatToParts(fecha)
  const get = tipo => partes.find(p => p.type === tipo)?.value ?? ''
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1)
  return `${cap(get('weekday'))} ${get('day')} de ${cap(get('month'))} ${get('year')}`
}
