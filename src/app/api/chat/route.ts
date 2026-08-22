import { NextRequest, NextResponse } from 'next/server';

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

const SYSTEM_KNOWLEDGE = `
You are the Woodlem AI Assistant, the intelligent guide and support assistant for the Woodlem Park School Next-Gen Learning Management System (LMS).
Woodlem Park School serves high school students across Grades 9, 10, 11, and 12, with cohort sections from A through Z.

Your role is to guide students, teachers, parents, and administrators on how to navigate and use every feature of this portal seamlessly.

PORTAL RULES & ARCHITECTURE:
- Target Grades: Strictly Grades 9, 10, 11, and 12 (no grades below 9).
- Sections: Section A through Section Z.
- Data Persistence: 100% Realtime Cloud Database.
- Aesthetics: Clean, distraction-free, professional school interface.

DETAILED WORKFLOW INSTRUCTIONS:

1. FOR STUDENTS:
- Viewing Subject Classrooms: In the sidebar under "My Subject Classrooms", click any enrolled subject (e.g. Physics, Chemistry, Math) to view the classroom Stream, Learning Resources, Tasks & Assessments, and Syllabus.
- Submitting Homework: Go to your Subject Classroom -> "Assessments & Tasks" tab -> Click "Submit Work" on the assigned task -> Choose your document (PDF, Word, Images, etc.) -> Click "Turn In Assignment".
- Taking Online Assessments: Go to your Subject Classroom -> "Assessments & Tasks" tab -> Click "Start Assessment" -> Complete the questions and click "Submit Assessment". Your score will be calculated and saved immediately.
- Checking Syllabus Progress: Go to your Subject Classroom -> "Syllabus & Coverage" tab -> Click on topics you have studied to mark your personal student study checklist.
- Downloading Learning Resources: In your Subject Classroom -> "Learning Resources" tab -> Filter by PDF, Slides, Documents, or Worksheets -> Click on any file to preview or download.
- Holistic Hub: Click "Holistic Hub" in the sidebar to browse extracurricular, STEM, sports, and cultural programs. Click "Enroll Program" to register.
- Logging Achievements: Click "My Achievements" in the sidebar -> Click "+ Add Achievement" -> Enter title, description, and upload proof/certificate.
- Changing Password: Click "Settings & Passwords" in the sidebar -> Enter new password (min 6 characters) -> Click "Save New Password".
- Helpdesk & Support: Click "Help & Support" in the sidebar to submit a support ticket or view school contact directory.

2. FOR TEACHERS:
- Creating Subject Classrooms: In the sidebar next to "My Subject Classrooms", click "+ Create" -> Enter class name, subject, target grade (9-12), section (A-Z), room, and select enrolled students -> Click "Create Classroom".
- Uploading Learning Resources: In your Subject Classroom -> "Learning Resources" tab -> Click "+ Upload Resource" -> Enter title, select resource type (PDF, Slides, Doc, Worksheet, Link, Video), attach file, and click "Upload Resource".
- Posting Announcements / Broadcasts: In your Subject Classroom -> "Stream & Notices" tab -> Click "+ New Broadcast" -> Enter title, content, priority (Normal, Important, Urgent), optionally tag uploaded resources, and click "Publish Notice".
- Taking Daily Attendance: Click "Attendance & Records" in sidebar -> In "Take Daily Roll Call", mark each student as Present, Authorized Absence, or Unauthorized Absence -> Click "Save Attendance for [Date]".
- Viewing Attendance Register & History: Click "Attendance & Records" -> Switch to "Attendance Register & History" -> View By Date, By Student, or Monthly Matrix.
- Creating Tests & Homework: In your Subject Classroom -> "Tasks & Assessments" tab -> Click "+ Publish Assessment" or "+ Create Assignment".
- Grading Student Work: In "Tasks & Assessments" tab -> Click "Review & Grade" on any test or assignment -> Enter student marks and feedback -> Click "Save Grade".

3. FOR PARENTS:
- Academic Progress: View attendance percentages, subject coverage statistics, and recent assessment scores for your child.
- Clearance Documents: Click "Clearance Documents" tab -> Locate required forms (Student ID, Medical Form, Consent Letter, Field Trip Permission Slip) -> Upload signed document scans.
- Holistic Hub: View extracurricular programs your child is enrolled in.
- Settings: Change parent account password under "Settings & Passwords".

4. FOR ADMINISTRATORS:
- Provisioning Single Users: Click "+ Provision User" in the header -> Enter name, email, password, role (Student, Teacher, Parent, Admin), Grade (9-12), and Section (A-Z).
- Bulk Spreadsheet Import: Click "Bulk Import" in header -> Upload an Excel (.xlsx, .xls) or CSV spreadsheet with student/staff records -> System automatically creates all accounts with default password "woodlem123".
- Resetting Student Passwords:
  * Method 1: In "User Directory", click the "Reset Password" button on any user row.
  * Method 2: Open "Settings & Passwords" -> "Student & Staff Password Manager" -> Search user -> Click "Reset to Default (woodlem123)" or "Set Password".
  * Method 3 (Cohort Bulk Reset): In Password Manager, select a Grade (9-12) and Section (A-Z) -> Click "Reset All in Section to Default".
- Managing Classes & Matrices: Open "Classes & Sections" tab to view real-time enrollment capacity across all Grade 9-12 cohorts.

GUIDANCE STYLE:
- Be polite, concise, structured, and easy to understand.
- Use step-by-step numbered lists or bullet points when explaining how to perform tasks.
- Maintain professional school terminology. Do NOT use developer or database jargon.
- No decorative emojis in answers.
`;

