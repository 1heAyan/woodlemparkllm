import { NextRequest, NextResponse } from 'next/server';

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

const SYSTEM_KNOWLEDGE = `
You are the Woodlem Gemini AI Copilot, an integrated neural assistant built directly into the Woodlem Park School Learning Management System (LMS).
Woodlem Park School serves high school students across Grades 9, 10, 11, and 12, with cohort sections from A through Z.

Your role is to guide students, teachers, parents, and administrators on how to navigate and use every feature of this portal seamlessly.

NAVIGATION TOKENS (CRITICAL INSTRUCTION):
Whenever you mention a page, tab, tool, modal, or classroom feature in your answer, you MUST provide an interactive navigation token at the end or within your response so the user can jump directly there with one click without closing the AI panel.

Token Formats to use:
- For Classroom Tasks / Homework / Submissions: [[nav:class:tasks|Go to Tasks & Assessments ↗]]
- For Classroom Learning Resources / Notes / Slides: [[nav:class:resources|Open Learning Resources ↗]]
- For Classroom Syllabus & Checklist: [[nav:class:syllabus|Open Syllabus & Coverage ↗]]
- For Classroom Stream / Broadcasts / Notices: [[nav:class:broadcasts|Open Classroom Notices ↗]]
- For Student Achievements & Awards: [[nav:view:awards|Open My Achievements ↗]]
- For Attendance (Student / Parent): [[nav:view:attendance|View Attendance Records ↗]]
- For Teacher Homeroom Roll Call: [[nav:view:attendance:mark|Take Daily Roll Call ↗]]
- For Teacher Attendance Register & History: [[nav:view:attendance:history|View Attendance Register ↗]]
- For Extracurricular / Holistic Hub: [[nav:view:hub|Explore Holistic Hub ↗]]
- For Password & Account Settings: [[nav:view:settings|Open Settings & Passwords ↗]]
- For IT Helpdesk / Support Tickets: [[nav:view:support|Contact IT Helpdesk ↗]]
- For Admin User Directory: [[nav:view:directory|Open User Directory ↗]]
- For Admin Cohort & Section Capacity: [[nav:view:classes|Manage Classes & Sections ↗]]
- For Admin Parent Document Approvals: [[nav:view:documents|Review Parent Documents ↗]]
- For Admin Provision User Modal: [[nav:modal:provision_user|Provision New User ↗]]
- For Admin Bulk Excel Import: [[nav:modal:bulk_import|Bulk Import Excel ↗]]
- For Parent Academic Progress: [[nav:view:progress|View Child Academic Progress ↗]]
- For Parent Clearance Forms: [[nav:view:documents|Submit Clearance Documents ↗]]

PORTAL RULES & ARCHITECTURE:
- Target Grades: Strictly Grades 9, 10, 11, and 12 (no grades below 9).
- Sections: Section A through Section Z.
- Real-time persistence: Everything saves instantly to cloud database.
- Clean, distraction-free, professional school interface.

DETAILED WORKFLOW INSTRUCTIONS:

1. FOR STUDENTS:
- Viewing Subject Classrooms: In the sidebar under "My Subject Classrooms", click any enrolled subject to view Stream, Learning Resources, Tasks & Assessments, and Syllabus.
- Submitting Homework: Go to Subject Classroom -> "Assessments & Tasks" tab -> Click "Submit Work" on the assigned task -> Choose your document -> Click "Turn In Assignment".
- Taking Online Assessments: Go to Subject Classroom -> "Assessments & Tasks" tab -> Click "Start Assessment" -> Answer questions -> Click "Submit Assessment".
- Checking Syllabus Progress: Go to Subject Classroom -> "Syllabus & Coverage" tab -> Check off topics studied.
- Downloading Learning Resources: In Subject Classroom -> "Learning Resources" tab -> Filter by PDF, Slides, Documents, or Worksheets -> Click on any file to preview or download.
- Holistic Hub: Click "Holistic Hub" in sidebar to browse extracurricular, STEM, sports, and cultural programs.
- Logging Achievements: Click "My Achievements" in sidebar -> Click "+ Add Achievement" -> Enter title, description, upload proof.
- Changing Password: Click "Settings & Passwords" in sidebar -> Enter new password (min 6 characters) -> Click "Save New Password".
- Helpdesk & Support: Click "Help & Support" in sidebar to submit a support ticket or view contact directory.

2. FOR TEACHERS:
- Creating Subject Classrooms: In sidebar next to "My Subject Classrooms", click "+ Create" -> Enter class name, subject, target grade (9-12), section (A-Z), room, and enrolled students.
- Uploading Learning Resources: In Subject Classroom -> "Learning Resources" tab -> Click "+ Upload Resource" -> Enter title, select type, attach file, click "Upload Resource".
- Posting Announcements: In Subject Classroom -> "Stream & Notices" tab -> Click "+ New Broadcast" -> Enter title, content, priority, click "Publish Notice".
- Taking Daily Attendance: Click "Attendance & Records" in sidebar -> "Take Daily Roll Call" tab -> Mark Present, Authorized Absence, or Unauthorized Absence -> Click "Save Attendance".
- Viewing Attendance Register & History: Click "Attendance & Records" -> "Attendance Register & History" -> View By Date, By Student, or Monthly Matrix.
- Creating Tests & Homework: In Subject Classroom -> "Tasks & Assessments" tab -> Click "+ Publish Assessment" or "+ Create Assignment".
- Grading Student Work: In "Tasks & Assessments" tab -> Click "Review & Grade" on any test or assignment -> Enter marks and feedback -> Save.

3. FOR PARENTS:
- Academic Progress: View attendance percentages, subject coverage statistics, and recent assessment scores.
- Clearance Documents: Click "Clearance Documents" tab -> Upload required forms (Student ID, Medical Form, Consent Letter, Field Trip Permission Slip).
- Holistic Hub: View extracurricular programs child is enrolled in.
- Settings: Change account password under "Settings & Passwords".

4. FOR ADMINISTRATORS:
- Provisioning Single Users: Click "+ Provision User" in header or sidebar -> Enter name, email, password, role, Grade (9-12), Section (A-Z).
- Bulk Spreadsheet Import: Click "Bulk Import" in header -> Upload Excel (.xlsx, .xls) or CSV spreadsheet. Default password is "woodlem123".
- Resetting Student Passwords:
  * In "User Directory", click "Reset Password" on any user row.
  * In "Settings & Passwords" -> "Student & Staff Password Manager" -> Search user -> Click "Reset to Default (woodlem123)".
  * Bulk Section Reset: In Password Manager, select Grade (9-12) & Section (A-Z) -> Click "Reset All in Section to Default".
- Managing Classes & Matrices: Open "Classes & Sections" tab to view real-time enrollment capacity across all cohorts.

GUIDANCE STYLE:
- Be polite, concise, structured, and easy to understand.
- Use step-by-step numbered lists.
- Include corresponding [[nav:...]] tokens so users can immediately click to navigate.
- No decorative emojis in answers.
`;

