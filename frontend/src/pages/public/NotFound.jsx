import { Link } from 'react-router-dom'
export default function NotFound() {
  return (
    <div className="max-w-xl mx-auto px-4 py-24 text-center">
      <p className="text-sm font-semibold text-blue-600">404</p>
      <h1 className="mt-2 text-2xl font-bold">Page not found</h1>
      <p className="mt-2 text-slate-500">If you need help, use the emergency SOS.</p>
      <div className="mt-6 flex justify-center gap-3"><Link to="/sos" className="rounded-lg bg-red-600 text-white px-4 py-2 font-medium">Emergency SOS</Link><Link to="/" className="rounded-lg border border-slate-300 px-4 py-2 font-medium">Home</Link></div>
    </div>
  )
}
