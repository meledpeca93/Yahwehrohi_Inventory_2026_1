const {test}=require('node:test');const assert=require('node:assert/strict');
const access=require('./access');
test('profiles distinguish consultation from management and deny administrative access by default',()=>{
 assert.equal(access.defaults('Consulta').settings,'read');assert.equal(access.defaults('Operador').settings,'read');assert.equal(access.defaults('Consulta').billing,'read');assert.equal(access.defaults('Operador').users,'none');
 assert.equal(access.allowed({permissions:{inventory:'read'}},['inventory'],true),false);
 assert.equal(access.allowed({permissions:{inventory:'read'}},['inventory']),true);
 assert.deepEqual(access.resourceKeys('/api/attendance/mark',true),['attendance']);
 assert.deepEqual(access.resourceKeys('unknown:create',true),[]);
});
test('password hash verifies correct credentials and preserves legacy login compatibility',async()=>{
 const hash=await access.hashPassword('test-pass-123');assert.ok(hash.startsWith('scrypt$'));assert.ok(!hash.includes('test-pass'));
 assert.equal(await access.verifyPassword('test-pass-123',hash),true);assert.equal(await access.verifyPassword('wrong',hash),false);
 assert.equal(await access.verifyPassword('legacy','legacy'),true);assert.equal(await access.verifyPassword('bad','legacy'),false);
 await assert.rejects(access.hashPassword('short'));
});
test('unknown module and permission levels are rejected',()=>{
 assert.throws(()=>access.normalizePermissions({billing:'admin'}));assert.throws(()=>access.normalizePermissions({unknown:'write'}));assert.throws(()=>access.normalizePermissions([]));
});
const sql=require('mssql'),db=require('../../db');let statements=[],rolledBack=false,committed=false;
const target={id_usuario:1,nombre:'Admin',usuario:'admin',rol:'admin',activo:true,PERFIL:'Administrador',PERMISOS:'{}'};
class FakeRequest{constructor() {this.inputs={};}input(key,type,value){this.inputs[key]=value;return this;}async query(text){statements.push({text,inputs:this.inputs});
 if(text.includes('COUNT(*) AS n'))return {recordset:[{n:1}]};
 if(text.includes('WHERE u.id_usuario=@id'))return {recordset:[target]};
 if(text.includes('OUTPUT inserted.id_usuario'))return {recordset:[{id_usuario:2}]};
 return {recordset:[]};}}
class FakeTransaction{async begin(){}async commit(){committed=true;}async rollback(){rolledBack=true;}}
sql.Request=FakeRequest;sql.Transaction=FakeTransaction;db.getPool=async()=>({request:()=>new FakeRequest()});
const service=require('./users.service');
test('administrative writes reject a non administrator before any query',async()=>{
 const before=statements.length;await assert.rejects(service.saveUser({profile:'Consulta'},null,{}),e=>e.status===403);assert.equal(statements.length,before);
});
test('last active administrator cannot be demoted and transaction rolls back',async()=>{
 await assert.rejects(service.saveUser({id:9,profile:'Administrador'},1,{nombre:'Admin',usuario:'admin',profile:'Operador',activo:true,permissions:{},password:''}),/administrador activo/);assert.equal(rolledBack,true);
});
test('own administrator cannot disable or remove administrative access',async()=>{
 await assert.rejects(service.saveUser({id:1,profile:'Administrador'},1,{nombre:'Admin',usuario:'admin',profile:'Consulta',activo:true,permissions:{}}),/propio acceso/);
});
test('new users persist only hashed password and permissions atomically',async()=>{
 await service.saveUser({id:9,usuario:'actor',profile:'Administrador'},null,{nombre:'Nuevo',usuario:'nuevo',profile:'Consulta',activo:true,permissions:{billing:'read'},password:'test-password'});
 const saved=statements.find(s=>s.text.includes('OUTPUT inserted.id_usuario'));assert.ok(saved.inputs.pass.startsWith('scrypt$'));assert.equal(committed,true);
 assert.ok(statements.some(s=>s.text.includes('INSERT dbo.USUARIO_ACCESO')));
});
test('HTTP ignores forged body identity and blocks read-only writes',async()=>{
 const original=service.authenticate;service.authenticate=async()=>({id:7,profile:'Consulta',nombre:'Consulta',permissions:{inventory:'read'}});
 const {authorizeHttp}=require('./users.routes');let status=0,next=false;
 await authorizeHttp({path:'/products',method:'POST',headers:{authorization:'Bearer forged'},body:{user:{profile:'Administrador'}}},{status(n){status=n;return this;},json(){}},()=>{next=true;});
 assert.equal(status,403);assert.equal(next,false);service.authenticate=original;
});
test('HTTP permits assigned reads, and missing or malformed tokens fail closed',async()=>{
 await assert.rejects(service.authenticate(''),e=>e.status===401);await assert.rejects(service.authenticate('forged'),e=>e.status===401);
 const original=service.authenticate;service.authenticate=async()=>({id:7,profile:'Consulta',permissions:{inventory:'read'}});
 const {authorizeHttp}=require('./users.routes');let next=false;
 await authorizeHttp({path:'/products',method:'GET',headers:{authorization:'Bearer demo'}},{status(){return this;},json(){}},()=>{next=true;});assert.equal(next,true);service.authenticate=original;
});

test('Electron denies mutations without module management rights and forwards verified actor',async()=>{
 const original=service.authenticate;
 service.authenticate=async token=>{assert.equal(token,'verified-token');return {id:7,nombre:'Consulta',profile:'Consulta',permissions:{inventory:'read'}};};
 const {withIpcAccess}=require('./ipc-authorization');let called=false;
 await assert.rejects(withIpcAccess('products:update-status',()=>{called=true;})({}, {user:{id:1,profile:'Administrador'}},{sessionToken:'verified-token'}),e=>e.status===403);assert.equal(called,false);
 const event={};await withIpcAccess('products:list',(event)=>{assert.equal(event.authenticatedUser.id,7);called=true;})(event,{sessionToken:'verified-token'});assert.equal(called,true);
 service.authenticate=original;
});
