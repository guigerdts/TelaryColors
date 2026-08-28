// useDebounce — return a value that only updates after `delay` ms of quiet.
// Used by the Search page so the pantone query fires 250ms after the last
// keystroke (design: Search debounce 250ms), not on every keypress.
import { useEffect, useState } from 'react'

export function useDebounce(value, delay = 250) {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])

  return debounced
}
