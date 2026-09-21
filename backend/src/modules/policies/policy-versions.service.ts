import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PolicyVersion } from '../../database/entities';
import { Policy } from '../../database/entities';

/** Fields that constitute the policy's meaningful state. */
const TRACKED_FIELDS = [
  'scope',
  'scope_target_id',
  'trigger',
  'condition',
  'action',
  'priority',
  'enabled',
  'description',
] as const;

type TrackedField = (typeof TRACKED_FIELDS)[number];

function snapshotOf(policy: Policy): Record<string, any> {
  const snap: Record<string, any> = {};
  for (const f of TRACKED_FIELDS) snap[f] = (policy as any)[f] ?? null;
  return snap;
}

function diffSnapshots(
  from: Record<string, any> | null,
  to: Record<string, any>,
): Record<string, { from: any; to: any }> {
  if (!from) return {};
  const diff: Record<string, { from: any; to: any }> = {};
  for (const f of TRACKED_FIELDS) {
    const a = JSON.stringify(from[f] ?? null);
    const b = JSON.stringify(to[f] ?? null);
    if (a !== b) diff[f] = { from: from[f] ?? null, to: to[f] ?? null };
  }
  return diff;
}

@Injectable()
export class PolicyVersionsService {
  /**
   * Record a new version for the policy. `previous` is the state before the
   * change (null for creation). Never throws into the caller's flow — the
   * policy change itself must not fail because history could not be written;
   * the audit log still captures the action.
   */
  async record(
    policy: Policy,
    changeType: PolicyVersion['change_type'],
    previous: Policy | null,
    changedBy: string | null,
  ): Promise<void> {
    try {
      const last = await this.repo.findOne({
        where: { policy_id: policy.id },
        order: { version: 'DESC' },
      });
      const snapshot = snapshotOf(policy);
      const diff =
        previous !== null
          ? diffSnapshots(snapshotOf(previous), snapshot)
          : {};
      const version = this.repo.create({
        policy_id: policy.id,
        version: (last?.version ?? 0) + 1,
        snapshot,
        diff,
        change_type: changeType,
        changed_by: changedBy ?? 'system',
      });
      await this.repo.save(version);
    } catch (err) {
      // Logged by the global logger through the caller; swallowing here keeps
      // history best-effort without hiding the failure entirely.
      // eslint-disable-next-line no-console
      console.error(`[policy-versions] failed to record version: ${err}`);
    }
  }

  constructor(
    @InjectRepository(PolicyVersion)
    private repo: Repository<PolicyVersion>,
  ) {}

  /** All versions of a policy, newest first. */
  async listForPolicy(policyId: string): Promise<PolicyVersion[]> {
    return this.repo.find({
      where: { policy_id: policyId },
      order: { version: 'DESC' },
    });
  }

  /** History survives policy deletion (tombstone versions remain). */
  async listHistorySummary(policyId: string): Promise<{
    versions: number;
    latest: PolicyVersion | null;
  }> {
    const rows = await this.listForPolicy(policyId);
    return { versions: rows.length, latest: rows[0] ?? null };
  }

  /**
   * Dry-run: what would change if `candidate` were applied to the current
   * policy? Pure — reads current state, computes the field-level diff,
   * writes nothing.
   */
  async dryRunDiff(
    policyId: string,
    candidate: Partial<Record<(typeof TRACKED_FIELDS)[number], any>>,
  ): Promise<{
    policy_id: string;
    changes: Record<string, { from: any; to: any }>;
    would_change: boolean;
  }> {
    const current = await this.repo.manager
      .getRepository(Policy)
      .findOne({ where: { id: policyId } });
    if (!current) throw new NotFoundException(`Policy ${policyId} not found`);

    const merged = { ...current, ...candidate } as unknown as Policy;
    const changes = diffSnapshots(snapshotOf(current), snapshotOf(merged));
    return { policy_id: policyId, changes, would_change: Object.keys(changes).length > 0 };
  }
}
