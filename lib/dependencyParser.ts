export type Ecosystem = "npm" | "pip" | "go" | "cargo";

export interface Dependency {
  name: string;
  version: string;
  ecosystem: Ecosystem;
}

const normalizeVersion = (version: string): string => {
  return version
    .trim()
    .replace(/^[~^><=\s]+/, "")
    .replace(/[",']/g, "")
    .trim();
};

export const parsePackageJson = (content: string): Dependency[] => {
  const parsed = JSON.parse(content) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };

  const merged = {
    ...(parsed.dependencies ?? {}),
    ...(parsed.devDependencies ?? {}),
  };

  return Object.entries(merged)
    .map(([name, version]) => ({
      name,
      version: normalizeVersion(version),
      ecosystem: "npm" as const,
    }))
    .filter((dep) => dep.version.length > 0);
};

export const parsePythonRequirements = (content: string): Dependency[] => {
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"))
    .map((line) => {
      const cleanLine = line.split("#")[0].trim();
      const match = cleanLine.match(/^([A-Za-z0-9._\-]+)\s*(?:==|>=|<=|~=|>|<)\s*([^\s;]+)/);
      if (!match) {
        return null;
      }
      return {
        name: match[1],
        version: normalizeVersion(match[2]),
        ecosystem: "pip" as const,
      };
    })
    .filter((dep): dep is Dependency => dep !== null && dep.version.length > 0);
};

export const parseGoMod = (content: string): Dependency[] => {
  const lines = content.split(/\r?\n/);
  const dependencies: Dependency[] = [];
  let inRequireBlock = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("//")) {
      continue;
    }

    if (line === "require (") {
      inRequireBlock = true;
      continue;
    }

    if (inRequireBlock && line === ")") {
      inRequireBlock = false;
      continue;
    }

    const requireLine = inRequireBlock ? line : line.startsWith("require ") ? line.replace(/^require\s+/, "") : "";
    if (!requireLine) {
      continue;
    }

    const parts = requireLine.split(/\s+/);
    if (parts.length >= 2) {
      dependencies.push({
        name: parts[0],
        version: normalizeVersion(parts[1]),
        ecosystem: "go",
      });
    }
  }

  return dependencies.filter((dep) => dep.version.length > 0);
};

export const parseCargo = (content: string): Dependency[] => {
  const lines = content.split(/\r?\n/);
  const dependencies: Dependency[] = [];
  let inDependenciesSection = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (line.startsWith("[") && line.endsWith("]")) {
      inDependenciesSection = line === "[dependencies]";
      continue;
    }

    if (!inDependenciesSection || !line || line.startsWith("#")) {
      continue;
    }

    const simpleMatch = line.match(/^([A-Za-z0-9_\-]+)\s*=\s*"([^"]+)"/);
    if (simpleMatch) {
      dependencies.push({
        name: simpleMatch[1],
        version: normalizeVersion(simpleMatch[2]),
        ecosystem: "cargo",
      });
      continue;
    }

    const tableMatch = line.match(/^([A-Za-z0-9_\-]+)\s*=\s*\{([^}]+)\}/);
    if (tableMatch) {
      const name = tableMatch[1];
      const body = tableMatch[2];
      const versionMatch = body.match(/version\s*=\s*"([^"]+)"/);
      if (versionMatch) {
        dependencies.push({
          name,
          version: normalizeVersion(versionMatch[1]),
          ecosystem: "cargo",
        });
      }
    }
  }

  return dependencies.filter((dep) => dep.version.length > 0);
};

export const detectFileType = (
  filename: string,
): "package.json" | "requirements.txt" | "go.mod" | "Cargo.toml" | null => {
  const lower = filename.toLowerCase();

  if (lower.endsWith("package.json")) {
    return "package.json";
  }
  if (lower.endsWith("requirements.txt")) {
    return "requirements.txt";
  }
  if (lower.endsWith("go.mod")) {
    return "go.mod";
  }
  if (lower.endsWith("cargo.toml")) {
    return "Cargo.toml";
  }

  return null;
};

export const parseAnyFile = (filename: string, content: string): Dependency[] => {
  const type = detectFileType(filename);

  if (!type) {
    return [];
  }

  switch (type) {
    case "package.json":
      return parsePackageJson(content);
    case "requirements.txt":
      return parsePythonRequirements(content);
    case "go.mod":
      return parseGoMod(content);
    case "Cargo.toml":
      return parseCargo(content);
    default:
      return [];
  }
};
