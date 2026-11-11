import { featureAvailabilityResponse, getFeatureAvailability } from "@/lib/feature-availability";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { verifyStudentToken } from "@/lib/student-token";
import { getUploadPolicy, sanitizeUploadName, validateUploadInput } from "@/lib/object-storage";
import { deleteDriveFile, ensureTeacherSubmissionFolder, verifyDriveUploadedFile } from "@/lib/google-drive-storage";

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
 if(code==="GOOGLE_DRIVE_FILE_METADATA_MISMATCH"||code==="GOOGLE_DRIVE_FILE_SIGNATURE_INVALID")return NextResponse.json({error:"ไฟล์ที่ส่งไปยัง Google Drive ไม่ผ่านการตรวจสอบ กรุณาอัปโหลดใหม่"},{status:400});
 return null;
}

export async function POST(request:Request){
 const unavailable=await featureAvailabilityResponse("assignments");if(unavailable)return unavailable;
 const body=await request.json().catch(()=>null);
 const assignmentId=typeof body?.assignmentId==="string"?body.assignmentId:"";
 const driveFileId=typeof body?.driveFileId==="string"?body.driveFileId:"";
 const fileName=typeof body?.fileName==="string"?sanitizeUploadName(body.fileName):"";
 const contentType=typeof body?.contentType==="string"?body.contentType.toLowerCase():"";
 const sizeBytes=Number(body?.sizeBytes),validation=validateUploadInput(contentType,sizeBytes);
 if(!assignmentId||!driveFileId||driveFileId.length>256||!fileName||validation||!(EXTENSIONS[contentType]||[]).some(x=>fileName.toLowerCase().endsWith(x)))return NextResponse.json({error:validation||"ข้อมูลไฟล์ไม่ถูกต้อง"},{status:400});
 if(sizeBytes>getUploadPolicy().maxBytes)return NextResponse.json({error:"ไฟล์มีขนาดใหญ่เกินกำหนด"},{status:400});
 const jar=await cookies(),raw=jar.get("student_token")?.value,payload=raw?verifyStudentToken(raw):null;
 if(!payload?.studentId||!payload.classId)return NextResponse.json({error:"กรุณาเข้าสู่ระบบนักเรียน"},{status:401});
 const [assignment,student]=await Promise.all([
  prisma.assignment.findFirst({where:{id:assignmentId,classId:payload.classId,status:"PUBLISHED",mode:"SYSTEM_UPLOAD"},select:{id:true,ownerId:true,autoMarkAttendance:true,attendanceSessionId:true,classroom:{select:{name:true}},teachingAssignment:{select:{subject:{select:{code:true}}}}}}),
  prisma.student.findFirst({where:{id:payload.studentId,classId:payload.classId,isActive:true},select:{id:true,rollNo:true}}),
 ]);
 if(!assignment||!student)return NextResponse.json({error:"ไม่พบงานที่เปิดรับส่งหรือไม่มีสิทธิ์ส่งงาน"},{status:404});
 if(!student.rollNo.trim())return NextResponse.json({error:"ยังไม่มีเลขที่นักเรียนในระบบ กรุณาแจ้งครูประจำวิชาให้บันทึกเลขที่ก่อนส่งงาน"},{status:409});
 if(!assignment.teachingAssignment.subject.code.trim())return NextResponse.json({error:"งานนี้ยังไม่มีรหัสวิชา กรุณาแจ้งครูตรวจสอบข้อมูลรายวิชา"},{status:409});

 let storedOnDrive=false;
 try{
  const name=assignment.classroom.name.trim(),slash=name.match(/^(.+?)\s*[/|]\s*(.+)$/),room=name.match(/^(.+?)\s+ห้อง\s*(.+)$/i);
  const gradeLevel=slash?slash[1].trim():room?room[1].trim():name;
  const roomName=slash?"ห้อง "+slash[2].replace(/^ห้อง\s*/i,"").trim():room?"ห้อง "+room[2].trim():"ห้องทั่วไป";
  const destination=await ensureTeacherSubmissionFolder(assignment.ownerId,assignment.teachingAssignment.subject.code,gradeLevel,roomName,student.rollNo.trim());
  await verifyDriveUploadedFile(assignment.ownerId,driveFileId,destination.folderId,{fileName,contentType,sizeBytes});
  storedOnDrive=true;
  const attendanceAvailability=assignment.autoMarkAttendance?await getFeatureAvailability("attendance"):null;
  const result=await prisma.$transaction(async tx=>{
   const key={assignmentId_studentId:{assignmentId,studentId:student.id}};
   const existing=await tx.submission.findUnique({where:key,select:{id:true,status:true,submittedAt:true}});
   if(existing?.status==="REVIEWED")throw new Error("SUBMISSION_ALREADY_REVIEWED");
   let submission:{id:string;submittedAt:Date};
   if(existing?.status==="RETURNED"){
    const changed=await tx.submission.updateMany({where:{id:existing.id,status:"RETURNED"},data:{status:"SUBMITTED",submittedAt:new Date(),score:null,feedback:"",reviewedAt:null}});
    if(changed.count!==1)throw new Error("SUBMISSION_STATE_CHANGED");
    submission=await tx.submission.findUniqueOrThrow({where:{id:existing.id},select:{id:true,submittedAt:true}});
   }else if(existing){
    const locked=await tx.submission.updateMany({where:{id:existing.id,status:"SUBMITTED"},data:{updatedAt:new Date()}});
    if(locked.count!==1)throw new Error("SUBMISSION_ALREADY_REVIEWED");
    submission=existing;
   }else{
    submission=await tx.submission.create({data:{assignmentId,studentId:student.id},select:{id:true,submittedAt:true}});
   }
   const savedFile=await tx.submissionFile.create({data:{submissionId:submission.id,objectKey:null,driveFileId,fileName,contentType,sizeBytes},select:{id:true,fileName:true,contentType:true,sizeBytes:true}});
   if(assignment.autoMarkAttendance&&assignment.attendanceSessionId&&attendanceAvailability?.status==="AVAILABLE"){
    await tx.attendanceRecord.createMany({data:[{sessionId:assignment.attendanceSessionId,studentId:student.id,status:"PRESENT",note:"เช็กชื่ออัตโนมัติจากการส่งงาน"}],skipDuplicates:true});
   }
   return {submission,file:savedFile};
  });
  return NextResponse.json({ok:true,submission:{id:result.submission.id,submittedAt:result.submission.submittedAt.toISOString()},file:result.file},{status:201});
 }catch(error){
  if(storedOnDrive)await deleteDriveFile(assignment.ownerId,driveFileId).catch(cleanup=>console.error("[DriveUpload] orphan cleanup failed:",cleanup));
  if(error instanceof Error&&(error.message==="SUBMISSION_ALREADY_REVIEWED"||error.message==="SUBMISSION_STATE_CHANGED"))return NextResponse.json({error:"งานนี้ตรวจแล้ว ไม่สามารถเพิ่มหรือเปลี่ยนไฟล์ส่งงานได้"},{status:409});
  const mapped=mapError(error);if(mapped)return mapped;
  console.error("[DriveUpload] completion failed:",error);
  return NextResponse.json({error:"ตรวจสอบหรือบันทึกไฟล์จาก Google Drive ไม่สำเร็จ กรุณาลองใหม่"},{status:502});
 }
}
