Got it Kyle 👍 here’s the **cleaned master prompt** with **no mention of pages** and still clearly instructing the other AI not to redesign your system.

You can copy this directly:

---

# 📌 SYSTEM ENHANCEMENT INSTRUCTIONS (DO NOT REDESIGN)

We already have a completed wireframe and structured School Management System with working modules (Student, Registrar, Teacher, Principal, Admin).

⚠️ IMPORTANT INSTRUCTION:

* Do NOT redesign the entire system.
* Do NOT change the UI layout, navigation, theme, or structure.
* Do NOT remove existing modules.
* Do NOT reorganize dashboards.

Only ADD or ENHANCE the necessary missing features and system logic listed below.

The objective is to improve functionality, validation, and system enforcement — NOT to rebuild the system.

---

# REQUIRED SYSTEM IMPROVEMENTS

---

## 1️⃣ School Year Control (Critical)

* Enrollment must require an ACTIVE School Year.
* Only Principal or Admin can:

  * Create School Year
  * Activate / Deactivate School Year
* Add School Year dropdown filters in:

  * Enrollment
  * Grades
  * Attendance
  * Reports
* Keep existing dashboards. Only add enforcement logic and filters.

---

## 2️⃣ Student Number System

* Auto-generate a SCHOOL-BASED Student Number.
* Must NOT depend on LRN.
* LRN remains for DepEd reference only.
* Student Number becomes the system’s primary identifier.
* Do NOT change profile layout — only enhance logic.

---

## 3️⃣ Registrar – Enrollment Improvements

Enhance the existing Enrollment Review process:

* Add REQUIRED comment field when:

  * Approving
  * Rejecting
* Comments must be visible in the Student Portal.
* Add embedded PDF preview inside the review modal.
* Add payment verification status flow:

  * Pending Review
  * For Payment
  * Payment Verified
  * Approved
  * Rejected

Do NOT redesign the enrollment table or modal layout — just enhance functionality.

---

## 4️⃣ Section Configuration Enhancement

Add configuration capability for:

* Creating section names
* Setting section capacity
* Assigning adviser
* Linking section to School Year

Add validation:

* Prevent exceeding capacity.

Do NOT change the section UI layout — only enhance logic and configuration.

---

## 5️⃣ Student Portal – My Grades Enhancement

Enhance existing grades page:

Add:

* School Year dropdown
* Semester filter (Grade 11 & 12 – 1st / 2nd Semester)
* Status column (Passed / Failed / Incomplete)

Do NOT redesign the grade table.

---

## 6️⃣ Payment Workflow

When student submits a request:

* Show popup message:
  “Please proceed to Registrar for payment.”
* Add payment tracking status:

  * Unpaid
  * Under Verification
  * Paid
  * Processing

Do NOT change dashboard structure.

---

## 7️⃣ Announcement Filtering Logic

Enhance logic so announcements can be filtered by:

* Year Level
* Strand
* Section
* Department

Students must only see announcements assigned to them.

Keep the existing announcement design.

---

## 8️⃣ Attendance Enhancement

Add:

* Date picker filter
* School Year filter
* Semester filter

Optional:

* Export attendance to PDF

Do NOT redesign attendance layout.

---

## 9️⃣ Principal Reports Enhancement

Add:

* Export to PDF
* Export to Excel
* School Year filter
* Semester filter

Keep current report design.

---

## 🔟 Account Logic Improvements

* Remove manual “Create Account” from Registrar.
* Automatically create student account upon enrollment approval.
* Auto-generate default temporary password.
* Force password change on first login.

Do NOT modify login page design.

---

# SYSTEM RULES TO ENFORCE

* Enrollment cannot proceed without:

  * Active School Year
  * Assigned Section
  * Verified Payment
  * Complete Documents
* Section capacity must auto-update.
* Approval actions must be logged.
* Maintain strict role-based access control.

---

# FINAL REMINDER

Do NOT:

* Change theme
* Redesign dashboards
* Rearrange modules
* Remove existing features

Only enhance logic, validation, filtering, and configuration panels where necessary.

Focus on system completeness and enforcement logic while preserving the current UI and structure.

---

If you want, I can also make a **shorter version** (in case the AI you’re using has a character limit).
