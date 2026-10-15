'use client';

import React, { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  X,
  Download,
  Calendar,
  FileSpreadsheet,
  FileText,
  Printer,
  CheckSquare,
  Square,
  CheckCircle2,
  AlertCircle,
  Clock,
  ChevronDown,
  Filter,
  Users,
} from 'lucide-react';
import { UserProfile } from '@/lib/supabaseClient';

export interface ExportAttendanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  attendance: Record<string, Record<string, string>>; // date -> studentId -> status ('present' | 'auth_absent' | 'unauth_absent')
  students: UserProfile[];
  classroomLabel?: string;
  teacherName?: string;
  defaultMonth?: string; // YYYY-MM
}

type SelectionMode = 'month' | 'range' | 'custom_dates' | 'all';
type ExportFormat = 'xlsx' | 'csv' | 'pdf' | 'print';

export const ExportAttendanceModal: React.FC<ExportAttendanceModalProps> = ({
  isOpen,
  onClose,
  attendance = {},
  students = [],
  classroomLabel = 'Classroom Attendance Register',
  teacherName = 'Woodlem Faculty',
  defaultMonth,
}) => {
  const allRecordedDates = useMemo(() => {
    return Object.keys(attendance || {}).sort().reverse();
  }, [attendance]);

  const currentYearMonth = defaultMonth || (allRecordedDates.length > 0 ? allRecordedDates[0].slice(0, 7) : new Date().toISOString().slice(0, 7));

  // State
  const [selectionMode, setSelectionMode] = useState<SelectionMode>('month');
  const [selectedMonth, setSelectedMonth] = useState<string>(currentYearMonth);
  
  const [startDate, setStartDate] = useState<string>(() => {
    if (allRecordedDates.length > 0) {
      return allRecordedDates[Math.min(allRecordedDates.length - 1, 29)];
    }
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });

  const [endDate, setEndDate] = useState<string>(() => {
    if (allRecordedDates.length > 0) {
      return allRecordedDates[0];
    }
    return new Date().toISOString().split('T')[0];
  });

  const [selectedCustomDates, setSelectedCustomDates] = useState<Set<string>>(() => {
    return new Set(allRecordedDates.slice(0, 15));
  });

  const [selectedStudentFilter, setSelectedStudentFilter] = useState<string>('all');
  const [exportFormat, setExportFormat] = useState<ExportFormat>('xlsx');
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [searchStudentQuery, setSearchStudentQuery] = useState<string>('');

  // Discover all months available in attendance database
  const availableRecordedMonths = useMemo(() => {
    const monthCounts: Record<string, number> = {};
    allRecordedDates.forEach((d) => {
      const ym = d.slice(0, 7);
      monthCounts[ym] = (monthCounts[ym] || 0) + 1;
    });
    return Object.keys(monthCounts).sort().reverse().map((ym) => {
      const [year, month] = ym.split('-');
      const dateObj = new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1);
      const label = dateObj.toLocaleString('default', { month: 'long', year: 'numeric' });
      return {
        key: ym,
        label,
        count: monthCounts[ym],
      };
    });
  }, [allRecordedDates]);

  // Compute final list of dates to be included in export based on selection mode
  const activeExportDates = useMemo(() => {
    if (selectionMode === 'all') {
      return [...allRecordedDates].sort();
    }
    if (selectionMode === 'month') {
      return allRecordedDates.filter((d) => d.startsWith(selectedMonth)).sort();
    }
    if (selectionMode === 'range') {
      return allRecordedDates.filter((d) => {
        if (startDate && d < startDate) return false;
        if (endDate && d > endDate) return false;
        return true;
      }).sort();
    }
    if (selectionMode === 'custom_dates') {
      return allRecordedDates.filter((d) => selectedCustomDates.has(d)).sort();
    }
    return [];
  }, [selectionMode, selectedMonth, startDate, endDate, selectedCustomDates, allRecordedDates]);

  // Filter students list
  const activeExportStudents = useMemo(() => {
    let filtered = students;
    if (selectedStudentFilter !== 'all') {
      filtered = filtered.filter((s) => s.id === selectedStudentFilter || s.email === selectedStudentFilter);
    }
    if (searchStudentQuery.trim()) {
      const q = searchStudentQuery.toLowerCase().trim();
      filtered = filtered.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          (s.admission_number || '').toLowerCase().includes(q) ||
          (s.email || '').toLowerCase().includes(q)
      );
    }
    // Sort alphabetically by student name by default
    filtered = filtered.sort((a, b) => {
      const nameA = (a.name || '').toLowerCase();
      const nameB = (b.name || '').toLowerCase();
      return nameA.localeCompare(nameB);
    });
    return filtered;
  }, [students, selectedStudentFilter, searchStudentQuery]);

  // Calculate per-student and classroom statistics for selected dates
  const exportStats = useMemo(() => {
    let totalPossiblePresent = 0;
    let totalPresentMarked = 0;
    let totalAuthAbsent = 0;
    let totalUnauthAbsent = 0;

    const studentSummaries: Record<string, {
      present: number;
      authAbsent: number;
      unauthAbsent: number;
      totalSessions: number;
      rate: number;
    }> = {};

    activeExportStudents.forEach((st) => {
      let p = 0;
      let auth = 0;
      let unauth = 0;
      let total = 0;

      activeExportDates.forEach((dateStr) => {
        const dayMap = attendance[dateStr] || {};
        const stat = dayMap[st.id] || (st.email && dayMap[st.email]);
        if (stat) {
          total++;
          if (stat === 'present') p++;
          else if (stat === 'auth_absent') auth++;
          else if (stat === 'unauth_absent') unauth++;
        }
      });

      const rate = total > 0 ? Math.round((p / total) * 100) : 100;
      studentSummaries[st.id] = {
        present: p,
        authAbsent: auth,
        unauthAbsent: unauth,
        totalSessions: total,
        rate,
      };

      totalPossiblePresent += total;
      totalPresentMarked += p;
      totalAuthAbsent += auth;
      totalUnauthAbsent += unauth;
    });

    const overallRate = totalPossiblePresent > 0 ? Math.round((totalPresentMarked / totalPossiblePresent) * 100) : 100;

    return {
      studentSummaries,
      totalPossiblePresent,
      totalPresentMarked,
      totalAuthAbsent,
      totalUnauthAbsent,
      overallRate,
    };
  }, [activeExportStudents, activeExportDates, attendance]);

  if (!isOpen) return null;

  // Toggle custom date selection
  const handleToggleCustomDate = (dateStr: string) => {
    const updated = new Set(selectedCustomDates);
    if (updated.has(dateStr)) {
      updated.delete(dateStr);
    } else {
      updated.add(dateStr);
    }
    setSelectedCustomDates(updated);
  };

  const handleSelectAllDates = () => {
    setSelectedCustomDates(new Set(allRecordedDates));
  };

  const handleClearAllDates = () => {
    setSelectedCustomDates(new Set());
  };

  // Quick preset ranges
  const applyPresetRange = (preset: 'last7' | 'last30' | 'thisMonth' | 'lastMonth' | 'all') => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    if (preset === 'last7') {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      setStartDate(d.toISOString().split('T')[0]);
      setEndDate(todayStr);
      setSelectionMode('range');
    } else if (preset === 'last30') {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      setStartDate(d.toISOString().split('T')[0]);
      setEndDate(todayStr);
      setSelectionMode('range');
    } else if (preset === 'thisMonth') {
      const ym = todayStr.slice(0, 7);
      setSelectedMonth(ym);
      setSelectionMode('month');
    } else if (preset === 'lastMonth') {
      const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const ym = d.toISOString().slice(0, 7);
      setSelectedMonth(ym);
      setSelectionMode('month');
    } else if (preset === 'all') {
      setSelectionMode('all');
    }
  };

  const getStatusLabel = (code: string | undefined): { label: string; code: string } => {
    if (code === 'present') return { label: 'Present', code: 'P' };
    if (code === 'auth_absent') return { label: 'Permit Leave (PL)', code: 'PL' };
    if (code === 'unauth_absent') return { label: 'Absent', code: 'A' };
    return { label: '—', code: '—' };
  };

  const getFileNameBase = () => {
    const cleanClass = classroomLabel.replace(/[^a-zA-Z0-9_-]/g, '_');
    let timeScope = '';
    if (selectionMode === 'month') {
      timeScope = `Month_${selectedMonth}`;
    } else if (selectionMode === 'range') {
      timeScope = `${startDate}_to_${endDate}`;
    } else if (selectionMode === 'custom_dates') {
      timeScope = `${activeExportDates.length}_selected_dates`;
    } else {
      timeScope = 'All_Recorded_Dates';
    }
    return `Woodlem_Attendance_${cleanClass}_${timeScope}`;
  };

  // 1. GENERATE EXCEL WORKBOOK (.xlsx)
  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();

    // Sheet 1: Matrix Register
    const matrixRows: any[] = [];
    
    // Header Info
    matrixRows.push(['WOODLEM PARK SCHOOL — ATTENDANCE REGISTER']);
    matrixRows.push([`Classroom / Section: ${classroomLabel}`, `Faculty / Class Teacher: ${teacherName}`]);
    matrixRows.push([`Export Scope: ${selectionMode.toUpperCase()}`, `Total School Sessions: ${activeExportDates.length}`, `Generated On: ${new Date().toLocaleString()}`]);
    matrixRows.push([]); // blank row

    // Table Header
    const tableHeader = ['#', 'Admission No.', 'Student Name', 'Grade / Section', ...activeExportDates, 'Present (P)', 'Permit Leave (PL)', 'Absent (A)', 'Total Sessions', 'Attendance Rate %'];
    matrixRows.push(tableHeader);

    // Table Body
    activeExportStudents.forEach((st, idx) => {
      const stat = exportStats.studentSummaries[st.id] || { present: 0, authAbsent: 0, unauthAbsent: 0, totalSessions: 0, rate: 100 };
      const dateStatuses = activeExportDates.map((d) => {
        const s = (attendance[d] || {})[st.id] || (st.email && (attendance[d] || {})[st.email]);
        return getStatusLabel(s).code;
      });

      matrixRows.push([
        idx + 1,
        st.admission_number || st.user_code || '—',
        st.name,
        st.grade ? `${st.grade}${st.class_letter ? `-${st.class_letter}` : ''}` : classroomLabel,
        ...dateStatuses,
        stat.present,
        stat.authAbsent,
        stat.unauthAbsent,
        stat.totalSessions,
        `${stat.rate}%`,
      ]);
    });

    // Summary Totals Row
    const dateTotalsPresent = activeExportDates.map((d) => {
      let pCount = 0;
      activeExportStudents.forEach((st) => {
        const s = (attendance[d] || {})[st.id] || (st.email && (attendance[d] || {})[st.email]);
        if (s === 'present') pCount++;
      });
      return pCount;
    });

    matrixRows.push([]);
    matrixRows.push([
      'TOTAL PRESENT',
      '',
      '',
      '',
      ...dateTotalsPresent,
      exportStats.totalPresentMarked,
      exportStats.totalAuthAbsent,
      exportStats.totalUnauthAbsent,
      exportStats.totalPossiblePresent,
      `${exportStats.overallRate}%`,
    ]);

    const wsMatrix = XLSX.utils.aoa_to_sheet(matrixRows);
    XLSX.utils.book_append_sheet(wb, wsMatrix, 'Attendance Matrix');

    // Sheet 2: Detailed Session Logs
    const logRows: any[] = [];
    logRows.push(['Date', 'Day of Week', 'Admission No.', 'Student Name', 'Classroom', 'Attendance Status', 'Status Code']);
    
    activeExportDates.forEach((dateStr) => {
      const dateObj = new Date(dateStr);
      const weekday = dateObj.toLocaleDateString('default', { weekday: 'long' });
      activeExportStudents.forEach((st) => {
        const s = (attendance[dateStr] || {})[st.id] || (st.email && (attendance[dateStr] || {})[st.email]);
        const statusInfo = getStatusLabel(s);
        logRows.push([
          dateStr,
          weekday,
          st.admission_number || st.user_code || '—',
          st.name,
          classroomLabel,
          statusInfo.label,
          statusInfo.code,
        ]);
      });
    });

    const wsLogs = XLSX.utils.aoa_to_sheet(logRows);
    XLSX.utils.book_append_sheet(wb, wsLogs, 'Detailed Log Breakdown');

    // Trigger download
    const fileName = `${getFileNameBase()}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  // 2. GENERATE CSV (.csv)
  const handleExportCSV = () => {
    const rows: string[][] = [];

    // Header
    rows.push(['#', 'Admission No', 'Student Name', 'Grade/Section', ...activeExportDates, 'Present', 'Permit Leave', 'Absent', 'Total Days', 'Attendance Rate %']);

    activeExportStudents.forEach((st, idx) => {
      const stat = exportStats.studentSummaries[st.id] || { present: 0, authAbsent: 0, unauthAbsent: 0, totalSessions: 0, rate: 100 };
      const dateStatuses = activeExportDates.map((d) => {
        const s = (attendance[d] || {})[st.id] || (st.email && (attendance[d] || {})[st.email]);
        return getStatusLabel(s).code;
      });

      rows.push([
        String(idx + 1),
        st.admission_number || st.user_code || '',
        st.name,
        st.grade ? `${st.grade}${st.class_letter ? `-${st.class_letter}` : ''}` : classroomLabel,
        ...dateStatuses,
        String(stat.present),
        String(stat.authAbsent),
        String(stat.unauthAbsent),
        String(stat.totalSessions),
        `${stat.rate}%`,
      ]);
    });

    const csvContent = '\uFEFF' + rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${getFileNameBase()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 3. GENERATE PDF (.pdf)
  const handleExportPDF = () => {
    const doc = new jsPDF({
      orientation: activeExportDates.length > 8 ? 'landscape' : 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    // Woodlem Header
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(44, 110, 106); // Emerald primary
    doc.text('WOODLEM PARK SCHOOL', 14, 15);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80, 80, 80);
    doc.text(`Official Attendance Register — ${classroomLabel}`, 14, 21);

    doc.setFontSize(8.5);
    doc.setTextColor(120, 120, 120);
    const scopeDesc = selectionMode === 'month' ? `Month: ${selectedMonth}` : selectionMode === 'range' ? `Dates: ${startDate} to ${endDate}` : `Custom (${activeExportDates.length} Dates)`;
    doc.text(`Teacher: ${teacherName} | Scope: ${scopeDesc} | Overall Classroom Attendance: ${exportStats.overallRate}%`, 14, 26);

    // Columns: if dates count > 15, show formatted short summary to avoid PDF overflow
    let headers: string[] = [];
    let bodyRows: any[][] = [];

    if (activeExportDates.length <= 15) {
      headers = ['#', 'Adm No', 'Student Name', ...activeExportDates.map((d) => d.slice(5)), 'Pres', 'PL', 'Abs', 'Rate%'];
      bodyRows = activeExportStudents.map((st, idx) => {
        const stat = exportStats.studentSummaries[st.id] || { present: 0, authAbsent: 0, unauthAbsent: 0, totalSessions: 0, rate: 100 };
        const dateCodes = activeExportDates.map((d) => {
          const s = (attendance[d] || {})[st.id] || (st.email && (attendance[d] || {})[st.email]);
          return getStatusLabel(s).code;
        });
        return [
          idx + 1,
          st.admission_number || st.user_code || '—',
          st.name,
          ...dateCodes,
          stat.present,
          stat.authAbsent,
          stat.unauthAbsent,
          `${stat.rate}%`,
        ];
      });
    } else {
      // Summary register for larger date sets
      headers = ['#', 'Adm No', 'Student Name', 'Total Sessions', 'Present (P)', 'Permit Leave (PL)', 'Absent (A)', 'Attendance %', 'Status'];
      bodyRows = activeExportStudents.map((st, idx) => {
        const stat = exportStats.studentSummaries[st.id] || { present: 0, authAbsent: 0, unauthAbsent: 0, totalSessions: 0, rate: 100 };
        const statusText = stat.rate >= 90 ? 'Regular' : stat.rate >= 80 ? 'Satisfactory' : 'At-Risk (<80%)';
        return [
          idx + 1,
          st.admission_number || st.user_code || '—',
          st.name,
          stat.totalSessions,
          stat.present,
          stat.authAbsent,
          stat.unauthAbsent,
          `${stat.rate}%`,
          statusText,
        ];
      });
    }

    autoTable(doc, {
      head: [headers],
      body: bodyRows,
      startY: 30,
      theme: 'grid',
      headStyles: {
        fillColor: [44, 110, 106],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8,
        halign: 'center',
      },
      styles: {
        fontSize: 7.5,
        cellPadding: 2,
        halign: 'center',
      },
      columnStyles: {
        0: { halign: 'center', cellWidth: 8 },
        1: { halign: 'left', cellWidth: 22 },
        2: { halign: 'left', cellWidth: 38 },
      },
      alternateRowStyles: {
        fillColor: [248, 247, 244],
      },
    });

    doc.save(`${getFileNameBase()}.pdf`);
  };

  // 4. PRINTABLE REPORT (HTML Window Print)
  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please allow pop-ups to print the attendance register.');
      return;
    }

    const tableRowsHtml = activeExportStudents.map((st, idx) => {
      const stat = exportStats.studentSummaries[st.id] || { present: 0, authAbsent: 0, unauthAbsent: 0, totalSessions: 0, rate: 100 };
      const dateCells = activeExportDates.map((d) => {
        const s = (attendance[d] || {})[st.id] || (st.email && (attendance[d] || {})[st.email]);
        const code = getStatusLabel(s).code;
        const color = code === 'P' ? '#2D6E5D' : code === 'PL' ? '#92400E' : code === 'A' ? '#DC2626' : '#9E9B95';
        const bg = code === 'P' ? '#EAF3EF' : code === 'PL' ? '#FEF3C7' : code === 'A' ? '#FDF1F0' : 'transparent';
        return `<td style="text-align:center;font-weight:700;color:${color};background:${bg};padding:4px;">${code}</td>`;
      }).join('');

      return `
        <tr style="border-bottom: 1px solid #e5e7eb;">
          <td style="padding:6px;text-align:center;">${idx + 1}</td>
          <td style="padding:6px;font-family:monospace;font-size:11px;">${st.admission_number || st.user_code || '—'}</td>
          <td style="padding:6px;font-weight:600;">${st.name}</td>
          ${dateCells}
          <td style="padding:6px;text-align:center;font-weight:700;color:#2D6E5D;">${stat.present}</td>
          <td style="padding:6px;text-align:center;font-weight:700;color:#92400E;">${stat.authAbsent}</td>
          <td style="padding:6px;text-align:center;font-weight:700;color:#DC2626;">${stat.unauthAbsent}</td>
          <td style="padding:6px;text-align:center;font-weight:700;">${stat.rate}%</td>
        </tr>
      `;
    }).join('');

    const dateHeaders = activeExportDates.map((d) => `<th style="padding:4px;font-size:10px;text-align:center;background:#F8F7F4;border:1px solid #e5e7eb;">${d.slice(5)}</th>`).join('');

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Attendance Register — ${classroomLabel}</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 24px; color: #1a1a1a; margin: 0; }
            h1 { font-size: 18px; margin: 0 0 4px; color: #2C6E6A; }
            h2 { font-size: 13px; font-weight: 500; margin: 0 0 16px; color: #666; }
            .kpi-row { display: flex; gap: 16px; margin-bottom: 20px; }
            .kpi-card { border: 1px solid #e5e7eb; border-radius: 6px; padding: 10px 14px; background: #fafafa; }
            .kpi-title { font-size: 10px; text-transform: uppercase; font-weight: 700; color: #888; }
            .kpi-val { font-size: 18px; font-weight: 700; color: #2C6E6A; margin-top: 2px; }
            table { width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 10px; }
            th { background: #2C6E6A; color: white; padding: 6px; font-size: 10.5px; border: 1px solid #2C6E6A; }
            td { border: 1px solid #e5e7eb; font-size: 11px; }
            .footer { margin-top: 32px; display: flex; justify-content: space-between; font-size: 11px; color: #666; padding-top: 16px; border-top: 1px solid #e5e7eb; }
            @media print {
              body { padding: 0; }
              @page { size: landscape; margin: 12mm; }
            }
          </style>
        </head>
        <body>
          <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:12px;">
            <div>
              <h1>WOODLEM PARK SCHOOL</h1>
              <h2>Official Classroom Attendance Register — ${classroomLabel}</h2>
            </div>
            <div style="text-align:right; font-size:11px; color:#666;">
              <div><strong>Teacher:</strong> ${teacherName}</div>
              <div><strong>Generated:</strong> ${new Date().toLocaleDateString()}</div>
            </div>
          </div>

          <div class="kpi-row">
            <div class="kpi-card">
              <div class="kpi-title">Class Attendance Rate</div>
              <div class="kpi-val">${exportStats.overallRate}%</div>
            </div>
            <div class="kpi-card">
              <div class="kpi-title">Recorded Sessions</div>
              <div class="kpi-val">${activeExportDates.length} Days</div>
            </div>
            <div class="kpi-card">
              <div class="kpi-title">Total Enrolled</div>
              <div class="kpi-val">${activeExportStudents.length} Students</div>
            </div>
            <div class="kpi-card">
              <div class="kpi-title">Present Days Sum</div>
              <div class="kpi-val">${exportStats.totalPresentMarked}</div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th style="width:24px;">#</th>
                <th style="width:80px;">Adm No</th>
                <th style="text-align:left;">Student Name</th>
                ${dateHeaders}
                <th style="width:36px;">P</th>
                <th style="width:36px;">PL</th>
                <th style="width:36px;">A</th>
                <th style="width:45px;">Rate%</th>
              </tr>
            </thead>
            <tbody>
              ${tableRowsHtml}
            </tbody>
          </table>

          <div class="footer">
            <div>Verified &amp; Submitted by Class Teacher: _______________________</div>
            <div>Reviewed by Section Supervisor / Principal: _______________________</div>
          </div>

          <script>
            window.onload = function() {
              window.print();
            };
          </script>
        </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  const handleExecuteExport = () => {
    if (activeExportDates.length === 0) {
      alert('No attendance sessions found for the selected month or date range.');
      return;
    }

    setIsExporting(true);
    try {
      if (exportFormat === 'xlsx') {
        handleExportExcel();
      } else if (exportFormat === 'csv') {
        handleExportCSV();
      } else if (exportFormat === 'pdf') {
        handleExportPDF();
      } else if (exportFormat === 'print') {
        handlePrint();
      }
    } catch (err: any) {
      console.error('Export attendance failed:', err);
      alert('Failed to generate export file: ' + (err.message || 'Unknown error'));
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.5)',
        backdropFilter: 'blur(3px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#FFFFFF',
          borderRadius: 12,
          boxShadow: '0 20px 40px rgba(0,0,0,0.18)',
          width: '100%',
          maxWidth: 820,
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          border: '1px solid #E5E7EB',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* MODAL HEADER */}
        <div
          style={{
            padding: '18px 24px',
            borderBottom: '1px solid #ECEAE5',
            background: '#FAF9F6',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  padding: '2px 7px',
                  borderRadius: 4,
                  background: '#EAF3EF',
                  color: '#2D6E5D',
                  border: '1px solid #C7E4D8',
                  textTransform: 'uppercase',
                }}
              >
                Data Export
              </span>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{classroomLabel}</span>
            </div>
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: '#1A1A1A' }}>
              Export Attendance Records
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              width: 32,
              height: 32,
              borderRadius: 6,
              background: '#FFFFFF',
              border: '1px solid #E5E7EB',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: '#6B7280',
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* MODAL BODY */}
        <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* 1. SELECTION MODE TABS */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>
              1. Choose Date or Month Scope
            </label>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: 8,
                background: '#F4F2EE',
                padding: 4,
                borderRadius: 8,
              }}
            >
              <button
                type="button"
                onClick={() => setSelectionMode('month')}
                style={{
                  padding: '8px 12px',
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: selectionMode === 'month' ? 700 : 500,
                  background: selectionMode === 'month' ? '#FFFFFF' : 'transparent',
                  color: selectionMode === 'month' ? '#2C6E6A' : '#6B7280',
                  border: selectionMode === 'month' ? '1px solid #D1D5DB' : 'none',
                  boxShadow: selectionMode === 'month' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                }}
              >
                <Calendar size={14} /> By Month
              </button>

              <button
                type="button"
                onClick={() => setSelectionMode('range')}
                style={{
                  padding: '8px 12px',
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: selectionMode === 'range' ? 700 : 500,
                  background: selectionMode === 'range' ? '#FFFFFF' : 'transparent',
                  color: selectionMode === 'range' ? '#2C6E6A' : '#6B7280',
                  border: selectionMode === 'range' ? '1px solid #D1D5DB' : 'none',
                  boxShadow: selectionMode === 'range' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                }}
              >
                <Clock size={14} /> Date Range
              </button>

              <button
                type="button"
                onClick={() => setSelectionMode('custom_dates')}
                style={{
                  padding: '8px 12px',
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: selectionMode === 'custom_dates' ? 700 : 500,
                  background: selectionMode === 'custom_dates' ? '#FFFFFF' : 'transparent',
                  color: selectionMode === 'custom_dates' ? '#2C6E6A' : '#6B7280',
                  border: selectionMode === 'custom_dates' ? '1px solid #D1D5DB' : 'none',
                  boxShadow: selectionMode === 'custom_dates' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                }}
              >
                <CheckSquare size={14} /> Pick Dates ({selectedCustomDates.size})
              </button>

              <button
                type="button"
                onClick={() => setSelectionMode('all')}
                style={{
                  padding: '8px 12px',
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: selectionMode === 'all' ? 700 : 500,
                  background: selectionMode === 'all' ? '#FFFFFF' : 'transparent',
                  color: selectionMode === 'all' ? '#2C6E6A' : '#6B7280',
                  border: selectionMode === 'all' ? '1px solid #D1D5DB' : 'none',
                  boxShadow: selectionMode === 'all' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                }}
              >
                All Time ({allRecordedDates.length})
              </button>
            </div>
          </div>

          {/* 2. MODE-SPECIFIC CONTROLS */}
          {selectionMode === 'month' && (
            <div style={{ background: '#FAF9F6', padding: '14px 16px', borderRadius: 8, border: '1px solid #ECEAE5' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <label style={{ fontSize: 12, fontWeight: 700, color: '#374151' }}>Select Month:</label>
                  <input
                    type="month"
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    style={{
                      padding: '6px 12px',
                      fontSize: 13,
                      fontWeight: 600,
                      borderRadius: 6,
                      border: '1px solid #D1D5DB',
                      background: '#FFFFFF',
                    }}
                  />
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  Found <strong>{activeExportDates.length} recorded session{activeExportDates.length === 1 ? '' : 's'}</strong> in this month.
                </div>
              </div>

              {/* Quick Available Month Chips */}
              {availableRecordedMonths.length > 0 && (
                <div>
                  <span style={{ fontSize: 11, color: '#6B7280', display: 'block', marginBottom: 6 }}>
                    Recorded Months with Data:
                  </span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {availableRecordedMonths.map((m) => (
                      <button
                        key={m.key}
                        type="button"
                        onClick={() => setSelectedMonth(m.key)}
                        style={{
                          padding: '4px 10px',
                          borderRadius: 20,
                          fontSize: 11,
                          fontWeight: selectedMonth === m.key ? 700 : 500,
                          background: selectedMonth === m.key ? '#2C6E6A' : '#FFFFFF',
                          color: selectedMonth === m.key ? '#FFFFFF' : '#374151',
                          border: selectedMonth === m.key ? '1px solid #2C6E6A' : '1px solid #D1D5DB',
                          cursor: 'pointer',
                        }}
                      >
                        {m.label} ({m.count} days)
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {selectionMode === 'range' && (
            <div style={{ background: '#FAF9F6', padding: '14px 16px', borderRadius: 8, border: '1px solid #ECEAE5' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <label style={{ fontSize: 12, fontWeight: 700, color: '#374151' }}>From:</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    style={{
                      padding: '6px 10px',
                      fontSize: 12.5,
                      borderRadius: 6,
                      border: '1px solid #D1D5DB',
                      background: '#FFFFFF',
                    }}
                  />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <label style={{ fontSize: 12, fontWeight: 700, color: '#374151' }}>To:</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    style={{
                      padding: '6px 10px',
                      fontSize: 12.5,
                      borderRadius: 6,
                      border: '1px solid #D1D5DB',
                      background: '#FFFFFF',
                    }}
                  />
                </div>

                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  Includes <strong>{activeExportDates.length} recorded session{activeExportDates.length === 1 ? '' : 's'}</strong>
                </div>
              </div>

              {/* Quick Preset Range Buttons */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                <button
                  type="button"
                  onClick={() => applyPresetRange('last7')}
                  style={{
                    padding: '4px 10px',
                    borderRadius: 4,
                    fontSize: 11,
                    fontWeight: 600,
                    background: '#FFFFFF',
                    border: '1px solid #D1D5DB',
                    cursor: 'pointer',
                  }}
                >
                  Last 7 Days
                </button>
                <button
                  type="button"
                  onClick={() => applyPresetRange('last30')}
                  style={{
                    padding: '4px 10px',
                    borderRadius: 4,
                    fontSize: 11,
                    fontWeight: 600,
                    background: '#FFFFFF',
                    border: '1px solid #D1D5DB',
                    cursor: 'pointer',
                  }}
                >
                  Last 30 Days
                </button>
                <button
                  type="button"
                  onClick={() => applyPresetRange('thisMonth')}
                  style={{
                    padding: '4px 10px',
                    borderRadius: 4,
                    fontSize: 11,
                    fontWeight: 600,
                    background: '#FFFFFF',
                    border: '1px solid #D1D5DB',
                    cursor: 'pointer',
                  }}
                >
                  This Month
                </button>
                <button
                  type="button"
                  onClick={() => applyPresetRange('lastMonth')}
                  style={{
                    padding: '4px 10px',
                    borderRadius: 4,
                    fontSize: 11,
                    fontWeight: 600,
                    background: '#FFFFFF',
                    border: '1px solid #D1D5DB',
                    cursor: 'pointer',
                  }}
                >
                  Last Month
                </button>
              </div>
            </div>
          )}

          {selectionMode === 'custom_dates' && (
            <div style={{ background: '#FAF9F6', padding: '14px 16px', borderRadius: 8, border: '1px solid #ECEAE5' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#374151' }}>
                  Select Individual Attendance Days ({selectedCustomDates.size} of {allRecordedDates.length} selected):
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    onClick={handleSelectAllDates}
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: '#2C6E6A',
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      textDecoration: 'underline',
                    }}
                  >
                    Select All
                  </button>
                  <button
                    type="button"
                    onClick={handleClearAllDates}
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: '#6B7280',
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      textDecoration: 'underline',
                    }}
                  >
                    Clear Selection
                  </button>
                </div>
              </div>

              <div
                style={{
                  maxHeight: 180,
                  overflowY: 'auto',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))',
                  gap: 6,
                  paddingRight: 4,
                }}
              >
                {allRecordedDates.map((dateStr) => {
                  const isChecked = selectedCustomDates.has(dateStr);
                  const dateObj = new Date(dateStr);
                  const weekday = dateObj.toLocaleDateString('default', { weekday: 'short' });
                  
                  // Compute present count for day
                  let pCount = 0;
                  students.forEach((st) => {
                    const s = (attendance[dateStr] || {})[st.id] || (st.email && (attendance[dateStr] || {})[st.email]);
                    if (s === 'present') pCount++;
                  });

                  return (
                    <div
                      key={dateStr}
                      onClick={() => handleToggleCustomDate(dateStr)}
                      style={{
                        padding: '6px 10px',
                        borderRadius: 6,
                        border: isChecked ? '1px solid #2C6E6A' : '1px solid #E5E7EB',
                        background: isChecked ? '#EAF3EF' : '#FFFFFF',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        fontSize: 11.5,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {isChecked ? (
                          <CheckCircle2 size={14} color="#2C6E6A" />
                        ) : (
                          <Square size={14} color="#9CA3AF" />
                        )}
                        <div>
                          <div style={{ fontWeight: 700, color: isChecked ? '#2C6E6A' : '#1A1A1A' }}>{dateStr}</div>
                          <div style={{ fontSize: 10, color: '#6B7280' }}>{weekday}</div>
                        </div>
                      </div>
                      <span style={{ fontSize: 10, fontWeight: 600, color: '#6B7280' }}>
                        {pCount}/{students.length}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 3. STUDENT FILTER & SUMMARY BAR */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Users size={14} color="#6B7280" />
                <label style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                  Filter Students:
                </label>
              </div>

              <select
                value={selectedStudentFilter}
                onChange={(e) => setSelectedStudentFilter(e.target.value)}
                style={{
                  padding: '5px 10px',
                  fontSize: 12,
                  borderRadius: 6,
                  border: '1px solid #D1D5DB',
                  background: '#FFFFFF',
                }}
              >
                <option value="all">All Classroom Students ({students.length})</option>
                {students.map((st) => (
                  <option key={st.id} value={st.id}>
                    {st.name} ({st.admission_number || st.user_code || 'No Adm'})
                  </option>
                ))}
              </select>

              <input
                type="text"
                placeholder="Search name / admission #..."
                value={searchStudentQuery}
                onChange={(e) => setSearchStudentQuery(e.target.value)}
                style={{
                  padding: '5px 10px',
                  fontSize: 12,
                  borderRadius: 6,
                  border: '1px solid #D1D5DB',
                  background: '#FFFFFF',
                  width: 180,
                }}
              />
            </div>

            {/* Quick KPI Overview */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 4, background: '#EAF3EF', color: '#2D6E5D', fontWeight: 700 }}>
                {activeExportDates.length} Sessions
              </span>
              <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 4, background: '#F4F2EE', color: '#374151', fontWeight: 700 }}>
                {activeExportStudents.length} Students
              </span>
              <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 4, background: exportStats.overallRate >= 85 ? '#EAF3EF' : '#FDF1F0', color: exportStats.overallRate >= 85 ? '#2D6E5D' : '#DC2626', fontWeight: 700 }}>
                {exportStats.overallRate}% Avg Rate
              </span>
            </div>
          </div>

          {/* 4. PREVIEW TABLE SNIPPET */}
          <div style={{ border: '1px solid #E5E7EB', borderRadius: 8, overflow: 'hidden' }}>
            <div style={{ padding: '8px 12px', background: '#F8F7F4', borderBottom: '1px solid #E5E7EB', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                Live Export Preview ({activeExportStudents.length} Students · {activeExportDates.length} Selected Dates)
              </span>
              <span style={{ fontSize: 10.5, color: '#6B7280' }}>
                Showing first 5 rows &amp; recent dates
              </span>
            </div>

            <div style={{ overflowX: 'auto', maxHeight: 180 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                <thead>
                  <tr style={{ background: '#FAF9F6', borderBottom: '1px solid #E5E7EB', color: '#6B7280' }}>
                    <th style={{ textAlign: 'left', padding: '6px 10px', width: 28 }}>#</th>
                    <th style={{ textAlign: 'left', padding: '6px 10px' }}>Student</th>
                    {activeExportDates.slice(0, 7).map((d) => (
                      <th key={d} style={{ textAlign: 'center', padding: '6px 4px', width: 34 }}>
                        {d.slice(5)}
                      </th>
                    ))}
                    {activeExportDates.length > 7 && (
                      <th style={{ textAlign: 'center', padding: '6px 4px', color: '#9CA3AF' }}>+{activeExportDates.length - 7} more</th>
                    )}
                    <th style={{ textAlign: 'center', padding: '6px 8px', background: '#EAF3EF', color: '#2D6E5D' }}>Pres</th>
                    <th style={{ textAlign: 'center', padding: '6px 8px', background: '#FEF3C7', color: '#92400E' }}>PL</th>
                    <th style={{ textAlign: 'center', padding: '6px 8px', background: '#FDF1F0', color: '#DC2626' }}>Abs</th>
                    <th style={{ textAlign: 'right', padding: '6px 10px' }}>Rate %</th>
                  </tr>
                </thead>
                <tbody>
                  {activeExportStudents.slice(0, 5).map((st, idx) => {
                    const stat = exportStats.studentSummaries[st.id] || { present: 0, authAbsent: 0, unauthAbsent: 0, totalSessions: 0, rate: 100 };
                    return (
                      <tr key={st.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                        <td style={{ padding: '6px 10px', color: '#9CA3AF' }}>{idx + 1}</td>
                        <td style={{ padding: '6px 10px', fontWeight: 600, color: '#1A1A1A' }}>
                          <div>{st.name}</div>
                          <div style={{ fontSize: 9.5, color: '#6B7280', fontFamily: 'monospace' }}>{st.admission_number || st.user_code || ''}</div>
                        </td>
                        {activeExportDates.slice(0, 7).map((d) => {
                          const s = (attendance[d] || {})[st.id] || (st.email && (attendance[d] || {})[st.email]);
                          const code = getStatusLabel(s).code;
                          const color = code === 'P' ? '#2D6E5D' : code === 'PL' ? '#92400E' : code === 'A' ? '#DC2626' : '#9CA3AF';
                          const bg = code === 'P' ? '#EAF3EF' : code === 'PL' ? '#FEF3C7' : code === 'A' ? '#FDF1F0' : 'transparent';
                          return (
                            <td key={d} style={{ textAlign: 'center', padding: '4px 2px' }}>
                              <span style={{ display: 'inline-block', width: 20, height: 20, lineHeight: '20px', borderRadius: 3, background: bg, color, fontWeight: 700, fontSize: 10 }}>
                                {code}
                              </span>
                            </td>
                          );
                        })}
                        {activeExportDates.length > 7 && (
                          <td style={{ textAlign: 'center', color: '#9CA3AF', fontSize: 10 }}>...</td>
                        )}
                        <td style={{ textAlign: 'center', padding: '6px 8px', fontWeight: 700, color: '#2D6E5D' }}>{stat.present}</td>
                        <td style={{ textAlign: 'center', padding: '6px 8px', fontWeight: 600, color: '#92400E' }}>{stat.authAbsent}</td>
                        <td style={{ textAlign: 'center', padding: '6px 8px', fontWeight: 600, color: stat.unauthAbsent > 0 ? '#DC2626' : '#6B7280' }}>{stat.unauthAbsent}</td>
                        <td style={{ textAlign: 'right', padding: '6px 10px', fontWeight: 700, color: stat.rate >= 85 ? '#2D6E5D' : '#DC2626' }}>{stat.rate}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* 5. FORMAT SELECTION */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>
              2. Select Download Format
            </label>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
              <div
                onClick={() => setExportFormat('xlsx')}
                style={{
                  border: exportFormat === 'xlsx' ? '2px solid #2C6E6A' : '1px solid #E5E7EB',
                  background: exportFormat === 'xlsx' ? '#EAF3EF' : '#FFFFFF',
                  borderRadius: 8,
                  padding: '12px 14px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                }}
              >
                <FileSpreadsheet size={20} color={exportFormat === 'xlsx' ? '#2C6E6A' : '#107C41'} />
                <div>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: '#1A1A1A' }}>Excel (.xlsx)</div>
                  <div style={{ fontSize: 10.5, color: '#6B7280' }}>Matrix &amp; Log Sheets</div>
                </div>
              </div>

              <div
                onClick={() => setExportFormat('csv')}
                style={{
                  border: exportFormat === 'csv' ? '2px solid #2C6E6A' : '1px solid #E5E7EB',
                  background: exportFormat === 'csv' ? '#EAF3EF' : '#FFFFFF',
                  borderRadius: 8,
                  padding: '12px 14px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                }}
              >
                <Download size={20} color={exportFormat === 'csv' ? '#2C6E6A' : '#4B5563'} />
                <div>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: '#1A1A1A' }}>CSV File</div>
                  <div style={{ fontSize: 10.5, color: '#6B7280' }}>Universal format</div>
                </div>
              </div>

              <div
                onClick={() => setExportFormat('pdf')}
                style={{
                  border: exportFormat === 'pdf' ? '2px solid #2C6E6A' : '1px solid #E5E7EB',
                  background: exportFormat === 'pdf' ? '#EAF3EF' : '#FFFFFF',
                  borderRadius: 8,
                  padding: '12px 14px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                }}
              >
                <FileText size={20} color={exportFormat === 'pdf' ? '#2C6E6A' : '#DC2626'} />
                <div>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: '#1A1A1A' }}>PDF Document</div>
                  <div style={{ fontSize: 10.5, color: '#6B7280' }}>Printable register</div>
                </div>
              </div>

              <div
                onClick={() => setExportFormat('print')}
                style={{
                  border: exportFormat === 'print' ? '2px solid #2C6E6A' : '1px solid #E5E7EB',
                  background: exportFormat === 'print' ? '#EAF3EF' : '#FFFFFF',
                  borderRadius: 8,
                  padding: '12px 14px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                }}
              >
                <Printer size={20} color={exportFormat === 'print' ? '#2C6E6A' : '#4B5563'} />
                <div>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: '#1A1A1A' }}>Print / HTML</div>
                  <div style={{ fontSize: 10.5, color: '#6B7280' }}>Woodlem Letterhead</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* MODAL FOOTER */}
        <div
          style={{
            padding: '14px 24px',
            borderTop: '1px solid #ECEAE5',
            background: '#FAF9F6',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ fontSize: 12, color: '#6B7280' }}>
            Ready to export <strong>{activeExportDates.length} session{activeExportDates.length === 1 ? '' : 's'}</strong> for <strong>{activeExportStudents.length} student{activeExportStudents.length === 1 ? '' : 's'}</strong>.
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '8px 16px',
                fontSize: 12.5,
                fontWeight: 600,
                borderRadius: 6,
                border: '1px solid #D1D5DB',
                background: '#FFFFFF',
                color: '#374151',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleExecuteExport}
              disabled={isExporting || activeExportDates.length === 0}
              style={{
                padding: '8px 20px',
                fontSize: 12.5,
                fontWeight: 700,
                borderRadius: 6,
                border: 'none',
                background: activeExportDates.length === 0 ? '#9CA3AF' : '#2C6E6A',
                color: '#FFFFFF',
                cursor: activeExportDates.length === 0 ? 'not-allowed' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                boxShadow: '0 2px 4px rgba(44,110,106,0.25)',
              }}
            >
              <Download size={15} />
              {isExporting ? 'Generating...' : `Download ${exportFormat.toUpperCase()}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
