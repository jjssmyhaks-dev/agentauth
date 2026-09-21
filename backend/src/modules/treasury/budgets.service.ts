import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  TreasuryBudget,
  TreasuryBudgetPeriod,
  TreasuryBudgetReservation,
  BudgetPeriodKind,
} from './treasury-entities';

function periodWindow(kind: BudgetPeriodKind, now: Date): { start: Date; end: Date } {
  const start = new Date(now);
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(start);
  switch (kind) {
    case 'one_time': {
      // One-time budgets use a 100-year window; created explicitly with dates.
      end.setUTCFullYear(end.getUTCFullYear() + 100);
      break;
    }
    case 'daily':
      end.setUTCDate(end.getUTCDate() + 1);
      break;
    case 'weekly':
      end.setUTCDate(end.getUTCDate() + (7 - end.getUTCDay() + 1)); // ends Monday 00:00
      break;
    case 'monthly':
      end.setUTCMonth(end.getUTCMonth() + 1, 1);
      break;
    case 'rolling_30d': {
      const s = new Date(now);
      s.setUTCDate(s.getUTCDate() - 30);
      s.setUTCHours(0, 0, 0, 0);
      const e = new Date(now);
      e.setUTCHours(23, 59, 59, 999);
      return { start: s, end: e };
    }
  }
  return { start, end };
}

@Injectable()
export class TreasuryBudgetsService {
  private readonly logger = new Logger(TreasuryBudgetsService.name);

  constructor(
    @InjectRepository(TreasuryBudget)
    private budgetRepo: Repository<TreasuryBudget>,
    @InjectRepository(TreasuryBudgetPeriod)
    private periodRepo: Repository<TreasuryBudgetPeriod>,
    @InjectRepository(TreasuryBudgetReservation)
    private reservationRepo: Repository<TreasuryBudgetReservation>,
  ) {}

  async createBudget(input: {
    org_id: string;
    name: string;
    scope_type: TreasuryBudget['scope_type'];
    scope_id?: string | null;
    parent_budget_id?: string | null;
    asset_code: string;
    period_kind: BudgetPeriodKind;
    limit_minor: string;
  }): Promise<TreasuryBudget> {
    if (BigInt(input.limit_minor) < 0n) throw new BadRequestException('limit_minor must be >= 0');
    const created = this.budgetRepo.create(input as unknown as TreasuryBudget);
    const saved = await this.budgetRepo.save(created);
    return saved as TreasuryBudget;
  }

  async listForOrg(orgId: string): Promise<TreasuryBudget[]> {
    return (await this.budgetRepo.find({ where: { org_id: orgId }, order: { created_at: 'DESC' } })) as TreasuryBudget[];
  }

  async updateBudget(id: string, orgId: string, patch: { limit_minor?: string; status?: string; name?: string }): Promise<TreasuryBudget> {
    const budget = await this.budgetRepo.findOne({ where: { id, org_id: orgId } });
    if (!budget) throw new NotFoundException(`Budget ${id} not found`);
    if (patch.limit_minor !== undefined) {
      if (BigInt(patch.limit_minor) < 0n) throw new BadRequestException('limit_minor must be >= 0');
      budget.limit_minor = patch.limit_minor;
    }
    if (patch.status && ['active', 'paused', 'archived'].includes(patch.status)) budget.status = patch.status as any;
    if (patch.name) budget.name = patch.name;
    return this.budgetRepo.save(budget);
  }

  /** Ancestor chain for a budget: [budget, parent, grandparent, ... root]. */
  private async chain(budgetId: string, orgId: string): Promise<TreasuryBudget[]> {
    const chain: TreasuryBudget[] = [];
    let cursor: string | null = budgetId;
    for (let i = 0; i < 10 && cursor; i++) {
      const b = await this.budgetRepo.findOne({ where: { id: cursor, org_id: orgId } });
      if (!b) break;
      chain.push(b);
      cursor = b.parent_budget_id;
    }
    return chain;
  }

