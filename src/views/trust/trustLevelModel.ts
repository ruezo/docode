import type { LinuxDoTrustLevelSnapshot } from '../../linuxdo/trustLevelLoader';

export interface TrustLevelStep {
  readonly complete: boolean;
  readonly id: string;
  readonly label: string;
  readonly target: number;
  readonly unit: 'count' | 'minutes';
  readonly value: number;
}

export interface TrustLevelBuildModel {
  readonly completedSteps: number;
  readonly currentLevel: number;
  readonly kind: 'granted' | 'max' | 'progress' | 'reference';
  readonly nextLevel: number | null;
  readonly progressRatio: number;
  readonly steps: readonly TrustLevelStep[];
}

export function createTrustLevelBuildModel(
  snapshot: LinuxDoTrustLevelSnapshot,
): TrustLevelBuildModel {
  const currentLevel = snapshot.trustLevel;
  if (currentLevel >= 4) {
    return {
      completedSteps: 0,
      currentLevel,
      kind: 'max',
      nextLevel: null,
      progressRatio: 1,
      steps: [],
    };
  }
  if (currentLevel === 3) {
    return {
      completedSteps: 0,
      currentLevel,
      kind: 'granted',
      nextLevel: 4,
      progressRatio: 0,
      steps: [],
    };
  }
  const steps =
    currentLevel === 0
      ? trustLevelOneSteps(snapshot)
      : currentLevel === 1
        ? trustLevelTwoSteps(snapshot)
        : trustLevelThreeReferenceSteps(snapshot);
  const completedSteps = steps.filter(({ complete }) => complete).length;
  const progressRatio =
    steps.length === 0
      ? 0
      : steps.reduce(
          (total, step) => total + Math.min(step.value / Math.max(step.target, 1), 1),
          0,
        ) / steps.length;
  return {
    completedSteps,
    currentLevel,
    kind: currentLevel === 2 ? 'reference' : 'progress',
    nextLevel: currentLevel + 1,
    progressRatio,
    steps,
  };
}

function trustLevelOneSteps(snapshot: LinuxDoTrustLevelSnapshot): readonly TrustLevelStep[] {
  return [
    step('topics-entered', 'Topics entered', snapshot.topicsEntered, 5),
    step('posts-read', 'Posts read', snapshot.postsReadCount, 30),
    step('time-read', 'Reading time', secondsToMinutes(snapshot.timeReadSeconds), 10, 'minutes'),
  ];
}

function trustLevelTwoSteps(snapshot: LinuxDoTrustLevelSnapshot): readonly TrustLevelStep[] {
  return [
    step('days-visited', 'Days visited', snapshot.daysVisited, 15),
    step('likes-given', 'Likes given', snapshot.likesGiven, 1),
    step('likes-received', 'Likes received', snapshot.likesReceived, 1),
    step('posts-created', 'Replies created', snapshot.postCount, 3),
    step('topics-entered', 'Topics entered', snapshot.topicsEntered, 20),
    step('posts-read', 'Posts read', snapshot.postsReadCount, 100),
    step('time-read', 'Reading time', secondsToMinutes(snapshot.timeReadSeconds), 60, 'minutes'),
  ];
}

function trustLevelThreeReferenceSteps(
  snapshot: LinuxDoTrustLevelSnapshot,
): readonly TrustLevelStep[] {
  return [
    step('days-visited', 'Days visited (50 of last 100 days)', snapshot.daysVisited, 50),
    step('likes-given', 'Likes given (last 100 days)', snapshot.likesGiven, 30),
    step('likes-received', 'Likes received (last 100 days)', snapshot.likesReceived, 20),
  ];
}

function step(
  id: string,
  label: string,
  value: number,
  target: number,
  unit: TrustLevelStep['unit'] = 'count',
): TrustLevelStep {
  return { complete: value >= target, id, label, target, unit, value };
}

function secondsToMinutes(seconds: number): number {
  return Math.floor(seconds / 60);
}
