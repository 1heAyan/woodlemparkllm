// =============================================
// Woodlem Park LMS — Core Application State
// v6: Parent Dashboard + Holistic Development Hub
// =============================================
const STORAGE_KEY = 'woodlem_v6_hub_data';

const SVG_ICONS = {
    counselling: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`,
    club: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>`,
    summer: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`,
    workshop: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>`,
    event: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
    volunteer: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`,
    leadership: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.45 1-1 1H4v2h16v-2h-5c-.55 0-1-.45-1-1v-2.34"/><path d="M12 2a4 4 0 0 0-4 4v5a4 4 0 0 0 8 0V6a4 4 0 0 0-4-4Z"/></svg>`,
    plant: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon"><path d="M12 22V12"/><path d="M12 12a5 5 0 0 0 5-5c0-2-2-3-5-3S7 5 7 7a5 5 0 0 0 5 5z"/><path d="M12 18a4 4 0 0 0 4-4c0-1.5-1-2.5-4-2.5S8 12.5 8 14a4 4 0 0 0 4 4z"/></svg>`,
    attachment: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>`,
    date: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
    absences: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
    syllabus: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>`,
    id_card: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M15 13h4M15 17h4M5 18a4 4 0 0 1 8 0"/></svg>`,
    admission: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/><path d="M9 14h6M9 10h6M9 18h6"/></svg>`,
    medical: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>`,
    consent: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>`,
    permission: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon"><path d="M4 10a2 2 0 0 0-2-2V4a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v4a2 2 0 0 0-2 2 2 2 0 0 0 2 2v4a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-4a2 2 0 0 0 2-2z"/></svg>`,
    emergency: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>`,
    video_play: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon play-icon"><polygon points="5 3 19 12 5 21 5 3"/></svg>`
};

const HUB_TYPE_ICONS = {
    'Counselling Appointment': 'counselling',
    'Club Registration':       'club',
    'Summer Programme':        'summer',
    'Workshop':                'workshop',
    'Event':                   'event',
    'Volunteer Opportunity':   'volunteer',
    'Leadership Programme':    'leadership'
};

function getSvg(name, extraClasses = '') {
    const rawSvg = SVG_ICONS[name] || '';
    if (!rawSvg) return '';
    if (extraClasses) {
        // Simple inject of additional classes
        return rawSvg.replace('class="svg-icon"', `class="svg-icon ${extraClasses}"`);
    }
    return rawSvg;
}

let appData = {
    students: [
        { id: 'S1', name: 'Sarah Jenkins' },
        { id: 'S2', name: 'Marcus Thorne' },
        { id: 'S3', name: 'Aisha Rahman' },
        { id: 'S4', name: 'David Chen' },
        { id: 'S5', name: 'Omar Al-Fayed' }
    ],
    tests: [],
    assignments: [],
    syllabus: [],
    achievements: [],
    attendance: {},
    hubActivities: [],
    parentDocuments: []
};

// Simulating logged-in context
const currentStudentId = 'S1'; // Sarah Jenkins
const currentParentChildId = 'S1'; // Parent is linked to Sarah Jenkins

// =============================================
// INITIALIZATION
// =============================================
document.addEventListener('DOMContentLoaded', () => {
    const storedData = localStorage.getItem(STORAGE_KEY);
    
    if (storedData) {
        const parsed = JSON.parse(storedData);
        // Merge to ensure new keys exist even on old saves
        appData = {
            ...appData,
            ...parsed,
            hubActivities: parsed.hubActivities || [],
            parentDocuments: parsed.parentDocuments || []
        };
        // Migrate old YouTube URLs to valid ones to avoid Error 153
        appData.hubActivities.forEach(act => {
            if (act.id === 'hub2' && (act.videoUrl === 'https://www.youtube.com/embed/hnpQrMqDoAE' || act.videoUrl === '')) {
                act.videoUrl = 'https://www.youtube.com/watch?v=inpok4MKVLM';
            }
            if (act.id === 'hub3' && (act.videoUrl === 'https://www.youtube.com/embed/dQw4w9WgXcQ' || act.videoUrl === '')) {
                act.videoUrl = 'https://www.youtube.com/watch?v=481H_N2k4HY';
            }
        });
        saveData();
    } else {
        seedInitialData();
        saveData();
    }

    // Set today's date in attendance picker
    const todayStr = new Date().toISOString().split('T')[0];
    const dateInput = document.getElementById('attendance-date');
    if (dateInput) dateInput.value = todayStr;

    // Handle session persistence
    const activeRole = localStorage.getItem('woodlem_active_role');
    if (activeRole) {
        document.querySelectorAll('.view-container').forEach(el => el.classList.remove('active'));
        const view = document.getElementById(activeRole + '-view');
        if (view) view.classList.add('active');
        document.getElementById('selectedRole').value = activeRole;

        // Restore the correct toggle button highlight
        const idx = ['student','teacher','admin','parent'].indexOf(activeRole);
        if (idx >= 0) {
            document.querySelectorAll('.role-toggle-btn').forEach(b => b.classList.remove('active'));
            const btn = document.getElementById('roleBtn-' + activeRole);
            if (btn) {
                btn.classList.add('active');
                document.getElementById('roleSlider').style.transform = `translateX(calc(${idx * 100}%))`;
            }
        }
    }

    renderAll();
    populateAdminDocFilter();
});

function saveData() { localStorage.setItem(STORAGE_KEY, JSON.stringify(appData)); }