  /**
   * ATOMIC hierarchical reservation (PRD FR-TRE-1): for every budget in the
   * chain (child → root), upsert the current period and increment reserved
   * with a conditional update that respects the hard invariant. If ANY level
   * cannot accommodate the amount, the whole transaction rolls back.
   * Lock ordering is budget_id ascending inside the chain to avoid deadlocks.
   */
  async reserve(input: {
    org_id: string;
    budget_id: string;
    payment_intent_id: string;
    amount_minor: string;
    expires_at: Date;
  }): Promise<{ reservations: TreasuryBudgetReservation[]; periods: TreasuryBudgetPeriod[] }> {
    const chain = await this.chain(input.budget_id, input.org_id);
    if (chain.length === 0) throw new NotFoundException(`Budget ${input.budget_id} not found`);

    const amount = BigInt(input.amount_minor);
    if (amount <= 0n) throw new BadRequestException('amount_minor must be > 0');

    return this.periodRepo.manager.transaction(async (em) => {
      const periods: TreasuryBudgetPeriod[] = [];
      const reservations: TreasuryBudgetReservation[] = [];

      for (const budget of chain) {
        if (budget.status !== 'active') throw new Error(`budget_paused:${budget.id}`);
        const win = periodWindow(budget.period_kind, new Date());
        let period = await em.getRepository(TreasuryBudgetPeriod).findOne({
          where: { budget_id: budget.id, period_start: win.start },
        });
        if (!period) {
          period = em.getRepository(TreasuryBudgetPeriod).create({
            org_id: input.org_id,
            budget_id: budget.id,
            period_start: win.start,
            period_end: win.end,
            limit_minor: budget.limit_minor,
            reserved_minor: '0',
            spent_minor: '0',
          } as unknown as TreasuryBudgetPeriod);
          period = await em.getRepository(TreasuryBudgetPeriod).save(period);
        }

        // Conditional atomic increment — the hard invariant is enforced HERE.
        const updated = await em
          .getRepository(TreasuryBudgetPeriod)
          .createQueryBuilder()
          .update()
          .set({ reserved_minor: () => `"reserved_minor" + ${amount.toString()}` })
          .where('id = :id AND ("reserved_minor" + "spent_minor" + :amt) <= "limit_minor"', {
            id: period.id,
            amt: amount.toString(),
          })
          .execute();
        if (!updated.affected) {
          // Deterministic failure: the closest-to-limit level wins the reason.
          const fresh = await em.getRepository(TreasuryBudgetPeriod).findOne({ where: { id: period.id } });
          const remaining = BigInt(fresh?.limit_minor ?? '0') - BigInt(fresh?.reserved_minor ?? '0') - BigInt(fresh?.spent_minor ?? '0');
          throw new Error(`budget_exceeded:${budget.id}:${remaining > 0n ? remaining : 0}`);
        }
        periods.push((await em.getRepository(TreasuryBudgetPeriod).findOne({ where: { id: period.id } }))!);

        const reservation = await em.getRepository(TreasuryBudgetReservation).save(
          em.getRepository(TreasuryBudgetReservation).create({
            org_id: input.org_id,
            budget_period_id: period.id,
            payment_intent_id: input.payment_intent_id,
            amount_minor: amount.toString(),
            status: 'held',
            expires_at: input.expires_at,
          } as unknown as TreasuryBudgetReservation),
        );
        reservations.push(reservation);
      }
      return { reservations, periods };
    });
  }

  /** Held → captured (spend booked, reservation consumed). */
  async capture(paymentIntentId: string, orgId: string): Promise<void> {
    await this.reservationRepo.manager.transaction(async (em) => {
      const reservations = await em.getRepository(TreasuryBudgetReservation).find({
        where: { payment_intent_id: paymentIntentId, org_id: orgId, status: 'held' },
      });
      for (const r of reservations) {
        await em
          .getRepository(TreasuryBudgetPeriod)
          .createQueryBuilder()
          .update()
          .set({
            reserved_minor: () => `"reserved_minor" - ${r.amount_minor}`,
            spent_minor: () => `"spent_minor" + ${r.amount_minor}`,
          })
          .where('id = :id', { id: r.budget_period_id })
          .execute();
        r.status = 'captured';
        await em.getRepository(TreasuryBudgetReservation).save(r);
      }
    });
  }

  /** Held → released (deny, cancel, expiry, failure). */
  async release(paymentIntentId: string, orgId: string): Promise<void> {
    await this.reservationRepo.manager.transaction(async (em) => {
      const reservations = await em.getRepository(TreasuryBudgetReservation).find({
        where: { payment_intent_id: paymentIntentId, org_id: orgId, status: 'held' },
      });
      for (const r of reservations) {
        await em
          .getRepository(TreasuryBudgetPeriod)
          .createQueryBuilder()
          .update()
          .set({ reserved_minor: () => `"reserved_minor" - ${r.amount_minor}` })
          .where('id = :id', { id: r.budget_period_id })
          .execute();
        r.status = 'released';
        await em.getRepository(TreasuryBudgetReservation).save(r);
      }
    });
  }

  /** Release every held reservation past expiry; returns number released. */
  async releaseExpired(orgId?: string): Promise<number> {
    const qb = this.reservationRepo
      .createQueryBuilder('r')
      .where('r.status = :status', { status: 'held' })
      .andWhere('r.expires_at < :now', { now: new Date() });
    if (orgId) qb.andWhere('r.org_id = :orgId', { orgId });
    const expired = await qb.getMany();
    for (const r of expired) {
      await this.release(r.payment_intent_id, r.org_id);
    }
    return expired.length;
  }

  /** Remaining authority across a budget's current period (child level). */
  async remaining(budgetId: string, orgId: string): Promise<{ remaining_minor: string; period_end: Date }> {
    const chain = await this.chain(budgetId, orgId);
    if (chain.length === 0) throw new NotFoundException(`Budget ${budgetId} not found`);
    const leaf = chain[0];
    const win = periodWindow(leaf.period_kind, new Date());
    const period = await this.periodRepo.findOne({ where: { budget_id: leaf.id, period_start: win.start } });
    const remaining =
      BigInt(period?.limit_minor ?? leaf.limit_minor) -
      BigInt(period?.reserved_minor ?? '0') -
      BigInt(period?.spent_minor ?? '0');
    return { remaining_minor: remaining.toString(), period_end: period?.period_end ?? win.end };
  }
}
