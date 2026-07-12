import { describe, expect, it, vi } from 'vitest';
import { RequestContextMiddleware, resolveCorrelationId } from './request-context.middleware';
import type { RequestWithAuditContext } from './request-context.middleware';

describe('RequestContextMiddleware', () => {
  it('generates request ID and safe correlation ID headers', () => {
    const middleware = new RequestContextMiddleware();
    const req: RequestWithAuditContext = { headers: { 'user-agent': 'Vitest' }, ip: '127.0.0.1' };
    const res = { setHeader: vi.fn() };
    const next = vi.fn();

    middleware.use(req, res, next);

    expect(req.requestContext?.requestId).toEqual(expect.any(String));
    expect(req.requestContext?.correlationId).toEqual(expect.any(String));
    expect(req.requestContext?.source).toBe('API');
    expect(res.setHeader).toHaveBeenCalledWith('x-request-id', req.requestContext?.requestId);
    expect(res.setHeader).toHaveBeenCalledWith(
      'x-correlation-id',
      req.requestContext?.correlationId,
    );
    expect(next).toHaveBeenCalledOnce();
  });

  it('propagates safe correlation IDs', () => {
    expect(resolveCorrelationId('mobile.req-123:abc')).toBe('mobile.req-123:abc');
  });

  it('replaces invalid or multiline correlation IDs', () => {
    const resolved = resolveCorrelationId('bad\nvalue');
    expect(resolved).not.toBe('bad\nvalue');
    expect(resolved).toEqual(expect.any(String));
  });

  it('replaces overly long correlation IDs', () => {
    const value = 'a'.repeat(101);
    expect(resolveCorrelationId(value)).not.toBe(value);
  });
});
