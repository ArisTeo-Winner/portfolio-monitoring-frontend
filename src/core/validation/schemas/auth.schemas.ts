import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Correo inválido"),
  password: z.string().min(1, "Contraseña requerida"),
});

export const registerSchema = z.object({
  firstName: z
    .string()
    .min(2, "Mínimo 2 caracteres")
    .max(60, "Máximo 60 caracteres")
    .regex(/^[a-zA-ZÀ-ÿ\s'-]+$/, "Solo letras"),
  lastName: z
    .string()
    .min(2, "Mínimo 2 caracteres")
    .max(60, "Máximo 60 caracteres")
    .regex(/^[a-zA-ZÀ-ÿ\s'-]+$/, "Solo letras"),
  username: z
    .string()
    .min(4, "Mínimo 4 caracteres")
    .max(50, "Máximo 50 caracteres")
    .regex(/^[a-zA-Z0-9_]+$/, "Solo letras, números y guión bajo (_)"),
  email: z.string().email("Correo inválido"),
  password: z
    .string()
    .min(8, "Mínimo 8 caracteres")
    .regex(/[A-Z]/, "Requiere una mayúscula")
    .regex(/[a-z]/, "Requiere una minúscula")
    .regex(/[0-9]/, "Requiere un número")
    .regex(/[@#$%^&+=!]/, "Requiere un símbolo (@#$%^&+=!)"),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
