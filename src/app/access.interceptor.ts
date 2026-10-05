import { HttpInterceptorFn } from '@angular/common/http';
export const accessInterceptor: HttpInterceptorFn = (request,next) => {
  let token='';
  try { token=JSON.parse(localStorage.getItem('yahweh-rohi-session-user') || 'null')?.sessionToken || ''; } catch {}
  return next(token && request.url.startsWith('/api/') ? request.clone({setHeaders:{Authorization:'Bearer '+token}}) : request);
};
