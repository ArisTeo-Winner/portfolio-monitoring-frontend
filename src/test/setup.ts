import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

// jsdom may create a non-standard localStorage when --localstorage-file is
// missing a valid path. Replace it with a plain in-memory implementation so
// getItem / setItem / removeItem / clear work reliably in all unit tests.
function makeStorageMock() {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = String(value);
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
    get length() {
      return Object.keys(store).length;
    },
    key: (index: number) => Object.keys(store)[index] ?? null,
  };
}

vi.stubGlobal("localStorage", makeStorageMock());

beforeEach(() => {
  (localStorage as ReturnType<typeof makeStorageMock>).clear();
});

afterEach(() => {
  cleanup();
});

class ResizeObserverMock {
  observe() {}

  unobserve() {}

  disconnect() {}
}

vi.stubGlobal("ResizeObserver", ResizeObserverMock);
