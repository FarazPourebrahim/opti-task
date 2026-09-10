import { env } from '@/shared/config';
import { logger } from '@/shared/logger';
import { ServiceUnavailableError } from '@/shared/errors';

/**
 * External AI provider boundary. The backend NEVER runs models (docs/OptiTask.md)
 * — it calls an external service through this typed interface. The concrete
 * transport (HTTP to an internal AI service, a direct LLM SDK, …) is intentionally
 * undecided; swapping it is a single `setAiProvider` call with no caller changes.
 *
 * Inputs are plain data the AI needs; outputs always carry a confidence score and
 * human-readable reasoning so every suggestion can be persisted with metadata.
 */
export type StoryPointEstimateInput = {
  title: string;
  description: string | null;
  labels: string[];
  similarStoryPoints: number[];
};

export type StoryPointEstimateResult = {
  storyPoints: number;
  confidence: number;
  reasoning: string;
};

export type AssignmentCandidateInput = {
  userId: string;
  skills: string[];
  expertise: string[];
  workload: number;
  activeTaskCount: number;
  completedTasks: number;
};

export type AssignmentInput = {
  title: string;
  description: string | null;
  labels: string[];
  candidates: AssignmentCandidateInput[];
};

export type AssignmentResult = {
  suggestedAssigneeId: string | null;
  confidence: number;
  reasoning: string;
  ranking: Array<{ userId: string; score: number }>;
};

export type SprintHealthInput = {
  name: string;
  totalStoryPoints: number;
  completedStoryPoints: number;
  remainingStoryPoints: number;
  capacity: number | null;
  overCapacity: boolean;
  workload: Array<{ assigneeId: string | null; storyPoints: number }>;
};

export type SprintInsightResult = {
  summary: string;
  confidence: number;
  risks: string[];
};

export type AiProvider = {
  readonly name: string;
  estimateStoryPoints(input: StoryPointEstimateInput): Promise<StoryPointEstimateResult>;
  suggestAssignee(input: AssignmentInput): Promise<AssignmentResult>;
  analyzeSprintHealth(input: SprintHealthInput): Promise<SprintInsightResult>;
  trackProgress(input: SprintHealthInput): Promise<SprintInsightResult>;
};

const FIBONACCI = [1, 2, 3, 5, 8, 13, 21];

function nearestFibonacci(value: number): number {
  return FIBONACCI.reduce((best, point) =>
    Math.abs(point - value) < Math.abs(best - value) ? point : best,
  );
}

/**
 * Deterministic stub provider. Stands in for a real external service: same
 * inputs always yield the same suggestion, so the integration, persistence, and
 * approval machinery are fully testable without a live model.
 */
export const stubAiProvider: AiProvider = {
  name: 'stub',

  async estimateStoryPoints(input) {
    const words = (input.title + ' ' + (input.description ?? '')).trim().split(/\s+/).length;
    const base = input.similarStoryPoints.length
      ? input.similarStoryPoints.reduce((a, b) => a + b, 0) / input.similarStoryPoints.length
      : words / 8;
    const storyPoints = nearestFibonacci(Math.max(1, base + input.labels.length));
    return {
      storyPoints,
      confidence: input.similarStoryPoints.length ? 0.8 : 0.6,
      reasoning: `Estimated ${storyPoints} points from ${words} words of scope, ${input.labels.length} label(s), and ${input.similarStoryPoints.length} similar task(s).`,
    };
  },

  async suggestAssignee(input) {
    // Rank by lightest workload, then fewest active tasks, then userId for stability.
    const ranking = [...input.candidates]
      .map((candidate) => ({
        userId: candidate.userId,
        score:
          1000 - candidate.workload * 10 - candidate.activeTaskCount * 5 + candidate.completedTasks,
      }))
      .sort((a, b) => b.score - a.score || a.userId.localeCompare(b.userId));
    const top = ranking[0] ?? null;
    return {
      suggestedAssigneeId: top?.userId ?? null,
      confidence: top ? 0.7 : 0,
      reasoning: top
        ? `Recommended the candidate with the lightest current workload among ${input.candidates.length}.`
        : 'No eligible candidates were available.',
      ranking,
    };
  },

  async analyzeSprintHealth(input) {
    const risks: string[] = [];
    if (input.overCapacity) {
      risks.push('Committed story points exceed sprint capacity.');
    }
    const overloaded = input.workload.filter((w) => w.assigneeId && w.storyPoints > 13);
    if (overloaded.length > 0) {
      risks.push(`${overloaded.length} member(s) carry a heavy load (>13 points).`);
    }
    return {
      summary: `Sprint “${input.name}”: ${input.completedStoryPoints}/${input.totalStoryPoints} points done, ${input.remainingStoryPoints} remaining.`,
      confidence: 0.65,
      risks,
    };
  },

  async trackProgress(input) {
    const ratio = input.totalStoryPoints > 0 ? input.completedStoryPoints / input.totalStoryPoints : 0;
    const confidence = Math.round(ratio * 100) / 100;
    return {
      summary: `Roughly ${Math.round(ratio * 100)}% complete; ${input.remainingStoryPoints} points of effort remain.`,
      confidence,
      risks: ratio < 0.25 ? ['Low completion ratio — delivery confidence is low.'] : [],
    };
  },
};

let provider: AiProvider = stubAiProvider;

export function getAiProvider(): AiProvider {
  return provider;
}

export function setAiProvider(next: AiProvider): void {
  provider = next;
}

/**
 * Runs a provider call with a timeout and bounded retries, degrading to a safe
 * `ServiceUnavailableError` on exhaustion — never crashing the request and never
 * leaving partial data (the caller persists only on success).
 */
export async function callProvider<T>(
  operation: string,
  fn: (p: AiProvider) => Promise<T>,
): Promise<T> {
  const attempts = env.AI_REQUEST_RETRIES + 1;
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await withTimeout(fn(provider), env.AI_REQUEST_TIMEOUT_MS);
    } catch (error) {
      lastError = error;
      logger.warn({ err: error, operation, attempt }, 'AI provider call failed');
    }
  }

  logger.error({ err: lastError, operation }, 'AI provider unavailable after retries');
  throw new ServiceUnavailableError('AI provider is currently unavailable. Please try again.');
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`AI provider timed out after ${ms}ms`)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error instanceof Error ? error : new Error('AI provider error'));
      },
    );
  });
}
