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
    expect(result.current).toBe('221')
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
    expect(result.current).toBe('a')

    // After the remaining delay the new value settles.
    act(() => {
      vi.advanceTimersByTime(200)
    })
    expect(result.current).toBe('b')
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
    expect(result.current).toBe('a')

    act(() => {
      vi.advanceTimersByTime(100)
    })
    expect(result.current).toBe('c')
  })
})
