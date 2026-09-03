// useDebounce — return a value that only updates after `delay` ms of quiet.
// Used by the Search page so the pantone query fires 250ms after the last
// keystroke (design: Search debounce 250ms), not on every keypress.
// Returns [debouncedValue, resetFn] — call reset() to sync immediately
// (e.g. after a form save clears the source value).
import { useEffect, useRef, useState } from 'react'

export function useDebounce(value, delay = 250) {
  const [debounced, setDebounced] = useState(value)
  const valueRef = useRef(value)
  valueRef.current = value

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])

  // Immediate sync — clears the pending timer and sets the debounced value
  // to the CURRENT source value (via ref, so it reads the latest even when
  // called synchronously after a setState that hasn't flushed yet).
  const reset = () => setDebounced(valueRef.current)

  return [debounced, reset]
}
