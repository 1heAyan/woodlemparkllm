import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      id,
      userId,
      userName,
      userEmail,
      userRole,
      category,
      title,
      description,
      pageContext,
      screenshotDataUrl,
      screenshotName,
      deviceInfo,
      createdAt,
    } = body;

    if (!title || !description) {
      return NextResponse.json(
        { error: 'Title and description are required.' },
        { status: 400 }
      );
    }

    const feedbackRecord = {
      id: id || `fb_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      user_id: userId || 'anonymous',
      user_name: userName || 'Anonymous User',
      user_email: userEmail || 'no-email@woodlempark.ae',
      user_role: userRole || 'general',
      category: category || 'general',
      title,
      description,
      page_context: pageContext || '',
      has_screenshot: Boolean(screenshotDataUrl),
      screenshot_name: screenshotName || (screenshotDataUrl ? 'screenshot.png' : null),
      device_info: deviceInfo || null,
      status: 'new',
      created_at: createdAt || new Date().toISOString(),
    };

    // 1. Log to server console for immediate visibility
    console.log('\n======================================================================');
    console.log(`[USER FEEDBACK SUBMITTED] [${(category || 'GENERAL').toUpperCase()}]`);
    console.log(`From: ${feedbackRecord.user_name} (${feedbackRecord.user_email}) [Role: ${feedbackRecord.user_role}]`);
    console.log(`Title: ${feedbackRecord.title}`);
    console.log(`Context: ${feedbackRecord.page_context}`);
    console.log(`Description: ${feedbackRecord.description}`);
    console.log(`Has Screenshot: ${feedbackRecord.has_screenshot ? 'YES' : 'NO'}`);
    console.log('======================================================================\n');

    // 2. Persist to Supabase audit_logs
    try {
      const details = {
        category: feedbackRecord.category,
        title: feedbackRecord.title,
        description: feedbackRecord.description,
        userEmail: feedbackRecord.user_email,
        pageContext: feedbackRecord.page_context,
        screenshotDataUrl: screenshotDataUrl || undefined,
        screenshotName: screenshotName || undefined,
        deviceInfo: deviceInfo || undefined,
        status: 'new',
      };

      await supabase.from('audit_logs').insert([{
        id: feedbackRecord.id,
        action_type: 'USER_FEEDBACK',
        user_id: feedbackRecord.user_id,
        user_name: feedbackRecord.user_name,
        user_role: feedbackRecord.user_role,
        target_title: feedbackRecord.title,
        details: JSON.stringify(details),
        created_at: feedbackRecord.created_at,
      }]);
    } catch (dbErr) {
      console.warn('[FEEDBACK] Supabase audit_logs insert warning:', dbErr);
    }

    return NextResponse.json({
      success: true,
      feedback: feedbackRecord,
      message: 'Feedback submitted successfully.',
    });
  } catch (error: any) {
    console.error('Error processing feedback submission:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to submit feedback' },
      { status: 500 }
    );
  }
}
