export async function api<T=unknown>(path:string,method='GET',body?:unknown):Promise<T>{
  const form=body instanceof FormData;
  const r=await fetch(`/api/${path}`,{method,credentials:'same-origin',headers:body&&!form?{'Content-Type':'application/json'}:undefined,body:body?(form?body:JSON.stringify(body)):undefined});
  const payload=await r.json();if(!r.ok)throw new Error(payload.error??'La requête a échoué.');return payload.data as T;
}
export async function downloadExport(ids:string[]){
  const r=await fetch('/api/documents/export',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ids})});
  if(!r.ok)throw new Error((await r.json()).error);saveBlob(await r.blob(),'GED-by-DZ_documents.zip');
}
export function saveBlob(blob:Blob,name:string){const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
