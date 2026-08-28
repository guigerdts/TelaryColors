import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// testing-library's auto-cleanup only registers when test globals are exposed
// (globals: true). We keep globals off and register it explicitly so rendered
// DOM is torn down between tests instead of accumulating on <body>.
afterEach(() => {
  cleanup()
})
