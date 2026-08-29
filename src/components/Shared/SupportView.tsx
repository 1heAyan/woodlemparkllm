'use client';

import React, { useState, useMemo } from 'react';
import { UserProfile } from '@/lib/supabaseClient';
import { SegmentedControl } from '@/components/UI/SegmentedControl';

interface SupportViewProps {
  currentUser: UserProfile;
}

const FAQ_ITEMS = [
  {
    category: 'Account & Password',
    question: 'How do I change or reset my account password?',
    answer:
      'You can change your password anytime by heading to the "Settings & Passwords" tab in your dashboard sidebar. Enter your new password (at least 6 characters) and click "Save New Password". If you forget your password, contact your school administrator or IT Helpdesk to perform an instant password reset.',
  },
  {
    category: 'Classroom & Homework',
    question: 'How do students submit homework assignments and files?',
    answer:
      'Click on your enrolled classroom in the sidebar, open the "Assessments & Tasks" tab, and locate the assigned task. Click "Submit Work" to upload your assignment document, PDF, or presentation.',
  },
  {
    category: 'Classroom & Resources',
    question: 'Where can I find lesson notes, worksheets, and teacher slides?',
    answer:
      'Every subject classroom has a dedicated "Learning Resources" tab where faculty upload reference PDFs, lecture slides, worksheets, and external video links organized by topic.',
  },
  {
    category: 'Attendance & Records',
    question: 'How is student attendance recorded and calculated?',
    answer:
      'Class teachers record homeroom attendance during morning registration. Attendance percentage is calculated in real-time and visible to students, parents, and school administrators.',
  },
  {
    category: 'Parent Documents',
    question: 'How do parents submit mandatory student clearance forms?',
    answer:
      'Parents can log into the Parent Portal, open the "Clearance Documents" tab, and upload required documents such as Medical Forms, Consent Letters, and Student ID cards.',
  },
  {
    category: 'Grades & Sections',
    question: 'Which cohorts are supported on the Woodlem LMS portal?',
    answer:
      'Woodlem Park School Al Jurf LMS supports high school students across Grades 9, 10, 11, and 12, organized with section divisions from A through Z.',
  },
  {
    category: 'Technical Support',
    question: 'Who should I contact if I experience technical glitches or portal issues?',
    answer:
      'You can reach out directly to the IT Helpdesk via email at it-helpdesk@woodlempark.ae or phone +971 6 740 9444 (Ext. 104).',
  },
];

