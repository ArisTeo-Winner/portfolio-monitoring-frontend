import { cn } from "../cn";

describe("cn", () => {
  it("returns a single class unchanged", () => {
    expect(cn("foo")).toBe("foo");
  });

  it("joins multiple classes with a space", () => {
    expect(cn("foo", "bar", "baz")).toBe("foo bar baz");
  });

  it("filters out false", () => {
    expect(cn("foo", false, "bar")).toBe("foo bar");
  });

  it("filters out null", () => {
    expect(cn("foo", null, "bar")).toBe("foo bar");
  });

  it("filters out undefined", () => {
    expect(cn("foo", undefined, "bar")).toBe("foo bar");
  });

  it("returns empty string when all values are falsy", () => {
    expect(cn(false, null, undefined)).toBe("");
  });

  it("handles an empty call", () => {
    expect(cn()).toBe("");
  });
});
