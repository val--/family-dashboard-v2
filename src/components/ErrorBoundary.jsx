import { Component } from 'react'

// A safety net: if what's inside crashes while rendering (e.g. an API answered something unexpected), only
// this part shows a discreet placeholder instead of the whole dashboard going blank. It tries again by
// itself after a while, since the next data refresh usually fixes it.
export default class ErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error) {
    console.error(`[${this.props.name || 'bloc'}] indisponible:`, error)
    clearTimeout(this.retry)
    this.retry = setTimeout(() => this.setState({ error: null }), this.props.retryMs ?? 60 * 1000)
  }

  componentWillUnmount() {
    clearTimeout(this.retry)
  }

  render() {
    if (!this.state.error) return this.props.children
    if (this.props.fallback !== undefined) return this.props.fallback
    return (
      <div className="flex h-full min-h-10 items-center justify-center rounded-2xl text-sm text-white/45">
        {this.props.label || 'Indisponible pour le moment'}
      </div>
    )
  }
}