function seedInitialData() {
    appData.tests = [{ id: 'test1', title: 'Unit Assessment 1: Electromagnetism' }];
    appData.assignments = [{ id: 'ass1', title: 'Circuit Diagram Practice' }];
    appData.syllabus = [
        { id: 'term1', name: 'Periodic Assessment 1', topics: [
            { id: 't1', title: 'Electrostatics', teacherChecked: true, studentChecked: true },
            { id: 't2', title: 'Current Electricity', teacherChecked: false, studentChecked: false }
        ]}
    ];
    appData.achievements = [
        { id: 'aw1', studentId: 'S1', title: 'Regional Science Fair — 1st Place', desc: 'Demonstrated wireless power transfer.' },
        { id: 'aw2', studentId: 'S2', title: 'Math Olympiad Gold', desc: 'Scored top 1% nationally.' }
    ];

    // Generate last 5 days of realistic attendance
    const today = new Date();
    for (let i = 4; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        appData.attendance[dateStr] = {
            'S1': 'present',
            'S2': i === 2 ? 'unauth_absent' : 'present',
            'S3': 'present',
            'S4': i === 1 ? 'auth_absent' : 'present',
            'S5': i === 0 ? 'unauth_absent' : 'present'
        };
    }

    // Seed sample Hub Activities
    const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 7);
    const nextWeek = new Date(); nextWeek.setDate(nextWeek.getDate() + 14);
    const nextMonth = new Date(); nextMonth.setDate(nextMonth.getDate() + 30);

    appData.hubActivities = [
        {
            id: 'hub1',
            title: 'Photography Club Registration',
            type: 'Club Registration',
            description: 'Join our school photography club and learn the art of capturing moments. Sessions every Thursday. Open to all skill levels — cameras provided for beginners.',
            date: tomorrow.toISOString().split('T')[0],
            videoUrl: '',
            attachedFileName: 'photography_club_flyer.pdf',
            targetGrades: ['Grade 12', 'Grade 11'],
            enrolledStudentIds: ['S1', 'S3'],
            createdBy: 'teacher'
        },
        {
            id: 'hub2',
            title: 'Counselling Session — Exam Stress Management',
            type: 'Counselling Appointment',
            description: 'One-on-one confidential counselling sessions with Dr. Meera Patel. Topics include exam anxiety, time management, and mental wellness. Book your preferred slot.',
            date: nextWeek.toISOString().split('T')[0],
            videoUrl: 'https://www.youtube.com/watch?v=inpok4MKVLM',
            attachedFileName: '',
            targetGrades: ['Grade 12'],
            enrolledStudentIds: ['S2'],
            createdBy: 'teacher'
        },
        {
            id: 'hub3',
            title: 'STEM Summer Research Programme 2026',
            type: 'Summer Programme',
            description: 'A 6-week immersive research programme hosted at the university campus. Students work alongside professors on live research projects. Includes a stipend and certificate.',
            date: nextMonth.toISOString().split('T')[0],
            videoUrl: 'https://www.youtube.com/watch?v=481H_N2k4HY',
            attachedFileName: 'stem_summer_brochure.pdf',
            targetGrades: ['Grade 12', 'Grade 11', 'Grade 10'],
            enrolledStudentIds: ['S1', 'S2', 'S4'],
            createdBy: 'teacher'
        },
        {
            id: 'hub4',
            title: 'Environmental Volunteer Day',
            type: 'Volunteer Opportunity',
            description: 'Participate in the annual city park restoration effort. Students earn community service hours and a certificate of participation. All supplies provided.',
            date: nextWeek.toISOString().split('T')[0],
            videoUrl: '',
            attachedFileName: '',
            targetGrades: ['Grade 10', 'Grade 11', 'Grade 12'],
            enrolledStudentIds: ['S3', 'S5'],
            createdBy: 'teacher'
        },
        {
            id: 'hub5',
            title: 'Student Leadership Summit',
            type: 'Leadership Programme',
            description: 'An intensive 2-day leadership development programme for aspiring student leaders. Covers public speaking, team management, and project planning. Limited to 20 seats.',
            date: nextMonth.toISOString().split('T')[0],
            videoUrl: '',
            attachedFileName: 'leadership_summit_details.pdf',
            targetGrades: ['Grade 12'],
            enrolledStudentIds: [],
            createdBy: 'teacher'
        }
    ];

    // Seed parent documents
    appData.parentDocuments = [
        { id: 'doc1', studentId: 'S1', docType: 'Student ID', status: 'submitted', fileName: 'sarah_id.jpg', uploadedAt: '2026-07-10' },
        { id: 'doc2', studentId: 'S1', docType: 'Medical Form', status: 'pending', fileName: '', uploadedAt: '' },
        { id: 'doc3', studentId: 'S1', docType: 'Admission Form', status: 'submitted', fileName: 'admission_sarah.pdf', uploadedAt: '2026-07-08' },
        { id: 'doc4', studentId: 'S1', docType: 'Consent Letter', status: 'pending', fileName: '', uploadedAt: '' },
        { id: 'doc5', studentId: 'S1', docType: 'Permission Slip — Field Trip', status: 'pending', fileName: '', uploadedAt: '' },
        { id: 'doc6', studentId: 'S1', docType: 'Emergency Contact Form', status: 'submitted', fileName: 'emergency_contacts.pdf', uploadedAt: '2026-07-09' }
    ];
}

// =============================================
// MAIN RENDER ORCHESTRATOR
// =============================================
function renderAll() {
    renderTests();
    renderSyllabus();
    renderStudentAwards();
    renderTeacherAwards('');
    loadAttendance();
    renderAttendanceDashboard();
    renderAdminPanel();
    renderStudentHub();
    renderTeacherHub();
    renderAdminHub();
    renderAdminDocuments();
    renderParentProgress();
    renderParentDocuments();
    renderParentHub();
}

// =============================================
// EXISTING RENDER ENGINES
// =============================================
function renderTests() {
    const stuTests = document.getElementById('student-tests-list');
    const stuAssigs = document.getElementById('student-assignments-list');
    const teacherOverview = document.getElementById('teacher-overview-list');
    const parentTests = document.getElementById('parent-tests-list');
    
    if (!stuTests || !teacherOverview) return;
    
    stuTests.innerHTML = '';
    if (stuAssigs) stuAssigs.innerHTML = '';
    let teacherHTML = '';
    let parentHTML = '';

    // Render Tests
    if (appData.tests.length === 0) {
        stuTests.innerHTML = '<div class="empty-state">No active tests.</div>';
    } else {
        appData.tests.forEach(test => {
            stuTests.innerHTML += `<div class="item-card"><div class="item-info"><span class="badge badge-test">Active Test</span><h4>${test.title}</h4></div><button class="btn-primary">Start</button></div>`;
            teacherHTML += `<div class="item-card"><div class="item-info"><span class="badge badge-test">Active Test</span><h4>${test.title}</h4></div><button class="btn-secondary btn-primary">Review Scores</button></div>`;
            parentHTML += `<div class="item-card"><div class="item-info"><span class="badge badge-test">Active Test</span><h4>${test.title}</h4></div><span style="font-size:13px;color:var(--text-secondary);">In Progress</span></div>`;
        });
    }

    // Render Assignments
    if (stuAssigs) {
        if (appData.assignments.length === 0) {
            stuAssigs.innerHTML = '<div class="empty-state">No pending tasks.</div>';
        } else {
            appData.assignments.forEach(ass => {
                stuAssigs.innerHTML += `<div class="item-card"><div class="item-info"><span class="badge badge-test" style="background:var(--secondary-light); color:var(--secondary);">Assignment</span><h4>${ass.title}</h4></div><button class="btn-secondary btn-primary">Submit File</button></div>`;
                teacherHTML += `<div class="item-card"><div class="item-info"><span class="badge badge-test" style="background:var(--secondary-light); color:var(--secondary);">Assignment</span><h4>${ass.title}</h4></div><button class="btn-secondary btn-primary">Grade</button></div>`;
                parentHTML += `<div class="item-card"><div class="item-info"><span class="badge badge-test" style="background:var(--secondary-light); color:var(--secondary);">Assignment</span><h4>${ass.title}</h4></div><span style="font-size:13px;color:var(--doc-pending);">Due Soon</span></div>`;
            });
        }
    }

    if (teacherHTML === '') teacherHTML = '<div class="empty-state">No active assessments or tasks.</div>';
    teacherOverview.innerHTML = teacherHTML;
    if (parentTests) parentTests.innerHTML = parentHTML || '<div class="empty-state">No active tests or assignments.</div>';
}

