"use client";

import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils/cn";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { settingsDensity } from "@/features/settings/ui/settings-density";

export function SettingsCard({ children, className, ...props }: HTMLAttributes<HTMLElement>) {
  return (
    <Card className={cn(settingsDensity.card, className)} {...props}>
      {children}
    </Card>
  );
}

type SettingsHeaderProps = {
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  className?: string;
};

export function SettingsHeader({ className, description, icon, title }: SettingsHeaderProps) {
  return (
    <CardHeader className={cn(settingsDensity.cardHeader, className)}>
      <div>
        <CardTitle className={settingsDensity.title}>{title}</CardTitle>
        {description ? <CardDescription className={settingsDensity.description}>{description}</CardDescription> : null}
      </div>
      {icon ?? null}
    </CardHeader>
  );
}

type SettingsFieldProps = HTMLAttributes<HTMLDivElement> & {
  label: ReactNode;
  children: ReactNode;
};

export function SettingsField({ children, className, label, ...props }: SettingsFieldProps) {
  return (
    <div
      data-testid="settings-field"
      className={cn(settingsDensity.field, className)}
      {...props}
    >
      <p className={settingsDensity.label}>{label}</p>
      <div className={settingsDensity.control}>{children}</div>
    </div>
  );
}

export function SettingsActions({ children, className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn(settingsDensity.actions, className)} {...props}>
      {children}
    </div>
  );
}
