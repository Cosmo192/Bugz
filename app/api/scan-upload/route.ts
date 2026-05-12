import { NextResponse } from "next/server";
import { parseAnyFile, type Dependency } from "@/lib/dependencyParser";
import { scanDependencies } from "@/lib/vulnerabilityChecker";

const SUPPORTED = new Set(["package.json", "requirements.txt", "go.mod", "cargo.toml"]);

const isZipFile = (file: File) => file.name.toLowerCase().endsWith(".zip");

const parseDependencyFile = async (file: File): Promise<Dependency[]> => {
  const content = await file.text();
  const parsed = parseAnyFile(file.name, content);
  if (parsed.length === 0) {
    throw new Error(`Unsupported or empty dependency file: ${file.name}`);
  }
  return parsed;
};

const parseZipFile = async (file: File): Promise<Dependency[]> => {
  const jszipModule = await import("jszip");
  const JSZip = jszipModule.default;
  const archive = await JSZip.loadAsync(await file.arrayBuffer());
  const dependencies: Dependency[] = [];

  const entries = Object.values(archive.files).filter((entry) => !entry.dir);

  for (const entry of entries) {
    const base = entry.name.split("/").at(-1)?.toLowerCase() ?? "";
    if (!SUPPORTED.has(base)) {
      continue;
    }

    const content = await entry.async("string");
    dependencies.push(...parseAnyFile(base, content));
  }

  return dependencies;
};

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const files = formData
      .getAll("files")
      .filter((entry): entry is File => entry instanceof File && entry.size > 0);

    if (files.length === 0) {
      return NextResponse.json({ error: "Please upload at least one file." }, { status: 400 });
    }

    const dependencies: Dependency[] = [];
    const parseErrors: string[] = [];

    for (const file of files) {
      try {
        if (isZipFile(file)) {
          dependencies.push(...(await parseZipFile(file)));
        } else {
          dependencies.push(...(await parseDependencyFile(file)));
        }
      } catch (error) {
        parseErrors.push(`${file.name}: ${(error as Error).message}`);
      }
    }

    if (dependencies.length === 0) {
      return NextResponse.json(
        {
          vulnerabilities: [],
          summary: { total: 0, critical: 0, high: 0, medium: 0, low: 0 },
          message: "No dependencies found in uploaded files.",
          parseErrors,
        },
        { status: 200 },
      );
    }

    const scan = await scanDependencies(dependencies);

    return NextResponse.json({
      ...scan,
      scannedDependencies: dependencies.length,
      parseErrors,
    });
  } catch (error) {
    return NextResponse.json(
      { error: `Failed to scan uploaded files: ${(error as Error).message}` },
      { status: 500 },
    );
  }
}