function renderSyllabus() {
    const tContainer = document.getElementById('teacher-terms-container');
    const sContainer = document.getElementById('student-terms-container');
    const selectBox = document.getElementById('topic-term-select');
    
    if (!tContainer || !sContainer) return;
    tContainer.innerHTML = ''; sContainer.innerHTML = '';
    if (selectBox) selectBox.innerHTML = '';

    if (appData.syllabus.length === 0) {
        tContainer.innerHTML = '<div class="empty-state">No syllabus terms created.</div>';
        sContainer.innerHTML = '<div class="empty-state">Syllabus pending.</div>';
        calculateSyllabusProgress(); return;
    }

    appData.syllabus.forEach(term => {
        if (selectBox) {
            const opt = document.createElement('option');
            opt.value = term.id; opt.innerText = term.name; selectBox.appendChild(opt);
        }

        let tHTML = `<div class="panel-block"><div class="panel-header-action"><h3 class="section-title" style="margin:0;">${term.name}</h3><button class="action-btn" onclick="openAddTopicModal('${term.id}')">+ Add Topic</button></div><div class="card-list">`;
        let sHTML = `<div class="panel-block"><h3 class="section-title">${term.name}</h3><div class="card-list">`;

        if (term.topics.length === 0) {
            tHTML += `<p style="font-size:13px; color:var(--text-secondary);">No topics added.</p>`;
            sHTML += `<p style="font-size:13px; color:var(--text-secondary);">No topics assigned.</p>`;
        } else {
            term.topics.forEach(topic => {
                tHTML += `
                    <div class="item-card">
                        <div style="display: flex; align-items: flex-start; gap: 16px;">
                            <input type="checkbox" class="syllabus-checkbox" onchange="toggleCheck('${term.id}', '${topic.id}', 'teacher', this.checked)" ${topic.teacherChecked ? 'checked' : ''}>
                            <div class="item-info"><h4>${topic.title}</h4></div>
                        </div>
                    </div>`;
                const sBadge = topic.teacherChecked
                    ? `<span class="badge badge-system" style="margin: 0;">Taught</span>`
                    : `<span class="badge badge-system" style="margin: 0; background:transparent; border:1px solid var(--border-color);">Pending</span>`;
                sHTML += `
                    <div class="item-card">
                        <div style="display: flex; align-items: flex-start; gap: 16px;">
                            <input type="checkbox" class="syllabus-checkbox" onchange="toggleCheck('${term.id}', '${topic.id}', 'student', this.checked)" ${topic.studentChecked ? 'checked' : ''}>
                            <div class="item-info"><h4>${topic.title}</h4></div>
                        </div>${sBadge}
                    </div>`;
            });
        }
        tHTML += `</div></div>`; sHTML += `</div></div>`;
        tContainer.innerHTML += tHTML; sContainer.innerHTML += sHTML;
    });
    calculateSyllabusProgress();
}

function toggleCheck(termId, topicId, role, isChecked) {
    const term = appData.syllabus.find(t => t.id === termId);
    if (!term) return;
    const topic = term.topics.find(t => t.id === topicId);
    if (!topic) return;
    if (role === 'teacher') topic.teacherChecked = isChecked;
    if (role === 'student') topic.studentChecked = isChecked;
    saveData();
    if (role === 'teacher') renderSyllabus(); else calculateSyllabusProgress();
}

function calculateSyllabusProgress() {
    let total = 0, tDone = 0, sDone = 0;
    appData.syllabus.forEach(term => { term.topics.forEach(topic => { total++; if (topic.teacherChecked) tDone++; if (topic.studentChecked) sDone++; }); });
    const tPct = total > 0 ? Math.round((tDone / total) * 100) : 0;
    const sPct = total > 0 ? Math.round((sDone / total) * 100) : 0;

    const tBarOver = document.getElementById('teacher-overall-bar');
    if (tBarOver) { document.getElementById('teacher-overall-pct').innerText = tPct + '%'; tBarOver.style.width = tPct + '%'; }

    const sBarT = document.getElementById('student-teacher-bar');
    if (sBarT) {
        document.getElementById('student-teacher-pct').innerText = tPct + '%'; sBarT.style.width = tPct + '%';
        document.getElementById('student-self-pct').innerText = sPct + '%'; document.getElementById('student-self-bar').style.width = sPct + '%';
    }
}

// Awards
function getStudentName(sId) { const s = appData.students.find(st => st.id === sId); return s ? s.name : 'Unknown'; }

function renderStudentAwards() {
    const list = document.getElementById('student-awards-list');
    if (!list) return;
    const myAwards = appData.achievements.filter(a => a.studentId === currentStudentId);
    if (myAwards.length === 0) {
        list.innerHTML = '<div class="empty-state" style="grid-column: 1 / -1;">No achievements added yet.</div>';
    } else {
        list.innerHTML = myAwards.map(aw => `
            <div class="grid-card">
                <span class="badge badge-award" style="width: fit-content;">Certificate Attached</span>
                <h4 style="font-family: var(--font-display); font-size: 16px; margin: 8px 0;">${aw.title}</h4>
                <p style="font-family: var(--font-label); color: var(--text-secondary); font-size: 13px;">${aw.desc}</p>
            </div>`).join('');
    }
}

function renderTeacherAwards(searchTerm = '') {
    const list = document.getElementById('teacher-awards-list');
    if (!list) return;
    const lowerSearch = searchTerm.toLowerCase();
    const filtered = appData.achievements.filter(aw => aw.title.toLowerCase().includes(lowerSearch) || getStudentName(aw.studentId).toLowerCase().includes(lowerSearch));
    if (filtered.length === 0) {
        list.innerHTML = '<div class="empty-state" style="grid-column: 1 / -1;">No achievements found in database.</div>';
    } else {
        list.innerHTML = filtered.map(aw => `
            <div class="grid-card">
                <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                    <span class="badge badge-award" style="width: fit-content;">Verified</span>
                    <span style="font-size:12px; font-weight:600; color:var(--neutral-dark); background:var(--surface-variant); padding:4px 8px; border-radius:4px;">${getStudentName(aw.studentId)}</span>
                </div>
                <h4 style="font-family: var(--font-display); font-size: 16px; margin: 12px 0 8px 0;">${aw.title}</h4>
                <p style="font-family: var(--font-label); color: var(--text-secondary); font-size: 13px;">${aw.desc}</p>
            </div>`).join('');
    }
}

