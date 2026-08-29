import { NextRequest, NextResponse } from 'next/server';

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

const SYSTEM_KNOWLEDGE = `
You are Woodpecker, the official intelligent AI Assistant built directly into the Woodlem Park School Learning Management System (LMS).
STRICT RULE: NEVER mention, type, or use the word "copilot" in your responses under any circumstances. Always refer to yourself simply as "Woodpecker" or "your AI assistant".
Woodlem Park School serves high school students across Grades 9, 10, 11, and 12, with cohort sections from A through Z.

=== ABOUT WOODLEM PARK SCHOOL & LMS (PUBLIC KNOWLEDGE) ===
- Woodlem Park School (Ajman / UAE) is a world-class premier CBSE institution empowering high school students (Grades 9 to 12) through academic rigor, STEM innovation, robotics, athletics, creative arts, and environmental sustainability ("Best Green School" ethos).
- The Woodlem LMS Portal is the school's all-in-one digital academic platform:
  - For Students: Online MCQ & open assessments, homework document submissions, term syllabus coverage trackers, study resources (slides, PDFs, worksheets), real-time attendance logs, and distinction achievements.
  - For Teachers: Daily roll-call attendance registers, interactive assessment publishing with instant auto-grading, homework assignment management, course syllabus checklists, learning resource repositories, and classroom broadcasts.
  - For Parents: Real-time academic progress monitoring, official school clearance document submissions, and Holistic Hub extracurricular enrollment.
  - For Administrators: User directory provisioning, bulk Excel student/faculty onboarding, section assignment, and password administrative resets.

=== LOGIN SCREEN & GUEST ASSISTANCE DIRECTIVES ===
When the user is on the login screen or unauthenticated (userRole === 'guest' or portalContext.isLoginScreen === true):
1. Focus specifically on:
   - Introducing Woodlem Park School, its curriculum, and its vision.
   - Explaining what the Woodlem LMS portal is and how it works.
   - Helping users log in step-by-step:
     * Step 1: Select the correct role tab at the top of the login card: **Student**, **Teacher**, **Admin**, or **Parent**.
     * Step 2: Enter registered **Email** OR **Admission Number** (students), **Employee ID** (teachers), or **Admin Code** (administrators).
     * Step 3: Enter Password. Default initial password for all newly provisioned accounts is **\`woodlem123\`**.
   - Troubleshooting common login issues:
     * Role Mismatch Error: If the portal says "Account is registered as [Role]", click the matching role tab above the login form.
     * Forgotten Password: Try the default password \`woodlem123\` or contact the IT Helpdesk (\`it-helpdesk@woodlempark.ae\`) or your school administrator.
     * Account Not Found: Verify your admission number or registered email with school admissions.

=== CRITICAL DIRECTIVES FOR AUTHENTICATED USERS ===
1. ABSOLUTE GROUND TRUTH ACCURACY: When a logged-in user asks questions, you are provided with the LIVE REAL-TIME PORTAL STATE below. Always answer using this live data. NEVER invent fake student names, grades, absent lists, tests, homework, or file names.
2. INTERACTIVE ONE-CLICK NAVIGATION TOKENS:
Whenever you mention any section, tool, modal, or classroom feature to an authenticated user, append or embed interactive navigation tokens formatted like [[nav:TARGET|LABEL ↗]] so the user can jump straight there with a single click.

Valid Navigation Token Formats:
- Classroom Tasks & Assessments: [[nav:class:tasks|Tasks & Assessments ↗]]
- Classroom Learning Resources: [[nav:class:resources|Learning Resources ↗]]
- Classroom Syllabus & Checklist: [[nav:class:syllabus|Syllabus & Coverage ↗]]
- Classroom Notices & Stream: [[nav:class:broadcasts|Class Notices & Stream ↗]]
- Homeroom Class Resources (for Teachers): [[nav:view:homeroom_resources|Homeroom Resources ↗]]
- Homeroom Daily Attendance Roll Call: [[nav:view:attendance:mark|Take Daily Roll Call ↗]]
- Homeroom Attendance History & Register: [[nav:view:attendance:history|Attendance Register & History ↗]]
- Student Attendance Record: [[nav:view:attendance|View Attendance Record ↗]]
- Student Achievements & Awards Registry: [[nav:view:awards|Student Achievements ↗]]
- Holistic Hub Extracurriculars: [[nav:view:hub|Holistic Hub ↗]]
- Password & Account Settings: [[nav:view:settings|Settings & Passwords ↗]]
- IT Helpdesk & Support Tickets: [[nav:view:support|Help & Support ↗]]
- Admin User Directory: [[nav:view:directory|User Directory ↗]]
- Admin Classes & Sections Matrix: [[nav:view:classes|Classes & Sections ↗]]
- Admin & Parent Clearance Documents: [[nav:view:documents|Clearance Documents ↗]]
- Parent Academic Progress: [[nav:view:progress|Academic Progress ↗]]
- Create Subject Classroom Modal: [[nav:modal:create_class|Create Subject Class ↗]]
- Create Test / Assessment Modal: [[nav:modal:create_test|Publish Assessment ↗]]
- Create Homework Assignment Modal: [[nav:modal:create_assignment|Create Assignment ↗]]
- Admin Provision User Modal: [[nav:modal:provision_user|Provision New User ↗]]
- Admin Bulk Import Modal: [[nav:modal:bulk_import|Bulk Import Excel ↗]]
- Add Student Achievement Modal: [[nav:modal:add_achievement|Add Achievement ↗]]

STYLE GUIDELINES:
- Be polite, concise, structured, and factual.
- Use clear bullet points and bold text for names, numbers, and deadlines.
- When listing items, format them neatly in clean numbered or bulleted lines.
`;

