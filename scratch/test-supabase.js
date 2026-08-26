const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://geewtbleggwsrjazfqac.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdlZXd0YmxlZ2d3c3JqYXpmcWFjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU0MTE4NDIsImV4cCI6MjEwMDk4Nzg0Mn0.inCAGx_xty3j37a1KJrnEzNTT47kh1cuwJBByQhEUxU';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function test() {
  console.log('Testing offline_assessments table...');
  const { data, error } = await supabase.from('offline_assessments').select('*').limit(5);
  if (error) {
    console.error('Error fetching offline_assessments:', error);
  } else {
    console.log('Successfully fetched offline_assessments:', data);
  }

  console.log('Testing offline_assessment_marks table...');
  const { data: marks, error: marksError } = await supabase.from('offline_assessment_marks').select('*').limit(5);
  if (marksError) {
    console.error('Error fetching offline_assessment_marks:', marksError);
  } else {
    console.log('Successfully fetched offline_assessment_marks:', marks);
  }
}

test();