// Attendance
function loadAttendance() {
    const date = document.getElementById('attendance-date')?.value;
    const list = document.getElementById('attendance-list');
    if (!date || !list) return;
    list.innerHTML = '';
    const dayRecords = appData.attendance[date] || {};
    appData.students.forEach(student => {
        const status = dayRecords[student.id] || '';
        const isPres = status === 'present' ? 'checked' : '';
        const isAuth = status === 'auth_absent' ? 'checked' : '';
        const isUnauth = status === 'unauth_absent' ? 'checked' : '';
        list.innerHTML += `
            <div class="item-card" style="padding: 16px 24px; margin-bottom: 12px; display:flex; justify-content:space-between; align-items:center;">
                <div style="font-family:var(--font-display); font-weight: 600; font-size: 15px;">${student.name}</div>
                <div style="display: flex; gap: 8px;">
                    <label><input type="radio" name="att_${student.id}" value="present" class="att-radio" ${isPres}><div class="att-label">Present</div></label>
                    <label><input type="radio" name="att_${student.id}" value="auth_absent" class="att-radio" ${isAuth}><div class="att-label">Auth. Absent</div></label>
                    <label><input type="radio" name="att_${student.id}" value="unauth_absent" class="att-radio" ${isUnauth}><div class="att-label">Unauth. Absent</div></label>
                </div>
            </div>`;
    });
    generateReportText();
}

function saveAttendance() {
    const date = document.getElementById('attendance-date').value;
    if (!date) return;
    const dayRecord = {};
    appData.students.forEach(student => {
        const radios = document.getElementsByName(`att_${student.id}`);
        radios.forEach(r => { if (r.checked) dayRecord[student.id] = r.value; });
    });
    appData.attendance[date] = dayRecord;
    saveData(); generateReportText(); renderAttendanceDashboard();
    renderParentProgress(); // Refresh parent view too
}

function generateReportText() {
    const date = document.getElementById('attendance-date')?.value;
    const textEl = document.getElementById('attendance-report-text');
    if (!textEl || !date) return;
    const dayRecord = appData.attendance[date] || {};
    let pCount = 0, aAuthCount = 0, aUnauthCount = 0;
    let aAuthNames = [], aUnauthNames = [];
    appData.students.forEach(student => {
        const status = dayRecord[student.id];
        if (status === 'present') pCount++;
        else if (status === 'auth_absent') { aAuthCount++; aAuthNames.push(student.name); }
        else if (status === 'unauth_absent') { aUnauthCount++; aUnauthNames.push(student.name); }
    });
    if (pCount === 0 && aAuthCount === 0 && aUnauthCount === 0) { textEl.innerText = 'No data logged for this date.'; return; }
    let report = `📊 Daily Attendance Report\n📅 Date: ${date}\n🏫 Class: Grade 12 Physics\n\n`;
    report += `✅ Present: ${pCount}\n⚠️ Auth Absent: ${aAuthCount}\n❌ Unauth Absent: ${aUnauthCount}\n`;
    if (aAuthCount > 0) { report += `\nAuthorized Absences:\n`; aAuthNames.forEach(n => { report += `- ${n}\n`; }); }
    if (aUnauthCount > 0) { report += `\nUnauthorized Absences (ACTION REQ):\n`; aUnauthNames.forEach(n => { report += `- ${n}\n`; }); }
    textEl.innerText = report;
}

function copyReport() {
    navigator.clipboard.writeText(document.getElementById('attendance-report-text').innerText)
        .then(() => alert('Report copied to clipboard!'))
        .catch(() => alert('Select and copy manually.'));
}

function renderAttendanceDashboard() {
    const chartContainer = document.getElementById('attendance-trend-chart');
    const insightsContainer = document.getElementById('attendance-insights');
    if (!chartContainer || !insightsContainer) return;
    const dates = Object.keys(appData.attendance).sort().slice(-5);
    chartContainer.innerHTML = '';
    let perfectStudents = [...appData.students], worstStudent = { id: null, unauth: 0 };
    let studentAbsences = {}; appData.students.forEach(s => studentAbsences[s.id] = 0);
    dates.forEach(date => {
        const record = appData.attendance[date];
        let dailyPresent = 0, dailyTotal = 0;
        appData.students.forEach(s => {
            if (record[s.id]) dailyTotal++;
            if (record[s.id] === 'present') dailyPresent++;
            else {
                perfectStudents = perfectStudents.filter(ps => ps.id !== s.id);
                if (record[s.id] === 'unauth_absent') {
                    studentAbsences[s.id]++;
                    if (studentAbsences[s.id] > worstStudent.unauth) worstStudent = { id: s.id, unauth: studentAbsences[s.id] };
                }
            }
        });
        const pct = dailyTotal > 0 ? (dailyPresent / dailyTotal) * 100 : 0;
        const isBad = pct < 75;
        const shortDate = date.split('-').slice(1).join('/');
        chartContainer.innerHTML += `
            <div class="chart-bar-group">
                <div class="bar-wrap"><div class="bar-fill ${isBad ? 'bad' : ''}" style="height: ${pct}%;"></div></div>
                <span class="bar-label">${shortDate}</span>
            </div>`;
    });
    insightsContainer.innerHTML = '';
    if (perfectStudents.length > 0) {
        insightsContainer.innerHTML += `<div class="insight-item"><span class="insight-icon good">●</span><span><b>Perfect Record:</b> ${perfectStudents[0].name} ${perfectStudents.length > 1 ? `& ${perfectStudents.length - 1} more` : ''} present all week.</span></div>`;
    }
    if (worstStudent.unauth > 0) {
        insightsContainer.innerHTML += `<div class="insight-item"><span class="insight-icon bad">●</span><span><b>Action Req:</b> ${getStudentName(worstStudent.id)} has ${worstStudent.unauth} recent unauthorized absences.</span></div>`;
    }
    if (insightsContainer.innerHTML === '') insightsContainer.innerHTML = '<div class="insight-item">No significant anomalies detected.</div>';
}

function renderAdminPanel() {
    const list = document.getElementById('admin-student-list');
    if (!list) return;
    list.innerHTML = appData.students.map(s => `
        <div class="item-card">
            <div class="item-info">
                <span class="badge badge-system">Student User</span>
                <h4>${s.name}</h4>
                <p>ID: ${s.id} | Grade 12</p>
            </div>
            <button class="btn-secondary btn-primary">Manage</button>
        </div>`).join('');
}

// =============================================
// HOLISTIC DEVELOPMENT HUB — RENDER FUNCTIONS
// =============================================

