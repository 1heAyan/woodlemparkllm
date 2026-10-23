'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { UserProfile, SubjectClass } from '@/lib/supabaseClient';
import { CustomSelect } from '@/components/UI/CustomSelect';
import { MultiSubjectSelect } from '@/components/UI/MultiSubjectSelect';
import { sanitizeUserCode } from '@/lib/userCodeHelper';
import { ONBOARDING_DOC_DEFINITIONS, getDocumentExpiryStatus, formatShortDate } from '@/lib/documentExpiryHelper';
import { buildParentWelcomeEmailHtml } from '@/lib/emailNotificationHelper';
import {
  User,
  GraduationCap,
  Users,
  HeartPulse,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Upload,
  Calendar,
  Mail,
  Shield,
  Eye,
  Trash2,
  ArrowRight,
  ArrowLeft,
  X,
  FileCheck,
  Camera,
} from 'lucide-react';

const GRADES = ['9', '10', '11', '12'] as const;
const SECTIONS = Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i)); // A to Z

const NATIONALITIES = [
  'United Arab Emirates',
  'India',
  'Pakistan',
  'United Kingdom',
  'Egypt',
  'Philippines',
  'Jordan',
  'Syria',
  'Lebanon',
  'Bangladesh',
  'Sri Lanka',
  'Canada',
  'United States',
  'Australia',
  'Other',
];

const RELIGIONS = [
  'Islam',
  'Christianity',
  'Hinduism',
  'Sikhism',
  'Buddhism',
  'Judaism',
  'Other / Prefer not to say',
];

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];

const SECOND_LANGUAGES = [
  'Arabic (Native / Special)',
  'Hindi',
  'French',
  'Urdu',
  'Malayalam',
  'Tamil',
  'German',
  'Special Arabic (Non-Arabs)',
];

const CURRICULA = [
  'CBSE (Central Board of Secondary Education)',
  'British / Cambridge (IGCSE / GCSE)',
  'ICSE / CISCE',
  'International Baccalaureate (IB)',
  'American Curriculum',
  'UAE Ministry of Education (MoE)',
  'Other National Board',
];

const HOUSE_COLOURS = [
  { value: '', label: 'Select House Colour (Optional)' },
  { value: 'Ruby (Red)', label: 'Ruby (Red)' },
  { value: 'Sapphire (Blue)', label: 'Sapphire (Blue)' },
  { value: 'Emerald (Green)', label: 'Emerald (Green)' },
  { value: 'Topaz (Yellow)', label: 'Topaz (Yellow)' },
];

export interface UploadedOnboardingDoc {
  docType: string;
  fileName: string;
  fileDataUrl?: string;
  expiryDate?: string;
  documentNumber?: string;
  uploadedAt: string;
}

export interface StudentOnboardData {
  // Account core
  name: string;
  email: string;
  password: string;
  admissionNumber?: string;
  grade: string;
  classLetter?: string;
  academicYear: string;
  houseColour?: string;
  enrolledSubjects?: string[];

  // Student personal
  dob: string;
  gender: 'Male' | 'Female' | 'Other';
  nationality: string;
  religion: string;
  bloodGroup: string;
  firstLanguage: string;
  secondLanguage: string;
  studentEmiratesId: string;
  studentPassportNumber: string;
  residentialAddress: string;
  cityEmirate: string;

  // Previous schooling
  lastSchoolName: string;
  lastSchoolLocation?: string;
  previousCurriculum: string;
  transferReason: string;

  // Academic entrance & assessment marks
  previousMarks?: string;
  cat4Score?: string;
  satScore?: string;

  // Parents & Guardians
  fatherName: string;
  fatherPhone: string;
  fatherOccupation: string;
  motherName: string;
  motherPhone: string;
  motherOccupation: string;
  primaryContact: 'Father' | 'Mother';
  parentEmail: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  emergencyContactRelationship: string;

  // Medical & Health
  allergies: string;
  chronicConditions: string;
  emergencyMedication: string;
  senNotes: string;

  // Uploaded regulatory documents
  documents: UploadedOnboardingDoc[];
}

interface StudentOnboardingModalProps {
  isOpen: boolean;
  profiles: UserProfile[];
  subjectClasses?: SubjectClass[];
  onClose: () => void;
  onSubmit: (data: StudentOnboardData) => Promise<void> | void;
}