export const SupportView: React.FC<SupportViewProps> = () => {
  const [activeSubTab, setActiveSubTab] = useState<'faq' | 'contacts'>('contacts');

  // FAQ search query
  const [faqSearch, setFaqSearch] = useState('');
  const [selectedFaqCategory, setSelectedFaqCategory] = useState('All');
  const [expandedFaqIndex, setExpandedFaqIndex] = useState<number | null>(0);

  const filteredFaqs = useMemo(() => {
    return FAQ_ITEMS.filter((item) => {
      if (selectedFaqCategory !== 'All' && item.category !== selectedFaqCategory) return false;
      if (faqSearch.trim()) {
        const q = faqSearch.toLowerCase();
        return (
          item.question.toLowerCase().includes(q) ||
          item.answer.toLowerCase().includes(q) ||
          item.category.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [faqSearch, selectedFaqCategory]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Top Banner Header */}
      <div
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border-color)',
          borderRadius: 8,
          padding: '16px 20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#2C6E6A', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Woodlem Park School · Al Jurf, Ajman
          </span>
          <h2 style={{ margin: '2px 0 0', fontSize: 17, fontWeight: 800, color: 'var(--neutral-dark)' }}>
            Helpdesk &amp; Campus Directory
          </h2>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '4px 0 0' }}>
            Official contact information, working hours, and knowledge base guides for Woodlem Park School, Al Jurf, Ajman.
          </p>
        </div>

        {/* Sub-Tabs (Contacts and FAQ Only) */}
        <div style={{ display: 'flex' }}>
          <SegmentedControl
            value={activeSubTab}
            onChange={(tab) => setActiveSubTab(tab)}
            options={[
              { value: 'contacts', label: 'Campus Directory & Contacts' },
              { value: 'faq', label: 'Knowledge Base & FAQ' },
            ]}
            height={34}
            textTransform="none"
          />
        </div>
      </div>

      {/* VIEW 1: CAMPUS DIRECTORY & CONTACTS */}
      {activeSubTab === 'contacts' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Main Campus Overview Card */}
          <div
            style={{
              background: 'linear-gradient(135deg, #1E293B 0%, #0F172A 100%)',
              color: '#FFFFFF',
              borderRadius: 8,
              padding: '18px 22px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 16,
              boxShadow: '0 4px 14px rgba(0,0,0,0.12)',
            }}
          >
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#00F5D4', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Official Campus Headquarters
              </div>
              <h3 style={{ margin: '4px 0 2px', fontSize: 18, fontWeight: 800, letterSpacing: '0.01em' }}>
                Woodlem Park School, Al Jurf
              </h3>
              <p style={{ margin: 0, fontSize: 12.5, color: '#CBD5E1' }}>
                P.O. Box 1215, Al Jurf Industrial Area 3, Ajman, United Arab Emirates
              </p>
            </div>

            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              <div style={{ background: 'rgba(255,255,255,0.08)', padding: '8px 14px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.12)' }}>
                <div style={{ fontSize: 10, color: '#94A3B8', fontWeight: 600 }}>MAIN RECEPTION</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#FFFFFF', marginTop: 2 }}>+971 6 740 9444</div>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.08)', padding: '8px 14px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.12)' }}>
                <div style={{ fontSize: 10, color: '#94A3B8', fontWeight: 600 }}>GENERAL EMAIL</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#00F5D4', marginTop: 2 }}>info@woodlempark.ae</div>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.08)', padding: '8px 14px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.12)' }}>
                <div style={{ fontSize: 10, color: '#94A3B8', fontWeight: 600 }}>OFFICIAL PORTAL</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#FFFFFF', marginTop: 2 }}>www.woodlempark.ae</div>
              </div>
            </div>
          </div>

          {/* Department Contact Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))', gap: 14 }}>
            {[
              {
                title: 'Main Administration & Reception',
                email: 'info@woodlempark.ae',
                phone: '+971 6 740 9444',
                hours: 'Mon – Thu: 7:30 AM – 3:30 PM | Fri: 7:30 AM – 12:00 PM',
                desc: 'General school reception, visitor inquiries, parent liaison desk, and administrative appointments.',
              },
              {
                title: 'Admissions & Student Registration',
                email: 'admissions@woodlempark.ae',
                phone: '+971 6 740 9444 (Ext. 101)',
                hours: 'Mon – Thu: 8:00 AM – 3:30 PM | Fri: 8:00 AM – 11:30 AM',
                desc: 'Grade 9–12 admissions, student registration, transfer certificates, and entrance evaluations.',
              },
              {
                title: 'IT Helpdesk & LMS Systems',
                email: 'it-helpdesk@woodlempark.ae',
                phone: '+971 6 740 9444 (Ext. 104)',
                hours: 'Mon – Thu: 7:30 AM – 4:00 PM | Fri: 7:30 AM – 12:00 PM',
                desc: 'Student/Teacher portal accounts, password resets, classroom connectivity, and digital learning support.',
              },
              {
                title: 'Academic Affairs & Examinations',
                email: 'academics@woodlempark.ae',
                phone: '+971 6 740 9444 (Ext. 108)',
                hours: 'Mon – Thu: 7:45 AM – 3:45 PM | Fri: 7:45 AM – 11:45 AM',
                desc: 'CBSE curriculum coverage, assessment schedules, report cards, topic syllabi, and academic records.',
              },
              {
                title: 'Finance & Accounts Department',
                email: 'accounts@woodlempark.ae',
                phone: '+971 6 740 9444 (Ext. 102)',
                hours: 'Mon – Thu: 8:00 AM – 3:00 PM | Fri: 8:00 AM – 11:30 AM',
                desc: 'Tuition fees, online fee payment receipts, clearance certificates, and sibling concession queries.',
              },
              {
                title: 'Campus Health Clinic & Medical Care',
                email: 'clinic@woodlempark.ae',
                phone: '+971 6 740 9444 (Ext. 120)',
                hours: 'Mon – Thu: 7:30 AM – 4:00 PM | Fri: 7:30 AM – 12:00 PM',
                desc: 'Medical clearance forms, vaccination records, emergency first-aid, and student health records.',
              },
              {
                title: 'School Transport & Bus Operations',
                email: 'transport@woodlempark.ae',
                phone: '+971 6 740 9444 (Ext. 110)',
                hours: 'Mon – Thu: 7:00 AM – 4:30 PM | Fri: 7:00 AM – 12:30 PM',
                desc: 'Bus route allocation, GPS bus tracking inquiries, bus supervisor coordination, and timings.',
              },
              {
                title: 'Pastoral Care & Well-being Office',
                email: 'wellbeing@woodlempark.ae',
                phone: '+971 6 740 9444 (Ext. 115)',
                hours: 'Mon – Thu: 7:30 AM – 3:30 PM | Fri: 7:30 AM – 11:30 AM',
                desc: 'Student behavioral counseling, pastoral development, special educational needs, and holistic guidance.',
              },
            ].map((dept, i) => (
              <div
                key={i}
                style={{
                  border: '1px solid var(--border-color)',
                  borderRadius: 8,
                  padding: '16px 18px',
                  background: '#FFFFFF',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                  boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--neutral-dark)' }}>
                    {dept.title}
                  </h4>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      color: '#2C6E6A',
                      background: '#EAF3EF',
                      padding: '2px 7px',
                      borderRadius: 4,
                    }}
                  >
                    Al Jurf Campus
                  </span>
                </div>

                <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                  {dept.desc}
                </p>

                <div style={{ borderTop: '1px solid #ECEAE5', paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 5, fontSize: 12 }}>
                  <div style={{ display: 'flex', gap: 6, color: 'var(--neutral-dark)' }}>
                    <span style={{ fontWeight: 600, color: 'var(--text-secondary)', width: 55 }}>Email:</span>
                    <a href={`mailto:${dept.email}`} style={{ color: '#2C6E6A', fontWeight: 600, textDecoration: 'none' }}>
                      {dept.email}
                    </a>
                  </div>
                  <div style={{ display: 'flex', gap: 6, color: 'var(--neutral-dark)' }}>
                    <span style={{ fontWeight: 600, color: 'var(--text-secondary)', width: 55 }}>Phone:</span>
                    <span style={{ fontWeight: 500 }}>{dept.phone}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 6, color: 'var(--neutral-dark)' }}>
                    <span style={{ fontWeight: 600, color: 'var(--text-secondary)', width: 55 }}>Hours:</span>
                    <span style={{ color: 'var(--text-secondary)', fontSize: 11.5 }}>{dept.hours}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* VIEW 2: KNOWLEDGE BASE & FAQ */}
      {activeSubTab === 'faq' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* FAQ Search & Category Filter */}
          <div
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border-color)',
              borderRadius: 8,
              padding: '16px 20px',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <input
                type="text"
                placeholder="Search knowledge base articles and guides..."
                value={faqSearch}
                onChange={(e) => setFaqSearch(e.target.value)}
                style={{
                  flex: 1,
                  minWidth: 240,
                  height: 32,
                  padding: '0 12px',
                  fontSize: 12,
                  borderRadius: 6,
                  border: '1px solid #E5E3DF',
                  background: '#FFFFFF',
                  color: '#1A1A1A',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Category Filter Pills */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {['All', 'Account & Password', 'Classroom & Homework', 'Classroom & Resources', 'Attendance & Records', 'Parent Documents', 'Technical Support'].map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedFaqCategory(cat)}
                  style={{
                    padding: '5px 12px',
                    fontSize: 11.5,
                    fontWeight: selectedFaqCategory === cat ? 700 : 500,
                    borderRadius: 20,
                    border: selectedFaqCategory === cat ? '1px solid #2D2C2A' : '1px solid var(--border-color)',
                    background: selectedFaqCategory === cat ? '#2D2C2A' : '#FFFFFF',
                    color: selectedFaqCategory === cat ? '#FFFFFF' : 'var(--neutral-dark)',
                    cursor: 'pointer',
                  }}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* FAQ Accordion List */}
          <div
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border-color)',
              borderRadius: 8,
              padding: '12px 18px',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            {filteredFaqs.length === 0 ? (
              <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>
                No FAQ articles match your search query. Try searching with different keywords.
              </div>
            ) : (
              filteredFaqs.map((faq, index) => {
                const isOpen = expandedFaqIndex === index;
                return (
                  <div
                    key={index}
                    style={{
                      border: '1px solid var(--border-color)',
                      borderRadius: 6,
                      background: isOpen ? '#FAF9F6' : '#FFFFFF',
                      overflow: 'hidden',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => setExpandedFaqIndex(isOpen ? null : index)}
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        textAlign: 'left',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        gap: 12,
                      }}
                    >
                      <div>
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            color: '#2C6E6A',
                            textTransform: 'uppercase',
                            letterSpacing: '0.04em',
                            marginRight: 8,
                          }}
                        >
                          [{faq.category}]
                        </span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--neutral-dark)' }}>
                          {faq.question}
                        </span>
                      </div>
                      <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-secondary)' }}>
                        {isOpen ? '−' : '+'}
                      </span>
                    </button>

                    {isOpen && (
                      <div
                        style={{
                          padding: '10px 16px 14px',
                          fontSize: 12.5,
                          lineHeight: 1.55,
                          color: 'var(--text-secondary)',
                          borderTop: '1px solid var(--border-color)',
                          background: '#FFFFFF',
                        }}
                      >
                        {faq.answer}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