const HUB_IMAGES = {
    'Photography Club Registration': 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=600&auto=format&fit=crop&q=80',
    'Counselling Session — Exam Stress Management': 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=600&auto=format&fit=crop&q=80',
    'STEM Summer Research Programme 2026': 'https://images.unsplash.com/photo-1532094349884-543bc11b234d?w=600&auto=format&fit=crop&q=80',
    'Environmental Volunteer Day': 'https://images.unsplash.com/photo-1530587191325-3db32d826c18?w=600&auto=format&fit=crop&q=80',
    'Student Leadership Summit': 'https://images.unsplash.com/photo-1515187029135-18ee286d815b?w=600&auto=format&fit=crop&q=80',
    'Counselling Appointment': 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=600&auto=format&fit=crop&q=80',
    'Club Registration': 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=600&auto=format&fit=crop&q=80',
    'Summer Programme': 'https://images.unsplash.com/photo-1532094349884-543bc11b234d?w=600&auto=format&fit=crop&q=80',
    'Workshop': 'https://images.unsplash.com/photo-1531482615713-2afd69097998?w=600&auto=format&fit=crop&q=80',
    'Event': 'https://images.unsplash.com/photo-1511578314322-379afb476865?w=600&auto=format&fit=crop&q=80',
    'Volunteer Opportunity': 'https://images.unsplash.com/photo-1530587191325-3db32d826c18?w=600&auto=format&fit=crop&q=80',
    'Leadership Programme': 'https://images.unsplash.com/photo-1515187029135-18ee286d815b?w=600&auto=format&fit=crop&q=80'
};

function getHubCardImage(act) {
    return HUB_IMAGES[act.title] || HUB_IMAGES[act.type] || 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=600&auto=format&fit=crop&q=80';
}

function getYouTubeId(url) {
    if (!url) return '';
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : '';
}

function getYouTubeThumbnail(videoId) {
    return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
}

function renderHubMedia(act) {
    const ytId = getYouTubeId(act.videoUrl);
    const imageUrl = getHubCardImage(act);
    const hasVideo = !!ytId;
    
    let mediaHTML = `<div class="hub-card-media">
        <img src="${imageUrl}" alt="${act.title}">`;
    if (hasVideo) {
        mediaHTML += `
        <div class="video-play-overlay" onclick="openVideoModal('${act.id}', event)">
            <div class="play-btn-circle">
                ${getSvg('video_play')}
            </div>
        </div>`;
    }
    mediaHTML += `</div>`;
    return mediaHTML;
}

function openVideoModal(actId, event) {
    if (event) event.stopPropagation();
    const act = appData.hubActivities.find(a => a.id === actId);
    if (!act) return;
    
    document.getElementById('video-modal-title-display').innerText = act.type;
    document.getElementById('video-modal-title-body').innerText = act.title;
    document.getElementById('video-modal-desc-body').innerText = act.description;
    
    // Choose appropriate MP4 video
    let mp4Url = 'https://assets.mixkit.co/videos/preview/mixkit-students-walking-in-a-university-campus-41583-large.mp4';
    if (act.type === 'Counselling Appointment' || act.title.toLowerCase().includes('stress')) {
        mp4Url = 'https://assets.mixkit.co/videos/preview/mixkit-woman-meditating-by-the-sea-41584-large.mp4';
    } else if (act.type === 'Summer Programme' || act.type === 'Club Registration' || act.title.toLowerCase().includes('stem')) {
        mp4Url = 'https://assets.mixkit.co/videos/preview/mixkit-science-laboratory-with-chemical-glassware-40242-large.mp4';
    }
    
    const mediaDisplay = document.getElementById('video-modal-media-display');
    mediaDisplay.innerHTML = `
        <video controls autoplay muted style="width:100%; height:100%; border-radius:8px;">
            <source src="${mp4Url}" type="video/mp4">
            Your browser does not support the video tag.
        </video>`;
        
    const actionsDisplay = document.getElementById('video-modal-actions-display');
    if (act.videoUrl) {
        actionsDisplay.innerHTML = `
            <a href="${act.videoUrl}" target="_blank" class="btn-primary" style="display:inline-flex; align-items:center; gap:8px; text-decoration:none; padding:10px 20px; font-size:13px; font-weight:600; border-radius:8px;">
                Watch on YouTube
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:14px; height:14px;"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
            </a>`;
    } else {
        actionsDisplay.innerHTML = '';
    }
    
    openModal('videoPlayerModal');
}

function closeVideoModal() {
    const mediaDisplay = document.getElementById('video-modal-media-display');
    if (mediaDisplay) mediaDisplay.innerHTML = '';
    closeModal('videoPlayerModal');
}

function getHubTypeIcon(type) {
    const key = HUB_TYPE_ICONS[type] || 'event';
    return getSvg(key);
}

// Student Hub
function renderStudentHub() {
    const list = document.getElementById('student-hub-list');
    if (!list) return;
    const filterVal = document.getElementById('student-hub-filter')?.value || '';
    let activities = appData.hubActivities;
    if (filterVal) activities = activities.filter(a => a.type === filterVal);

    if (activities.length === 0) {
        list.innerHTML = '<div class="empty-state" style="grid-column:1/-1;">No activities available right now. Check back soon!</div>';
        return;
    }

    list.innerHTML = activities.map(act => {
        const isEnrolled = act.enrolledStudentIds.includes(currentStudentId);
        const mediaHTML = renderHubMedia(act);
        const fileHTML = act.attachedFileName
            ? `<span class="badge badge-system" style="margin:0; font-size:11px; display:inline-flex; align-items:center; gap:4px;">${getSvg('attachment')} ${act.attachedFileName}</span>` : '';
        const enrollBtnClass = isEnrolled ? 'btn-enrolled btn-primary' : 'btn-hub btn-primary';
        const enrollBtnText = isEnrolled ? '✓ Enrolled' : 'Register / Apply';

        return `
        <div class="hub-card ${isEnrolled ? 'enrolled' : ''}">
            ${mediaHTML}
            <div class="hub-card-body">
                <div class="hub-card-meta">
                    <span class="badge badge-hub" style="margin:0;">${act.type}</span>
                    ${isEnrolled ? '<span class="badge badge-hub-enrolled" style="margin:0;">Enrolled</span>' : ''}
                </div>
                <div class="hub-card-title">${act.title}</div>
                <div class="hub-card-desc">${act.description}</div>
                <div class="hub-card-meta">
                    <span class="hub-card-date">${getSvg('date')} ${formatDate(act.date)}</span>
                    ${fileHTML}
                </div>
            </div>
            <div class="hub-card-footer">
                <span class="hub-card-enroll-count">${act.enrolledStudentIds.length} enrolled</span>
                <button class="${enrollBtnClass}" onclick="toggleHubEnrollment('${act.id}')">${enrollBtnText}</button>
            </div>
        </div>`;
    }).join('');
}

