const crypto = require('node:crypto');
const { promisify } = require('node:util');
const scrypt = promisify(crypto.scrypt);
const modules = ['dashboard','billing','invoices','inventory','purchases','credits','attendance','payroll','costs','petty-cash','financial-movements','sales-profitability','history','system-health','settings','users'];
const profiles = ['Administrador','Operador','Consulta'];
const isAdmin = role => /^(admin|administrador)$/i.test(String(role).trim());
function defaults(profile) { return Object.fromEntries(modules.map(key => [key, profile === 'Administrador' ? 'write' : key === 'users' ? 'none' : key === 'settings' ? 'read' : profile === 'Consulta' ? 'read' : 'write'])); }
function normalizePermissions(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Object.assign(Error('Permisos inválidos'),{status:400});
  const result = {};
  for (const [key, level] of Object.entries(value)) {
    if (!modules.includes(key) || !['none','read','write'].includes(level)) throw Object.assign(Error('Módulo o nivel de acceso inválido'),{status:400});
    result[key] = level;
  }
  return result;
}
async function hashPassword(password) {
  if (typeof password !== 'string' || password.length < 8 || password.length > 128) throw Object.assign(Error('La contraseña debe tener entre 8 y 128 caracteres'),{status:400});
  const salt = crypto.randomBytes(16).toString('hex');
  return `scrypt$${salt}$${(await scrypt(password,salt,64)).toString('hex')}`;
}
async function verifyPassword(password, stored) {
  if (typeof stored !== 'string' || typeof password !== 'string' || password.length > 128) return false;
  if (!stored.startsWith('scrypt$')) { const a=Buffer.from(password),b=Buffer.from(stored); return a.length===b.length && crypto.timingSafeEqual(a,b); }
  const [,salt,hash] = stored.split('$');
  if (!salt || !/^[a-f0-9]{128}$/.test(hash || '')) return false;
  const actual=await scrypt(password,salt,64);return crypto.timingSafeEqual(actual,Buffer.from(hash,'hex'));
}
function allowed(user, keys, write=false) { return keys.some(key => user.permissions[key] === 'write' || (!write && user.permissions[key] === 'read')); }
function resourceKeys(resource, write=false) {
  const root = resource.replace(/^\/api\//,'').split(/[/:]/)[0];
  const map = {
    'assembled-offers':write?['inventory']:['inventory','billing'],'reports':modules,'app':['settings'],'billing':['billing'],sales:['billing'],products:write?['inventory']:['inventory','billing','purchases'],inventory:['inventory'],
    invoices:write?['invoices']:['invoices','billing','credits'],purchases:['purchases'],credits:['credits'], 'credit-payments':['credits'],
    attendance:write?['attendance']:['attendance','payroll'],payroll:['payroll'],customers:['billing','credits','invoices'],suppliers:['purchases','inventory'],
    quotes:['billing'], 'daily-cuts':['billing','financial-movements'], 'opening-cuts':['billing'],
    'petty-cash':['petty-cash'], 'financial-movements':['financial-movements'], 'operational-costs':['costs','purchases'],costs:['costs'],
    dashboard:['dashboard'],analytics:['sales-profitability'],history:['history'], 'system-health':['system-health'], 'database-backups':['settings'],users:['users'],
  };
  return map[root] || [];
}
module.exports={modules,profiles,isAdmin,defaults,normalizePermissions,hashPassword,verifyPassword,allowed,resourceKeys};
