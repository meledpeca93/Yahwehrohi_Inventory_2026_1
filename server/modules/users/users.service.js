const sql=require('mssql');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {getPool}=require('../../db');
const access=require('./access');
let schemaPromise;
async function ensureSchema() {
  if (!schemaPromise) schemaPromise=getPool().then(pool=>pool.request().query(fs.readFileSync(path.join(__dirname,'schema.sql'),'utf8'))).catch(error=>{schemaPromise=null;throw error;});
  await schemaPromise;
}
function dto(row) {
 const profile=row.PERFIL || (access.isAdmin(row.rol)?'Administrador':'Operador');
 return {id:row.id_usuario,nombre:row.nombre,usuario:row.usuario,rol:row.rol,activo:!!row.activo,ultimoAcceso:row.ultimo_acceso,profile,
 permissions:profile==='Administrador'?access.defaults(profile):{...access.defaults(profile),...access.normalizePermissions(JSON.parse(row.PERMISOS || '{}'))}};
}
async function createSession(user) {
 await ensureSchema();const token=crypto.randomBytes(32).toString('hex'),pool=await getPool();
 await pool.request().input('hash',sql.Char(64),crypto.createHash('sha256').update(token).digest('hex')).input('id',sql.Int,user.id).query("DELETE FROM dbo.USUARIO_SESION WHERE VENCE_EN < SYSUTCDATETIME(); INSERT dbo.USUARIO_SESION VALUES (@hash,@id,DATEADD(hour,12,SYSUTCDATETIME()));");
 const record=await pool.request().input('id',sql.Int,user.id).query('SELECT u.*,a.PERFIL,a.PERMISOS FROM dbo.usuario u LEFT JOIN dbo.USUARIO_ACCESO a ON a.ID_USUARIO=u.id_usuario WHERE u.id_usuario=@id');
 return {...dto(record.recordset[0]),sessionToken:token};
}
async function authenticate(token) {
 if (typeof token!=='string'||!/^[a-f0-9]{64}$/.test(token)) throw Object.assign(Error('Inicia sesión para continuar'),{status:401});
 await ensureSchema();const pool=await getPool();
 const result=await pool.request().input('hash',sql.Char(64),crypto.createHash('sha256').update(token).digest('hex')).query(`SELECT u.*,a.PERFIL,a.PERMISOS FROM dbo.USUARIO_SESION s JOIN dbo.usuario u ON u.id_usuario=s.ID_USUARIO LEFT JOIN dbo.USUARIO_ACCESO a ON a.ID_USUARIO=u.id_usuario WHERE s.TOKEN_HASH=@hash AND s.VENCE_EN>SYSUTCDATETIME() AND u.activo=1`);
 if(!result.recordset[0]) throw Object.assign(Error('La sesión venció o el usuario está inactivo'),{status:401});return dto(result.recordset[0]);
}
async function revokeSession(token){
 if(typeof token!=='string')return;
 const pool=await getPool();await pool.request().input('hash',sql.Char(64),crypto.createHash('sha256').update(token).digest('hex')).query('DELETE FROM dbo.USUARIO_SESION WHERE TOKEN_HASH=@hash');
}
function admin(actor){if(actor.profile!=='Administrador')throw Object.assign(Error('Solo administradores pueden gestionar usuarios'),{status:403});}
async function listUsers(actor){admin(actor);await ensureSchema();const pool=await getPool();return (await pool.request().query('SELECT u.*,a.PERFIL,a.PERMISOS FROM dbo.usuario u LEFT JOIN dbo.USUARIO_ACCESO a ON a.ID_USUARIO=u.id_usuario ORDER BY u.nombre')).recordset.map(dto);}
async function saveUser(actor,id,body){
 admin(actor);
 if(!body || typeof body!=='object' || Array.isArray(body))throw Object.assign(Error('Datos del usuario inválidos'),{status:400});
 if(id!==null&&(!Number.isSafeInteger(id)||id<=0))throw Object.assign(Error('ID inválido'),{status:400});
 await ensureSchema();
 const nombre=String(body.nombre||'').trim(),usuario=String(body.usuario||'').trim(),profile=body.profile;
 if(typeof body.nombre!=='string'||typeof body.usuario!=='string'||!nombre||nombre.length>120||!usuario||usuario.length>60||!access.profiles.includes(profile))throw Object.assign(Error('Nombre, usuario o perfil inválido'),{status:400});
 if(typeof body.activo!=='boolean')throw Object.assign(Error('Estado inválido'),{status:400});
 const permissions=access.normalizePermissions(body.permissions),password=body.password?await access.hashPassword(body.password):null;
 if(!id&&!password)throw Object.assign(Error('La contraseña es obligatoria'),{status:400});
 if(id===actor.id&&(!body.activo||profile!=='Administrador'))throw Object.assign(Error('No puedes desactivar ni quitar tu propio acceso administrativo'),{status:400});
 const pool=await getPool(),tx=new sql.Transaction(pool);await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
 try{
  const old=await new sql.Request(tx).input('id',sql.Int,id||0).query('SELECT u.*,a.PERFIL,a.PERMISOS FROM dbo.usuario u WITH(UPDLOCK,HOLDLOCK) LEFT JOIN dbo.USUARIO_ACCESO a ON a.ID_USUARIO=u.id_usuario WHERE u.id_usuario=@id');
  if(id&&!old.recordset[0])throw Object.assign(Error('Usuario no encontrado'),{status:404});
  const admins=await new sql.Request(tx).query("SELECT COUNT(*) AS n FROM dbo.usuario u WITH(UPDLOCK,HOLDLOCK) LEFT JOIN dbo.USUARIO_ACCESO a ON a.ID_USUARIO=u.id_usuario WHERE u.activo=1 AND (a.PERFIL=N'Administrador' OR (a.PERFIL IS NULL AND LOWER(LTRIM(RTRIM(u.rol))) IN ('admin','administrador')))");
  if(id&&dto(old.recordset[0]).profile==='Administrador'&&old.recordset[0].activo&&(!body.activo||profile!=='Administrador')&&admins.recordset[0].n<=1)throw Object.assign(Error('Debe quedar al menos un administrador activo'),{status:400});
  const req=new sql.Request(tx).input('id',sql.Int,id||null).input('name',sql.VarChar(120),nombre).input('login',sql.VarChar(60),usuario).input('pass',sql.VarChar(255),password).input('role',sql.VarChar(25),profile==='Administrador'?'admin':profile==='Consulta'?'consulta':'operador').input('active',sql.Bit,body.activo);
  const saved=await req.query(id?`UPDATE dbo.usuario SET nombre=@name,usuario=@login,pass=COALESCE(@pass,pass),rol=@role,activo=@active,actualizado_en=GETDATE() OUTPUT inserted.id_usuario WHERE id_usuario=@id`:`INSERT dbo.usuario(nombre,usuario,pass,rol,activo) OUTPUT inserted.id_usuario VALUES(@name,@login,@pass,@role,@active)`);
  const savedId=saved.recordset[0].id_usuario;
  await new sql.Request(tx).input('id',sql.Int,savedId).input('profile',sql.NVarChar(25),profile).input('permissions',sql.NVarChar(sql.MAX),JSON.stringify(permissions)).query(`UPDATE dbo.USUARIO_ACCESO SET PERFIL=@profile,PERMISOS=@permissions,ACTUALIZADO_EN=SYSUTCDATETIME() WHERE ID_USUARIO=@id; IF @@ROWCOUNT=0 INSERT dbo.USUARIO_ACCESO(ID_USUARIO,PERFIL,PERMISOS) VALUES(@id,@profile,@permissions);`);
  if(password||!body.activo)await new sql.Request(tx).input('id',sql.Int,savedId).query('DELETE FROM dbo.USUARIO_SESION WHERE ID_USUARIO=@id');
  // Metadata-only audit: never records passwords, hashes or tokens.
  const {insertAuditRecord}=require('../../data-access');
  if(insertAuditRecord)await insertAuditRecord(tx,{tableName:'usuario',action:id?'UPDATE':'INSERT',user:actor.usuario,userId:actor.id,recordKey:String(savedId),previousData:JSON.stringify(old.recordset[0]?{nombre:old.recordset[0].nombre,activo:!!old.recordset[0].activo,profile:dto(old.recordset[0]).profile,permissions:dto(old.recordset[0]).permissions}:null),newData:JSON.stringify({nombre,usuario,profile,activo:body.activo,permissions})});
  await tx.commit();return savedId;
 }catch(error){await tx.rollback();if([2601,2627].includes(error.number))throw Object.assign(Error('Ese nombre de usuario ya existe'),{status:409});throw error;}
}
async function deleteUser(actor,id){admin(actor);const user=(await listUsers(actor)).find(u=>u.id===id);if(!user)throw Object.assign(Error('Usuario no encontrado'),{status:404});return saveUser(actor,id,{...user,password:'',activo:false});}
module.exports={revokeSession,createSession,authenticate,listUsers,saveUser,deleteUser,ensureSchema};