function toggleHubEnrollment(actId) {
    const act = appData.hubActivities.find(a => a.id === actId);
    if (!act) return;
    const idx = act.enrolledStudentIds.indexOf(currentStudentId);
    if (idx >= 0) {
        act.enrolledStudentIds.splice(idx, 1);
    } else {
        act.enrolledStudentIds.push(currentStudentId);
    }
    saveData();
    renderStudentHub();
    renderTeacherHub();
    renderAdminHub();
    renderParentHub();
}

// Teacher Hub
function renderTeacherHub() {
    const list = document.getElementById('teacher-hub-list');
    if (!list) return;
    if (appData.hubActivities.length === 0) {
        list.innerHTML = '<div class="empty-state">No activities created yet. Click "+ Create Activity" to get started.</div>';
        return;
    }
    list.innerHTML = appData.hubActivities.map(act => {
        const icon = getHubTypeIcon(act.type);
        const enrolledNames = act.enrolledStudentIds.map(id => getStudentName(id));
        const rosterHTML = enrolledNames.length > 0
            ? `<div class="roster-list">${enrolledNames.map(n => `<span class="roster-chip">${n}</span>`).join('')}</div>`
            : `<p style="font-size:12px;color:var(--text-secondary);margin-top:4px;">No registrations yet.</p>`;

        return `
        <div class="hub-list-item">
            <div class="hub-type-icon">${icon}</div>
            <div class="hub-list-item-info">
                <h4>${act.title}</h4>
                <p style="margin-bottom:6px; font-size:13px; color:var(--text-secondary);">
                    <span>${act.type}</span> &middot; 
                    <span style="display:inline-flex; align-items:center; gap:3px; vertical-align:middle;">${getSvg('date')}${formatDate(act.date)}</span> &middot; 
                    <span>Target: ${act.targetGrades.join(', ')}</span>
                </p>
                ${rosterHTML}
            </div>
            <div class="hub-list-item-stats">
                <span class="hub-stat-chip">${act.enrolledStudentIds.length} enrolled</span>
                <button class="action-btn" style="font-size:12px;" onclick="deleteHubActivity('${act.id}')">Remove</button>
            </div>
        </div>`;
    }).join('');
}

function deleteHubActivity(actId) {
    if (!confirm('Remove this activity from the Hub?')) return;
    appData.hubActivities = appData.hubActivities.filter(a => a.id !== actId);
    saveData();
    renderTeacherHub(); renderStudentHub(); renderAdminHub(); renderParentHub();
}

// Admin Hub
function renderAdminHub() {
    const list = document.getElementById('admin-hub-list');
    if (!list) return;
    if (appData.hubActivities.length === 0) {
        list.innerHTML = '<div class="empty-state">No activities published yet.</div>';
        return;
    }
    list.innerHTML = appData.hubActivities.map(act => {
        const icon = getHubTypeIcon(act.type);
        const enrolledNames = act.enrolledStudentIds.map(id => getStudentName(id));
        const rosterHTML = enrolledNames.length > 0
            ? `<div class="roster-list">${enrolledNames.map(n => `<span class="roster-chip">${n}</span>`).join('')}</div>`
            : `<p style="font-size:12px;color:var(--text-secondary);margin-top:4px;">No registrations.</p>`;
        return `
        <div class="hub-list-item">
            <div class="hub-type-icon">${icon}</div>
            <div class="hub-list-item-info">
                <h4>${act.title}</h4>
                <p style="margin-bottom:6px; font-size:13px; color:var(--text-secondary);">
                    <span>${act.type}</span> &middot; 
                    <span style="display:inline-flex; align-items:center; gap:3px; vertical-align:middle;">${getSvg('date')}${formatDate(act.date)}</span> &middot; 
                    <span>Target: ${act.targetGrades.join(', ')}</span>
                </p>
                <p style="font-size:12px;font-weight:600;color:var(--text-secondary);margin-bottom:4px;">Participants:</p>
                ${rosterHTML}
            </div>
            <div class="hub-list-item-stats">
                <span class="hub-stat-chip">${act.enrolledStudentIds.length} / ${appData.students.length}</span>
            </div>
        </div>`;
    }).join('');
}

// =============================================
// PARENT DASHBOARD — RENDER FUNCTIONS
// =============================================

function renderParentProgress() {
    // Attendance stats for current child
    const dates = Object.keys(appData.attendance).sort().slice(-5);
    let presentCount = 0, absentCount = 0;
    dates.forEach(date => {
        const record = appData.attendance[date] || {};
        const status = record[currentParentChildId];
        if (status === 'present') presentCount++;
        else if (status) absentCount++;
    });

    const presentEl = document.getElementById('parent-present-count');
    const absentEl = document.getElementById('parent-absent-count');
    const syllabusEl = document.getElementById('parent-syllabus-pct');
    if (presentEl) presentEl.innerText = presentCount;
    if (absentEl) absentEl.innerText = absentCount;

    // Syllabus %
    let total = 0, tDone = 0;
    appData.syllabus.forEach(term => term.topics.forEach(topic => { total++; if (topic.teacherChecked) tDone++; }));
    const tPct = total > 0 ? Math.round((tDone / total) * 100) : 0;
    if (syllabusEl) syllabusEl.innerText = tPct + '%';

    // Attendance log
    const logEl = document.getElementById('parent-attendance-log');
    if (logEl) {
        if (dates.length === 0) {
            logEl.innerHTML = '<div class="empty-state">No attendance records available.</div>';
        } else {
            logEl.innerHTML = dates.map(date => {
                const record = appData.attendance[date] || {};
                const status = record[currentParentChildId] || 'not recorded';
                let badgeClass = 'badge-system';
                let label = 'Not Recorded';
                if (status === 'present') { badgeClass = ''; label = 'Present'; }
                else if (status === 'auth_absent') { badgeClass = 'badge-pending'; label = 'Auth. Absent'; }
                else if (status === 'unauth_absent') { badgeClass = ''; label = 'Unauth. Absent'; }
                const color = status === 'present' ? 'var(--doc-submitted)' : status === 'auth_absent' ? 'var(--doc-pending)' : status === 'unauth_absent' ? 'var(--primary)' : 'var(--text-secondary)';
                return `
                <div class="item-card" style="margin-bottom:10px;">
                    <span style="font-family:var(--font-display); font-weight:600; font-size:14px;">📅 ${formatDate(date)}</span>
                    <span style="font-size:13px; font-weight:700; color:${color};">${label}</span>
                </div>`;
            }).join('');
        }
    }

    // Syllabus detail
    const sylEl = document.getElementById('parent-syllabus-detail');
    if (sylEl) {
        if (appData.syllabus.length === 0) {
            sylEl.innerHTML = '<div class="empty-state">No syllabus data available.</div>';
        } else {
            sylEl.innerHTML = appData.syllabus.map(term => {
                const termTotal = term.topics.length;
                const termDone = term.topics.filter(t => t.teacherChecked).length;
                const pct = termTotal > 0 ? Math.round((termDone / termTotal) * 100) : 0;
                return `
                <div>
                    <div class="progress-header">
                        <p class="progress-label">${term.name} (${termDone}/${termTotal} topics covered)</p>
                        <span class="progress-value">${pct}%</span>
                    </div>
                    <div class="progress-track"><div class="progress-fill fill-parent" style="width:${pct}%;"></div></div>
                </div>`;
            }).join('');
        }
    }
}