function getLocalAiResponse(query: string, userRole: string = 'student'): string {
  const q = query.toLowerCase();

  if (q.includes('homework') || q.includes('submit assignment') || q.includes('upload assignment') || q.includes('turn in') || q.includes('task')) {
    if (userRole === 'teacher') {
      return `To manage and grade homework assignments:
1. Open your Subject Classroom from the sidebar.
2. Click on the "Tasks & Assessments" tab.
3. Click "+ Create Assignment" to set up a new homework task or "Review & Grade" to score submissions.

[[nav:class:tasks|Open Tasks & Assessments ↗]] [[nav:class:resources|Browse Learning Resources ↗]]`;
    }
    return `To submit homework assignments:
1. Open your enrolled Subject Classroom from the sidebar under "My Subject Classrooms".
2. Click on the "Assessments & Tasks" tab.
3. Locate your assigned homework task and click "Submit Work".
4. Choose your file (PDF, Word document, image scan, or presentation).
5. Click "Turn In Assignment" to complete your submission.

[[nav:class:tasks|Go to Assessments & Tasks ↗]] [[nav:class:resources|View Learning Resources ↗]]`;
  }

  if (q.includes('password') || q.includes('reset password') || q.includes('change password')) {
    if (userRole === 'admin') {
      return `As an Administrator, you can reset passwords in multiple ways:
1. Quick Reset: Go to "User Directory", find the user, and click "Reset Password".
2. Password Manager: Open the "Settings & Passwords" tab and select "Student & Staff Password Manager".
3. Reset to Default: Click "Reset to Default" to immediately restore a user's password to "woodlem123".
4. Bulk Section Reset: Select a Grade (9-12) and Section (A-Z), then click "Reset All in Section to Default".

[[nav:view:settings|Open Password Manager & Settings ↗]] [[nav:view:directory|Open User Directory ↗]]`;
    }
    return `To change your account password:
1. Click on the "Settings & Passwords" tab in your sidebar.
2. In the "Change Your Password" section, enter your new password (minimum 6 characters).
3. Re-enter the password in the confirmation field.
4. Click "Save New Password".

[[nav:view:settings|Open Settings & Passwords ↗]] [[nav:view:support|Contact IT Helpdesk ↗]]`;
  }

  if (q.includes('resource') || q.includes('notes') || q.includes('slides') || q.includes('worksheet') || q.includes('materials') || q.includes('lecture')) {
    if (userRole === 'teacher') {
      return `To upload lesson resources for your students:
1. Click on your Subject Classroom from the sidebar.
2. Open the "Learning Resources" tab.
3. Click the "+ Upload Resource" button.
4. Fill in the title, description, and select the resource type (PDF, Slides, Document, Worksheet, Video, or Web Link).
5. Attach the file or link and click "Upload Resource".

[[nav:class:resources|Open Learning Resources ↗]] [[nav:class:broadcasts|Post Classroom Notice ↗]]`;
    }
    return `To view and download lesson resources:
1. Click on your enrolled Subject Classroom in the sidebar.
2. Open the "Learning Resources" tab.
3. You can filter materials by type (PDFs, Lecture Slides, Worksheets, or External Links) or use the search bar.
4. Click on any file to open the interactive viewer or download the document.

[[nav:class:resources|Browse Learning Resources ↗]] [[nav:class:syllabus|Check Syllabus Coverage ↗]]`;
  }

  if (q.includes('attendance') || q.includes('roll call') || q.includes('present') || q.includes('absent')) {
    if (userRole === 'teacher') {
      return `To manage homeroom attendance:
1. Click on "Attendance & Records" in the sidebar under Homeroom.
2. In the "Take Daily Roll Call" tab, select the date.
3. Mark each student as Present, Authorized Absence, or Unauthorized Absence.
4. Click "Save Attendance for [Date]" to sync records.
5. You can also view the full attendance history and monthly matrix under "Attendance Register & History".

[[nav:view:attendance:mark|Take Daily Roll Call ↗]] [[nav:view:attendance:history|View Attendance Register ↗]]`;
    }
    if (userRole === 'parent') {
      return `To track your child's attendance and academic record:
1. Go to "Academic Progress" in the sidebar.
2. Review the cumulative attendance percentage, breakdown charts, and recent roll call logs.

[[nav:view:progress|View Child Academic Progress ↗]] [[nav:view:documents|Submit Clearance Documents ↗]]`;
    }
    return `To check your attendance records:
1. Click on "Attendance Record" in your sidebar.
2. You can view your overall attendance rate percentage and recent daily status logs.

[[nav:view:attendance|View Attendance Records ↗]]`;
  }

  if (q.includes('test') || q.includes('assessment') || q.includes('exam') || q.includes('quiz')) {
    if (userRole === 'teacher') {
      return `To publish and grade assessments:
1. Open your Subject Classroom and click the "Assessments & Tasks" tab.
2. Click "+ Publish Assessment" and provide the title and questions.
3. Once students submit, click "Review & Grade" on the assessment card to inspect answers and record scores and feedback.

[[nav:class:tasks|Manage Tasks & Assessments ↗]]`;
    }
    return `To take an online assessment:
1. Open your Subject Classroom in the sidebar.
2. Navigate to the "Assessments & Tasks" tab.
3. Click "Start Assessment" on any active test.
4. Answer the assessment questions and click "Submit Assessment" when done. Your score will be saved immediately.

[[nav:class:tasks|Go to Assessments & Tasks ↗]]`;
  }

  if (q.includes('broadcast') || q.includes('notice') || q.includes('announcement') || q.includes('stream')) {
    if (userRole === 'teacher') {
      return `To post a classroom announcement:
1. Navigate to your Subject Classroom -> "Stream & Notices" tab.
2. Click "+ New Broadcast".
3. Enter the announcement title, message content, and priority (Normal, Important, or Urgent).
4. Optionally pin the notice to the top or tag uploaded learning resources.
5. Click "Publish Notice".

[[nav:class:broadcasts|Open Class Stream & Notices ↗]] [[nav:class:resources|Manage Resources ↗]]`;
    }
    return `To view classroom announcements and teacher notices:
1. Open your Subject Classroom in the sidebar.
2. The "Stream & Notices" tab displays all latest updates, assignments posted, and pinned announcements.

[[nav:class:broadcasts|Open Classroom Notices ↗]]`;
  }

  if (q.includes('hub') || q.includes('activity') || q.includes('extracurricular') || q.includes('stem') || q.includes('club')) {
    return `The Holistic Hub features extracurricular, STEM, arts, and athletic programs:
1. Click "Holistic Hub" in your sidebar navigation.
2. Browse active programs for Grades 9 through 12.
3. Click "Enroll Program" to register for workshops and activities.

[[nav:view:hub|Explore Holistic Hub ↗]]`;
  }

  if (q.includes('award') || q.includes('achievement') || q.includes('certificate')) {
    if (userRole === 'teacher') {
      return `To review student achievements:
1. Click on "Student Achievements" in the sidebar under Homeroom.
2. Inspect certificates, awards, and extracurricular recognitions logged by students.

[[nav:view:awards|View Student Achievements ↗]]`;
    }
    return `To log and view your achievements:
1. Click "My Achievements" in the sidebar.
2. Click "+ Add Achievement".
3. Enter the award title, category, description, and upload a photo or certificate PDF.

[[nav:view:awards|Open My Achievements ↗]]`;
  }

  if (q.includes('provision') || q.includes('bulk') || q.includes('import') || q.includes('user') || q.includes('directory')) {
    if (userRole === 'admin') {
      return `As an Administrator, you can manage user accounts in multiple ways:
1. Single User: Click "+ Provision User" to create an individual student, teacher, parent, or admin.
2. Bulk Import: Click "Bulk Import" to upload an Excel (.xlsx, .csv) spreadsheet containing multiple student/staff accounts.
3. User Directory: Search, filter, edit, or reset passwords for any user in the school directory.

[[nav:view:directory|Open User Directory ↗]] [[nav:modal:provision_user|Provision New User ↗]] [[nav:modal:bulk_import|Bulk Import Excel ↗]]`;
    }
  }

  if (q.includes('syllabus') || q.includes('coverage') || q.includes('topic')) {
    return `To check syllabus coverage and topics:
1. Open your Subject Classroom in the sidebar.
2. Click the "Syllabus & Coverage" tab.
3. You can review term-by-term topics and check off items you have completed.

[[nav:class:syllabus|Open Syllabus & Coverage ↗]]`;
  }

  if (q.includes('support') || q.includes('help') || q.includes('ticket') || q.includes('contact') || q.includes('it')) {
    return `To get help or submit a support ticket:
1. Click on "Help & Support" in your sidebar.
2. Select the "Submit Request" tab to file an inquiry with the IT Helpdesk.
3. You will receive a unique ticket tracking number (e.g. WPS-TKT-XXXX).
4. You can also reach IT Services directly at it-helpdesk@woodlempark.ae or phone extension 104.

[[nav:view:support|Contact IT Helpdesk ↗]]`;
  }

  if (q.includes('document') || q.includes('form') || q.includes('clearance') || q.includes('medical') || q.includes('id card')) {
    if (userRole === 'parent') {
      return `To upload required student clearance documents:
1. Click on "Clearance Documents" in your sidebar.
2. Upload scanned copies for Student ID, Medical Form, Consent Letter, or Field Trip Permission Slips.

[[nav:view:documents|Submit Clearance Documents ↗]]`;
    }
    if (userRole === 'admin') {
      return `To review and approve parent clearance documents:
1. Open "Parent Documents" in your admin navigation.
2. Inspect submitted forms, download attachments, and mark verification status.

[[nav:view:documents|Review Parent Documents ↗]]`;
    }
  }

  return `Welcome to the Woodlem Park School AI Copilot. I am ready to guide you across all portal tools:
- Submitting homework and taking online assessments
- Accessing teacher lecture notes, slides, and worksheets
- Checking syllabus progress and attendance records
- Enrolling in Holistic Hub programs
- Managing account passwords and support requests

Select a quick action or ask any question to get started.

[[nav:class:tasks|Assessments & Tasks ↗]] [[nav:class:resources|Learning Resources ↗]] [[nav:view:hub|Holistic Hub ↗]] [[nav:view:support|IT Helpdesk ↗]]`;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { message, history = [], userRole = 'student', userName = 'Student' } = body;

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;

    // If Gemini API key is available, call Google Gemini 2.5 Flash
    if (apiKey) {
      try {
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

        const promptText = `${SYSTEM_KNOWLEDGE}

Current User Session Details:
User Name: ${userName}
User Role: ${userRole}

User Question: "${message}"

Please provide an accurate, polite, structured step-by-step guidance response to the user. Always include relevant [[nav:...]] tokens at the bottom or inline so the user can navigate to the referenced section with a single click.`;

        const contents = [
          {
            role: 'user',
            parts: [{ text: promptText }],
          },
        ];

        // Append recent conversation context if available
        if (Array.isArray(history) && history.length > 0) {
          const recentHistory = history.slice(-4);
          for (const h of recentHistory) {
            if (h.role === 'user' || h.role === 'assistant') {
              contents.push({
                role: h.role === 'assistant' ? 'model' : ('user' as any),
                parts: [{ text: h.content }],
              });
            }
          }
          contents.push({
            role: 'user',
            parts: [{ text: message }],
          });
        }

        const res = await fetch(geminiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents,
            generationConfig: {
              temperature: 0.35,
              maxOutputTokens: 1000,
            },
          }),
        });

        if (res.ok) {
          const data = await res.json();
          const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (reply && typeof reply === 'string') {
            return NextResponse.json({ reply: reply.trim() });
          }
        } else {
          const errData = await res.json().catch(() => ({}));
          console.warn('Gemini API returned error status:', res.status, errData);
        }
      } catch (geminiErr) {
        console.warn('Gemini API call failed, falling back to local engine:', geminiErr);
      }
    }

    // Contextual local LMS knowledge engine fallback
    const fallbackReply = getLocalAiResponse(message, userRole);
    return NextResponse.json({ reply: fallbackReply });
  } catch (err: any) {
    return NextResponse.json(
      {
        reply: `I am here to assist you with the Woodlem portal. Please ask any question regarding homework, attendance, resources, or password settings.

[[nav:class:tasks|Assessments & Tasks ↗]] [[nav:class:resources|Learning Resources ↗]] [[nav:view:support|IT Helpdesk ↗]]`,
      },
      { status: 200 }
    );
  }
}
