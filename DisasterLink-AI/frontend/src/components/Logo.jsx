import { Link } from 'react-router-dom'
export default function Logo({ to = '/', small }) {
  return (
    <Link to={to} className="flex items-center gap-2.5 shrink-0" aria-label="DisasterLink AI home">
      <img src="/favicon.svg" alt="" className={small ? 'w-7 h-7' : 'w-8 h-8'} />
      <span className="leading-tight">
        <span className="block text-[15px] font-bold tracking-tight text-navy-800">DisasterLink <span className="text-blue-600">AI</span></span>
        {!small && <span className="block text-[10px] font-medium text-slate-500 -mt-0.5">Every Need Matters</span>}
      </span>
    </Link>
  )
}