// Parent documents
const REQUIRED_DOC_TYPES = [
    { type: 'Student ID', iconKey: 'id_card', desc: 'A clear photo of the student\'s ID card or government-issued photo ID.' },
    { type: 'Admission Form', iconKey: 'admission', desc: 'Completed and signed school admission form.' },
    { type: 'Medical Form', iconKey: 'medical', desc: 'Student health declaration and immunization records.' },
    { type: 'Consent Letter', iconKey: 'consent', desc: 'General parental consent letter for school activities.' },
    { type: 'Permission Slip — Field Trip', iconKey: 'permission', desc: 'Signed permission slip for upcoming field trips.' },
    { type: 'Emergency Contact Form', iconKey: 'emergency', desc: 'Emergency contact details and medical alerts.' }
];

function renderParentDocuments() {
    const grid = document.getElementById('parent-doc-grid');
    if (!grid) return;

    grid.innerHTML = REQUIRED_DOC_TYPES.map(docDef => {
        const existing = appData.parentDocuments.find(d => d.studentId === currentParentChildId && d.docType === docDef.type);
        const isSubmitted = existing && existing.status === 'submitted';
        const statusClass = isSubmitted ? 'status-submitted' : 'status-pending';
        const badgeClass = isSubmitted ? 'badge-submitted' : 'badge-pending';
        const badgeText = isSubmitted ? '✓ Submitted' : '⏳ Pending';
        const fileInfo = isSubmitted
            ? `<div class="doc-filename" style="display:inline-flex; align-items:center; gap:4px;">${getSvg('attachment')} ${existing.fileName}</div>`
            : `<div class="doc-upload-area" onclick="triggerDocUpload('${docDef.type}')">Click to upload file<br><span style="font-size:11px;">PDF, JPG, PNG accepted</span></div>`;

        return `
        <div class="doc-card ${statusClass}" id="doc-card-${docDef.type.replace(/[^a-zA-Z0-9]/g,'_')}">
            <div style="display:flex; align-items:center; justify-content:space-between;">
                <div class="doc-card-icon">${getSvg(docDef.iconKey)}</div>
                <span class="badge ${badgeClass}" style="margin:0;">${badgeText}</span>
            </div>
            <div>
                <div class="doc-card-title">${docDef.type}</div>
                <div class="doc-card-subtitle">${docDef.desc}</div>
            </div>
            ${fileInfo}
            ${isSubmitted ? `<button class="action-btn" style="font-size:12px;" onclick="removeDoc('${docDef.type}')">Replace File</button>` : ''}
        </div>`;
    }).join('');
}

function triggerDocUpload(docType) {
    // Create a temporary file input
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf,.jpg,.jpeg,.png';
    input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        // Simulate upload: update or insert doc record
        const existing = appData.parentDocuments.find(d => d.studentId === currentParentChildId && d.docType === docType);
        const today = new Date().toISOString().split('T')[0];
        if (existing) {
            existing.status = 'submitted';
            existing.fileName = file.name;
            existing.uploadedAt = today;
        } else {
            appData.parentDocuments.push({
                id: 'doc_' + Date.now(),
                studentId: currentParentChildId,
                docType,
                status: 'submitted',
                fileName: file.name,
                uploadedAt: today
            });
        }
        saveData();
        renderParentDocuments();
        renderAdminDocuments();
    };
    input.click();
}

function removeDoc(docType) {
    const existing = appData.parentDocuments.find(d => d.studentId === currentParentChildId && d.docType === docType);
    if (existing) {
        existing.status = 'pending';
        existing.fileName = '';
        existing.uploadedAt = '';
        saveData();
        renderParentDocuments();
        renderAdminDocuments();
    }
}

// Parent Hub (read-only)
function renderParentHub() {
    const list = document.getElementById('parent-hub-list');
    if (!list) return;
    if (appData.hubActivities.length === 0) {
        list.innerHTML = '<div class="empty-state" style="grid-column:1/-1;">No school activities published yet.</div>';
        return;
    }
    list.innerHTML = appData.hubActivities.map(act => {
        const isEnrolled = act.enrolledStudentIds.includes(currentParentChildId);
        const mediaHTML = renderHubMedia(act);

        return `
        <div class="hub-card ${isEnrolled ? 'enrolled' : ''}">
            ${mediaHTML}
            <div class="hub-card-body">
                <div class="hub-card-meta">
                    <span class="badge badge-hub" style="margin:0;">${act.type}</span>
                    ${isEnrolled ? '<span class="badge badge-hub-enrolled" style="margin:0;">Child Enrolled</span>' : ''}
                </div>
                <div class="hub-card-title">${act.title}</div>
                <div class="hub-card-desc">${act.description}</div>
                <div class="hub-card-meta">
                    <span class="hub-card-date">${getSvg('date')} ${formatDate(act.date)}</span>
                    <span style="font-size:12px;color:var(--text-secondary);">Grades: ${act.targetGrades.join(', ')}</span>
                </div>
            </div>
            <div class="hub-card-footer">
                <span class="hub-card-enroll-count">${act.enrolledStudentIds.length} students enrolled</span>
                <span style="font-size:12px;font-weight:600;color:${isEnrolled ? 'var(--doc-submitted)' : 'var(--text-secondary)'};">${isEnrolled ? '✓ Your child is registered' : 'Not registered'}</span>
            </div>
        </div>`;
    }).join('');
}

// Admin Documents
function populateAdminDocFilter() {
    const select = document.getElementById('admin-doc-filter');
    if (!select) return;
    select.innerHTML = '<option value="">All Students</option>';
    appData.students.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s.id; opt.innerText = s.name; select.appendChild(opt);
    });
}

