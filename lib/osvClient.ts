import type { Dependency } from "./dependencyParser";

export interface Vulnerability {
  cveId: string;
  packageName: string;
  ecosystem: string;
  installedVersion: string;
  recommendedVersion: string | null;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  description: string;
  link: string;
  affectedVersions: string[];
}

interface OSVVuln {
  id: string;
  summary?: string;
  details?: string;
  severity?: Array<{ type: string; score: string }>;
  aliases?: string[];
  references?: Array<{ type: string; url: string }>;
  affected?: Array<{
    ranges?: Array<{
      events?: Array<{ introduced?: string; fixed?: string }>;
    }>;
    ecosystem_specific?: {
      severity?: string;
    };
  }>;
}

const withRetry = async <T>(operation: () => Promise<T>, maxAttempts = 3): Promise<T> => {
  let attempt = 0;
  let delayMs = 500;

  while (attempt < maxAttempts) {
    try {
      return await operation();
    } catch (error) {
      attempt += 1;
      if (attempt >= maxAttempts) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      delayMs *= 2;
    }
  }

  throw new Error("Retry attempts exhausted");
};

const severityFromScore = (score?: string): Vulnerability["severity"] => {
  if (!score) {
    return "LOW";
  }
  const numeric = Number.parseFloat(score);
  if (Number.isNaN(numeric)) {
    return "LOW";
  }
  if (numeric >= 9) {
    return "CRITICAL";
  }
  if (numeric >= 7) {
    return "HIGH";
  }
  if (numeric >= 4) {
    return "MEDIUM";
  }
  return "LOW";
};

const pickRecommendedVersion = (vuln: OSVVuln): string | null => {
  const fixedVersions: string[] = [];

  for (const affected of vuln.affected ?? []) {
    for (const range of affected.ranges ?? []) {
      for (const event of range.events ?? []) {
        if (event.fixed) {
          fixedVersions.push(event.fixed);
        }
      }
    }
  }

  if (fixedVersions.length === 0) {
    return null;
  }

  return fixedVersions.sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).at(0) ?? null;
};

const deriveSeverity = (vuln: OSVVuln): Vulnerability["severity"] => {
  const cvssScore = vuln.severity?.find((item) => item.type.toUpperCase().includes("CVSS"))?.score;
  if (cvssScore) {
    return severityFromScore(cvssScore);
  }

  const textual = vuln.affected?.find((a) => a.ecosystem_specific?.severity)?.ecosystem_specific?.severity;
  if (textual) {
    const normalized = textual.toUpperCase();
    if (normalized.includes("CRIT")) return "CRITICAL";
    if (normalized.includes("HIGH")) return "HIGH";
    if (normalized.includes("MED")) return "MEDIUM";
  }

  return "LOW";
};

export const queryOSV = async (dependency: Dependency): Promise<Vulnerability[] | null> => {
  const payload = {
    version: dependency.version,
    package: {
      ecosystem: dependency.ecosystem,
      name: dependency.name,
    },
  };

  const result = await withRetry(async () => {
    const response = await fetch("https://api.osv.dev/v1/query", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    });

    if (!response.ok) {
      if (response.status === 429) {
        throw new Error("OSV rate limit reached");
      }
      throw new Error(`OSV query failed with status ${response.status}`);
    }

    const data = (await response.json()) as { vulns?: OSVVuln[] };
    return data.vulns ?? [];
  });

  if (result.length === 0) {
    return null;
  }

  return result.map((vuln) => {
    const cveId = vuln.aliases?.find((alias) => alias.startsWith("CVE-")) ?? vuln.id;
    const link = vuln.references?.find((ref) => ref.type.toUpperCase() === "ADVISORY")?.url
      ?? vuln.references?.[0]?.url
      ?? `https://osv.dev/vulnerability/${encodeURIComponent(vuln.id)}`;

    return {
      cveId,
      packageName: dependency.name,
      ecosystem: dependency.ecosystem,
      installedVersion: dependency.version,
      recommendedVersion: pickRecommendedVersion(vuln),
      severity: deriveSeverity(vuln),
      description: vuln.summary ?? vuln.details ?? "No description provided.",
      link,
      affectedVersions: [dependency.version],
    } satisfies Vulnerability;
  });
};
