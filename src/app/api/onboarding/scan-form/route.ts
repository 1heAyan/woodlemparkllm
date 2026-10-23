import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { imageBase64, mimeType = 'image/jpeg' } = await req.json();

    if (!imageBase64) {
      return NextResponse.json({ error: 'No image provided for scanning' }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;

    // Clean base64 data URL prefix if present
    const cleanBase64 = imageBase64.includes(';base64,')
      ? imageBase64.split(';base64,')[1]
      : imageBase64;

    const detectedMime = imageBase64.startsWith('data:')
      ? imageBase64.substring(5, imageBase64.indexOf(';'))
      : mimeType;

    if (!apiKey) {
      console.warn('GEMINI_API_KEY not found, returning smart parsed fallback');
      return NextResponse.json({
        success: true,
        extracted: {
          name: 'Ibrahim Tariq Al-Nuaimi',
          dob: '2010-06-14',
          gender: 'Male',
          nationality: 'United Arab Emirates',
          religion: 'Islam',
          bloodGroup: 'B+',
          firstLanguage: 'Arabic',
          secondLanguage: 'Arabic (Native / Special)',
          studentEmiratesId: '784-2010-1498231-5',
          studentPassportNumber: 'N1984210',
          residentialAddress: 'Villa 22, Al Rawda 3, Ajman',
          cityEmirate: 'Ajman',
          grade: '10',
          section: 'A',
          academicYear: '2026-2027',
          admissionNumber: 'WPS-' + Math.floor(1000 + Math.random() * 9000),
          lastSchoolName: 'Delhi Private School',
          previousCurriculum: 'CBSE (Central Board of Secondary Education)',
          transferReason: 'Relocation / Family Move',
          fatherName: 'Tariq Al-Nuaimi',
          fatherPhone: '+971 50 491 8234',
          fatherOccupation: 'Executive Director, Ajman Municipality',
          motherName: 'Mariam Al-Nuaimi',
          motherPhone: '+971 52 388 9120',
          motherOccupation: 'Senior Education Specialist',
          primaryContact: 'Father',
          parentEmail: 'tariq.nuaimi@gmail.com',
          emergencyContactName: 'Dr. Sultan Al-Nuaimi',
          emergencyContactPhone: '+971 55 901 2345',
          emergencyContactRelationship: 'Paternal Uncle',
          allergies: 'None',
          chronicConditions: 'None',
          emergencyMedication: '',
          senNotes: '',
          cat4Score: '118',
          previousMarks: '91.5%',
        },
        message: 'Sample demo form parsed successfully (add GEMINI_API_KEY for live vision OCR)',
      });
    }

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    const promptText = `
You are an expert AI document and optical character recognition (OCR) parser for Woodlem Park School admissions.
The user has provided a scanned photo or PDF page of a physical, handwritten or printed school admission registration form.

Read the form thoroughly and extract every piece of data.
Return ONLY a valid, raw JSON object (with NO markdown code fences, NO explanation, NO surrounding text) with exactly the following keys:
{
  "name": "Student Full Name as in form or passport",
  "dob": "YYYY-MM-DD format if date found, or string",
  "gender": "Male" or "Female",
  "nationality": "e.g. United Arab Emirates, India, etc.",
  "religion": "e.g. Islam, Christianity, Hinduism, etc.",
  "bloodGroup": "e.g. O+, A+, B+, etc.",
  "firstLanguage": "e.g. English, Arabic, Malayalam, etc.",
  "secondLanguage": "e.g. Arabic, Hindi, French, Urdu, etc.",
  "studentEmiratesId": "784-YYYY-XXXXXXX-X format if visible",
  "studentPassportNumber": "Passport number if visible",
  "residentialAddress": "Address / villa / street",
  "cityEmirate": "e.g. Ajman, Sharjah, Dubai, Abu Dhabi",
  "grade": "e.g. 9, 10, 11, or 12",
  "section": "e.g. A, B, C",
  "academicYear": "e.g. 2026-2027",
  "admissionNumber": "Admission number if filled, or empty",
  "lastSchoolName": "Name of last school attended",
  "previousCurriculum": "e.g. CBSE, British, ICSE, American, MoE",
  "transferReason": "Reason for school transfer",
  "fatherName": "Father full name",
  "fatherPhone": "Father mobile number with country code",
  "fatherOccupation": "Father job / company",
  "motherName": "Mother full name",
  "motherPhone": "Mother mobile number with country code",
  "motherOccupation": "Mother job / company",
  "primaryContact": "Father" or "Mother",
  "parentEmail": "Parent email address for portal login",
  "emergencyContactName": "Emergency contact person",
  "emergencyContactPhone": "Emergency contact phone",
  "emergencyContactRelationship": "Relationship e.g. Uncle, Grandparent",
  "allergies": "Allergies or 'None'",
  "chronicConditions": "Chronic illness or 'None'",
  "emergencyMedication": "Emergency medication notes",
  "senNotes": "Special Educational Needs or gifted notes",
  "cat4Score": "CAT4 exam score if mentioned, e.g. 115",
  "previousMarks": "Previous marks/percentages if mentioned"
}

If a field is not present or illegible in the scanned form, leave it as an empty string ("").
Do not invent facts not in the image. Return strictly valid JSON.
`;

    const requestBody = {
      contents: [
        {
          role: 'user',
          parts: [
            { text: promptText },
            {
              inlineData: {
                mimeType: detectedMime.includes('pdf') ? 'application/pdf' : 'image/jpeg',
                data: cleanBase64,
              },
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 2000,
        responseMimeType: 'application/json',
      },
    };

    const res = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.warn('Gemini vision API error:', res.status, errText);
      throw new Error(`Gemini Vision API error: ${res.status}`);
    }

    const data = await res.json();
    const candidateText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!candidateText) {
      throw new Error('No content returned from Gemini Vision model');
    }

    let parsed: any = {};
    try {
      const cleanedText = candidateText.replace(/```json/gi, '').replace(/```/g, '').trim();
      parsed = JSON.parse(cleanedText);
    } catch (parseErr) {
      console.warn('JSON parse error from Gemini output:', candidateText);
      throw new Error('Failed to parse structured form JSON from image');
    }

    return NextResponse.json({
      success: true,
      extracted: parsed,
      message: 'Physical form successfully scanned & fields extracted via AI',
    });
  } catch (error: any) {
    console.error('Scan form error:', error);
    return NextResponse.json(
      {
        error: error?.message || 'Failed to scan physical form',
      },
      { status: 500 }
    );
  }
}
