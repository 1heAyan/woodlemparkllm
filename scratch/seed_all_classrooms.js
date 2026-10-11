const xlsx = require('xlsx');
const crypto = require('crypto');
const path = require('path');

const SUPABASE_URL = 'https://geewtbleggwsrjazfqac.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdlZXd0YmxlZ2d3c3JqYXpmcWFjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU0MTE4NDIsImV4cCI6MjEwMDk4Nzg0Mn0.inCAGx_xty3j37a1KJrnEzNTT47kh1cuwJBByQhEUxU';

const isDryRun = process.argv.includes('--dry-run');

// Subject standardizer
function standardizeSubject(sub) {
  const s = (sub || '').trim();
  if (s === 'Maths') return 'Mathematics';
  if (s === 'PE') return 'Physical Education';
  if (s === 'ART') return 'Art';
  if (s === 'IT') return 'Information Technology';
  if (s === 'Leadership,Welbeing') return 'Leadership & Wellbeing';
  if (s === 'Psycology') return 'Psychology';
  if (s === 'SST (Hist,Pol.sci)') return 'History & Political Science';
  if (s === 'SST (Eco,Geo)') return 'Economics & Geography';
  return s;
}

// Clean names for matching
function cleanTeacherNameKey(s) {
  return (s || '')
    .toLowerCase()
    .replace(/^(ms\.|mr\.|ms|mr)\s+/i, '')
    .replace(/\s+ict$/i, '')
    .replace(/lekshmi/g, 'lakshmi')
    .replace(/[^a-z0-9]/g, '');
}

// Helper to determine accurate primary subject for new teacher profiles
function getTeacherPrimarySubject(name, rawSubjectsSet) {
  if (['Maria', 'Syed Ahmad', 'Saad'].some(n => name.includes(n))) return 'Islamic Education';
  if (['Biji Krishnan', 'Anzeena', 'Chinu', 'Snija', 'Nilufar Abdul', 'Anju M'].some(n => name.includes(n))) return 'English';
  if (['Farida', 'Sanil Kumar'].some(n => name.includes(n))) return 'Art';
  if (['Yoonus', 'Shafnas', 'Sana', 'Afra', 'Abdur Raoof', 'Shakeer'].some(n => name.includes(n))) return 'Arabic';
  if (['Adil', 'Sonu', 'Sudarshini'].some(n => name.includes(n))) return 'Hindi';
  if (['Suzan', 'Astrid'].some(n => name.includes(n))) return 'French';
  if (['Shiji', 'Abhinaya', 'Shumaila', 'Jareena'].some(n => name.includes(n))) return 'Malayalam';
  if (['Yamuna', 'Unais', 'Leeja'].some(n => name.includes(n))) return 'Physical Education';
  if (['Rana', 'Sreekala'].some(n => name.includes(n))) return 'Leadership & Wellbeing';
  if (['Syeda Aneesa'].some(n => name.includes(n))) return 'Mass Media';
  if (['Gini'].some(n => name.includes(n))) return 'Sociology';
  if (['Shilpa', 'Bindu'].some(n => name.includes(n))) return 'Value Education';
  if (['Sumithra', 'Shine', 'Amrutha Bio'].some(n => name.includes(n))) return 'Biology';
  if (['Jaya', 'Sangeetha', 'Harishma', 'Lakshmi Maya'].some(n => name.includes(n))) return 'Mathematics';
  if (['Sreerenjini', 'Lakshmi K'].some(n => name.includes(n))) return 'Social Science';
  if (['Shimra', 'Sameega'].some(n => name.includes(n))) return 'Physics';
  if (['Deva Shiney', 'Aparna'].some(n => name.includes(n))) return 'Information Technology';
  if (['Sharmila'].some(n => name.includes(n))) return 'Chemistry';
  if (['Nahida Shabeer'].some(n => name.includes(n))) return 'Psychology';

  const subs = Array.from(rawSubjectsSet || []).map(standardizeSubject);
  return subs.find(s => !s.startsWith('Opt') && !s.includes('Lab') && !s.includes('Second Lang')) || subs[0] || 'General';
}

// Generate teacher email
function generateTeacherEmail(name) {
  const clean = name
    .toLowerCase()
    .replace(/^(ms\.|mr\.|ms|mr)\s+/i, (match) => match.trim().replace('.', '') + '.')
    .replace(/\s+/g, '.')
    .replace(/[^a-z0-9.]/g, '');
  return `${clean}@woodlempark.ae`;
}

