import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AgentGroup, Agent } from '../../database/entities';
import { GroupsService } from './groups.service';

describe('GroupsService', () => {
  let service: GroupsService;
  let groupRepo: {
    create: jest.Mock;
    save: jest.Mock;
    find: jest.Mock;
    findOne: jest.Mock;
    remove: jest.Mock;
    createQueryBuilder: jest.Mock;
  };
  let agentRepo: { find: jest.Mock };

  const group = (overrides: Partial<AgentGroup> = {}): Partial<AgentGroup> => ({
    id: 'group-1',
    org_id: 'org-1',
    name: 'db-admins',
    description: null,
    members: [],
    ...overrides,
  });

  beforeEach(async () => {
    groupRepo = {
      create: jest.fn((x) => ({ id: 'group-new', ...x })),
      save: jest.fn(async (g) => g),
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(group()),
      remove: jest.fn().mockResolvedValue(undefined),
      createQueryBuilder: jest.fn(),
    };
    agentRepo = { find: jest.fn().mockResolvedValue([]) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GroupsService,
        { provide: getRepositoryToken(AgentGroup), useValue: groupRepo },
        { provide: getRepositoryToken(Agent), useValue: agentRepo },
      ],
    }).compile();

    service = module.get(GroupsService);
  });

  it('creates a group', async () => {
    groupRepo.findOne.mockResolvedValue(null);
    const g = await service.create('org-1', 'db-admins');
    expect(g.name).toBe('db-admins');
    expect(groupRepo.create).toHaveBeenCalledWith(expect.objectContaining({ org_id: 'org-1', name: 'db-admins' }));
  });

  it('rejects duplicate group names within an org', async () => {
    groupRepo.findOne.mockResolvedValue(group());
    await expect(service.create('org-1', 'db-admins')).rejects.toThrow(BadRequestException);
  });

  it('throws NotFound for a foreign-org group', async () => {
    groupRepo.findOne.mockResolvedValue(null);
    await expect(service.findOne('org-2', 'group-1')).rejects.toThrow(NotFoundException);
  });

  it('setMembers replaces membership and validates agents belong to the org', async () => {
    agentRepo.find.mockResolvedValue([{ id: 'agent-1' } as Agent]);
    await service.setMembers('org-1', 'group-1', ['agent-1']);
    expect(groupRepo.save).toHaveBeenCalledWith(expect.objectContaining({ members: [{ id: 'agent-1' }] }));
  });

  it('setMembers rejects unknown agents', async () => {
    agentRepo.find.mockResolvedValue([]);
    await expect(service.setMembers('org-1', 'group-1', ['ghost-agent'])).rejects.toThrow(BadRequestException);
  });

  it('groupIdsForAgent returns group ids from the membership join', async () => {
    const qb = {
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([{ id: 'group-1' }, { id: 'group-2' }]),
    };
    groupRepo.createQueryBuilder.mockReturnValue(qb);

    const ids = await service.groupIdsForAgent('org-1', 'agent-1');
    expect(ids).toEqual(['group-1', 'group-2']);
    expect(qb.andWhere).toHaveBeenCalledWith('m.agent_id = :agentId', { agentId: 'agent-1' });
  });

  it('removes a group', async () => {
    await service.remove('org-1', 'group-1');
    expect(groupRepo.remove).toHaveBeenCalled();
  });
});
