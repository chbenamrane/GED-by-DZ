import 'dotenv/config';
import { createInterface } from 'node:readline/promises';
import { stdin,stdout } from 'node:process';
import { db } from '../src/lib/db';
import { passwordHash,passwordPolicy } from '../src/lib/security';
async function main(){const username=process.argv[2];if(!username||!/^[A-Za-z0-9._-]{3,32}$/.test(username))throw new Error('Usage : npm run admin:create -- identifiant');
  if(await db.user.findUnique({where:{username}}))throw new Error('Ce compte existe déjà.');
  const prompt=createInterface({input:stdin,output:stdout});const password=await prompt.question('Mot de passe (saisie visible, absent de l’historique du shell) : ');prompt.close();passwordPolicy(password);
  await db.user.create({data:{username,passwordHash:await passwordHash(password),role:'ADMIN'}});console.log('Compte administrateur créé.');}
main().catch(e=>{console.error(e.message);process.exitCode=1;}).finally(()=>db.$disconnect());
