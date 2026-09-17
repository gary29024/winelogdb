import { describe,expect,it } from 'vitest';
import { authRoute } from '../../worker/multiUser/auth';
import { ApiError,appOrigin } from '../../worker/multiUser/common';

describe('launch runtime configuration',()=>{
  it('normalizes APP_URL to one origin so a trailing slash cannot break OAuth callbacks',()=>{
    expect(appOrigin({APP_URL:'https://wine.example.com/'})).toBe('https://wine.example.com');
    expect(appOrigin({APP_URL:'https://wine.example.com'})).toBe('https://wine.example.com');
  });

  it('rejects APP_URL values that contain an application path',()=>{
    expect(()=>appOrigin({APP_URL:'https://wine.example.com/login'})).toThrow(ApiError);
  });

  it('serves the public support contact without authentication',async()=>{
    const request=new Request('https://wine.example.com/api/public/config');
    const response=await authRoute(request,{SUPPORT_EMAIL:'support@example.com'} as never);
    expect(response?.status).toBe(200);
    expect(await response?.json()).toEqual({supportEmail:'support@example.com'});
  });

  it('does not expose another configuration value through the public endpoint',async()=>{
    const request=new Request('https://wine.example.com/api/public/config');
    const response=await authRoute(request,{SUPPORT_EMAIL:'support@example.com',GOOGLE_CLIENT_SECRET:'do-not-leak',AUTH_SECRET:'x'.repeat(48)} as never);
    const body=await response?.json() as Record<string,unknown>;
    expect(body).toEqual({supportEmail:'support@example.com'});
    expect(JSON.stringify(body)).not.toContain('do-not-leak');
  });
});
