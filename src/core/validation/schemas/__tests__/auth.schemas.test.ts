import { loginSchema, registerSchema } from "../auth.schemas";

describe("loginSchema", () => {
  it("parses valid credentials", () => {
    const result = loginSchema.safeParse({ email: "user@example.com", password: "secret123" });
    expect(result.success).toBe(true);
  });

  it("returns inferred type on success", () => {
    const result = loginSchema.safeParse({ email: "a@b.com", password: "x" });
    if (!result.success) throw new Error("Expected success");
    expect(result.data).toEqual({ email: "a@b.com", password: "x" });
  });

  it("rejects an invalid email format", () => {
    const result = loginSchema.safeParse({ email: "not-an-email", password: "secret" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.errors[0].message).toBe("Correo inválido");
    }
  });

  it("rejects an empty email", () => {
    const result = loginSchema.safeParse({ email: "", password: "secret" });
    expect(result.success).toBe(false);
  });

  it("rejects an empty password", () => {
    const result = loginSchema.safeParse({ email: "user@example.com", password: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.errors[0].message).toBe("Contraseña requerida");
    }
  });

  it("rejects missing fields", () => {
    const result = loginSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe("registerSchema", () => {
  const valid = {
    username: "johndoe",
    email: "john@example.com",
    password: "Password1!",
  };

  it("parses valid registration data", () => {
    expect(registerSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects username shorter than 3 characters", () => {
    const result = registerSchema.safeParse({ ...valid, username: "ab" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.errors[0].message).toContain("3 caracteres");
    }
  });

  it("rejects username longer than 50 characters", () => {
    const result = registerSchema.safeParse({ ...valid, username: "a".repeat(51) });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.errors[0].message).toContain("50 caracteres");
    }
  });

  it("rejects invalid email", () => {
    const result = registerSchema.safeParse({ ...valid, email: "bad-email" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.errors[0].message).toBe("Correo inválido");
    }
  });

  it("rejects password shorter than 8 characters", () => {
    const result = registerSchema.safeParse({ ...valid, password: "Aa1!" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.errors.some((e) => e.message.includes("8 caracteres"))).toBe(true);
    }
  });

  it("rejects password without uppercase", () => {
    const result = registerSchema.safeParse({ ...valid, password: "password1!" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.errors.some((e) => e.message.includes("mayúscula"))).toBe(true);
    }
  });

  it("rejects password without lowercase", () => {
    const result = registerSchema.safeParse({ ...valid, password: "PASSWORD1!" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.errors.some((e) => e.message.includes("minúscula"))).toBe(true);
    }
  });

  it("rejects password without a digit", () => {
    const result = registerSchema.safeParse({ ...valid, password: "Password!" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.errors.some((e) => e.message.includes("número"))).toBe(true);
    }
  });

  it("rejects password without a symbol", () => {
    const result = registerSchema.safeParse({ ...valid, password: "Password1" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.errors.some((e) => e.message.includes("símbolo"))).toBe(true);
    }
  });
});
