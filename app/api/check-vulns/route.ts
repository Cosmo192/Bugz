import { NextResponse } from "next/server";
import type { Dependency } from "@/lib/dependencyParser";
import { scanDependencies } from "@/lib/vulnerabilityChecker";

export async function POST(request: Request) {
  const startedAt = Date.now();

  try {
    const body = (await request.json()) as { dependencies?: Dependency[] };
    const dependencies = body.dependencies ?? [];

    if (!Array.isArray(dependencies) || dependencies.length === 0) {
      return NextResponse.json({ error: "dependencies[] is required." }, { status: 400 });
    }

    const scanResult = await scanDependencies(dependencies);
    const executionTimeMs = Date.now() - startedAt;

    return NextResponse.json({
      ...scanResult,
      executionTimeMs,
    });
  } catch (error) {
    return NextResponse.json(
      { error: `Vulnerability check failed: ${(error as Error).message}` },
      { status: 500 },
    );
  }
}