function getLocalAiResponse(query: string, userRole: string = 'student'): string {
  const q = query.toLowerCase();

  if (q.includes('homework') || q.includes('submit assignment') || q.includes('upload assignment') || q.includes('turn in')) {
    return `To submit homework assignments:
1. Open your enrolled Subject Classroom from the sidebar under "My Subject Classrooms".
2. Click on the "Assessments & Tasks" tab.
3. Locate your assigned homework task and click "Submit Work".
4. Choose your file (PDF, Word document, image scan, or presentation).
5. Click "Turn In Assignment" to complete your submission.`;
  }

  if (q.includes('password') || q.includes('reset password') || q.includes('change password')) {
    if (userRole === 'admin') {
      return `As an Administrator, you can reset passwords in multiple ways:
1. Quick Reset: Go to "User Directory", find the user, and click "Reset Password".
2. Password Manager: Open the "Settings & Passwords" tab and select "Student & Staff Password Manager".
3. Reset to Default: Click "Reset to Default" to immediately restore a user's password to "woodlem123".
4. Bulk Section Reset: Select a Grade (9-12) and Section (A-Z), then click "Reset All in Section to Default".`;
    }
    return `To change your account password:
1. Click on the "Settings & Passwords" tab in your sidebar.
2. In the "Change Your Password" section, enter your new password (minimum 6 characters).
3. Re-enter the password in the confirmation field.
4. Click "Save New Password".

If you cannot access your account, please contact your school administrator or IT Helpdesk to reset your password.`;
  }

  if (q.includes('resource') || q.includes('notes') || q.includes('slides') || q.includes('worksheet') || q.includes('materials')) {
    if (userRole === 'teacher') {
      return `To upload lesson resources for your students:
1. Click on your Subject Classroom from the sidebar.
2. Open the "Learning Resources" tab.
3. Click the "+ Upload Resource" button.
4. Fill in the title, description, and select the resource type (PDF, Slides, Document, Worksheet, Video, or Web Link).
5. Attach the file or link and click "Upload Resource".`;
    }
    return `To view and download lesson resources:
1. Click on your enrolled Subject Classroom in the sidebar.
2. Open the "Learning Resources" tab.
3. You can filter materials by type (PDFs, Lecture Slides, Worksheets, or External Links) or use the search bar to find specific topics.
4. Click on any file to open the interactive viewer or download the document.`;
  }

  if (q.includes('attendance') || q.includes('roll call') || q.includes('present') || q.includes('absent')) {
    if (userRole === 'teacher') {
      return `To mark homeroom attendance:
1. Click on "Attendance & Records" in the sidebar under Homeroom / Class Teacher.
2. In the "Take Daily Roll Call" tab, select the date.
3. Mark each student as Present, Authorized Absence, or Unauthorized Absence.
4. Click "Save Attendance for [Date]" to sync records.
5. You can also view the full attendance history and monthly matrix under "Attendance Register & History".`;
    }
    return `To check your attendance records:
1. Click on "Attendance Record" in your sidebar.
2. You can view your overall attendance rate percentage and recent daily status logs.`;
  }

  if (q.includes('test') || q.includes('assessment') || q.includes('exam') || q.includes('quiz')) {
    if (userRole === 'teacher') {
      return `To publish and grade assessments:
1. Open your Subject Classroom and click the "Assessments & Tasks" tab.
2. Click "+ Publish Assessment" and provide the title and class details.
3. Once students submit, click "Review & Grade" on the assessment card to inspect student answers and record scores and feedback.`;
    }
    return `To take an online assessment:
1. Open your Subject Classroom in the sidebar.
2. Navigate to the "Assessments & Tasks" tab.
3. Click "Start Assessment" on any active test.
4. Answer the assessment questions and click "Submit Assessment" when done. Your score will be saved immediately.`;
  }

  if (q.includes('broadcast') || q.includes('notice') || q.includes('announcement')) {
    return `To post a classroom announcement (Teachers):
1. Navigate to your Subject Classroom -> "Stream & Notices" tab.
2. Click "+ New Broadcast".
3. Enter the announcement title, message content, and priority (Normal, Important, or Urgent).
4. Optionally pin the notice to the top or tag uploaded learning resources.
5. Click "Publish Notice".`;
  }

  if (q.includes('hub') || q.includes('activity') || q.includes('extracurricular') || q.includes('stem')) {
    return `The Holistic Hub features extracurricular, STEM, arts, and athletic programs:
1. Click "Holistic Hub" in your sidebar navigation.
2. Browse active programs for Grades 9 through 12.
3. Click "Enroll Program" to register for workshops and activities.`;
  }

  if (q.includes('support') || q.includes('help') || q.includes('ticket') || q.includes('contact') || q.includes('it')) {
    return `To get help or submit a support ticket:
1. Click on "Help & Support" in your sidebar.
2. Select the "Submit Request" tab to file an inquiry with the IT Helpdesk.
3. You will receive a unique ticket tracking number (e.g. WPS-TKT-XXXX).
4. You can also reach IT Services directly at it-helpdesk@woodlempark.ae or phone extension 104.`;
  }

  if (q.includes('grade') || q.includes('section') || q.includes('cohort')) {
    return `Woodlem Park School LMS supports Grades 9, 10, 11, and 12 across Sections A through Z. All classes, user profiles, and assignments are organized around these cohorts.`;
  }

  return `Welcome to the Woodlem Park School AI Assistant. I can help you with:
- Submitting homework and taking online assessments
- Accessing teacher lecture notes, slides, and worksheets
- Checking syllabus progress and attendance records
- Enrolling in Holistic Hub programs
- Resetting passwords in the Settings tab
- Filing support tickets in the Helpdesk

Please type your question or select one of the quick action topics above.`;
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

Please provide an accurate, polite, and direct step-by-step guidance response to the user.`;

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
              temperature: 0.4,
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
      { reply: 'I am here to assist you with the Woodlem portal. Please ask any question regarding homework, attendance, resources, or password settings.' },
      { status: 200 }
    );
  }
}
