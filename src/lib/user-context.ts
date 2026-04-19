import { getTaskMemory, type TaskMemory } from "./memory-store";
import { getUpcomingAppointments, type Appointment } from "./google-calendar";
import { logger } from "./logger";

export interface UserContext {
  userId: string;
  memory: TaskMemory | null;
  upcomingAppointments: Appointment[];
}

export async function getUserContext(userId: string): Promise<UserContext> {
  const [memory, upcomingAppointments] = await Promise.allSettled([
    getTaskMemory(userId),
    getUpcomingAppointments(1),
  ]);

  if (memory.status === "rejected") {
    logger.warn("user-context", "memory fetch failed", memory.reason);
  }
  if (upcomingAppointments.status === "rejected") {
    logger.warn("user-context", "appointments fetch failed", upcomingAppointments.reason);
  }

  return {
    userId,
    memory: memory.status === "fulfilled" ? memory.value : null,
    upcomingAppointments:
      upcomingAppointments.status === "fulfilled" ? upcomingAppointments.value : [],
  };
}