export const StudentOnboardingModal: React.FC<StudentOnboardingModalProps> = ({
  isOpen,
  profiles = [],
  subjectClasses = [],
  onClose,
  onSubmit,
}) => {
  const [activeStep, setActiveStep] = useState<number>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Tab 1: Student Personal Details
  const [name, setName] = useState('');
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState<'Male' | 'Female' | 'Other'>('Male');
  const [nationality, setNationality] = useState('United Arab Emirates');
  const [religion, setReligion] = useState('Islam');
  const [bloodGroup, setBloodGroup] = useState('O+');
  const [firstLanguage, setFirstLanguage] = useState('English');
  const [secondLanguage, setSecondLanguage] = useState('Arabic (Native / Special)');
  const [studentEmiratesId, setStudentEmiratesId] = useState('');
  const [studentPassportNumber, setStudentPassportNumber] = useState('');
  const [residentialAddress, setResidentialAddress] = useState('');
  const [cityEmirate, setCityEmirate] = useState('Sharjah');

  // Academic & Placement (Cohort/Class assigned later upon admission confirmation)
  const [admissionNumber, setAdmissionNumber] = useState('');
  const [grade, setGrade] = useState<'9' | '10' | '11' | '12'>('9');
  const [section, setSection] = useState('Unassigned');
  const [academicYear, setAcademicYear] = useState('2026-2027');
  const [emailPrefix, setEmailPrefix] = useState('');
  const [password, setPassword] = useState('woodlem123');
  const [houseColour, setHouseColour] = useState('');
  const [studentSubjects, setStudentSubjects] = useState('English, Math, Physics, Chemistry, Biology');

  // Previous Schooling (Essential Details Only)
  const [lastSchoolName, setLastSchoolName] = useState('');
  const [previousCurriculum, setPreviousCurriculum] = useState('CBSE (Central Board of Secondary Education)');
  const [transferReason, setTransferReason] = useState('Relocation / Family Move');

  // Optional Assessments & Medical
  const [previousMarks, setPreviousMarks] = useState('');
  const [cat4Score, setCat4Score] = useState('');

  // Tab 2: Parents & Guardians
  const [fatherName, setFatherName] = useState('');
  const [fatherPhone, setFatherPhone] = useState('');
  const [fatherOccupation, setFatherOccupation] = useState('');
  const [motherName, setMotherName] = useState('');
  const [motherPhone, setMotherPhone] = useState('');
  const [motherOccupation, setMotherOccupation] = useState('');
  const [primaryContact, setPrimaryContact] = useState<'Father' | 'Mother'>('Father');
  const [parentEmail, setParentEmail] = useState('');
  const [emergencyContactName, setEmergencyContactName] = useState('');
  const [emergencyContactPhone, setEmergencyContactPhone] = useState('');
  const [emergencyContactRelationship, setEmergencyContactRelationship] = useState('Father');

  // Health & Medical
  const [allergies, setAllergies] = useState('');
  const [chronicConditions, setChronicConditions] = useState('');
  const [emergencyMedication, setEmergencyMedication] = useState('');
  const [senNotes, setSenNotes] = useState('');

  // Tab 3: Regulatory Compliance Documents
  const [documents, setDocuments] = useState<Record<string, {
    fileName: string;
    fileDataUrl?: string;
    expiryDate?: string;
    documentNumber?: string;
  }>>({});

  // AI Form Scanner State
  const [isScanningForm, setIsScanningForm] = useState(false);
  const [scanSuccessMessage, setScanSuccessMessage] = useState<string | null>(null);

  // Email provider status state
  const [emailProviderInfo, setEmailProviderInfo] = useState<{ configured: boolean; provider: string; help: string } | null>(null);
  const [isTestingEmail, setIsTestingEmail] = useState(false);

  // Computed email hook (unconditional at top level)
  const studentFullEmail = useMemo(() => {
    const clean = (emailPrefix || name.toLowerCase().replace(/\s+/g, '.')).replace(/[^a-z0-9.]/g, '');
    return clean ? `${clean}@woodlempark.ae` : 'student@woodlempark.ae';
  }, [emailPrefix, name]);

  useEffect(() => {
    if (isOpen) {
      fetch('/api/send-email')
        .then((res) => res.json())
        .then((data) => setEmailProviderInfo(data))
        .catch(() => {});
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Auto-generate student email prefix when name changes
  const handleNameChange = (val: string) => {
    setName(val);
    if (!emailPrefix || emailPrefix === name.toLowerCase().replace(/[^a-z0-9]/g, '.')) {
      const suggested = val.trim().toLowerCase().replace(/\s+/g, '.').replace(/[^a-z0-9.]/g, '');
      setEmailPrefix(suggested);
    }
  };

  const handlePhysicalFormUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsScanningForm(true);
    setScanSuccessMessage(null);

    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      try {
        const res = await fetch('/api/onboarding/scan-form', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageBase64: dataUrl,
            mimeType: file.type || 'image/jpeg',
          }),
        });

        const json = await res.json();
        if (json.success && json.extracted) {
          const ext = json.extracted;
          if (ext.name) handleNameChange(ext.name);
          if (ext.dob) setDob(ext.dob);
          if (ext.gender === 'Male' || ext.gender === 'Female') setGender(ext.gender);
          if (ext.nationality) setNationality(ext.nationality);
          if (ext.religion) setReligion(ext.religion);
          if (ext.bloodGroup) setBloodGroup(ext.bloodGroup);
          if (ext.firstLanguage) setFirstLanguage(ext.firstLanguage);
          if (ext.secondLanguage) setSecondLanguage(ext.secondLanguage);
          if (ext.studentEmiratesId) setStudentEmiratesId(ext.studentEmiratesId);
          if (ext.studentPassportNumber) setStudentPassportNumber(ext.studentPassportNumber);
          if (ext.residentialAddress) setResidentialAddress(ext.residentialAddress);
          if (ext.cityEmirate) setCityEmirate(ext.cityEmirate);

          if (ext.grade && ['9', '10', '11', '12'].includes(String(ext.grade).trim())) {
            setGrade(String(ext.grade).trim() as any);
          }
          if (ext.admissionNumber) setAdmissionNumber(ext.admissionNumber);
          if (ext.lastSchoolName) setLastSchoolName(ext.lastSchoolName);
          if (ext.previousCurriculum) setPreviousCurriculum(ext.previousCurriculum);
          if (ext.transferReason) setTransferReason(ext.transferReason);

          if (ext.fatherName) setFatherName(ext.fatherName);
          if (ext.fatherPhone) setFatherPhone(ext.fatherPhone);
          if (ext.fatherOccupation) setFatherOccupation(ext.fatherOccupation);
          if (ext.motherName) setMotherName(ext.motherName);
          if (ext.motherPhone) setMotherPhone(ext.motherPhone);
          if (ext.motherOccupation) setMotherOccupation(ext.motherOccupation);
          if (ext.primaryContact === 'Father' || ext.primaryContact === 'Mother') {
            setPrimaryContact(ext.primaryContact);
          }
          if (ext.parentEmail) setParentEmail(ext.parentEmail);
          if (ext.emergencyContactName) setEmergencyContactName(ext.emergencyContactName);
          if (ext.emergencyContactPhone) setEmergencyContactPhone(ext.emergencyContactPhone);
          if (ext.emergencyContactRelationship) setEmergencyContactRelationship(ext.emergencyContactRelationship);

          if (ext.allergies) setAllergies(ext.allergies);
          if (ext.chronicConditions) setChronicConditions(ext.chronicConditions);
          if (ext.emergencyMedication) setEmergencyMedication(ext.emergencyMedication);
          if (ext.senNotes) setSenNotes(ext.senNotes);

          if (ext.cat4Score) setCat4Score(ext.cat4Score);
          if (ext.previousMarks) setPreviousMarks(ext.previousMarks);

          setScanSuccessMessage('✨ Physical form successfully scanned via AI! All fields have been populated. Please review the details.');
        } else {
          alert('Could not parse form: ' + (json.error || 'Please enter details manually.'));
        }
      } catch (err: any) {
        alert('Form scanning error: ' + (err?.message || 'Check network connection'));
      } finally {
        setIsScanningForm(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDocumentFileChange = (docType: string, file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      setDocuments((prev) => ({
        ...prev,
        [docType]: {
          ...prev[docType],
          fileName: file.name,
          fileDataUrl: reader.result as string,
        },
      }));
    };
    reader.readAsDataURL(file);
  };

  const handleDocumentExpiryChange = (docType: string, expiryDate: string) => {
    setDocuments((prev) => ({
      ...prev,
      [docType]: {
        ...prev[docType],
        fileName: prev[docType]?.fileName || '',
        expiryDate,
      },
    }));
  };

  const handleDocumentNumberChange = (docType: string, documentNumber: string) => {
    setDocuments((prev) => ({
      ...prev,
      [docType]: {
        ...prev[docType],
        fileName: prev[docType]?.fileName || '',
        documentNumber,
      },
    }));
  };

  const validateStep = (step: number): boolean => {
    if (step === 1) {
      if (!name.trim()) {
        alert('Please enter Student Full Name.');
        return false;
      }
      if (!dob) {
        alert('Please select Student Date of Birth.');
        return false;
      }
      if (!grade) {
        alert('Please select Applying Grade.');
        return false;
      }
    } else if (step === 2) {
      if (!parentEmail.trim() || !parentEmail.includes('@')) {
        alert('Please enter a valid Primary Parent Email ID.');
        return false;
      }
      if (primaryContact === 'Father' && !fatherName.trim()) {
        alert('Please enter Father Full Name.');
        return false;
      }
      if (primaryContact === 'Mother' && !motherName.trim()) {
        alert('Please enter Mother Full Name.');
        return false;
      }
    }
    return true;
  };

  const handleNext = () => {
    if (validateStep(activeStep)) {
      setActiveStep((prev) => Math.min(prev + 1, 3));
    }
  };

  const handlePrev = () => {
    setActiveStep((prev) => Math.max(prev - 1, 1));
  };

  const handleSendTestEmail = async () => {
    if (!parentEmail.trim() || !parentEmail.includes('@')) {
      alert('Please enter a valid Primary Parent Email ID in Step 2 first.');
      return;
    }
    setIsTestingEmail(true);
    try {
      const res = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: parentEmail.trim(),
          toName: primaryContact === 'Mother' ? motherName : fatherName,
          subject: `[Test Verification] Woodlem Park School Parent Portal Dispatch`,
          html: `<div style="font-family: sans-serif; padding: 24px; color: #1C1B17; max-width: 600px; margin: 0 auto; border: 1px solid #E5E5E5; border-radius: 8px;">
            <h2 style="color: #2C6E6A; margin-top: 0;">Woodlem LMS Test Email Dispatch</h2>
            <p>Dear ${primaryContact === 'Mother' ? (motherName || 'Parent') : (fatherName || 'Parent')},</p>
            <p>This automated test message confirms that your Woodlem LMS email delivery service is operational.</p>
            <div style="background: #FAF9F6; padding: 14px; border-radius: 6px; border: 1px solid #E5E5E5; margin: 16px 0;">
              <div><strong>Parent Portal Login:</strong> ${parentEmail.trim()}</div>
              <div><strong>Default Password:</strong> woodlem123</div>
              <div><strong>Student Name:</strong> ${name.trim() || 'Enrolled Student'}</div>
            </div>
            <p style="font-size: 12px; color: #767571;">Woodlem Park School Admissions Office</p>
          </div>`,
          text: `Woodlem LMS email test confirmed for ${parentEmail.trim()}`,
          type: 'test_dispatch',
          studentName: name.trim() || 'Student',
        }),
      });
      const json = await res.json();
      if (json.provider === 'simulated') {
        alert(
          `⚠️ Email was generated in SIMULATED development mode.\n\n` +
          `No external email service (Resend or SMTP) is configured in your .env.local yet.\n\n` +
          `To deliver real emails to inboxes (Gmail/Outlook), add RESEND_API_KEY or SMTP credentials in your .env.local file.`
        );
      } else if (json.success) {
        alert(`✅ Live test email dispatched via ${json.provider.toUpperCase()}!\n\nPlease check the inbox for: ${parentEmail.trim()}`);
      } else {
        alert(`Email dispatch failed: ${json.error || 'Unknown error'}`);
      }
    } catch (err: any) {
      alert(`Failed to send test email: ${err?.message || err}`);
    } finally {
      setIsTestingEmail(false);
    }
  };

  const handleFinalSubmit = async () => {
    if (activeStep !== 3) {
      handleNext();
      return;
    }

    if (!name.trim() || !parentEmail.trim()) {
      alert('Missing required fields: Student Name or Parent Email.');
      return;
    }

    const duplicateEmail = profiles.find(
      (p) => p.email && p.email.toLowerCase() === studentFullEmail.toLowerCase()
    );
    if (duplicateEmail) {
      alert(`Cannot onboard: Student email "${studentFullEmail}" already exists for ${duplicateEmail.name}.`);
      setActiveStep(1);
      return;
    }

    if (admissionNumber.trim()) {
      const duplicateCode = profiles.find(
        (p) => p.role === 'student' && p.admission_number === admissionNumber.trim()
      );
      if (duplicateCode) {
        alert(`Cannot onboard: Admission Code "${admissionNumber}" is already assigned to ${duplicateCode.name}.`);
        setActiveStep(1);
        return;
      }
    }

    const docList: UploadedOnboardingDoc[] = Object.entries(documents)
      .filter(([_, doc]) => Boolean(doc.fileName))
      .map(([docType, doc]) => ({
        docType,
        fileName: doc.fileName,
        fileDataUrl: doc.fileDataUrl,
        expiryDate: doc.expiryDate,
        documentNumber: doc.documentNumber,
        uploadedAt: new Date().toISOString().split('T')[0],
      }));

    if (docList.length === 0) {
      const proceedWithoutDocs = confirm(
        'Notice: You have not attached any regulatory compliance documents yet.\n\n' +
        'Do you want to complete onboarding now and request the parent to upload them later via their Parent Portal?'
      );
      if (!proceedWithoutDocs) {
        return;
      }
    }

    setIsSubmitting(true);

    try {

      const payload: StudentOnboardData = {
        name: name.trim(),
        email: studentFullEmail,
        password: password || 'woodlem123',
        admissionNumber: admissionNumber.trim() || undefined,
        grade,
        classLetter: section || 'Unassigned',
        academicYear,
        houseColour: houseColour || undefined,
        enrolledSubjects: studentSubjects.split(',').map((s) => s.trim()).filter(Boolean),

        dob,
        gender,
        nationality,
        religion,
        bloodGroup,
        firstLanguage,
        secondLanguage,
        studentEmiratesId: studentEmiratesId.trim(),
        studentPassportNumber: studentPassportNumber.trim(),
        residentialAddress: residentialAddress.trim(),
        cityEmirate,

        lastSchoolName: lastSchoolName.trim(),
        previousCurriculum,
        transferReason: transferReason.trim(),

        previousMarks: previousMarks.trim(),
        cat4Score: cat4Score.trim(),

        fatherName: fatherName.trim(),
        fatherPhone: fatherPhone.trim(),
        fatherOccupation: fatherOccupation.trim(),
        motherName: motherName.trim(),
        motherPhone: motherPhone.trim(),
        motherOccupation: motherOccupation.trim(),
        primaryContact,
        parentEmail: parentEmail.trim().toLowerCase(),
        emergencyContactName: emergencyContactName.trim(),
        emergencyContactPhone: emergencyContactPhone.trim(),
        emergencyContactRelationship,

        allergies: allergies.trim(),
        chronicConditions: chronicConditions.trim(),
        emergencyMedication: emergencyMedication.trim(),
        senNotes: senNotes.trim(),

        documents: docList,
      };

      await onSubmit(payload);
      onClose();
    } catch (err: any) {
      console.error('Student Onboarding submission error:', err);
      alert('Failed to complete onboarding: ' + (err?.message || 'Unexpected error occurred.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const stepsList = [
    { num: 1, label: 'Student & Academics' },
    { num: 2, label: 'Parents & Guardians' },
    { num: 3, label: 'Regulatory Docs & Dispatch' },
  ];

  return (
    <div className="modal-overlay active" onClick={onClose} style={{ zIndex: 1200 }}>
      {/* STANDARD FULL-WIDTH WOODLEM MODAL CONTENT (NO INLINE MAXWIDTH TO PREVENT LEFT ALIGNMENT) */}
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        {/* STANDARD WOODLEM LMS MODAL HEADER (SPANS 100% ACROSS TOP OF SCREEN) */}
        <div className="modal-header">
          <div>
            <h2 className="modal-title">Student Onboarding &amp; Parent Provisioning</h2>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '2px 0 0' }}>
              UAE Ministry of Education Compliant Admissions • Regulatory Clearance &amp; Credentials Dispatch
            </p>
          </div>
          <button type="button" className="close-modal" onClick={onClose}>
            &times;
          </button>
        </div>

        {/* CENTERED SCROLLABLE FORM (MANAGED BY GLOBALS.CSS) */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (activeStep < 3) {
              handleNext();
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.target as HTMLElement).tagName === 'INPUT') {
              e.preventDefault();
              if (activeStep < 3) {
                handleNext();
              }
            }
          }}
          style={{ maxWidth: 840, width: '100%', margin: '0 auto' }}
        >
          {/* STEP TABS (3 SPACIOUS, UNIFIED TABS) */}
          <div
            style={{
              display: 'flex',
              background: '#FAF9F6',
              border: '1px solid var(--border-color)',
              borderRadius: 8,
              padding: 4,
              marginBottom: 20,
              gap: 6,
            }}
          >
            {stepsList.map((step) => {
              const isActive = activeStep === step.num;
              const isCompleted = activeStep > step.num;

              return (
                <button
                  key={step.num}
                  type="button"
                  onClick={() => {
                    if (activeStep > step.num || validateStep(activeStep)) {
                      setActiveStep(step.num);
                    }
                  }}
                  style={{
                    flex: 1,
                    padding: '10px 14px',
                    borderRadius: 6,
                    border: 'none',
                    background: isActive ? '#2D2C2A' : isCompleted ? '#FFFFFF' : 'transparent',
                    color: isActive ? '#FFFFFF' : isCompleted ? '#2D6E5D' : 'var(--text-secondary)',
                    fontSize: 12.5,
                    fontWeight: isActive ? 700 : 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    boxShadow: isActive ? '0 1px 3px rgba(0,0,0,0.12)' : 'none',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <span
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: '50%',
                      background: isActive ? '#FFFFFF' : isCompleted ? '#EAF3EF' : '#E5E3DF',
                      color: isActive ? '#2D2C2A' : isCompleted ? '#2D6E5D' : '#6B6963',
                      fontSize: 11,
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {isCompleted ? '✓' : step.num}
                  </span>
                  <span>{step.label}</span>
                </button>
              );
            })}
          </div>

          {/* AI PHYSICAL FORM SCANNER BAR */}
          <div
            style={{
              background: '#FAF9F6',
              border: '1px solid var(--border-color)',
              borderRadius: 8,
              padding: '16px 20px',
              marginBottom: 24,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 16,
              flexWrap: 'wrap',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 260 }}>
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 8,
                  background: '#EAF3EF',
                  color: '#2C6E6A',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Camera size={19} />
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--neutral-dark)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  AI Physical Form Scanner
                  <span style={{ fontSize: 10, fontWeight: 700, background: '#EAF3EF', color: '#2C6E6A', padding: '1px 6px', borderRadius: 4 }}>
                    AUTO-FILL
                  </span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                  Have a handwritten or printed paper registration form from parents? Upload a photo or scan to auto-fill all student, parent, and academic fields instantly.
                </div>
              </div>
            </div>

            <label
              style={{
                padding: '8px 16px',
                fontSize: 12,
                fontWeight: 600,
                background: '#2C6E6A',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: 6,
                cursor: isScanningForm ? 'wait' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                whiteSpace: 'nowrap',
              }}
            >
              <Upload size={14} />
              {isScanningForm ? 'Scanning with AI Vision...' : 'Scan / Upload Paper Form'}
              <input
                type="file"
                accept="image/*,.pdf"
                style={{ display: 'none' }}
                disabled={isScanningForm}
                onChange={handlePhysicalFormUpload}
              />
            </label>
          </div>

          {scanSuccessMessage && (
            <div
              style={{
                background: '#EAF3EF',
                border: '1px solid #C7E4D8',
                borderRadius: 8,
                padding: '10px 14px',
                marginBottom: 20,
                fontSize: 12,
                fontWeight: 600,
                color: '#2D6E5D',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <span>{scanSuccessMessage}</span>
              <button
                type="button"
                onClick={() => setScanSuccessMessage(null)}
                style={{ background: 'none', border: 'none', color: '#2D6E5D', cursor: 'pointer', fontWeight: 700 }}
              >
                ✕
              </button>
            </div>
          )}

          {/* STEP 1: STUDENT & ACADEMICS */}
          {activeStep === 1 && (
            <div>
              {/* Section 1A: Personal Details */}
              <div
                style={{
                  background: '#FFFFFF',
                  border: '1px solid var(--border-color)',
                  borderRadius: 8,
                  padding: '20px 24px',
                  marginBottom: 20,
                }}
              >
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--neutral-dark)', marginBottom: 4 }}>
                  Student Personal Details
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 16 }}>
                  Enter student biographical information as officially recorded on their UAE Emirates ID and Passport.
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
                  <div className="form-group">
                    <label className="form-label">
                      Student Full Name (as per Passport) <span style={{ color: '#DC2626' }}>*</span>
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. Zayd Mohammed Al-Hashemi"
                      value={name}
                      onChange={(e) => handleNameChange(e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      Date of Birth <span style={{ color: '#DC2626' }}>*</span>
                    </label>
                    <input
                      type="date"
                      className="form-input"
                      value={dob}
                      onChange={(e) => setDob(e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Gender</label>
                    <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                      {(['Male', 'Female'] as const).map((g) => (
                        <button
                          key={g}
                          type="button"
                          onClick={() => setGender(g)}
                          style={{
                            flex: 1,
                            padding: '8px 12px',
                            borderRadius: 6,
                            border: gender === g ? '1.5px solid #2C6E6A' : '1px solid var(--border-color)',
                            background: gender === g ? '#EAF3EF' : '#FFFFFF',
                            color: gender === g ? '#2D6E5D' : 'var(--neutral-dark)',
                            fontWeight: gender === g ? 700 : 500,
                            fontSize: 12.5,
                            cursor: 'pointer',
                          }}
                        >
                          {g}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Nationality</label>
                    <CustomSelect
                      value={nationality}
                      onChange={(val) => setNationality(val)}
                      options={NATIONALITIES.map((n) => ({ value: n, label: n }))}
                      buttonStyle={{ height: 38 }}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Religion</label>
                    <CustomSelect
                      value={religion}
                      onChange={(val) => setReligion(val)}
                      options={RELIGIONS.map((r) => ({ value: r, label: r }))}
                      buttonStyle={{ height: 38 }}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Blood Group</label>
                    <CustomSelect
                      value={bloodGroup}
                      onChange={(val) => setBloodGroup(val)}
                      options={BLOOD_GROUPS.map((b) => ({ value: b, label: b }))}
                      buttonStyle={{ height: 38 }}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">First Language / Mother Tongue</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. English, Arabic, Urdu"
                      value={firstLanguage}
                      onChange={(e) => setFirstLanguage(e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Second Language (Elective)</label>
                    <CustomSelect
                      value={secondLanguage}
                      onChange={(val) => setSecondLanguage(val)}
                      options={SECOND_LANGUAGES.map((l) => ({ value: l, label: l }))}
                      buttonStyle={{ height: 38 }}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Student Emirates ID Number</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="784-YYYY-XXXXXXX-X"
                      value={studentEmiratesId}
                      onChange={(e) => setStudentEmiratesId(e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Student Passport Number</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. N12345678"
                      value={studentPassportNumber}
                      onChange={(e) => setStudentPassportNumber(e.target.value)}
                    />
                  </div>

                  <div className="form-group" style={{ gridColumn: 'span 2' }}>
                    <label className="form-label">Residential Address (UAE)</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Building / Villa, Street, Community"
                      value={residentialAddress}
                      onChange={(e) => setResidentialAddress(e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Emirate / City</label>
                    <CustomSelect
                      value={cityEmirate}
                      onChange={(val) => setCityEmirate(val)}
                      options={[
                        { value: 'Sharjah', label: 'Sharjah' },
                        { value: 'Dubai', label: 'Dubai' },
                        { value: 'Ajman', label: 'Ajman' },
                        { value: 'Abu Dhabi', label: 'Abu Dhabi' },
                        { value: 'Ras Al Khaimah', label: 'Ras Al Khaimah' },
                        { value: 'Fujairah', label: 'Fujairah' },
                        { value: 'Umm Al Quwain', label: 'Umm Al Quwain' },
                      ]}
                      buttonStyle={{ height: 38 }}
                    />
                  </div>
                </div>
              </div>

              {/* Section 1B: Academic Placement & Prior Schooling */}
              <div
                style={{
                  background: '#FFFFFF',
                  border: '1px solid var(--border-color)',
                  borderRadius: 8,
                  padding: '20px 24px',
                  marginBottom: 20,
                }}
              >
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--neutral-dark)', marginBottom: 4 }}>
                  Academic Placement &amp; Prior Schooling
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 16 }}>
                  Record applying grade, academic year, and essential prior schooling background.
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
                  <div className="form-group">
                    <label className="form-label">
                      Applying Grade <span style={{ color: '#DC2626' }}>*</span>
                    </label>
                    <CustomSelect
                      value={grade}
                      onChange={(val) => setGrade(val as any)}
                      options={GRADES.map((g) => ({ value: g, label: `Grade ${g}` }))}
                      buttonStyle={{ height: 38 }}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Academic Year</label>
                    <input
                      type="text"
                      className="form-input"
                      value={academicYear}
                      onChange={(e) => setAcademicYear(e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Last School Attended</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. Delhi Private School"
                      value={lastSchoolName}
                      onChange={(e) => setLastSchoolName(e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Previous Curriculum</label>
                    <CustomSelect
                      value={previousCurriculum}
                      onChange={(val) => setPreviousCurriculum(val)}
                      options={CURRICULA.map((c) => ({ value: c, label: c }))}
                      buttonStyle={{ height: 38 }}
                    />
                  </div>

                  <div className="form-group" style={{ gridColumn: 'span 2' }}>
                    <label className="form-label">Reason for Transfer</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Relocation / Family Move"
                      value={transferReason}
                      onChange={(e) => setTransferReason(e.target.value)}
                    />
                  </div>
                </div>

                {/* Optional Assessment Marks & Medical Notes */}
                <div style={{ marginTop: 18, paddingTop: 16, borderTop: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--neutral-dark)', marginBottom: 12 }}>
                    Standardized Assessment Records (Optional) &amp; Medical Notes
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
                    <div className="form-group">
                      <label className="form-label">Previous Marks Aggregate (%)</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="e.g. 91.5%"
                        value={previousMarks}
                        onChange={(e) => setPreviousMarks(e.target.value)}
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">CAT4 Assessment Score</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="e.g. Mean SAS 118"
                        value={cat4Score}
                        onChange={(e) => setCat4Score(e.target.value)}
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Medical / Allergy Notes</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="e.g. Penicillin allergy or None"
                        value={allergies}
                        onChange={(e) => setAllergies(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: PARENTS & GUARDIANS */}
          {activeStep === 2 && (
            <div>
              {/* Primary Contact & Parent Portal Email */}
              <div
                style={{
                  background: '#FFFFFF',
                  border: '1px solid var(--border-color)',
                  borderRadius: 8,
                  padding: '20px 24px',
                  marginBottom: 20,
                }}
              >
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--neutral-dark)', marginBottom: 4 }}>
                  Primary Parent Account &amp; Communications
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 16 }}>
                  Designate who will be the primary contact and the email identifier for the Parent Portal.
                </div>

                <div className="form-group" style={{ marginBottom: 18 }}>
                  <label className="form-label">
                    Designated Primary Contact for Official School Communications <span style={{ color: '#DC2626' }}>*</span>
                  </label>
                  <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
                    {(['Father', 'Mother'] as const).map((role) => (
                      <button
                        key={role}
                        type="button"
                        onClick={() => {
                          setPrimaryContact(role);
                          setEmergencyContactRelationship(role);
                        }}
                        style={{
                          flex: 1,
                          padding: '10px 14px',
                          borderRadius: 6,
                          border: primaryContact === role ? '1.5px solid #2C6E6A' : '1px solid var(--border-color)',
                          background: primaryContact === role ? '#EAF3EF' : '#FFFFFF',
                          color: primaryContact === role ? '#2D6E5D' : 'var(--neutral-dark)',
                          fontWeight: primaryContact === role ? 700 : 500,
                          fontSize: 13,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 8,
                        }}
                      >
                        <span>{role === 'Father' ? '👨 Father' : '👩 Mother'}</span>
                        {primaryContact === role && <span>(Primary Contact)</span>}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">
                    Primary Parent Email ID (Login Identifier) <span style={{ color: '#DC2626' }}>*</span>
                  </label>
                  <input
                    type="email"
                    className="form-input"
                    placeholder="parent.guardian@example.com"
                    value={parentEmail}
                    onChange={(e) => setParentEmail(e.target.value)}
                    required
                  />
                  <span style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 4, display: 'block' }}>
                    Parent Portal login credentials and default password (woodlem123) will be sent automatically to this address.
                  </span>
                </div>
              </div>

              {/* Father & Mother Information Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
                {/* Father Information */}
                <div
                  style={{
                    background: '#FFFFFF',
                    border: '1px solid var(--border-color)',
                    borderRadius: 8,
                    padding: '20px 22px',
                  }}
                >
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--neutral-dark)', marginBottom: 14 }}>
                    Father's Details
                  </div>
                  <div className="form-group">
                    <label className="form-label">
                      Father Full Name {primaryContact === 'Father' && <span style={{ color: '#DC2626' }}>*</span>}
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. Mohammed Al-Hashemi"
                      value={fatherName}
                      onChange={(e) => setFatherName(e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Father Phone Number (Primary)</label>
                    <input
                      type="tel"
                      className="form-input"
                      placeholder="+971 50 XXXXXXX"
                      value={fatherPhone}
                      onChange={(e) => setFatherPhone(e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Father Occupation / Employer</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. Civil Engineer, ADNOC"
                      value={fatherOccupation}
                      onChange={(e) => setFatherOccupation(e.target.value)}
                    />
                  </div>
                </div>

                {/* Mother Information */}
                <div
                  style={{
                    background: '#FFFFFF',
                    border: '1px solid var(--border-color)',
                    borderRadius: 8,
                    padding: '20px 22px',
                  }}
                >
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--neutral-dark)', marginBottom: 14 }}>
                    Mother's Details
                  </div>
                  <div className="form-group">
                    <label className="form-label">
                      Mother Full Name {primaryContact === 'Mother' && <span style={{ color: '#DC2626' }}>*</span>}
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. Mariam Al-Hashemi"
                      value={motherName}
                      onChange={(e) => setMotherName(e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Mother Phone Number (Secondary)</label>
                    <input
                      type="tel"
                      className="form-input"
                      placeholder="+971 55 XXXXXXX"
                      value={motherPhone}
                      onChange={(e) => setMotherPhone(e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Mother Occupation / Employer</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. Architect, Dubai Design"
                      value={motherOccupation}
                      onChange={(e) => setMotherOccupation(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* Emergency Contact */}
              <div
                style={{
                  background: '#FFFFFF',
                  border: '1px solid var(--border-color)',
                  borderRadius: 8,
                  padding: '20px 24px',
                  marginTop: 20,
                }}
              >
                <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--neutral-dark)', marginBottom: 14 }}>
                  Alternative Emergency Contact Details
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
                  <div className="form-group">
                    <label className="form-label">Emergency Contact Name</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. Tariq Al-Hashemi"
                      value={emergencyContactName}
                      onChange={(e) => setEmergencyContactName(e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Emergency Phone Number</label>
                    <input
                      type="tel"
                      className="form-input"
                      placeholder="+971 5X XXXXXXX"
                      value={emergencyContactPhone}
                      onChange={(e) => setEmergencyContactPhone(e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Relationship to Student</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. Uncle, Grandparent"
                      value={emergencyContactRelationship}
                      onChange={(e) => setEmergencyContactRelationship(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: REGULATORY DOCUMENTS & DISPATCH */}
          {activeStep === 3 && (
            <div>
              <div style={{ marginBottom: 18 }}>
                <h3 style={{ margin: '0 0 4px', fontSize: 15, color: 'var(--neutral-dark)', fontWeight: 700 }}>
                  Step 3: UAE Regulatory Compliance Documents &amp; Dispatch
                </h3>
                <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)' }}>
                  Attach official regulatory documents, document numbers, and expiry dates. Automatic warnings will notify parents 30 days before expiration.
                </p>
              </div>

              {/* 9 Regulatory Compliance Documents */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
                {ONBOARDING_DOC_DEFINITIONS.map((docDef) => {
                  const currentDoc = documents[docDef.type] || { fileName: '' };
                  const isAttached = Boolean(currentDoc.fileName);
                  const expiryStatus = docDef.requiresExpiry && currentDoc.expiryDate
                    ? getDocumentExpiryStatus(currentDoc.expiryDate, true)
                    : null;

                  return (
                    <div
                      key={docDef.type}
                      style={{
                        background: isAttached ? '#FAF9F6' : '#FFFFFF',
                        border: expiryStatus?.isUrgent
                          ? '1.5px solid #F97316'
                          : isAttached
                          ? '1px solid #C7E4D8'
                          : '1px solid var(--border-color)',
                        borderRadius: 8,
                        padding: '16px 18px',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--neutral-dark)' }}>
                            {docDef.label}
                          </span>
                          <span
                            style={{
                              fontSize: 10.5,
                              fontWeight: 700,
                              padding: '2px 7px',
                              borderRadius: 4,
                              background: docDef.requiredForClearance ? '#FEF2F2' : '#F1F5F9',
                              color: docDef.requiredForClearance ? '#DC2626' : '#475569',
                            }}
                          >
                            {docDef.requiredForClearance ? 'Mandatory' : 'Optional'}
                          </span>
                        </div>

                        {expiryStatus && (
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 700,
                              padding: '2px 8px',
                              borderRadius: 4,
                              background: expiryStatus.badgeBg,
                              color: expiryStatus.badgeColor,
                              border: `1px solid ${expiryStatus.badgeBorder}`,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                            }}
                          >
                            {expiryStatus.isUrgent && <AlertTriangle size={11} />}
                            {expiryStatus.label}
                          </span>
                        )}
                      </div>

                      <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginBottom: 12 }}>
                        {docDef.desc}
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: docDef.requiresExpiry ? 'repeat(auto-fit, minmax(200px, 1fr))' : '1fr', gap: 12, alignItems: 'center' }}>
                        {/* File Upload Button */}
                        <div>
                          <label
                            className="btn-secondary"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6,
                              cursor: 'pointer',
                              padding: '7px 12px',
                              fontSize: 11.5,
                              fontWeight: 600,
                              background: isAttached ? '#EAF3EF' : '#FFFFFF',
                              color: isAttached ? '#2D6E5D' : 'var(--neutral-dark)',
                              borderColor: isAttached ? '#C7E4D8' : 'var(--border-color)',
                              width: '100%',
                              justifyContent: 'center',
                              boxSizing: 'border-box',
                            }}
                          >
                            <Upload size={13} />
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {isAttached ? `✓ ${currentDoc.fileName}` : 'Attach Document File'}
                            </span>
                            <input
                              type="file"
                              accept=".pdf,.jpg,.jpeg,.png"
                              style={{ display: 'none' }}
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handleDocumentFileChange(docDef.type, file);
                              }}
                            />
                          </label>
                        </div>

                        {/* Document Number */}
                        <div>
                          <input
                            type="text"
                            className="form-input"
                            placeholder={docDef.docNumberPlaceholder || 'Document / ID Number'}
                            value={currentDoc.documentNumber || ''}
                            onChange={(e) => handleDocumentNumberChange(docDef.type, e.target.value)}
                            style={{ fontSize: 12, height: 36 }}
                          />
                        </div>

                        {/* Expiry Date */}
                        {docDef.requiresExpiry && (
                          <div>
                            <input
                              type="date"
                              className="form-input"
                              value={currentDoc.expiryDate || ''}
                              onChange={(e) => handleDocumentExpiryChange(docDef.type, e.target.value)}
                              style={{ fontSize: 12, height: 36 }}
                              title="Document Expiration Date"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Automated Parent Welcome Email Dispatch Preview */}
              <div
                style={{
                  background: '#FFFFFF',
                  border: '1px solid var(--border-color)',
                  borderRadius: 8,
                  padding: '20px 22px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Mail size={16} color="#2C6E6A" />
                    <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--neutral-dark)' }}>
                      Automated Parent Welcome Email Dispatch Preview
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        padding: '3px 8px',
                        borderRadius: 4,
                        background: emailProviderInfo?.configured ? '#EAF3EF' : '#FEF3C7',
                        color: emailProviderInfo?.configured ? '#2D6E5D' : '#92400E',
                        border: emailProviderInfo?.configured ? '1px solid #C7E4D8' : '1px solid #FDE68A',
                      }}
                    >
                      {emailProviderInfo?.configured ? `🟢 ${emailProviderInfo.provider.toUpperCase()} Active` : '🟡 Simulated (Needs API Key)'}
                    </span>

                    <button
                      type="button"
                      onClick={handleSendTestEmail}
                      disabled={isTestingEmail || !parentEmail.trim()}
                      className="btn-secondary"
                      style={{
                        padding: '4px 10px',
                        fontSize: 11.5,
                        fontWeight: 600,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        cursor: isTestingEmail || !parentEmail.trim() ? 'not-allowed' : 'pointer',
                      }}
                      title="Send a live test verification email to the parent email entered"
                    >
                      {isTestingEmail ? 'Sending...' : 'Send Test Email'}
                    </button>
                  </div>
                </div>
                <div
                  style={{
                    background: '#FAF9F6',
                    border: '1px solid var(--border-color)',
                    borderRadius: 6,
                    padding: 16,
                    fontSize: 12,
                    lineHeight: 1.6,
                    color: 'var(--neutral-dark)',
                  }}
                >
                  <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: 8, marginBottom: 10, color: 'var(--text-secondary)' }}>
                    <strong>To:</strong> {parentEmail || 'parent.guardian@example.com'} • <strong>Subject:</strong> Welcome to Woodlem Park School — Parent Portal Credentials for {name || 'Student'}
                  </div>
                  <p style={{ margin: '0 0 8px' }}>
                    Dear {primaryContact === 'Mother' ? (motherName || 'Parent / Guardian') : (fatherName || 'Parent / Guardian')},
                  </p>
                  <p style={{ margin: '0 0 8px' }}>
                    Welcome to <strong>Woodlem Park School</strong>. We are pleased to confirm that <strong>{name || 'your child'}</strong> has been officially registered for <strong>Grade {grade}{section && section !== 'Unassigned' ? `-${section}` : ''}</strong>{admissionNumber ? ` (Admission No: ${admissionNumber})` : ''}.
                  </p>
                  <div style={{ background: '#FFFFFF', padding: '10px 14px', borderRadius: 6, border: '1px solid var(--border-color)', margin: '10px 0' }}>
                    <div><strong>Portal Login URL:</strong> {typeof window !== 'undefined' ? window.location.origin : 'https://woodlem.ae'}</div>
                    <div><strong>Username / Identifier:</strong> {parentEmail}</div>
                    <div><strong>Default Password:</strong> woodlem123</div>
                  </div>
                  <p style={{ margin: '8px 0 0', fontSize: 11.5, color: 'var(--text-secondary)' }}>
                    Security Notice: Please update your password immediately upon your first sign-in.
                  </p>
                </div>

                {!emailProviderInfo?.configured && (
                  <div style={{ marginTop: 12, padding: '10px 12px', borderRadius: 6, background: '#FFFBEB', border: '1px solid #FDE68A', fontSize: 11.5, color: '#92400E', lineHeight: 1.5 }}>
                    <strong>Note for live inbox delivery:</strong> Woodlem LMS generates and records the email successfully, but to deliver it into a real parent inbox (Gmail/Outlook), add your free <code>RESEND_API_KEY</code> or <code>SMTP_USER / SMTP_PASS</code> in <code>.env.local</code>.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STANDARD WOODLEM LMS MODAL FOOTER */}
          <div
            className="modal-footer"
            style={{
              marginTop: 32,
              paddingTop: 18,
              borderTop: '1px solid var(--border-color)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 12,
            }}
          >
            <div>
              {activeStep > 1 && (
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={handlePrev}
                  disabled={isSubmitting}
                >
                  ← Back
                </button>
              )}
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={onClose}
                disabled={isSubmitting}
              >
                Cancel
              </button>

              {activeStep < 3 ? (
                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleNext}
                >
                  Continue to Step {activeStep + 1} →
                </button>
              ) : (
                <button
                  type="button"
                  className="btn-primary"
                  disabled={isSubmitting}
                  onClick={handleFinalSubmit}
                  style={{
                    background: '#2C6E6A',
                    borderColor: '#2C6E6A',
                  }}
                >
                  {isSubmitting ? 'Onboarding Student & Dispatching...' : 'Complete Onboarding & Dispatch Email'}
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