function renderAdminDocuments() {
    const list = document.getElementById('admin-doc-list');
    if (!list) return;
    const filterStudent = document.getElementById('admin-doc-filter')?.value || '';

    let docs = appData.parentDocuments;
    if (filterStudent) docs = docs.filter(d => d.studentId === filterStudent);

    if (docs.length === 0) {
        list.innerHTML = '<div class="empty-state">No documents submitted yet.</div>';
        return;
    }

    list.innerHTML = docs.map(doc => {
        const student = appData.students.find(s => s.id === doc.studentId);
        const isSubmitted = doc.status === 'submitted';
        return `
        <div class="item-card">
            <div class="item-info">
                <span class="badge ${isSubmitted ? 'badge-submitted' : 'badge-pending'}" style="margin-bottom:8px;">${isSubmitted ? '✓ Submitted' : '⏳ Pending'}</span>
                <h4>${doc.docType}</h4>
                <p>Student: ${student ? student.name : 'Unknown'} ${isSubmitted ? '· File: ' + doc.fileName + ' · Uploaded: ' + doc.uploadedAt : '· Awaiting upload from parent'}</p>
            </div>
            ${isSubmitted ? `<button class="btn-secondary btn-primary" style="font-size:13px;">View File</button>` : '<span style="font-size:12px;font-weight:600;color:var(--doc-pending);">Pending</span>'}
        </div>`;
    }).join('');
}

// =============================================
// FORM SUBMISSIONS
// =============================================
document.getElementById('form-add-term')?.addEventListener('submit', e => {
    e.preventDefault();
    appData.syllabus.push({ id: 'term_' + Date.now(), name: document.getElementById('term-name-input').value, topics: [] });
    saveData(); renderSyllabus(); closeModal('addTermModal'); document.getElementById('term-name-input').value = '';
});

document.getElementById('form-add-topic')?.addEventListener('submit', e => {
    e.preventDefault();
    const termId = document.getElementById('topic-term-select').value;
    const term = appData.syllabus.find(t => t.id === termId);
    if (term) {
        term.topics.push({ id: 'topic_' + Date.now(), title: document.getElementById('topic-title-input').value, teacherChecked: false, studentChecked: false });
        saveData(); renderSyllabus();
    }
    closeModal('addTopicModal'); document.getElementById('topic-title-input').value = '';
});

document.getElementById('form-create-assignment')?.addEventListener('submit', e => {
    e.preventDefault();
    appData.assignments.push({ id: 'ass_' + Date.now(), title: document.getElementById('assignment-title-input').value });
    saveData(); renderTests(); closeModal('createAssignmentModal'); document.getElementById('form-create-assignment').reset();
});

document.getElementById('form-create-test')?.addEventListener('submit', e => {
    e.preventDefault();
    appData.tests.push({ id: 'test_' + Date.now(), title: document.getElementById('test-title-input').value });
    saveData(); renderTests(); closeModal('createTestModal'); document.getElementById('form-create-test').reset();
});

document.getElementById('form-add-award')?.addEventListener('submit', e => {
    e.preventDefault();
    appData.achievements.push({
        id: 'aw_' + Date.now(), studentId: currentStudentId,
        title: document.getElementById('award-title-input').value,
        desc: document.getElementById('award-desc-input').value
    });
    saveData(); renderStudentAwards(); renderTeacherAwards();
    closeModal('addAwardModal'); document.getElementById('form-add-award').reset();
});

document.getElementById('form-create-hub')?.addEventListener('submit', e => {
    e.preventDefault();
    const grades = [...document.querySelectorAll('input[name="hub-grade"]:checked')].map(cb => cb.value);
    const videoRaw = document.getElementById('hub-video-input').value.trim();
    const fileName = document.getElementById('hub-file-input').files[0]?.name || '';

    appData.hubActivities.push({
        id: 'hub_' + Date.now(),
        title: document.getElementById('hub-title-input').value,
        type: document.getElementById('hub-type-input').value,
        description: document.getElementById('hub-desc-input').value,
        date: document.getElementById('hub-date-input').value,
        videoUrl: videoRaw,
        attachedFileName: fileName,
        targetGrades: grades.length > 0 ? grades : ['All Grades'],
        enrolledStudentIds: [],
        createdBy: 'teacher'
    });
    saveData();
    renderTeacherHub(); renderStudentHub(); renderAdminHub(); renderParentHub();
    closeModal('createHubActivityModal');
    document.getElementById('form-create-hub').reset();
    document.getElementById('hub-file-name').innerHTML = '';
});

function handleHubFileSelect(input) {
    const fileNameEl = document.getElementById('hub-file-name');
    if (input.files[0] && fileNameEl) {
        fileNameEl.innerHTML = `<span class="doc-filename">📎 ${input.files[0].name}</span>`;
    }
}

// =============================================
// VIEW ROUTING
// =============================================
function selectRole(role, index, btn) {
    document.querySelectorAll('.role-toggle-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('roleSlider').style.transform = `translateX(calc(${index * 100}%))`;
    document.getElementById('selectedRole').value = role;
}

document.getElementById('login-form').addEventListener('submit', e => {
    e.preventDefault();
    const role = document.getElementById('selectedRole').value;
    localStorage.setItem('woodlem_active_role', role);
    document.querySelectorAll('.view-container').forEach(el => el.classList.remove('active'));
    const view = document.getElementById(role + '-view');
    if (view) view.classList.add('active');
    document.getElementById('password').value = '';
    // Refresh parent data on login
    if (role === 'parent') { renderParentProgress(); renderParentDocuments(); renderParentHub(); }
});

function logout() {
    localStorage.removeItem('woodlem_active_role');
    document.querySelectorAll('.view-container').forEach(el => el.classList.remove('active'));
    document.getElementById('login-view').classList.add('active');
}

function switchTab(role, tabId, element) {
    if (!element) return;
    const tabContainer = element.parentElement;
    tabContainer.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    element.classList.add('active');
    const parentScope = document.getElementById(role + '-view');
    parentScope.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    const targetContent = document.getElementById(role + '-content-' + tabId);
    if (targetContent) targetContent.classList.add('active');
}

function switchSubject(role, titleText, element) {
    const navContainer = document.getElementById(role + '-nav');
    if (navContainer) navContainer.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    element.classList.add('active');
    const titleEl = document.getElementById(role + '-page-title');
    if (titleEl) titleEl.innerText = titleText;
}

function openAddTopicModal(termId) {
    openModal('addTopicModal');
    const select = document.getElementById('topic-term-select');
    if (select && termId) select.value = termId;
}

function openModal(modalId) { document.getElementById(modalId)?.classList.add('active'); }
function closeModal(modalId) { document.getElementById(modalId)?.classList.remove('active'); }
window.onclick = e => {
    if (e.target.classList.contains('modal-overlay')) {
        if (e.target.id === 'videoPlayerModal') {
            closeVideoModal();
        } else {
            e.target.classList.remove('active');
        }
    }
};

// =============================================
// UTILITY
// =============================================
function formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}