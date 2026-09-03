import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'

import { useDebounce } from './useDebounce.js'

describe('useDebounce', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns the initial value immediately', () => {
    const { result } = renderHook(() => useDebounce('221', 250))
    const [debounced] = result.current
    expect(debounced).toBe('221')
  })

  it('defers updates until the delay has fully elapsed', () => {
    const { result, rerender } = renderHook(({ v }) => useDebounce(v, 250), {
      initialProps: { v: 'a' },
    })

    rerender({ v: 'b' })

    // Before the delay elapses the previous value is still current.
    act(() => {
      vi.advanceTimersByTime(100)
    })
    expect(result.current[0]).toBe('a')

    // After the remaining delay the new value settles.
    act(() => {
      vi.advanceTimersByTime(200)
    })
    expect(result.current[0]).toBe('b')
  })

  it('resets the timer when the value changes again before the delay elapses', () => {
    const { result, rerender } = renderHook(({ v }) => useDebounce(v, 250), {
      initialProps: { v: 'a' },
    })

    rerender({ v: 'b' })
    act(() => {
      vi.advanceTimersByTime(200)
    })
    // typing more cancels the pending emission
    rerender({ v: 'c' })
    act(() => {
      vi.advanceTimersByTime(200)
    })
    expect(result.current[0]).toBe('a')

    act(() => {
      vi.advanceTimersByTime(100)
    })
    expect(result.current[0]).toBe('c')
  })

  it('reset() syncs the debounced value immediately to the current source', () => {
    const { result, rerender } = renderHook(({ v }) => useDebounce(v, 250), {
      initialProps: { v: 'a' },
    })

    rerender({ v: 'b' })
    // Before the delay, debounced is still 'a'
    act(() => { vi.advanceTimersByTime(100) })
    expect(result.current[0]).toBe('a')

    // Call reset — debounced should snap to 'b' immediately
    const [, reset] = result.current
    act(() => { reset() })
    expect(result.current[0]).toBe('b')
  })

  it('reset() reads the latest value even when called synchronously after setState', () => {
    // Simulates the Pantone bug: setState('') + reset() in the same sync block.
    // reset() must see the NEW value (''), not the old one ('224').
    const { result, rerender } = renderHook(({ v }) => useDebounce(v, 250), {
      initialProps: { v: '224' },
    })

    // Debounce settles to '224'
    act(() => { vi.advanceTimersByTime(250) })
    expect(result.current[0]).toBe('224')

    // Simulate: setCode('') is queued, then reset() is called synchronously.
    // The ref should already point to '' by the time reset() reads it.
    rerender({ v: '' })        // ← setCode('') queued
    const [, reset] = result.current
    act(() => { reset() })     // ← must see '', not '224'

    expect(result.current[0]).toBe('')
  })
})
