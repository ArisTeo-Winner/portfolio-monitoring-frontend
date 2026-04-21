const DAY_IN_MS = 24 * 60 * 60 * 1000;

type TimedBadgeConfig = {
  label: string;
  launchDate: string;
  visibleDays: number;
};

const portfolioBadgeConfig: TimedBadgeConfig = {
  label: "New",
  launchDate: "2026-04-17",
  visibleDays: 28,
};

export function getPortfolioNavBadge(now = new Date()) {
  return getTimedBadge(portfolioBadgeConfig, now);
}

function getTimedBadge(config: TimedBadgeConfig, now: Date) {
  const launchTime = Date.parse(`${config.launchDate}T00:00:00Z`);

  if (Number.isNaN(launchTime)) {
    return undefined;
  }

  const expiresAt = launchTime + config.visibleDays * DAY_IN_MS;
  return now.getTime() < expiresAt ? config.label : undefined;
}
