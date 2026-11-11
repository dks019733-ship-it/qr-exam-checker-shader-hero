import { featureAvailabilityResponse } from "@/lib/feature-availability";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { verifyStudentToken } from "@/lib/student-token";
import { getUploadPolicy, sanitizeUploadName, validateUploadInput } from "@/lib/object-storage";
import { createDriveResumableSession, ensureTeacherSubmissionFolder } from "@/lib/google-drive-storage";

const EXTENSIONS:Record<string,string[]>={"application/pdf":[".pdf"],"image/jpeg":[".jpg",".jpeg"],"image/png":[".png"],"image/webp":[".webp"],"application/msword":[".doc"],"application/vnd.openxmlformats-officedocument.wordprocessingml.document":[".docx"]};

function classFolders(value:string){
 const name=value.trim(),slash=name.match(/^(.+?)\s*[/|]\s*(.+)$/),room=name.match(/^(.+?)\s+ห้อง\s*(.+)$/i);
 if(slash)return {gradeLevel:slash[1].trim(),roomName:"ห้อง "+slash[2].replace(/^ห้อง\s*/i,"").trim()};
 if(room)return {gradeLevel:room[1].trim(),roomName:"ห้อง "+room[2].trim()};
 return {gradeLevel:name,roomName:"ห้องทั่วไป"};
}
function mapError(error:unknown){
 const code=error instanceof Error?error.message:"";
 if(["GOOGLE_DRIVE_ACCOUNT_NOT_CONNECTED","GOOGLE_DRIVE_SCOPE_MISSING","GOOGLE_DRIVE_REAUTH_REQUIRED"].includes(code))return NextResponse.json({error:"บัญชี Google ของครูยังไม่ได้อนุญาต Google Drive กรุณาออกจากระบบแล้วเข้าสู่ระบบ Google ใหม่เพื่อให้สิทธิ์ Drive"},{status:409});
 if(code==="GOOGLE_OAUTH_NOT_CONFIGURED")return NextResponse.json({error:"ระบบเชื่อมต่อ Google Drive ยังตั้งค่าไม่ครบ กรุณาติดต่อผู้ดูแลระบบ"},{status:503});
 return null;
}

export async function POST(request:Request){
 const unavailable=await featureAvailabilityResponse("assignments");if(unavailable)return unavailable;
 const body=await request.json().catch(()=>null);
 const assignmentId=typeof body?.assignmentId==="string"?body.assignmentId:"";
 const fileName=typeof body?.fileName==="string"?sanitizeUploadName(body.fileName):"";
 const contentType=typeof body?.contentType==="string"?body.contentType.toLowerCase():"";
 const sizeBytes=Number(body?.sizeBytes),validation=validateUploadInput(contentType,sizeBytes);
 if(!assignmentId||!fileName||validation||!(EXTENSIONS[contentType]||[]).some(x=>fileName.toLowerCase().endsWith(x)))return NextResponse.json({error:validation||"ข้อมูลไฟล์ไม่ถูกต้อง"},{status:400});
 if(sizeBytes>getUploadPolicy().maxBytes)return NextResponse.json({error:"ไฟล์มีขนาดใหญ่เกินกำหนด"},{status:400});
 const jar=await cookies(),raw=jar.get("student_token")?.value,payload=raw?verifyStudentToken(raw):null;
 if(!payload?.studentId||!payload.classId)return NextResponse.json({error:"กรุณาเข้าสู่ระบบนักเรียน"},{status:401});
 const [assignment,student]=await Promise.all([
  prisma.assignment.findFirst({where:{id:assignmentId,classId:payload.classId,status:"PUBLISHED",mode:"SYSTEM_UPLOAD"},select:{id:true,ownerId:true,classroom:{select:{name:true}},teachingAssignment:{select:{subject:{select:{code:true}}}}}}),
  prisma.student.findFirst({where:{id:payload.studentId,classId:payload.classId,isActive:true},select:{id:true,rollNo:true}}),
 ]);
 if(!assignment||!student)return NextResponse.json({error:"ไม่พบงานที่เปิดรับส่งหรือไม่มีสิทธิ์ส่งงาน"},{status:404});
 if(!student.rollNo.trim())return NextResponse.json({error:"ยังไม่มีเลขที่นักเรียนในระบบ กรุณาแจ้งครูประจำวิชาให้บันทึกเลขที่ก่อนส่งงาน"},{status:409});
 if(!assignment.teachingAssignment.subject.code.trim())return NextResponse.json({error:"งานนี้ยังไม่มีรหัสวิชา กรุณาแจ้งครูตรวจสอบข้อมูลรายวิชา"},{status:409});
 try{
  const {gradeLevel,roomName}=classFolders(assignment.classroom.name);
  const destination=await ensureTeacherSubmissionFolder(assignment.ownerId,assignment.teachingAssignment.subject.code,gradeLevel,roomName,student.rollNo.trim());
  const sessionUrl=await createDriveResumableSession({token:destination.token,folderId:destination.folderId,fileName,contentType,sizeBytes});
  return NextResponse.json({sessionUrl,fileName,contentType,sizeBytes},{status:201});
 }catch(error){
  const mapped=mapError(error);if(mapped)return mapped;
  console.error("[DriveUpload] session creation failed:",error);
  return NextResponse.json({error:"ไม่สามารถเตรียมการอัปโหลดไปยัง Google Drive ได้"},{status:502});
 }
}
