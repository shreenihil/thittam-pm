/**
 * Server-side WebSocket emission helpers
 * Dispatches real-time events to room subscribers across users, departments, teams, projects, and admins.
 */

export function emitSocketEvent(room: string, event: string, data: any) {
  if (typeof global !== 'undefined' && (global as any).io) {
    try {
      (global as any).io.to(room).emit(event, data);
    } catch (err) {
      console.error(`Failed to emit socket event '${event}' to room '${room}':`, err);
    }
  }
}

export function emitToUser(userId: string, event: string, data: any) {
  emitSocketEvent(`user:${userId}`, event, data);
}

export function emitToDepartment(deptId: string, event: string, data: any) {
  emitSocketEvent(`dept:${deptId}`, event, data);
}

export function emitToTeam(teamId: string, event: string, data: any) {
  emitSocketEvent(`team:${teamId}`, event, data);
}

export function emitToProject(projectId: string, event: string, data: any) {
  emitSocketEvent(`project:${projectId}`, event, data);
}

export function emitToAdmins(event: string, data: any) {
  emitSocketEvent('admin', event, data);
}
