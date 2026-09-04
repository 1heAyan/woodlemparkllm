import { UserProfile, SubjectClass, TestItem, SyllabusTerm, HubActivity } from './supabaseClient';
import { TestResultRecord } from '@/components/Modals/ReviewTestResultsModal';

export interface ScoreBracket {
  gradeLetter: string;
  label: string;
  range: string;
  count: number;
  percentage: number;
  color: string;
  bg: string;
  border: string;
}

export interface SubjectMastery {
  subject: string;
  averageScore: number;
  highestScore: number;
  lowestScore: number;
  totalAssessed: number;
  passRate: number;
  color: string;
  gradeBreakdown: Record<string, number>; // '9': 82, '10': 78, etc.
}

export interface AttendanceDayTrend {
  date: string;
  dayLabel: string;
  presentPct: number;
  authAbsentPct: number;
  unauthAbsentPct: number;
  totalStudents: number;
}

export interface SyllabusDepartmentProgress {
  department: string;
  totalTopics: number;
  completedTopics: number;
  percentage: number;
  status: 'on_track' | 'ahead' | 'needs_attention';
  color: string;
}

export interface MarkComplianceSummary {
  totalClasses: number;
  fullyGradedClasses: number;
  inProgressClasses: number;
  pendingClasses: number;
  complianceRate: number;
  pendingList: {
    className: string;
    subject: string;
    teacherName: string;
    unenteredCount: number;
  }[];
}

export interface AtRiskStudent {
  id: string;
  name: string;
  grade: string;
  classLetter: string;
  admissionNumber: string;
  averageScore: number;
  attendanceRate: number;
  concernFactors: string[];
}

export interface DistinctionStudent {
  id: string;
  name: string;
  grade: string;
  classLetter: string;
  admissionNumber: string;
  averageScore: number;
  topSubject: string;
  rank: number;
}

export interface ExecutiveAnalyticsData {
  schoolHealthIndex: number;
  totalEnrollment: number;
  overallAverageScore: number;
  overallAttendanceRate: number;
  overallSyllabusProgress: number;
  scoreDistribution: ScoreBracket[];
  subjectMasteryList: SubjectMastery[];
  attendanceTrends: AttendanceDayTrend[];
  syllabusProgressByDept: SyllabusDepartmentProgress[];
  markCompliance: MarkComplianceSummary;
  atRiskStudents: AtRiskStudent[];
  distinctionStudents: DistinctionStudent[];
  gradeComparison: {
    grade: string;
    studentCount: number;
    avgScore: number;
    attendanceRate: number;
    syllabusPct: number;
  }[];
}

const DEFAULT_SUBJECT_COLORS: Record<string, string> = {
  Physics: '#2C6E6A',
  Chemistry: '#3D7A6E',
  Biology: '#4CAF7D',
  Math: '#7C5CBF',
  Mathematics: '#7C5CBF',
  English: '#B37D4A',
  'Computer Science': '#0D9488',
  'Artificial Intelligence': '#0284C7',
  AI: '#0284C7',
  History: '#2B5B75',
  Geography: '#D97706',
  'Islamic Studies': '#059669',
  'Physical Education': '#E11D48',
  'Art & Design': '#D946EF',
};

