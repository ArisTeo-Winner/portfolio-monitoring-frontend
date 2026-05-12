"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { LockKeyhole, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ProblemAlert } from "@/components/ui/problem-alert";
import { ConfirmDialog } from "@/components/settings/confirm-dialog";
import { SettingsActions, SettingsCard, SettingsField, SettingsHeader } from "@/components/settings/settings-layout";
import { changePassword, getAccountSettings } from "@/features/settings/api/settings";
import type { AccountSettings } from "@/features/settings/types/settings.types";

const passwordSchema = z
  .object({
    confirmPassword: z.string().min(1, "Confirma la contrasena."),
    currentPassword: z.string().min(1, "Ingresa tu contrasena actual."),
    newPassword: z
      .string()
      .min(8, "Minimo 8 caracteres.")
      .regex(/[A-Z]/, "Incluye una mayuscula.")
      .regex(/[a-z]/, "Incluye una minuscula.")
      .regex(/[0-9]/, "Incluye un numero.")
      .regex(/[^A-Za-z0-9]/, "Incluye un simbolo."),
  })
  .refine((values) => values.newPassword === values.confirmPassword, {
    message: "Las contrasenas no coinciden.",
    path: ["confirmPassword"],
  });

type PasswordFormValues = z.infer<typeof passwordSchema>;

export function SecuritySettingsForm() {
  const [account, setAccount] = useState<AccountSettings | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [successOpen, setSuccessOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingValues, setPendingValues] = useState<PasswordFormValues | null>(null);

  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
    reset,
  } = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      confirmPassword: "",
      currentPassword: "",
      newPassword: "",
    },
  });

  useEffect(() => {
    getAccountSettings()
      .then(setAccount)
      .catch(() => setAccount(null));
  }, []);

  function requestConfirmation(values: PasswordFormValues) {
    setError(null);
    setPendingValues(values);
    setConfirmOpen(true);
  }

  async function submitConfirmedPasswordChange() {
    if (!pendingValues) return;

    try {
      await changePassword({
        currentPassword: pendingValues.currentPassword,
        newPassword: pendingValues.newPassword,
      });
      reset();
      setPendingValues(null);
      setConfirmOpen(false);
      setSuccessOpen(true);
    } catch (requestError) {
      setConfirmOpen(false);
      setError(requestError instanceof Error ? requestError.message : "No se pudo cambiar la contrasena.");
    }
  }

  return (
    <div className="space-y-4" data-testid="security-settings-section">
      {/* Status: password last updated */}
      <SettingsCard data-testid="password-status-card">
        <SettingsHeader
          title="Contrasena"
          description="Control de acceso para tu portfolio tracker."
        />
        <div className="divide-y divide-neutral-800">
          <StatusRow label="Ultima actualizacion" value={formatDate(account?.passwordLastUpdatedAt) ?? "Not available"}>
            <Badge tone={account?.passwordLastUpdatedAt ? "success" : "default"}>Tracked</Badge>
          </StatusRow>
        </div>
      </SettingsCard>

      {/* Status: 2FA */}
      <SettingsCard data-testid="twofa-status-card">
        <SettingsHeader
          title="Autenticacion de dos factores"
          description="Estado reportado por el backend si la capacidad esta disponible."
        />
        <div className="divide-y divide-neutral-800">
          {typeof account?.twoFactorEnabled === "boolean" ? (
            <StatusRow label="Autenticador" value={account.twoFactorEnabled ? "Enabled" : "Disabled"}>
              <Badge tone={account.twoFactorEnabled ? "success" : "danger"}>
                {account.twoFactorEnabled ? "Enabled" : "Disabled"}
              </Badge>
            </StatusRow>
          ) : (
            <StatusRow label="Autenticador" value="Backend capability not reported">
              <Badge>Unavailable</Badge>
            </StatusRow>
          )}
        </div>
      </SettingsCard>

      {/* Form: change password */}
      <SettingsCard data-testid="settings-card-security">
        <SettingsHeader
          title="Change Password"
          description="Confirm sensitive changes before submitting."
          icon={<ShieldCheck className="text-blue-400" size={20} />}
        />

        {error ? (
          <div className="px-5 pt-4 md:px-8">
            <ProblemAlert message={error} />
          </div>
        ) : null}

        <form data-testid="security-settings-form" onSubmit={handleSubmit(requestConfirmation)}>
          <div className="divide-y divide-neutral-800">
            <SettingsField label="Contrasena actual">
              <Input
                autoComplete="current-password"
                data-testid="current-password-input"
                error={errors.currentPassword?.message}
                hideLabel
                icon={<LockKeyhole size={20} />}
                label="Current Password"
                type="password"
                wrapperClassName="bg-neutral-950"
                {...register("currentPassword")}
              />
            </SettingsField>
            <SettingsField label="Nueva contrasena">
              <Input
                autoComplete="new-password"
                data-testid="new-password-input"
                error={errors.newPassword?.message}
                hideLabel
                icon={<LockKeyhole size={20} />}
                label="New Password"
                type="password"
                wrapperClassName="bg-neutral-950"
                {...register("newPassword")}
              />
            </SettingsField>
            <SettingsField label="Confirmar contrasena">
              <Input
                autoComplete="new-password"
                data-testid="confirm-password-input"
                error={errors.confirmPassword?.message}
                hideLabel
                icon={<LockKeyhole size={20} />}
                label="Confirm Password"
                type="password"
                wrapperClassName="bg-neutral-950"
                {...register("confirmPassword")}
              />
            </SettingsField>
          </div>

          <SettingsActions>
            <Button
              className="h-12 rounded-2xl font-semibold"
              data-testid="settings-save-button"
              disabled={isSubmitting}
              type="submit"
            >
              {isSubmitting ? "Actualizando..." : "Update password"}
            </Button>
          </SettingsActions>
        </form>
      </SettingsCard>

      <ConfirmDialog
        body="This will update the password used for JWT authentication. Existing sessions may remain active depending on backend policy."
        confirmLabel="Update"
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={submitConfirmedPasswordChange}
        pending={isSubmitting}
        title="Confirm password change"
      />

      <ConfirmDialog
        body="Your password has been updated successfully."
        confirmLabel="Done"
        isOpen={successOpen}
        onClose={() => setSuccessOpen(false)}
        onConfirm={() => setSuccessOpen(false)}
        title="Password updated"
      />
    </div>
  );
}

function StatusRow({ children, label, value }: { children: ReactNode; label: string; value: string }) {
  return (
    <div
      data-testid="settings-field"
      className="grid gap-2 px-5 py-4 md:gap-4 md:grid-cols-[220px_minmax(0,1fr)_auto] md:items-center md:px-8 md:py-5"
    >
      <p className="text-sm font-semibold text-zinc-400">{label}</p>
      <p className="text-sm font-semibold text-neutral-100 tabular-nums md:text-base">{value}</p>
      {children}
    </div>
  );
}

function formatDate(value?: string | null) {
  if (!value) return null;
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
