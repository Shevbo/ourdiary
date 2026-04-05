import { prisma } from "./prisma";

export async function logTaskCompletion(taskId: string, userId: string, points: number) {
  await prisma.taskCompletionLog.create({
    data: { taskId, userId, points },
  });
}