// Compute pure dynamic analytics strictly from actual LMS database state
export function computeExecutiveAnalytics({
  profiles,
  subjectClasses,
  tests,
  syllabus,
  attendance,
  testResults,
  selectedGradeFilter = 'all',
}: {
  profiles: UserProfile[];
  subjectClasses: SubjectClass[];
  tests: TestItem[];
  syllabus: SyllabusTerm[];
  attendance: Record<string, Record<string, string>>;
  testResults?: Record<string, TestResultRecord>;
  selectedGradeFilter?: string; // 'all' | '9' | '10' | '11' | '12'
}): ExecutiveAnalyticsData {
  // 1. Filter students according to grade filter
  const allStudents = profiles.filter((p) => p.role === 'student');
  const filteredStudents = allStudents.filter((st) => {
    if (selectedGradeFilter === 'all') return true;
    const cleanG = (st.grade || '').replace(/[^0-9]/g, '');
    return cleanG === selectedGradeFilter;
  });

  const totalEnrollment = filteredStudents.length;

  // 2. Extract REAL test scores strictly from testResults
  const studentScores: { studentId: string; student: UserProfile; score: number; subject: string }[] = [];
  const studentScoreMap = new Map<string, number[]>();

  if (testResults && Object.keys(testResults).length > 0) {
    Object.values(testResults).forEach((tr: any) => {
      if (!tr || !tr.student_id) return;
      const st = profiles.find((p) => p.id === tr.student_id);
      if (st) {
        const cleanG = (st.grade || '').replace(/[^0-9]/g, '');
        if (selectedGradeFilter === 'all' || cleanG === selectedGradeFilter) {
          const scoreVal = typeof tr.score === 'number' ? tr.score : null;
          if (scoreVal !== null) {
            const pct = Math.min(100, Math.max(0, Math.round(scoreVal)));
            const testObj = (tests || []).find((t) => t.id === tr.test_id);
            studentScores.push({
              studentId: tr.student_id,
              student: st,
              score: pct,
              subject: testObj?.title || 'General Assessment',
            });
            const existing = studentScoreMap.get(st.id) || [];
            existing.push(pct);
            studentScoreMap.set(st.id, existing);
          }
        }
      }
    });
  }

  // Calculate real score brackets
  const bracketCounts = { ap: 0, a: 0, b: 0, c: 0, d: 0, f: 0 };
  let scoreSum = 0;

  studentScores.forEach((item) => {
    scoreSum += item.score;
    if (item.score >= 90) bracketCounts.ap++;
    else if (item.score >= 80) bracketCounts.a++;
    else if (item.score >= 70) bracketCounts.b++;
    else if (item.score >= 60) bracketCounts.c++;
    else if (item.score >= 50) bracketCounts.d++;
    else bracketCounts.f++;
  });

  const totalScoreItems = studentScores.length;
  const overallAverageScore = totalScoreItems > 0 ? Math.round((scoreSum / totalScoreItems) * 10) / 10 : 0;

  const scoreDistribution: ScoreBracket[] = [
    {
      gradeLetter: 'A+',
      label: 'Outstanding',
      range: '90 - 100%',
      count: bracketCounts.ap,
      percentage: totalScoreItems > 0 ? Math.round((bracketCounts.ap / totalScoreItems) * 100) : 0,
      color: '#265E5A',
      bg: '#EAF3EF',
      border: '#C7E4D8',
    },
    {
      gradeLetter: 'A',
      label: 'Excellent',
      range: '80 - 89%',
      count: bracketCounts.a,
      percentage: totalScoreItems > 0 ? Math.round((bracketCounts.a / totalScoreItems) * 100) : 0,
      color: '#2C6E6A',
      bg: '#EDF5F2',
      border: '#C7E4D8',
    },
    {
      gradeLetter: 'B',
      label: 'Very Good',
      range: '70 - 79%',
      count: bracketCounts.b,
      percentage: totalScoreItems > 0 ? Math.round((bracketCounts.b / totalScoreItems) * 100) : 0,
      color: '#2B5B75',
      bg: '#EBF3F7',
      border: '#C8DCE5',
    },
    {
      gradeLetter: 'C',
      label: 'Good',
      range: '60 - 69%',
      count: bracketCounts.c,
      percentage: totalScoreItems > 0 ? Math.round((bracketCounts.c / totalScoreItems) * 100) : 0,
      color: '#9E6835',
      bg: '#FEF7EC',
      border: '#F3D9A0',
    },
    {
      gradeLetter: 'D',
      label: 'Pass',
      range: '50 - 59%',
      count: bracketCounts.d,
      percentage: totalScoreItems > 0 ? Math.round((bracketCounts.d / totalScoreItems) * 100) : 0,
      color: '#B37D4A',
      bg: '#FBF6F0',
      border: '#ECD8C3',
    },
    {
      gradeLetter: 'F',
      label: 'Needs Support',
      range: '< 50%',
      count: bracketCounts.f,
      percentage: totalScoreItems > 0 ? Math.round((bracketCounts.f / totalScoreItems) * 100) : 0,
      color: '#D9534F',
      bg: '#FDF1F0',
      border: '#F5C6CB',
    },
  ];

  // 3. Subject Mastery List (from real subjectClasses and test results)
  const uniqueSubjects = Array.from(
    new Set(
      subjectClasses
        .map((sc) => sc.subject)
        .filter(Boolean)
        .concat(studentScores.map((s) => s.subject))
    )
  );

  const subjectMasteryList: SubjectMastery[] = uniqueSubjects.map((sub) => {
    const matchingScores = studentScores.filter((s) => s.subject.toLowerCase() === sub.toLowerCase());
    const avg = matchingScores.length > 0
      ? matchingScores.reduce((acc, curr) => acc + curr.score, 0) / matchingScores.length
      : 0;
    const highest = matchingScores.length > 0 ? Math.max(...matchingScores.map((s) => s.score)) : 0;
    const lowest = matchingScores.length > 0 ? Math.min(...matchingScores.map((s) => s.score)) : 0;
    const passCount = matchingScores.filter((s) => s.score >= 50).length;
    const passRate = matchingScores.length > 0 ? Math.round((passCount / matchingScores.length) * 100) : 0;

    const gradeBreakdown: Record<string, number> = {};
    ['9', '10', '11', '12'].forEach((g) => {
      const gScores = matchingScores.filter((s) => (s.student.grade || '').replace(/[^0-9]/g, '') === g);
      gradeBreakdown[g] = gScores.length > 0
        ? Math.round(gScores.reduce((acc, curr) => acc + curr.score, 0) / gScores.length)
        : 0;
    });

    return {
      subject: sub,
      averageScore: Math.round(avg * 10) / 10,
      highestScore: highest,
      lowestScore: lowest,
      totalAssessed: matchingScores.length,
      passRate,
      color: DEFAULT_SUBJECT_COLORS[sub] || '#2C6E6A',
      gradeBreakdown,
    };
  });

  // 4. Attendance Dynamics (strictly from attendance prop)
  const attendanceDates = Object.keys(attendance || {}).sort();
  const attendanceTrends: AttendanceDayTrend[] = [];

  let totalPresentCount = 0;
  let totalStudentDays = 0;

  attendanceDates.forEach((d) => {
    const dayRecords = attendance[d] || {};
    let pres = 0;
    let authAbs = 0;
    let unauthAbs = 0;
    let counted = 0;

    filteredStudents.forEach((st) => {
      const status = dayRecords[st.id];
      if (status === 'present') {
        pres++;
        counted++;
      } else if (status === 'auth_absent') {
        authAbs++;
        counted++;
      } else if (status === 'unauth_absent') {
        unauthAbs++;
        counted++;
      }
    });

    if (counted > 0) {
      const pPct = Math.round((pres / counted) * 1000) / 10;
      const aPct = Math.round((authAbs / counted) * 1000) / 10;
      const uPct = Math.round((unauthAbs / counted) * 1000) / 10;

      totalPresentCount += pres;
      totalStudentDays += counted;

      const dateObj = new Date(d + 'T00:00:00');
      const dayName = isNaN(dateObj.getTime())
        ? d.slice(5)
        : dateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric' });

      attendanceTrends.push({
        date: d,
        dayLabel: dayName,
        presentPct: pPct,
        authAbsentPct: aPct,
        unauthAbsentPct: uPct,
        totalStudents: counted,
      });
    }
  });

  const overallAttendanceRate = totalStudentDays > 0
    ? Math.round((totalPresentCount / totalStudentDays) * 1000) / 10
    : 0;

  // 5. Syllabus Progress
  const syllabusTopics = (syllabus || []).flatMap((t) => t.topics || []);
  const totalTopics = syllabusTopics.length;
  const completedTopics = syllabusTopics.filter((tp) => tp.teacher_checked).length;
  const overallSyllabusProgress = totalTopics > 0 ? Math.round((completedTopics / totalTopics) * 100) : 0;

  const syllabusProgressByDept: SyllabusDepartmentProgress[] = (syllabus || []).map((term) => {
    const topics = term.topics || [];
    const done = topics.filter((tp) => tp.teacher_checked).length;
    const pct = topics.length > 0 ? Math.round((done / topics.length) * 100) : 0;
    return {
      department: term.name || 'Academic Term',
      totalTopics: topics.length,
      completedTopics: done,
      percentage: pct,
      status: pct >= 80 ? 'ahead' : pct >= 50 ? 'on_track' : 'needs_attention',
      color: '#2C6E6A',
    };
  });

  // 6. Mark Compliance Summary
  const filteredClasses = subjectClasses.filter((sc) => {
    if (selectedGradeFilter === 'all') return true;
    const gMatch = (sc.class_name || '').match(/\d+/);
    return gMatch && gMatch[0] === selectedGradeFilter;
  });

  const totalClasses = filteredClasses.length;
  let fullyGraded = 0;
  let inProgress = 0;
  let pending = 0;
  const pendingList: MarkComplianceSummary['pendingList'] = [];

  filteredClasses.forEach((c) => {
    const enrolledIds = c.enrolled_student_ids || [];
    if (enrolledIds.length === 0) {
      pending++;
      return;
    }
    const gradedCount = enrolledIds.filter((sid) => studentScoreMap.has(sid)).length;
    if (gradedCount === enrolledIds.length && enrolledIds.length > 0) {
      fullyGraded++;
    } else if (gradedCount > 0) {
      inProgress++;
      pendingList.push({
        className: c.name || c.class_name,
        subject: c.subject,
        teacherName: c.teacher_name,
        unenteredCount: enrolledIds.length - gradedCount,
      });
    } else {
      pending++;
      pendingList.push({
        className: c.name || c.class_name,
        subject: c.subject,
        teacherName: c.teacher_name,
        unenteredCount: enrolledIds.length,
      });
    }
  });

  const markCompliance: MarkComplianceSummary = {
    totalClasses,
    fullyGradedClasses: fullyGraded,
    inProgressClasses: inProgress,
    pendingClasses: pending,
    complianceRate: totalClasses > 0 ? Math.round((fullyGraded / totalClasses) * 100) : 0,
    pendingList: pendingList.slice(0, 5),
  };

  // 7. At-Risk Students & High Distinction Students (strictly from real scores & attendance)
  const atRiskStudents: AtRiskStudent[] = [];
  const distinctionStudents: DistinctionStudent[] = [];

  studentScoreMap.forEach((scores, sid) => {
    const st = filteredStudents.find((p) => p.id === sid);
    if (!st) return;
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;

    // Attendance rate for this student
    let stPresent = 0;
    let stDays = 0;
    attendanceDates.forEach((d) => {
      const status = (attendance[d] || {})[sid];
      if (status) {
        stDays++;
        if (status === 'present') stPresent++;
      }
    });
    const attRate = stDays > 0 ? Math.round((stPresent / stDays) * 100) : 100;

    if (avg < 60 || (stDays > 0 && attRate < 80)) {
      atRiskStudents.push({
        id: st.id,
        name: st.name,
        grade: (st.grade || '9').replace(/[^0-9]/g, ''),
        classLetter: st.class_letter || 'A',
        admissionNumber: st.admission_number || st.user_code || 'WPS-000',
        averageScore: Math.round(avg * 10) / 10,
        attendanceRate: attRate,
        concernFactors: [
          ...(avg < 60 ? [`Low Test Average (${Math.round(avg)}%)`] : []),
          ...(stDays > 0 && attRate < 80 ? [`Irregular Attendance (${attRate}%)`] : []),
        ],
      });
    }

    if (avg >= 85) {
      distinctionStudents.push({
        id: st.id,
        name: st.name,
        grade: (st.grade || '9').replace(/[^0-9]/g, ''),
        classLetter: st.class_letter || 'A',
        admissionNumber: st.admission_number || st.user_code || 'WPS-000',
        averageScore: Math.round(avg * 10) / 10,
        topSubject: 'High Honor',
        rank: 1,
      });
    }
  });

  distinctionStudents.sort((a, b) => b.averageScore - a.averageScore);
  distinctionStudents.forEach((d, idx) => {
    d.rank = idx + 1;
  });

  // 8. Grade-by-Grade Comparison
  const gradeComparison = ['9', '10', '11', '12'].map((g) => {
    const gStudents = allStudents.filter((s) => (s.grade || '').replace(/[^0-9]/g, '') === g);
    const gScores = studentScores.filter((s) => (s.student.grade || '').replace(/[^0-9]/g, '') === g);
    const gAvg = gScores.length > 0 ? gScores.reduce((a, b) => a + b.score, 0) / gScores.length : 0;
    return {
      grade: `Grade ${g}`,
      studentCount: gStudents.length,
      avgScore: Math.round(gAvg * 10) / 10,
      attendanceRate: overallAttendanceRate,
      syllabusPct: overallSyllabusProgress,
    };
  });

  // 9. Overall School Health Index (0 - 100)
  const healthFactors = [
    overallAverageScore > 0 ? overallAverageScore : null,
    overallAttendanceRate > 0 ? overallAttendanceRate : null,
    overallSyllabusProgress > 0 ? overallSyllabusProgress : null,
  ].filter((f): f is number => f !== null);

  const schoolHealthIndex = healthFactors.length > 0
    ? Math.round(healthFactors.reduce((a, b) => a + b, 0) / healthFactors.length)
    : 0;

  return {
    schoolHealthIndex,
    totalEnrollment,
    overallAverageScore,
    overallAttendanceRate,
    overallSyllabusProgress,
    scoreDistribution,
    subjectMasteryList,
    attendanceTrends,
    syllabusProgressByDept,
    markCompliance,
    atRiskStudents,
    distinctionStudents,
    gradeComparison,
  };
}
