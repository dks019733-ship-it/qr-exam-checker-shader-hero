import { prisma } from "@/lib/prisma";
const API="https://www.googleapis.com/drive/v3";
const UPLOAD_API="https://www.googleapis.com/upload/drive/v3";

async function accessToken(ownerId:string){
 const account=await prisma.account.findFirst({where:{userId:ownerId,provider:"google"},select:{providerAccountId:true,access_token:true,refresh_token:true,expires_at:true,scope:true}});
 if(!account) throw new Error("GOOGLE_DRIVE_ACCOUNT_NOT_CONNECTED");
 if(!(account.scope||"").split(/\s+/).includes("https://www.googleapis.com/auth/drive.file")) throw new Error("GOOGLE_DRIVE_SCOPE_MISSING");
 const now=Math.floor(Date.now()/1000);
 if(account.access_token&&account.expires_at&&account.expires_at>now+300)return account.access_token;
 if(!account.refresh_token)throw new Error("GOOGLE_DRIVE_REAUTH_REQUIRED");
 const clientId=process.env.AUTH_GOOGLE_ID||process.env.GOOGLE_CLIENT_ID, clientSecret=process.env.AUTH_GOOGLE_SECRET||process.env.GOOGLE_CLIENT_SECRET;
 if(!clientId||!clientSecret)throw new Error("GOOGLE_OAUTH_NOT_CONFIGURED");
 const response=await fetch("https://oauth2.googleapis.com/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({client_id:clientId,client_secret:clientSecret,refresh_token:account.refresh_token,grant_type:"refresh_token"}),cache:"no-store"});
 const data=await response.json().catch(()=>null) as {access_token?:string;expires_in?:number;scope?:string}|null;
 if(!response.ok||!data?.access_token)throw new Error(response.status===400||response.status===401?"GOOGLE_DRIVE_REAUTH_REQUIRED":"GOOGLE_DRIVE_TOKEN_REFRESH_FAILED");
 await prisma.account.updateMany({where:{userId:ownerId,provider:"google",providerAccountId:account.providerAccountId},data:{access_token:data.access_token,expires_at:now+Math.max(60,Number(data.expires_in)||3600),...(data.scope?{scope:data.scope}:{})}});
 return data.access_token;
}
async function api(path:string,token:string,init:RequestInit={}){
 const response=await fetch(API+path,{...init,headers:{Authorization:"Bearer "+token,...(init.headers as Record<string,string>|undefined)},cache:"no-store"});
 if(!response.ok){await response.body?.cancel();throw new Error("GOOGLE_DRIVE_API_ERROR_"+response.status);}return response;
}
function escapeQuery(value:string){return value.replace(/\\/g,"\\\\").replace(/'/g,"\\'");}
async function ensureFolder(name:string,parentId:string|null,token:string){
 const clauses=["name = '"+escapeQuery(name)+"'","mimeType = 'application/vnd.google-apps.folder'","trashed = false"];
 if(parentId)clauses.push("'"+escapeQuery(parentId)+"' in parents");
 const found=await api("/files?q="+encodeURIComponent(clauses.join(" and "))+"&pageSize=100&fields=files(id,name)",token);
 const list=await found.json() as {files?:Array<{id?:string;name?:string}>};
 const existing=list.files?.find(x=>x.id&&x.name===name);if(existing?.id)return existing.id;
 const created=await api("/files?fields=id",token,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name,mimeType:"application/vnd.google-apps.folder",...(parentId?{parents:[parentId]}:{})})});
 const data=await created.json() as {id?:string};if(!data.id)throw new Error("GOOGLE_DRIVE_FOLDER_CREATE_FAILED");return data.id;
}
export async function ensureTeacherSubmissionFolder(ownerId:string,subjectCode:string,gradeLevel:string,roomName:string,rollNo:string){
 const token=await accessToken(ownerId);let parentId:string|null=null;
 const root=(process.env.GOOGLE_DRIVE_SUBMISSIONS_FOLDER||"งานของครู").trim();
 for(const name of [root,subjectCode,gradeLevel,roomName,"เลขที่ "+rollNo]){if(!name.trim()||name.length>100)throw new Error("GOOGLE_DRIVE_FOLDER_NAME_INVALID");parentId=await ensureFolder(name.trim(),parentId,token);}
 if(!parentId)throw new Error("GOOGLE_DRIVE_FOLDER_CREATE_FAILED");
 return {token,folderId:parentId};
}
export function verifyUploadBytes(bytes:Uint8Array,type:string){
 const starts=(...values:number[])=>values.every((v,i)=>bytes[i]===v);
 switch(type){
 case "application/pdf":return new TextDecoder().decode(bytes.slice(0,5))==="%PDF-";
 case "image/jpeg":return starts(0xff,0xd8,0xff);
 case "image/png":return starts(0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a);
 case "image/webp":return new TextDecoder().decode(bytes.slice(0,4))==="RIFF"&&new TextDecoder().decode(bytes.slice(8,12))==="WEBP";
 case "application/msword":return starts(0xd0,0xcf,0x11,0xe0,0xa1,0xb1,0x1a,0xe1);
 case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":return starts(0x50,0x4b,0x03,0x04);
 default:return false;
 }
}
export async function uploadSubmissionToDrive(input:{token:string;folderId:string;fileName:string;contentType:string;bytes:Uint8Array}){
 const boundary="qr-exam-"+crypto.randomUUID(),metadata=JSON.stringify({name:input.fileName,mimeType:input.contentType,parents:[input.folderId]});
 const prefix=Buffer.from("--"+boundary+"\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n"+metadata+"\r\n--"+boundary+"\r\nContent-Type: "+input.contentType+"\r\n\r\n");
 const body=Buffer.concat([prefix,Buffer.from(input.bytes),Buffer.from("\r\n--"+boundary+"--")]);
 const response=await fetch(UPLOAD_API+"/files?uploadType=multipart&fields=id",{method:"POST",headers:{Authorization:"Bearer "+input.token,"Content-Type":"multipart/related; boundary="+boundary,"Content-Length":String(body.byteLength)},body,cache:"no-store"});
 const data=await response.json().catch(()=>null) as {id?:string}|null;if(!response.ok||!data?.id)throw new Error("GOOGLE_DRIVE_UPLOAD_FAILED_"+response.status);return data.id;
}
export async function deleteDriveFile(ownerId:string,id:string){
 const token=await accessToken(ownerId),response=await fetch(API+"/files/"+encodeURIComponent(id),{method:"DELETE",headers:{Authorization:"Bearer "+token},cache:"no-store"});
 if(!response.ok&&response.status!==404){await response.body?.cancel();throw new Error("GOOGLE_DRIVE_DELETE_FAILED_"+response.status);}
}
export async function createDriveDownloadResponse(ownerId:string,id:string,fileName:string,contentType:string){
 const token=await accessToken(ownerId),response=await api("/files/"+encodeURIComponent(id)+"?alt=media",token);
 const headers=new Headers({"Content-Type":contentType,"Content-Disposition":"inline; filename*=UTF-8''"+encodeURIComponent(fileName),"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"});
 const size=response.headers.get("content-length");if(size)headers.set("Content-Length",size);
 return new Response(response.body,{status:200,headers});
}
