import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null } }
  static getDerivedStateFromError(error) { return { error } }
  componentDidCatch(error, info) { console.error('UI error:', error, info) }
  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="card p-8 m-6 text-center" role="alert">
        <p className="font-semibold text-navy-800">This page failed to load</p>
        <p className="text-sm text-slate-500 mt-1">{String(this.state.error?.message || this.state.error)}</p>
        <button className="mt-4 rounded-lg border border-slate-300 px-3 py-2 text-sm" onClick={() => this.setState({ error: null })}>Try again</button>
        <a href="/sos" className="mt-4 ml-2 inline-block rounded-lg bg-red-600 text-white px-3 py-2 text-sm">Emergency SOS</a>
      </div>
    )
  }
}
