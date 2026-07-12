import { BusinessRole } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { hasBusinessPermission } from '../businesses/permissions/business-permissions';
import { AuditLogsController } from './audit-logs.controller';

describe('audit permissions and controller surface', () => {
  it('maps audit read permissions by business role', () => {
    expect(hasBusinessPermission(BusinessRole.OWNER, 'auditLogs.read')).toBe(true);
    expect(hasBusinessPermission(BusinessRole.OWNER, 'auditLogs.readSecurity')).toBe(true);
    expect(hasBusinessPermission(BusinessRole.ADMIN, 'auditLogs.read')).toBe(true);
    expect(hasBusinessPermission(BusinessRole.ADMIN, 'auditLogs.readSecurity')).toBe(true);
    expect(hasBusinessPermission(BusinessRole.ACCOUNTANT, 'auditLogs.read')).toBe(true);
    expect(hasBusinessPermission(BusinessRole.ACCOUNTANT, 'auditLogs.readSecurity')).toBe(false);
    expect(hasBusinessPermission(BusinessRole.STAFF, 'auditLogs.read')).toBe(false);
    expect(hasBusinessPermission(BusinessRole.VIEWER, 'auditLogs.read')).toBe(false);
  });

  it('exposes list and detail methods only; no public write endpoints exist', () => {
    const service = {
      findBusinessEventById: vi.fn(),
      findBusinessEvents: vi.fn(),
    };
    const controller = new AuditLogsController(service as never);

    expect(typeof controller.list).toBe('function');
    expect(typeof controller.getById).toBe('function');
    expect('create' in controller).toBe(false);
    expect('update' in controller).toBe(false);
    expect('delete' in controller).toBe(false);
    expect('remove' in controller).toBe(false);
  });

  it('passes tenant role context to list and detail service calls', () => {
    const service = {
      findBusinessEventById: vi.fn(),
      findBusinessEvents: vi.fn(),
    };
    const controller = new AuditLogsController(service as never);
    const context = { membership: { role: BusinessRole.ACCOUNTANT } };

    controller.list('business_1', context as never, { limit: '25' });
    controller.getById('business_1', 'audit_1', context as never);

    expect(service.findBusinessEvents).toHaveBeenCalledWith('business_1', BusinessRole.ACCOUNTANT, {
      limit: '25',
    });
    expect(service.findBusinessEventById).toHaveBeenCalledWith(
      'business_1',
      'audit_1',
      BusinessRole.ACCOUNTANT,
    );
  });
});
