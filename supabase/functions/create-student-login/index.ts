import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ADMIN_USER_ID = "ed5ab433-a082-41cc-81b0-bd2b65cdaa0b";

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return json({ success: false, error: "Method not allowed." }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const authorization = request.headers.get("Authorization");
    const token = authorization?.replace(/^Bearer\s+/i, "");

    if (!supabaseUrl || !serviceRoleKey || !token) {
      return json({ success: false, error: "Secure login service is not configured." }, 500);
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || authData.user?.id !== ADMIN_USER_ID) {
      return json({ success: false, error: "Only the class admin can create student logins." }, 403);
    }

    const body = await request.json();
    const studentId = String(body.studentId || "").trim();
    const password = String(body.password || "");
    if (!studentId || password.length < 8 || password.length > 72) {
      return json({ success: false, error: "Choose a student and use a password of 8–72 characters." }, 400);
    }

    const { data: student, error: studentError } = await supabaseAdmin
      .from("Student")
      .select("id, Student_name, Mobile_number")
      .eq("id", studentId)
      .maybeSingle();

    if (studentError || !student) {
      return json({ success: false, error: "Student record was not found." }, 404);
    }

    let mobile = String(student.Mobile_number || "").replace(/\D/g, "");
    if (mobile.length === 11 && mobile.startsWith("0")) mobile = mobile.slice(1);
    if (mobile.length === 12 && mobile.startsWith("91")) mobile = mobile.slice(2);
    if (mobile.length !== 10) {
      return json({ success: false, error: "Student record mein valid 10 digit mobile number nahi hai." }, 400);
    }

    const loginEmail = `student-${mobile}@nirajcoachingclasses.example.com`;
    const { data: linkedAccount, error: accountLookupError } = await supabaseAdmin
      .from("student_portal_accounts")
      .select("user_id")
      .eq("student_id", String(student.id))
      .maybeSingle();

    if (accountLookupError) {
      return json({ success: false, error: "Student login table could not be read." }, 500);
    }

    if (linkedAccount) {
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
        linkedAccount.user_id,
        {
          email: loginEmail,
          email_confirm: true,
          password,
          user_metadata: { student_id: String(student.id), student_name: student.Student_name || "" },
        },
      );
      if (updateError) {
        return json({ success: false, error: "Login update nahi hua: " + updateError.message }, 400);
      }
      return json({ success: true, updated: true });
    }

    const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: loginEmail,
      password,
      email_confirm: true,
      user_metadata: { student_id: String(student.id), student_name: student.Student_name || "" },
    });

    if (createError || !created.user) {
      return json({ success: false, error: "Login create nahi hua: " + (createError?.message || "Unknown error") }, 400);
    }

    const { error: linkError } = await supabaseAdmin
      .from("student_portal_accounts")
      .insert({ user_id: created.user.id, student_id: String(student.id) });

    if (linkError) {
      await supabaseAdmin.auth.admin.deleteUser(created.user.id);
      return json({ success: false, error: "Login student record se link nahi hua." }, 500);
    }

    return json({ success: true, updated: false });
  } catch (error) {
    console.error("create-student-login failed:", error);
    return json({ success: false, error: "Request complete nahi hui. Dobara koshish karein." }, 500);
  }
});

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
