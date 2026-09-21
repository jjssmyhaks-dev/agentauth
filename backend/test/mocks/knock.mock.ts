/**
 * Jest moduleNameMapper target: @knocklabs/node ships ESM-only builds that
 * jest cannot transform. The notification path is fire-and-forget and not
 * under test, so a minimal stub suffices.
 */
export class Knock {
  constructor(_signingKey?: string) {}
  notify(_workflow: string, _recipients: string | string[], _data?: unknown): Promise<unknown> {
    return Promise.resolve({});
  }
}
