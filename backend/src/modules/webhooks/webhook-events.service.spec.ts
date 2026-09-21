import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Webhook } from '../../database/entities';
import { WebhooksService } from './webhooks.service';
import { WebhookEventsService } from './webhook-events.service';

describe('WebhookEventsService', () => {
  let service: WebhookEventsService;
  let webhookRepo: { find: jest.Mock };
  let deliver: jest.Mock;

  const webhook = (overrides: Partial<Webhook> = {}): Partial<Webhook> => ({
    id: 'wh-1',
    org_id: 'org-1',
    url: 'https://example.com/hook',
    secret: 's3cret',
    status: 'active',
    event_types: ['policy.denied'],
    ...overrides,
  });

  beforeEach(async () => {
    webhookRepo = { find: jest.fn().mockResolvedValue([]) };
    deliver = jest.fn().mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhookEventsService,
        { provide: getRepositoryToken(Webhook), useValue: webhookRepo },
        { provide: WebhooksService, useValue: { deliver } },
      ],
    }).compile();

    service = module.get(WebhookEventsService);
  });

  it('delivers only to webhooks subscribed to the event type', async () => {
    webhookRepo.find.mockResolvedValue([
      webhook({ id: 'wh-sub', event_types: ['policy.denied'] }),
      webhook({ id: 'wh-other', event_types: ['approval.created'] }),
    ]);

    await service.emit('org-1', 'policy.denied', { denied: true });

    expect(deliver).toHaveBeenCalledTimes(1);
    expect(deliver).toHaveBeenCalledWith('wh-sub', 'policy.denied', { denied: true });
  });

  it('respects the wildcard subscription', async () => {
    webhookRepo.find.mockResolvedValue([webhook({ id: 'wh-all', event_types: ['*'] })]);

    await service.emit('org-1', 'policy.denied', { denied: true });

    expect(deliver).toHaveBeenCalledWith('wh-all', 'policy.denied', { denied: true });
  });

  it('queries only active webhooks of the org', async () => {
    // The active filter is expressed in the repo query — assert its shape.
    webhookRepo.find.mockResolvedValue([]);

    await service.emit('org-1', 'policy.denied', { denied: true });

    expect(webhookRepo.find).toHaveBeenCalledWith({
      where: { org_id: 'org-1', status: 'active' },
    });
  });

  it('does nothing when no webhooks are subscribed', async () => {
    webhookRepo.find.mockResolvedValue([]);

    await service.emit('org-1', 'policy.denied', { denied: true });

    expect(deliver).not.toHaveBeenCalled();
  });

  it('never throws even when delivery fails', async () => {
    webhookRepo.find.mockResolvedValue([webhook()]);
    deliver.mockRejectedValue(new Error('consumer down'));

    await expect(service.emit('org-1', 'policy.denied', {})).resolves.toBeUndefined();
  });

  it('never throws even when the repo fails', async () => {
    webhookRepo.find.mockRejectedValue(new Error('db down'));

    await expect(service.emit('org-1', 'policy.denied', {})).resolves.toBeUndefined();
  });
});
