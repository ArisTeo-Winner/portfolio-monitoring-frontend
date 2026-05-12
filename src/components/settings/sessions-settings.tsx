"use client";

import { MonitorSmartphone, ShieldX } from "lucide-react";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ProblemAlert } from "@/components/ui/problem-alert";
import { Table, TableContainer, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { ConfirmDialog } from "@/components/settings/confirm-dialog";
import { SettingsCard, SettingsHeader } from "@/components/settings/settings-layout";
import { getSessions, revokeSession } from "@/features/settings/api/settings";
import { settingsDensity } from "@/features/settings/ui/settings-density";
import type { SessionSettings } from "@/features/settings/types/settings.types";

export function SessionsSettings() {
  const [sessions, setSessions] = useState<SessionSettings[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingSession, setPendingSession] = useState<SessionSettings | null>(null);
  const [revoking, setRevoking] = useState(false);

  useEffect(() => {
    let active = true;

    getSessions()
      .then((items) => {
        if (active) setSessions(items.filter((session) => session.id));
      })
      .catch((requestError) =>
        setError(requestError instanceof Error ? requestError.message : "No se pudieron cargar las sesiones."),
      )
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  async function confirmRevoke() {
    if (!pendingSession) return;

    setRevoking(true);
    setError(null);

    try {
      await revokeSession(pendingSession.id);
      setSessions((current) => current.filter((session) => session.id !== pendingSession.id));
      setPendingSession(null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "No se pudo revocar la sesion.");
    } finally {
      setRevoking(false);
    }
  }

  return (
    <div className="space-y-4" data-testid="sessions-settings-section">
      <SettingsCard className={settingsDensity.contentCard} data-testid="settings-card-sessions">
        <SettingsHeader
          className={settingsDensity.contentHeader}
          title="Gestion de sesiones"
          description="Dispositivos con acceso activo a tu portfolio tracker."
          icon={<MonitorSmartphone className="shrink-0 text-blue-400" size={18} />}
        />

        {error ? (
          <div className="px-5 pt-4 md:px-8">
            <ProblemAlert message={error} />
          </div>
        ) : null}

        {/* Mobile session cards */}
        <div className={`${settingsDensity.repeatedList} lg:hidden`} data-testid="sessions-mobile-list">
          {loading ? <SessionSkeleton /> : null}
          {!loading && sessions.length === 0 ? (
            <p className="text-sm text-neutral-400">No active sessions reported.</p>
          ) : null}
          {sessions.map((session) => (
            <article
              key={session.id}
              data-testid="session-card"
              className={settingsDensity.sessionCard}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold leading-5 text-neutral-50">{session.device}</p>
                  <p className="truncate text-xs leading-4 text-neutral-400">{session.ipAddress}</p>
                </div>
                {session.current ? (
                  <Badge className={settingsDensity.sessionBadge} tone="success">
                    Current
                  </Badge>
                ) : (
                  <Badge className={settingsDensity.sessionBadge}>Active</Badge>
                )}
              </div>
              <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3">
                <Metric label="Created" value={formatDate(session.createdAt)} />
                <Metric label="Last Active" value={formatDate(session.lastActiveAt)} />
              </div>
              <Button
                block
                className={settingsDensity.sessionAction}
                data-testid="session-revoke-button"
                disabled={session.current}
                onClick={() => setPendingSession(session)}
                type="button"
                variant="danger"
              >
                Revoke
              </Button>
            </article>
          ))}
        </div>

        {/* Desktop table */}
        <TableContainer className="hidden rounded-none border-0 bg-transparent lg:block">
          <Table>
            <THead>
              <TR>
                <TH>Device</TH>
                <TH>IP</TH>
                <TH>Created</TH>
                <TH>Last Active</TH>
                <TH className="text-right">Revoke</TH>
              </TR>
            </THead>
            <TBody>
              {loading ? (
                <TR>
                  <TD colSpan={5}>Loading sessions...</TD>
                </TR>
              ) : null}
              {!loading && sessions.length === 0 ? (
                <TR>
                  <TD colSpan={5}>No active sessions reported.</TD>
                </TR>
              ) : null}
              {sessions.map((session) => (
                <TR key={session.id}>
                  <TD>
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-neutral-800 bg-neutral-950 text-neutral-400">
                        <MonitorSmartphone size={16} />
                      </span>
                      <span>
                        <span className="block font-semibold text-neutral-50">{session.device}</span>
                        {session.current ? (
                          <span className="text-xs text-emerald-400">Current session</span>
                        ) : null}
                      </span>
                    </div>
                  </TD>
                  <TD>{session.ipAddress}</TD>
                  <TD className="tabular-nums">{formatDate(session.createdAt)}</TD>
                  <TD className="tabular-nums">{formatDate(session.lastActiveAt)}</TD>
                  <TD className="text-right">
                    <Button
                      disabled={session.current}
                      icon={<ShieldX size={16} />}
                      onClick={() => setPendingSession(session)}
                      type="button"
                      variant="danger"
                    >
                      Revoke
                    </Button>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </TableContainer>
      </SettingsCard>

      <ConfirmDialog
        body={
          <>
            Revoke access for{" "}
            <span className="font-semibold text-neutral-100">{pendingSession?.device}</span>. This action cannot be
            undone.
          </>
        }
        confirmLabel="Revoke"
        confirmVariant="danger"
        isOpen={Boolean(pendingSession)}
        onClose={() => setPendingSession(null)}
        onConfirm={confirmRevoke}
        pending={revoking}
        title="Revoke session"
      />
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[0.6875rem] font-medium uppercase tracking-wide text-neutral-500">{label}</p>
      <p className={`${settingsDensity.sessionDate} font-semibold text-neutral-100 tabular-nums`}>{value}</p>
    </div>
  );
}

function SessionSkeleton() {
  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-4 text-sm text-neutral-400">
      Loading sessions...
    </div>
  );
}

function formatDate(value?: string) {
  if (!value) return "Not available";
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "short",
  }).format(new Date(value));
}