// Class name normalizer: "12 A" -> "12-A", "9A" -> "9-A", "9p" -> "9-P"
function normalizeClassName(rawClass) {
  if (!rawClass) return '';
  const clean = rawClass.trim().replace(/\s+/g, '-').toUpperCase();
  const match = clean.match(/^(\d+)[-\s]*([A-Z]+)$/);
  if (match) return `${match[1]}-${match[2]}`;
  return clean;
}

// HTTP helper for Supabase REST API
async function supabaseFetch(endpoint, options = {}) {
  const url = `${SUPABASE_URL}/rest/v1/${endpoint}`;
  const headers = {
    'apikey': ANON_KEY,
    'Authorization': `Bearer ${ANON_KEY}`,
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };
  const res = await fetch(url, { ...options, headers });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Supabase request failed: ${res.status} ${res.statusText} - ${errText}`);
  }
  const text = await res.text();
  if (!text || text.trim() === '') return null;
  return JSON.parse(text);
}

async function main() {
  console.log(`=== Woodlem LMS Class Seeder (Dry Run: ${isDryRun}) ===`);
  
  // 1. Fetch all existing profiles
  console.log('Fetching profiles from Supabase...');
  const allProfiles = await supabaseFetch('profiles?select=*&limit=2000');
  console.log(`Fetched ${allProfiles.length} total profiles.`);

  const studentProfiles = allProfiles.filter(p => p.role === 'student');
  const teacherProfiles = allProfiles.filter(p => p.role === 'teacher');
  console.log(`Students: ${studentProfiles.length}, Teachers: ${teacherProfiles.length}`);

  // Build student map: "12-A" -> [studentId1, studentId2, ...]
  const studentsByClass = {};
  for (const s of studentProfiles) {
    const key = `${s.grade}-${s.class_letter}`;
    if (!studentsByClass[key]) studentsByClass[key] = [];
    studentsByClass[key].push(s.id);
  }
  console.log(`Mapped students across ${Object.keys(studentsByClass).length} class sections.`);

  // Build teacher lookup map by cleaned name
  const teacherByCleanName = new Map();
  for (const t of teacherProfiles) {
    teacherByCleanName.set(cleanTeacherNameKey(t.name), t);
  }

  // 2. Read Book1.xlsx
  const excelPath = path.resolve(__dirname, '../Book1.xlsx');
  console.log(`Reading Excel file from ${excelPath}...`);
  const wb = xlsx.readFile(excelPath);
  const ws = wb.Sheets['Contracts Classes'];
  const rawRows = xlsx.utils.sheet_to_json(ws);
  console.log(`Parsed ${rawRows.length} rows from sheet "Contracts Classes".`);

  // 3. Expand classroom rows
  let currentClass = null;
  const rawClassrooms = [];
  const uniqueExcelTeachers = new Map(); // name -> primary subjects Set

  for (const r of rawRows) {
    if (r.Class) {
      currentClass = normalizeClassName(r.Class);
      continue;
    }
    if (!r.Teacher || !r.Subject) continue;

    const rawSub = r.Subject.trim();
    if (rawSub === 'Assembly' || rawSub === 'Assessment') continue;

    const rawTeachers = r.Teacher.split(',').map(t => t.trim()).filter(Boolean);
    for (const t of rawTeachers) {
      if (!uniqueExcelTeachers.has(t)) uniqueExcelTeachers.set(t, new Set());
      uniqueExcelTeachers.get(t).add(rawSub);
    }

    if (rawSub === 'Opt1-Bio,CS,Eco,Mark,MM') {
      const opt1Map = [
        { sub: 'Biology', name: 'Biology' },
        { sub: 'Computer Science', name: 'Computer Science' },
        { sub: 'Economics', name: 'Economics' },
        { sub: 'Marketing', name: 'Marketing' },
        { sub: 'Mass Media', name: 'Mass Media' }
      ];
      rawTeachers.forEach((t, i) => {
        const info = opt1Map[i] || { sub: 'Optional 1', name: 'Optional 1' };
        rawClassrooms.push({ teacher: t, subject: info.sub, class_name: currentClass });
      });
    } else if (rawSub === 'Opt2 Math,AI,EP,PS') {
      rawTeachers.forEach((t) => {
        let sub = 'Optional 2';
        if (t.includes('Sugathan')) sub = 'Mathematics';
        else if (t.includes('Jephia') || t.includes('Kibithiya')) sub = 'Artificial Intelligence';
        else if (t.includes('Amena')) sub = 'Entrepreneurship';
        else if (t.includes('Nithu')) sub = 'Political Science';
        else if (t.includes('Sadaf')) sub = 'Psychology';
        else if (t.includes('Ranjani')) sub = 'Applied Mathematics';
        rawClassrooms.push({ teacher: t, subject: sub, class_name: currentClass });
      });
    } else if (rawSub === 'Isl.Edu/Val.Edu') {
      rawTeachers.forEach((t) => {
        const isIslamic = ['Maria', 'Syed Ahmad', 'Saad'].some(n => t.includes(n));
        const sub = isIslamic ? 'Islamic Education' : 'Value Education';
        rawClassrooms.push({ teacher: t, subject: sub, class_name: currentClass });
      });
    } else if (rawSub === 'Second Lang') {
      rawTeachers.forEach((t) => {
        let sub = 'Second Language';
        if (['Yoonus', 'Abdur Raoof', 'Shafnas'].some(n => t.includes(n))) sub = 'Arabic';
        else if (['Adil', 'Sonu', 'Sudarshini'].some(n => t.includes(n))) sub = 'Hindi';
        else if (['Suzan', 'Astrid', 'Nadia'].some(n => t.includes(n))) sub = 'French';
        else if (['Shiji', 'Abhinaya', 'Shumaila', 'Jareena'].some(n => t.includes(n))) sub = 'Malayalam';
        rawClassrooms.push({ teacher: t, subject: sub, class_name: currentClass });
      });
    } else if (rawSub === 'Phy/Chem Lab') {
      rawTeachers.forEach((t) => {
        rawClassrooms.push({ teacher: t, subject: 'Physics & Chemistry Lab', class_name: currentClass });
      });
    } else if (rawSub === 'Arabic' && rawTeachers.length > 1) {
      rawTeachers.forEach((t) => {
        rawClassrooms.push({ teacher: t, subject: 'Arabic', class_name: currentClass });
      });
    } else {
      rawTeachers.forEach((t) => {
        rawClassrooms.push({ teacher: t, subject: standardizeSubject(rawSub), class_name: currentClass });
      });
    }
  }

  // Deduplicate classrooms by teacher + subject + class_name
  const dedupeMap = new Map();
  for (const c of rawClassrooms) {
    const key = `${c.teacher}|${c.subject}|${c.class_name}`;
    if (!dedupeMap.has(key)) {
      dedupeMap.set(key, c);
    }
  }
  const classroomsToCreate = Array.from(dedupeMap.values());
  console.log(`Total expanded unique classrooms: ${classroomsToCreate.length}`);

  // 4. Identify missing teachers and prepare new profiles
  const missingTeachers = [];
  const existingEmails = new Set(allProfiles.map(p => (p.email || '').toLowerCase()));
  let nextUserCodeNum = 101;

  for (const [tName, subjectsSet] of uniqueExcelTeachers.entries()) {
    const cleanKey = cleanTeacherNameKey(tName);
    if (!teacherByCleanName.has(cleanKey)) {
      let email = generateTeacherEmail(tName);
      if (existingEmails.has(email)) {
        email = email.replace('@', `${nextUserCodeNum}@`);
      }
      existingEmails.add(email);

      const primarySubject = getTeacherPrimarySubject(tName, subjectsSet);

      const newTeacherProfile = {
        id: crypto.randomUUID(),
        name: tName.replace(/\s+/g, ' ').trim(),
        email: email,
        role: 'teacher',
        user_code: `TCH-${nextUserCodeNum++}`,
        temp_password: 'woodlem123',
        subject: primarySubject,
        grade: 'Grade 9 to 12',
        class_letter: 'A',
        admission_number: '',
        linked_student_ids: []
      };
      missingTeachers.push(newTeacherProfile);
    }
  }

  console.log(`Existing matched teachers: ${uniqueExcelTeachers.size - missingTeachers.length}`);
  console.log(`Missing teachers to create: ${missingTeachers.length}`);

  if (missingTeachers.length > 0) {
    console.log('Sample missing teachers to create:');
    missingTeachers.slice(0, 10).forEach(m => console.log('  ', m.name, '|', m.email, '|', m.user_code, '|', m.subject));
  }

  // 5. Insert missing teacher profiles if not dry-run
  if (!isDryRun && missingTeachers.length > 0) {
    console.log(`Inserting ${missingTeachers.length} new teacher profiles into Supabase...`);
    for (let i = 0; i < missingTeachers.length; i += 25) {
      const batch = missingTeachers.slice(i, i + 25);
      await supabaseFetch('profiles', {
        method: 'POST',
        headers: { 'Prefer': 'return=minimal' },
        body: JSON.stringify(batch)
      });
      console.log(`Inserted teacher batch ${i + 1} to ${Math.min(i + 25, missingTeachers.length)}`);
    }
    // Update local teacher lookup map
    for (const t of missingTeachers) {
      teacherByCleanName.set(cleanTeacherNameKey(t.name), t);
    }
  } else if (isDryRun && missingTeachers.length > 0) {
    for (const t of missingTeachers) {
      teacherByCleanName.set(cleanTeacherNameKey(t.name), t);
    }
  }

  // 6. Fetch existing subject_classes to avoid duplicating existing ones
  console.log('Fetching existing subject_classes...');
  const existingSubjectClasses = await supabaseFetch('subject_classes?select=*&limit=1000');
  console.log(`Found ${existingSubjectClasses.length} existing subject_classes.`);

  const existingClassMap = new Map();
  for (const sc of existingSubjectClasses) {
    const key = `${cleanTeacherNameKey(sc.teacher_name)}|${sc.subject}|${sc.class_name}`;
    existingClassMap.set(key, sc);
  }

  // 7. Prepare final classroom records with enrolled students
  const finalClassroomsToInsert = [];
  const classroomsToUpdate = [];
  let totalEnrolledStudentCount = 0;

  for (const c of classroomsToCreate) {
    const teacher = teacherByCleanName.get(cleanTeacherNameKey(c.teacher));
    if (!teacher) {
      console.warn(`Could not resolve teacher profile for: ${c.teacher}`);
      continue;
    }

    const enrolledIds = studentsByClass[c.class_name] || [];
    totalEnrolledStudentCount += enrolledIds.length;

    const sectionLetter = c.class_name.split('-')[1] || '';
    const sectionName = sectionLetter ? `Section ${sectionLetter}` : '';
    const classroomName = `${c.subject} - ${c.class_name}`;
    const room = `Room ${c.class_name.replace('-', '')}`;

    const key = `${cleanTeacherNameKey(teacher.name)}|${c.subject}|${c.class_name}`;
    const existing = existingClassMap.get(key);

    if (existing) {
      classroomsToUpdate.push({
        id: existing.id,
        name: classroomName,
        subject: c.subject,
        class_name: c.class_name,
        section: sectionName,
        room: room,
        teacher_id: teacher.id,
        teacher_name: teacher.name,
        enrolled_student_ids: enrolledIds
      });
    } else {
      const classId = `class-${c.class_name.toLowerCase()}-${c.subject.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${teacher.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${crypto.randomBytes(3).toString('hex')}`;
      finalClassroomsToInsert.push({
        id: classId,
        name: classroomName,
        subject: c.subject,
        class_name: c.class_name,
        section: sectionName,
        room: room,
        teacher_id: teacher.id,
        teacher_name: teacher.name,
        enrolled_student_ids: enrolledIds
      });
    }
  }

  console.log(`Classrooms to insert: ${finalClassroomsToInsert.length}`);
  console.log(`Classrooms to update: ${classroomsToUpdate.length}`);
  console.log(`Total classroom-student enrollments: ${totalEnrolledStudentCount}`);

  // Sample check
  if (finalClassroomsToInsert.length > 0) {
    console.log('Sample classroom to insert:');
    const sample = finalClassroomsToInsert[0];
    console.log({
      id: sample.id,
      name: sample.name,
      subject: sample.subject,
      class_name: sample.class_name,
      teacher_name: sample.teacher_name,
      enrolled_students_count: sample.enrolled_student_ids.length
    });
  }

  // 8. Insert into Supabase if not dry run
  if (!isDryRun) {
    if (finalClassroomsToInsert.length > 0) {
      console.log(`Inserting ${finalClassroomsToInsert.length} classrooms into subject_classes...`);
      for (let i = 0; i < finalClassroomsToInsert.length; i += 50) {
        const batch = finalClassroomsToInsert.slice(i, i + 50);
        await supabaseFetch('subject_classes', {
          method: 'POST',
          headers: { 'Prefer': 'return=minimal' },
          body: JSON.stringify(batch)
        });
        console.log(`Inserted classroom batch ${i + 1} to ${Math.min(i + 50, finalClassroomsToInsert.length)}`);
      }
    }

    if (classroomsToUpdate.length > 0) {
      console.log(`Updating ${classroomsToUpdate.length} existing classrooms...`);
      for (const cu of classroomsToUpdate) {
        await supabaseFetch(`subject_classes?id=eq.${cu.id}`, {
          method: 'PATCH',
          headers: { 'Prefer': 'return=minimal' },
          body: JSON.stringify(cu)
        });
      }
    }

    console.log('Classroom creation completed successfully!');
  } else {
    console.log('DRY RUN COMPLETE: No database mutations were made.');
  }
}

main().catch(err => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