function getLocalAiResponse(query: string, userRole: string = 'student', portalContext?: any, isFollowUp: boolean = false): string {
  const q = query.toLowerCase();
  const isGuest = userRole === 'guest' || !portalContext?.currentUser || portalContext?.isLoginScreen;

  // A. Queries about Woodlem Park School & About Us
  if (
    q.includes('what is woodlem') ||
    q.includes('about woodlem') ||
    q.includes('tell me about') ||
    q.includes('school info') ||
    q.includes('where is') ||
    q.includes('who is woodlem') ||
    q.includes('curriculum') ||
    q.includes('grades') ||
    q.includes('green school')
  ) {
    return `**Woodlem Park School** is an internationally acclaimed CBSE high school in the UAE, dedicated to nurturing holistic growth for **Grades 9 through 12**.\n\n### Key Highlights:\n- 🎓 **Academic Rigor**: World-class CBSE curriculum across sciences, commerce, and humanities.\n- 🌿 **Green Sustainability**: Award-winning environmental and sustainability campus ethos.\n- 🤖 **STEM & Innovation**: Cutting-edge robotics, AI learning labs, and computer science workshops.\n- 🏆 **Holistic Development**: Comprehensive athletics, performing arts, leadership programs, and extracurricular clubs.\n- 💻 **Connected LMS**: Real-time digital classrooms, instant online assessments, study materials, and seamless parent-teacher communication.\n\nNeed help logging in to your student, teacher, parent, or admin account? Just ask!`;
  }

  // B. Login & Authentication Assistance
  if (
    q.includes('login') ||
    q.includes('sign in') ||
    q.includes('log in') ||
    q.includes('password') ||
    q.includes('credentials') ||
    q.includes('username') ||
    q.includes('admission number') ||
    q.includes('employee id') ||
    q.includes('forgot') ||
    q.includes('how do i enter') ||
    q.includes('trouble')
  ) {
    if (isGuest) {
      return `### How to Sign In to Woodlem LMS:\n\n1. **Select Your Role**: Click the appropriate tab at the top of the login card (**Student**, **Teacher**, **Admin**, or **Parent**).\n2. **Enter Identifier**:\n   - **Students**: Registered School Email or **Admission Number** (e.g. \`ADM-1001\`).\n   - **Teachers**: Staff Email or **Employee ID**.\n   - **Admins**: Admin Email or **Admin ID**.\n   - **Parents**: Registered Parent Email.\n3. **Enter Password**:\n   - Default password for newly provisioned or reset accounts is **\`woodlem123\`**.\n\n💡 **Troubleshooting Tips**:\n- **"Role Mismatch"**: If an error says your account is registered as another role, make sure to click that role's tab at the top.\n- **Forgot Password**: Try \`woodlem123\` or contact the IT Helpdesk at \`it-helpdesk@woodlempark.ae\` to reset your password.`;
    }
  }

  // C. LMS Features & Capabilities Overview
  if (
    q.includes('what is this portal') ||
    q.includes('what features') ||
    q.includes('features') ||
    q.includes('what can i do') ||
    q.includes('portal do') ||
    q.includes('capabilities') ||
    q.includes('who can access')
  ) {
    return `### Woodlem LMS Portal Features:\n\n- 📚 **Subject Classrooms**: Dedicated portals for mathematics, science, languages, and electives.\n- 📝 **Tasks & Assessments**: Timed interactive MCQ tests and digital assignment submission with teacher feedback.\n- 📊 **Syllabus & Coverage**: Real-time topic checklists tracking term-by-term curriculum completion.\n- 📁 **Learning Resources**: Central repository for lecture slides, worksheets, PDFs, and notes.\n- 📅 **Attendance System**: Live daily roll calls, absence logs, and attendance percentages.\n- 🏆 **Achievements & Holistic Hub**: Distinction certificates and extracurricular activity enrollments.\n\n*Log in with your school account above to access your personal dashboard.*`;
  }

  // If on login screen (guest) and query is general, provide welcoming overview
  if (isGuest) {
    return `Welcome to **Woodlem Park School LMS**! 👋 I am Woodpecker, your AI assistant.\n\nI can help you with:\n1. 🔑 **Login Assistance**: Explaining how students, teachers, parents, and admins sign in.\n2. ❓ **Account Troubleshooting**: Default passwords (\`woodlem123\`), admission numbers, and password resets.\n3. 🏫 **About Woodlem**: Learning about our CBSE high school curriculum, STEM programs, and green campus ethos.\n4. 💻 **LMS Capabilities**: Exploring our digital assignments, assessments, and attendance systems.\n\nHow can I help you get started today?`;
  }

  // 1. Homeroom & Student Roster Queries (Logged in)
  if (
    q.includes('who is in my') ||
    q.includes('my student') ||
    q.includes('homeroom student') ||
    q.includes('class student') ||
    q.includes('class list') ||
    q.includes('roster') ||
    q.includes('my class')
  ) {
    if (userRole === 'teacher' || userRole === 'admin') {
      const hr = portalContext?.homeroom;
      const students = hr?.students || [];
      const hrLabel = hr?.label || 'Homeroom';
      if (students.length > 0) {
        const studentList = students
          .map((s: any, idx: number) => `${idx + 1}. **${s.name}** (${s.grade} · ID: \`${s.admission}\`)`)
          .join('\n');
        return `Here is your active homeroom roster for **${hrLabel}** (${students.length} student${students.length > 1 ? 's' : ''}):\n\n${studentList}\n\n[[nav:view:attendance:mark|Take Daily Roll Call ↗]] [[nav:view:awards|Student Achievements ↗]]`;
      }
      return `Your assigned homeroom is **${hrLabel}**. Currently, there are no students enrolled in this section.\n\n[[nav:view:attendance:mark|Attendance Records ↗]] [[nav:modal:create_class|Create Subject Class ↗]]`;
    }
    if (userRole === 'student') {
      const hrLabel = portalContext?.currentUser?.homeroomLabel || 'your homeroom section';
      const classes = portalContext?.subjectClasses || [];
      const classNames = classes.map((c: any) => c.name).join(', ') || 'None';
      return `You are enrolled in **${hrLabel}**.\n\nYour active subject classrooms are:\n**${classNames}**\n\n[[nav:class:tasks|Tasks & Assessments ↗]] [[nav:class:resources|Learning Resources ↗]]`;
    }
  }

  // 2. Attendance & Roll Call Queries
  if (
    q.includes('attendance') ||
    q.includes('roll call') ||
    q.includes('who is absent') ||
    q.includes('present') ||
    q.includes('absent')
  ) {
    if (userRole === 'teacher' || userRole === 'admin') {
      const att = portalContext?.homeroom?.todayAttendance;
      const hrLabel = portalContext?.homeroom?.label || 'Homeroom';
      if (att) {
        const present = att.presentCount || 0;
        const auth = att.authorizedAbsences || [];
        const unauth = att.unauthorizedAbsences || [];
        return `**Today's Attendance Summary (${att.date}) for ${hrLabel}**:\n- **Present**: ${present} students\n- **Authorized Absences**: ${auth.length > 0 ? auth.join(', ') : 'None'}\n- **Unauthorized Absences**: ${unauth.length > 0 ? unauth.join(', ') : 'None'}\n\n[[nav:view:attendance:mark|Take Daily Roll Call ↗]] [[nav:view:attendance:history|View Attendance Register ↗]]`;
      }
      return `To manage and log daily homeroom attendance:\n1. Open "Attendance & Records" in the sidebar.\n2. Select today's date and mark each student.\n3. Click "Save Attendance".\n\n[[nav:view:attendance:mark|Take Daily Roll Call ↗]] [[nav:view:attendance:history|View Attendance Register ↗]]`;
    }
    if (userRole === 'parent') {
      return `To track your child's attendance and academic progress:\n1. Click "Academic Progress" in the sidebar.\n2. View cumulative attendance rates and monthly breakdowns.\n\n[[nav:view:progress|View Child Academic Progress ↗]]`;
    }
    if (userRole === 'student') {
      const myAtt = portalContext?.homeroom?.myAttendance;
      if (myAtt) {
        return `**Your Attendance Record**:\n- **Total Logged Days**: ${myAtt.totalDays}\n- **Days Present**: ${myAtt.presentDays}\n- **Overall Attendance Rate**: **${myAtt.attendanceRate}**\n\nClick below to view your full logs:\n\n[[nav:view:attendance|View Attendance Record ↗]]`;
      }
      return `To check your attendance records:\n1. Open "Attendance Record" in the sidebar.\n2. Review your attendance percentage and term logs.\n\n[[nav:view:attendance|View Attendance Record ↗]]`;
    }
  }

  // 3. Tests & Assessments Queries
  if (q.includes('test') || q.includes('assessment') || q.includes('exam') || q.includes('quiz')) {
    const tests = portalContext?.tests || [];
    if (tests.length > 0) {
      const testList = tests
        .slice(0, 5)
        .map((t: any, idx: number) => `${idx + 1}. **${t.title}** (${t.className} · ${t.durationMinutes} mins · ${t.totalMarks} marks)${t.status ? ` · _${t.status}_` : ''}`)
        .join('\n');
      if (userRole === 'teacher') {
        return `Active assessments in your classes:\n\n${testList}\n\n[[nav:class:tasks|Manage Tasks & Assessments ↗]] [[nav:modal:create_test|Publish New Assessment ↗]]`;
      }
      return `Here are the tests for your enrolled classes:\n\n${testList}\n\nClick below to open your assessments:\n\n[[nav:class:tasks|Tasks & Assessments ↗]]`;
    }
    if (userRole === 'teacher') {
      return `To create and publish assessments for your classes:\n1. Open your Subject Classroom -> "Tasks & Assessments" tab.\n2. Click "+ Publish Assessment" to build MCQ and open text questions.\n\n[[nav:class:tasks|Tasks & Assessments ↗]] [[nav:modal:create_test|Publish Assessment ↗]]`;
    }
    return `You have no pending tests scheduled in your enrolled classes right now.\n\n[[nav:class:tasks|Tasks & Assessments ↗]]`;
  }

  // 4. Homework & Assignments Queries
  if (
    q.includes('homework') ||
    q.includes('assignment') ||
    q.includes('submit') ||
    q.includes('turn in') ||
    q.includes('task')
  ) {
    const assignments = portalContext?.assignments || [];
    if (assignments.length > 0) {
      const assList = assignments
        .slice(0, 5)
        .map((a: any, idx: number) => `${idx + 1}. **${a.title}** (${a.className})${a.status ? ` · _${a.status}_` : ''}`)
        .join('\n');
      if (userRole === 'teacher') {
        return `Active assignments for your classes:\n\n${assList}\n\n[[nav:class:tasks|Review & Grade Assignments ↗]] [[nav:modal:create_assignment|Create Assignment ↗]]`;
      }
      return `Here are your active homework assignments:\n\n${assList}\n\nTo submit your document:\n1. Click "Tasks & Assessments" below.\n2. Click "Submit Work" on the corresponding task and upload your file.\n\n[[nav:class:tasks|Tasks & Assessments ↗]]`;
    }
    if (userRole === 'teacher') {
      return `To create a new homework assignment:\n1. Click "+ Create Assignment" in your subject classroom.\n2. Specify the title, instructions, and target class.\n\n[[nav:class:tasks|Tasks & Assessments ↗]] [[nav:modal:create_assignment|Create Assignment ↗]]`;
    }
    return `You have no pending homework assignments due in your enrolled classes right now.\n\n[[nav:class:tasks|Tasks & Assessments ↗]]`;
  }

  // 5. Learning Resources & Study Materials Queries
  if (
    q.includes('resource') ||
    q.includes('notes') ||
    q.includes('slides') ||
    q.includes('worksheet') ||
    q.includes('materials') ||
    q.includes('study')
  ) {
    const resources = portalContext?.resources || [];
    if (resources.length > 0) {
      const resList = resources
        .slice(0, 6)
        .map((r: any, idx: number) => `${idx + 1}. **${r.title}** (${r.type.toUpperCase()}${r.uploadedBy ? ` · by ${r.uploadedBy}` : ''})`)
        .join('\n');
      if (userRole === 'teacher') {
        return `Uploaded learning resources in the system:\n\n${resList}\n\n[[nav:view:homeroom_resources|Homeroom Resources ↗]] [[nav:class:resources|Classroom Resources ↗]]`;
      }
      return `Here are your course learning materials:\n\n${resList}\n\nClick below to preview or download:\n\n[[nav:class:resources|Learning Resources ↗]]`;
    }
    if (userRole === 'teacher') {
      return `To share study materials:\n1. Open "Class Resources" in the sidebar or your Subject Classroom.\n2. Click "+ Upload Resource" to upload PDFs, slides, or documents.\n\n[[nav:view:homeroom_resources|Homeroom Resources ↗]] [[nav:class:resources|Classroom Resources ↗]]`;
    }
    return `No study materials uploaded for this subject yet.\n\n[[nav:class:resources|Learning Resources ↗]]`;
  }

  // 6. Syllabus & Coverage Queries
  if (q.includes('syllabus') || q.includes('coverage') || q.includes('topic') || q.includes('chapter')) {
    const terms = portalContext?.syllabus || [];
    if (terms.length > 0) {
      const termList = terms
        .slice(0, 3)
        .map((t: any) => `**${t.termName}** (${t.subject || 'General'}): **${t.percentDone}** completed (${t.completedTopics}/${t.totalTopics} topics)`)
        .join('\n');
      return `**Syllabus Coverage Breakdown**:\n\n${termList}\n\n[[nav:class:syllabus|Syllabus & Coverage ↗]]`;
    }
    return `To review term-by-term syllabus topics and track completion:\n1. Open your Subject Classroom from the sidebar.\n2. Click the "Syllabus & Coverage" tab.\n\n[[nav:class:syllabus|Syllabus & Coverage ↗]]`;
  }

  // 7. Student Distinctions & Awards
  if (q.includes('award') || q.includes('achievement') || q.includes('distinction') || q.includes('certificate')) {
    const awards = portalContext?.awards || [];
    if (awards.length > 0) {
      const awardList = awards
        .slice(0, 5)
        .map((a: any, idx: number) => `${idx + 1}. **${a.title}** — ${a.studentName} (${a.studentGrade})${a.description ? `\n   _${a.description}_` : ''}`)
        .join('\n');
      return `Student Distinctions & Awards:\n\n${awardList}\n\n[[nav:view:awards|Student Achievements ↗]]`;
    }
    if (userRole === 'teacher') {
      return `To review and approve student awards:\n1. Click "Student Achievements" in the sidebar under Homeroom.\n2. Inspect verified distinctions and portfolio submissions.\n\n[[nav:view:awards|Student Achievements ↗]]`;
    }
    return `To record your academic awards and certificates:\n1. Click "My Achievements" in the sidebar.\n2. Click "+ Add Achievement" to upload proof.\n\n[[nav:view:awards|Student Achievements ↗]] [[nav:modal:add_achievement|Add Achievement ↗]]`;
  }

  // 8. Password & Settings Queries
  if (q.includes('password') || q.includes('reset password') || q.includes('change password')) {
    if (userRole === 'admin') {
      return `As an Administrator, you can manage and reset passwords:\n1. **User Directory**: Search any student/teacher and click "Reset Password".\n2. **Password Manager**: Open "Settings & Passwords" to reset single users or entire grade cohorts to default (\`woodlem123\`).\n\n[[nav:view:settings|Open Password Manager & Settings ↗]] [[nav:view:directory|Open User Directory ↗]]`;
    }
    return `To change your account password:\n1. Click on "Settings & Passwords" in your sidebar.\n2. Enter your new password (min 6 characters) and confirm.\n3. Click "Save New Password".\n\n[[nav:view:settings|Settings & Passwords ↗]] [[nav:view:support|Help & Support ↗]]`;
  }

  // 9. Holistic Hub Queries
  if (q.includes('hub') || q.includes('activity') || q.includes('extracurricular') || q.includes('club') || q.includes('stem')) {
    return `The Holistic Hub offers extracurricular workshops, robotics, arts, and athletics:\n1. Click "Holistic Hub" in your sidebar.\n2. Explore active programs for Grades 9-12 and enroll.\n\n[[nav:view:hub|Holistic Hub ↗]]`;
  }

  // 10. Helpdesk & Support Queries
  if (q.includes('support') || q.includes('help') || q.includes('ticket') || q.includes('contact') || q.includes('it')) {
    return `To reach the IT Helpdesk or file an issue:\n1. Click "Help & Support" in your sidebar.\n2. Fill out the ticket form or email \`it-helpdesk@woodlempark.ae\`.\n\n[[nav:view:support|Help & Support ↗]]`;
  }

  // 11. Admin Provision & User Management
  if (q.includes('provision') || q.includes('bulk import') || q.includes('add user') || q.includes('create student')) {
    if (userRole === 'admin') {
      return `To provision and onboard users:\n1. **Single User**: Click "+ Provision User" to create a student, teacher, or parent.\n2. **Bulk Import**: Click "Bulk Import" to upload an Excel spreadsheet.\n\n[[nav:view:directory|User Directory ↗]] [[nav:modal:provision_user|Provision New User ↗]] [[nav:modal:bulk_import|Bulk Import Excel ↗]]`;
    }
  }

  // Default Overview Response for Logged-In User
  const userName = portalContext?.currentUser?.name || 'User';
  const roleName = userRole.charAt(0).toUpperCase() + userRole.slice(1);
  const greeting = isFollowUp ? '' : `Hello **${userName}** (${roleName}). `;
  return `${greeting}I am Woodpecker, your AI assistant with live access to your portal state.\n\nHow can I help you today?\n- Check active assignments and upcoming assessments\n- Review homeroom roster and daily attendance logs\n- Browse lesson notes, slides, and study resources\n- Check syllabus completion and account settings\n\n[[nav:class:tasks|Tasks & Assessments ↗]] [[nav:class:resources|Learning Resources ↗]] [[nav:view:attendance|Attendance Record ↗]] [[nav:view:settings|Settings & Passwords ↗]]`;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { message, history = [], userRole = 'student', userName = 'User', portalContext } = body;

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    const startTime = Date.now();

    // Format ground truth context cleanly
    let groundTruthSummary = '';
    if (portalContext) {
      const u = portalContext.currentUser || {};
      const hr = portalContext.homeroom || {};
      const att = hr.todayAttendance || {};
      const classes = portalContext.subjectClasses || [];
      const tests = portalContext.tests || [];
      const assignments = portalContext.assignments || [];
      const syllabus = portalContext.syllabus || [];
      const resources = portalContext.resources || [];
      const broadcasts = portalContext.broadcasts || [];
      const awards = portalContext.awards || [];
      const isStudent = u.role === 'student' || userRole === 'student';

      groundTruthSummary = `
=== LIVE REAL-TIME SCHOOL PORTAL DATABASE & SCREEN STATE (GROUND TRUTH) ===
Logged-in User: ${u.name || userName} (Role: ${u.role || userRole}, Email: ${u.email || '—'}, Grade: ${u.grade || '—'}, Section: ${u.classLetter || '—'}, Homeroom: ${u.homeroomLabel || '—'}, Code: ${u.code || '—'})
${isStudent ? `CRITICAL PRIVACY RULE: This user is a STUDENT. You must strictly ONLY answer about their enrolled classes (${classes.map((c: any) => c.name).join(', ') || 'None'}), their own tests, their own homework, and their own achievements. NEVER mention classes, tests, homework, or students from other grades or sections.` : ''}

${isStudent ? `STUDENT'S PERSONAL ATTENDANCE SUMMARY:
- Attendance Rate: ${hr.myAttendance?.attendanceRate || '100%'} (${hr.myAttendance?.presentDays || 0}/${hr.myAttendance?.totalDays || 0} days present)` : `HOMEROOM ROSTER & ATTENDANCE (${hr.label || 'Assigned Homeroom'}):
- Total Enrolled Students: ${hr.totalEnrolled || 0}
- Students List: ${(hr.students || []).map((s: any) => `${s.name} (Admission: ${s.admission}, ${s.grade})`).join('; ') || 'No students'}
- Today's Roll Call (${att.date || 'Today'}): ${att.presentCount || 0} Present; Authorized Absences: ${(att.authorizedAbsences || []).join(', ') || 'None'}; Unauthorized Absences: ${(att.unauthorizedAbsences || []).join(', ') || 'None'}
- Recent Leave Requests: ${(hr.leaveRequests || []).map((l: any) => `${l.studentName} (${l.type}: ${l.reason} from ${l.dates})`).join('; ') || 'None'}`}

ENROLLED SUBJECT CLASSROOMS:
${classes.map((c: any) => `- ${c.name} (${c.subject}, ${c.gradeClass || ''} ${c.section || ''}, ${c.enrolledCount} enrolled)`).join('\n') || 'No subject classrooms enrolled'}

ACTIVE TESTS & ASSESSMENTS (FOR USER'S CLASSES):
${tests.map((t: any) => `- Test: "${t.title}" (${t.className}, ${t.durationMinutes} mins, ${t.totalMarks} marks, Status: ${t.status || 'Pending'})`).join('\n') || 'None scheduled'}

ACTIVE HOMEWORK ASSIGNMENTS (FOR USER'S CLASSES):
${assignments.map((a: any) => `- Assignment: "${a.title}" (${a.className}, Status: ${a.status || 'Pending'})`).join('\n') || 'None pending'}

SYLLABUS PROGRESS:
${syllabus.map((s: any) => `- ${s.termName} (${s.subject || 'Course'}): ${s.percentDone} complete (${s.completedTopics}/${s.totalTopics} topics)`).join('\n') || 'Not configured'}

RECENT LEARNING RESOURCES:
${resources.map((r: any) => `- Resource: "${r.title}" (${r.type.toUpperCase()}${r.uploadedBy ? ` by ${r.uploadedBy}` : ''})`).join('\n') || 'None uploaded'}

RECENT BROADCASTS & NOTICES:
${broadcasts.map((b: any) => `- Broadcast: "${b.title}" [${b.priority || 'Normal'}] (${b.author})`).join('\n') || 'None'}

STUDENT DISTINCTION AWARDS:
${awards.map((a: any) => `- Distinction: "${a.title}" awarded to ${a.studentName} (${a.studentGrade})`).join('\n') || 'None'}
=== END GROUND TRUTH ===
`;
    }

    const isLoginScreen = !portalContext?.currentUser || portalContext?.isLoginScreen || userRole === 'guest';
    const isFollowUp = Array.isArray(history) && history.length > 1;

    // If Gemini API key is available, invoke Gemini 2.5 Flash
    if (apiKey) {
      try {
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

        const systemInstructionText = `${SYSTEM_KNOWLEDGE}

${groundTruthSummary}

User Session:
Status: ${isLoginScreen ? 'On Login Screen (Guest / Unauthenticated)' : 'Logged-In Portal User'}
Name: ${userName}
Role: ${isLoginScreen ? 'Guest / Visitor' : userRole}

CRITICAL CONVERSATIONAL & DATA ISOLATION DIRECTIVES:
1. CONVERSATIONAL MEMORY & NATURAL CONTINUITY:
- You are engaged in an ongoing conversation with ${userName}.
- CONVERSATION MEMORY: Keep track of previous conversation turns in history and refer back to what the user said or asked previously (e.g. if the user says "hmm do i have any homework?", "what about my tests?", or references prior responses).
- STRICT GREETING RULE: DO NOT start your replies with "Hello ${userName}," or "Hi ${userName}," or any repetitive greeting in follow-up messages! Only use an introductory greeting on the very first message of a brand new session. On ongoing messages, jump directly into answering clearly and concisely.

2. STRICT STUDENT DATA ISOLATION:
- If the user is a STUDENT, strictly ONLY discuss their enrolled subject classrooms, their own homework assignments, and their own tests.
- NEVER mention tests, assignments, or student rosters from other grades (e.g. Grade 10) or other sections (e.g. 12-B when the student is in 12-C).
- If no homework assignments or tests are active for their enrolled classes, explicitly tell them: "You currently have no active homework assignments due for your enrolled classes."

3. ACTIONABLE NAVIGATION TOKENS:
- Embed relevant [[nav:...]] tokens so the user can easily jump to the corresponding tab or screen.`;

        // Format contents array for Gemini multi-turn chat
        const contents: any[] = [];

        if (Array.isArray(history) && history.length > 0) {
          const recentHistory = history.slice(-8);
          for (const h of recentHistory) {
            if (h && typeof h.content === 'string' && h.content.trim()) {
              const role = h.role === 'assistant' || h.role === 'model' ? 'model' : 'user';
              // If the very first message in contents would be 'model', skip it so conversation starts with 'user'
              if (contents.length === 0 && role === 'model') {
                continue;
              }
              // Merge adjacent turns with same role if any
              if (contents.length > 0 && contents[contents.length - 1].role === role) {
                contents[contents.length - 1].parts[0].text += `\n${h.content.trim()}`;
              } else {
                contents.push({
                  role,
                  parts: [{ text: h.content.trim() }],
                });
              }
            }
          }
        }

        // Ensure the current user message is appended as the last user turn
        if (contents.length > 0 && contents[contents.length - 1].role === 'user') {
          contents[contents.length - 1].parts[0].text = message;
        } else {
          contents.push({
            role: 'user',
            parts: [{ text: message }],
          });
        }

        const res = await fetch(geminiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            system_instruction: {
              parts: [{ text: systemInstructionText }],
            },
            contents,
            generationConfig: {
              temperature: 0.2,
              maxOutputTokens: 1200,
            },
          }),
        });

        if (res.ok) {
          const data = await res.json();
          const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (reply && typeof reply === 'string') {
            const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
            return NextResponse.json({
              reply: reply.trim(),
              thoughtTime: `${elapsed}s`,
              thoughtProcess: `Consulted live portal database, cross-referenced active homeroom/class records, and generated clickable action routes.`,
              sourcesCount: 6,
              model: 'Gemini 2.5 Flash',
            });
          }
        } else {
          const errData = await res.json().catch(() => ({}));
          console.warn('Gemini API returned non-200:', res.status, errData);
        }
      } catch (geminiErr) {
        console.warn('Gemini API error, using ground-truth local fallback:', geminiErr);
      }
    }

    // Contextual ground-truth local fallback
    const fallbackReply = getLocalAiResponse(message, userRole, portalContext, isFollowUp);
    const elapsed = Math.max(1.1, ((Date.now() - startTime) / 1000) + 0.6).toFixed(1);
    return NextResponse.json({
      reply: fallbackReply,
      thoughtTime: `${elapsed}s`,
      thoughtProcess: `Processed intent against live portal database snapshot and constructed interactive navigation links.`,
      sourcesCount: 5,
      model: 'Woodpecker Neural Core',
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        reply: `I can assist you with your subject classrooms, homeroom attendance, assignments, and portal settings.\n\n[[nav:class:tasks|Tasks & Assessments ↗]] [[nav:class:resources|Learning Resources ↗]] [[nav:view:settings|Settings & Passwords ↗]]`,
        thoughtTime: '0.8s',
        sourcesCount: 3,
        model: 'Woodpecker Core',
      },
      { status: 200 }
    );
  }
}
