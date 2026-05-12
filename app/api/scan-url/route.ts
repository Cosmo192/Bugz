import { NextResponse } from "next/server";
import { parseAnyFile, type Dependency } from "@/lib/dependencyParser";
import { scanDependencies } from "@/lib/vulnerabilityChecker";

const GITHUB_URL_PATTERN = /^https?:\/\/github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)(?:\/)?$/;

const fetchGitHubFile = async (owner: string, repo: string, path: string): Promise<string | null> => {
  const endpoint = `https://raw.githubusercontent.com/${owner}/${repo}/HEAD/${path}`;
  const response = await fetch(endpoint, {
    method: "GET",
    headers: { Accept: "text/plain" },
    cache: "no-store",
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`GitHub file request failed for ${path} (${response.status})`);
  }

  return response.text();
};

const fetchGitHubFiles = async (owner: string, repo: string): Promise<Array<{ name: string; content: string }>> => {
  const targets = ["package.json", "requirements.txt", "go.mod", "Cargo.toml"];
  const results = await Promise.all(targets.map(async (name) => ({ name, content: await fetchGitHubFile(owner, repo, name) })));
  return results.filter((item): item is { name: string; content: string } => item.content !== null);
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { url?: string };
    const url = body.url?.trim();

    if (!url) {
      return NextResponse.json({ error: "GitHub URL is required." }, { status: 400 });
    }

    const match = url.match(GITHUB_URL_PATTERN);
    if (!match) {
      return NextResponse.json(
        { error: "Invalid GitHub URL. Use format: https://github.com/user/repo" },
        { status: 400 },
      );
    }

    const [, owner, repo] = match;
    const files = await fetchGitHubFiles(owner, repo.replace(/\.git$/, ""));

    if (files.length === 0) {
      return NextResponse.json(
        { error: "No supported dependency files found in the repository root." },
        { status: 404 },
      );
    }

    const dependencies: Dependency[] = [];
    const parseErrors: string[] = [];

    for (const file of files) {
      try {
        dependencies.push(...parseAnyFile(file.name, file.content));
      } catch (error) {
        parseErrors.push(`${file.name}: ${(error as Error).message}`);
      }
    }

    if (dependencies.length === 0) {
      return NextResponse.json(
        {
          vulnerabilities: [],
          summary: { total: 0, critical: 0, high: 0, medium: 0, low: 0 },
          message: "No dependencies found to scan.",
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
    const message = (error as Error).message;
    const notFound = message.includes("404");
    return NextResponse.json(
      {
        error: notFound
          ? "Repository or dependency files not found. Please verify the URL and repo visibility."
          : `Failed to scan repository: ${message}`,
      },
      { status: notFound ? 404 : 500 },
    );
  }
}
