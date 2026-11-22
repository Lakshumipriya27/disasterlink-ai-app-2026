import ShelterFinder from '../../components/ShelterFinder'
export default function ShelterFinderPage() {
  return (
    <div className="bg-canvas">
      <div className="max-w-6xl mx-auto px-4 py-10">
        <h1 className="text-3xl font-bold tracking-tight">Find a suitable shelter</h1>
        <p className="mt-2 text-slate-600 max-w-2xl">Recommendations consider distance, free space, verified accessibility and facilities - not just the nearest shelter.</p>
        <div className="mt-8"><ShelterFinder /></div>
      </div>
    </div>
  )
}
