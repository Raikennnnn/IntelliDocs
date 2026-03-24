# 🏗️ SYSTEM ARCHITECTURE - School Year & Student Number System

## Component Hierarchy & Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                           App.tsx                               │
│                  <SchoolYearProvider>                           │
│                 (Wraps entire application)                      │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ├─────────────────────────────────────┐
                         │                                     │
                         ▼                                     ▼
         ┌───────────────────────────┐         ┌─────────────────────────┐
         │  SchoolYearContext        │         │  Other Providers        │
         │  (Global State)           │         │  (Future: Auth, etc.)   │
         └───────────┬───────────────┘         └─────────────────────────┘
                     │
                     │ Provides:
                     │ • activeSchoolYear
                     │ • schoolYears[]
                     │ • setActiveSchoolYear()
                     │ • addSchoolYear()
                     │ • updateSchoolYear()
                     │
     ┌───────────────┼───────────────┬─────────────────┬──────────────────┐
     │               │               │                 │                  │
     ▼               ▼               ▼                 ▼                  ▼
┌─────────┐   ┌──────────┐   ┌──────────┐   ┌─────────────┐   ┌──────────────┐
│ Admin   │   │Registrar │   │ Student  │   │  Teacher    │   │  Principal   │
│Dashboard│   │Dashboard │   │  Portal  │   │   Portal    │   │   Portal     │
└────┬────┘   └────┬─────┘   └────┬─────┘   └──────┬──────┘   └──────┬───────┘
     │             │              │                 │                  │
     ▼             ▼              ▼                 ▼                  ▼
```

---

## School Year Management Flow

```
┌──────────────────────────────────────────────────────────────────┐
│                   School Year Management                         │
│                (Principal/Admin Access Only)                     │
└────────────────────────┬─────────────────────────────────────────┘
                         │
         ┌───────────────┼───────────────┐
         │               │               │
         ▼               ▼               ▼
    ┌────────┐    ┌──────────┐    ┌──────────┐
    │ Create │    │ Activate │    │Deactivate│
    │   SY   │    │    SY    │    │    SY    │
    └────┬───┘    └────┬─────┘    └────┬─────┘
         │             │                │
         │             │                │
         ▼             ▼                ▼
    ┌────────────────────────────────────────┐
    │      SchoolYearContext.setState()      │
    │      Updates: schoolYears[]            │
    └──────────────┬─────────────────────────┘
                   │
                   │ Triggers re-render in:
                   │
    ┌──────────────┼──────────────┬──────────────────┐
    │              │              │                  │
    ▼              ▼              ▼                  ▼
┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────────────┐
│Enrollment│  │ School   │  │ Active   │  │  All pages with │
│  Guard   │  │  Year    │  │  School  │  │  SchoolYear     │
│          │  │  Filter  │  │   Year   │  │  Filter         │
│          │  │          │  │  Banner  │  │                 │
└──────────┘  └──────────┘  └──────────┘  └─────────────────┘
```

---

## Enrollment Guard Logic

```
                Student/Registrar
                Tries to Access
                Enrollment Form
                       │
                       ▼
              ┌────────────────┐
              │EnrollmentGuard │
              │   Component    │
              └───────┬────────┘
                      │
                      ▼
         Check: useEnrollmentAllowed()
                      │
                      │
         ┌────────────┴────────────┐
         │                         │
         ▼                         ▼
   ┌──────────┐            ┌──────────────┐
   │ Active   │            │  NO Active   │
   │ School   │            │   School     │
   │  Year    │            │    Year      │
   │  Exists  │            │   Exists     │
   └────┬─────┘            └──────┬───────┘
        │                         │
        ▼                         ▼
  ┌──────────┐            ┌─────────────┐
  │ ✅ ALLOW │            │ ❌ BLOCK    │
  │  Render  │            │  Show Error │
  │ Children │            │  Message    │
  └──────────┘            └─────────────┘
        │                         │
        ▼                         ▼
┌────────────────┐        ┌──────────────────┐
│ Enrollment Form│        │ 🔒 Enrollment    │
│    Renders     │        │ Currently        │
│                │        │ Unavailable      │
└────────────────┘        └──────────────────┘
```

---

## Student Number Generation Flow

```
                    Admin/Registrar
                    Clicks "Add User"
                    Role: Student
                           │
                           ▼
                  ┌────────────────┐
                  │ Add User Dialog│
                  └────────┬───────┘
                           │
                           ▼
               Clicks "Generate Student Number"
                           │
                           ▼
             ┌─────────────────────────────┐
             │ Check Active School Year    │
             └──────────┬──────────────────┘
                        │
                        ▼
              ┌──────────────────────┐
              │ Active SY: 2025-2026 │
              └──────────┬───────────┘
                         │
                         ▼
            Extract Start Year: 2025
                         │
                         ▼
      ┌──────────────────────────────────┐
      │ Query Existing Students          │
      │ Filter: studentNumber like 2025-%│
      └──────────┬───────────────────────┘
                 │
                 ▼
      Find Max Sequence: 247
      (from "2025-0247")
                 │
                 ▼
      ┌──────────────────────┐
      │ Generate Next Number │
      │   2025 - 0248        │
      └──────────┬───────────┘
                 │
                 ▼
      ┌──────────────────────┐
      │ Display in Form:     │
      │ Student Number:      │
      │ [2025-0248]         │
      └─────────────────────┘

KEY POINTS:
• Year comes from ACTIVE school year
• Sequence is auto-incremented
• NOT dependent on LRN
• LRN stored separately
```

---

## Data Relationships

```
┌────────────────────────────────────────────────────────────┐
│                      School Year                           │
│  ┌──────────────────────────────────────────────────┐     │
│  │ 2025-2026 (Active)                               │     │
│  │ Start: 2025-06-01                                │     │
│  │ End: 2026-03-31                                  │     │
│  │ Enrolled: 1,247 students                         │     │
│  └───────────────────┬──────────────────────────────┘     │
└──────────────────────┼─────────────────────────────────────┘
                       │
                       │ Has Many Students
                       │
        ┌──────────────┼──────────────┬─────────────┐
        │              │              │             │
        ▼              ▼              ▼             ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│   Student    │ │   Student    │ │   Student    │ │     ...      │
│              │ │              │ │              │ │              │
│ Number:      │ │ Number:      │ │ Number:      │ │ 1,244 more   │
│ 2025-0001   │ │ 2025-0002   │ │ 2025-0003   │ │              │
│              │ │              │ │              │ │              │
│ LRN:         │ │ LRN:         │ │ LRN:         │ │              │
│ 123456789012│ │ 234567890123│ │ 345678901234│ │              │
│   (DepEd)   │ │   (DepEd)   │ │   (DepEd)   │ │              │
│              │ │              │ │              │ │              │
│ Name:        │ │ Name:        │ │ Name:        │ │              │
│ Juan DC     │ │ Maria Santos│ │ Pedro Garcia│ │              │
│              │ │              │ │              │ │              │
│ Grade: 11   │ │ Grade: 12   │ │ Grade: 11   │ │              │
│ Semester: 1st│ │ Semester: 2nd│ │ Semester: 1st│ │              │
│ Strand: STEM│ │ Strand: ABM │ │ Strand: HUMSS│ │              │
│ Section:    │ │ Section:    │ │ Section:    │ │              │
│ St.Augustine│ │ St.Catherine│ │ St.Benedict │ │              │
└──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘

KEY:
• Student Number = PRIMARY identifier (2025-XXXX)
• LRN = DepEd reference only (12 digits)
• All students in same school year share year prefix
```

---

## Page Integration Map

```
┌─────────────────────────────────────────────────────────────────┐
│                         ADMIN PORTAL                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  School Year Management (NEW)                                   │
│  ┌───────────────────────────────────────────────────┐         │
│  │ • Create new school years                         │         │
│  │ • Activate/Deactivate school years                │         │
│  │ • View enrollment statistics                      │         │
│  │ • Manage academic year cycles                     │         │
│  └───────────────────────────────────────────────────┘         │
│                                                                 │
│  Access Control (ENHANCED)                                      │
│  ┌───────────────────────────────────────────────────┐         │
│  │ Add User:                                         │         │
│  │ • Auto-generate Student Number (2025-XXXX)       │         │
│  │ • Auto-generate temporary password                │         │
│  │ • Force password change checkbox                  │         │
│  │ • LRN field (separate from Student Number)       │         │
│  │ • School Year selector (with active indicator)   │         │
│  │ • Grade Level + Semester fields                   │         │
│  │ • Account summary preview                         │         │
│  └───────────────────────────────────────────────────┘         │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                      REGISTRAR PORTAL                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Enrollment Review (NEEDS INTEGRATION)                          │
│  ┌───────────────────────────────────────────────────┐         │
│  │ • ActiveSchoolYearBanner (shows current SY)       │         │
│  │ • EnrollmentGuard (blocks if no active SY)        │         │
│  │ • SchoolYearFilter (dropdown to filter by SY)     │         │
│  │ • Enrollment requests table                        │         │
│  └───────────────────────────────────────────────────┘         │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                       STUDENT PORTAL                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  My Grades (NEEDS INTEGRATION)                                  │
│  ┌───────────────────────────────────────────────────┐         │
│  │ Filters:                                          │         │
│  │ • SchoolYearFilter (dropdown)                     │         │
│  │ • Semester filter (1st/2nd)                       │         │
│  │                                                    │         │
│  │ Table:                                             │         │
│  │ • Subject | Grade | Status (Passed/Failed)       │         │
│  └───────────────────────────────────────────────────┘         │
│                                                                 │
│  My Profile (NEEDS UPDATE)                                      │
│  ┌───────────────────────────────────────────────────┐         │
│  │ Display:                                          │         │
│  │ • Student Number: 2025-0247 (PRIMARY)            │         │
│  │ • LRN: 1234-5678-9012 (DepEd Reference)          │         │
│  │ • Name, Email, etc.                               │         │
│  └───────────────────────────────────────────────────┘         │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                       TEACHER PORTAL                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Attendance (NEEDS INTEGRATION)                                 │
│  ┌───────────────────────────────────────────────────┐         │
│  │ Filters:                                          │         │
│  │ • SchoolYearFilter (dropdown)                     │         │
│  │ • Semester filter (1st/2nd)                       │         │
│  │ • Date range picker                               │         │
│  │ • Export to PDF button                            │         │
│  └───────────────────────────────────────────────────┘         │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                      PRINCIPAL PORTAL                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Reports (NEEDS INTEGRATION)                                    │
│  ┌───────────────────────────────────────────────────┐         │
│  │ Filters:                                          │         │
│  │ • SchoolYearFilter (dropdown)                     │         │
│  │ • Semester filter (1st/2nd)                       │         │
│  │ • Export to PDF/Excel buttons                     │         │
│  └───────────────────────────────────────────────────┘         │
│                                                                 │
│  Student Records (NEEDS INTEGRATION)                            │
│  ┌───────────────────────────────────────────────────┐         │
│  │ Filters:                                          │         │
│  │ • SchoolYearFilter (dropdown)                     │         │
│  │ • Search by Student Number (primary)             │         │
│  │ • Strand/Section filters                          │         │
│  │                                                    │         │
│  │ Table:                                             │         │
│  │ • Student Number | Name | LRN | Strand | Section │         │
│  └───────────────────────────────────────────────────┘         │
└─────────────────────────────────────────────────────────────────┘
```

---

## Component State & Props Flow

```
SchoolYearContext
├─ State: schoolYears: SchoolYear[]
├─ Derived: activeSchoolYear: SchoolYear | undefined
│
├─ Consumed by:
│  │
│  ├─ SchoolYearManagement
│  │  └─ Props: none (uses context directly)
│  │  └─ Actions: create, activate, deactivate
│  │
│  ├─ EnrollmentGuard
│  │  └─ Props: { children, message?, showDetails? }
│  │  └─ Logic: Blocks children if !activeSchoolYear
│  │
│  ├─ SchoolYearFilter
│  │  └─ Props: { value, onChange, label?, required?, showActiveIndicator? }
│  │  └─ Logic: Dropdown with active indicator
│  │
│  └─ ActiveSchoolYearBanner
│     └─ Props: none (uses context directly)
│     └─ Logic: Shows active SY or warning
│
└─ Hooks:
   ├─ useSchoolYear() → { schoolYears, activeSchoolYear, ... }
   ├─ useEnrollmentAllowed() → boolean
   └─ useSchoolYearOptions() → { options, defaultValue }
```

---

## Critical Validation Points

```
┌──────────────────────────────────────────────────────────┐
│              VALIDATION CHECKPOINT                       │
└──────────────────────────────────────────────────────────┘

1. School Year Activation
   ├─ Before: Check if another year is already active
   ├─ Action: Show confirmation dialog
   ├─ Execute: Set selected to Active, ALL others to Inactive
   └─ After: Verify only ONE active year exists

2. School Year Deactivation
   ├─ Before: Show warning about enrollment impact
   ├─ Action: User confirms via window.confirm()
   ├─ Execute: Set selected to Inactive
   └─ After: System may have ZERO active years (allowed)

3. Enrollment Form Access
   ├─ Before: EnrollmentGuard checks useEnrollmentAllowed()
   ├─ Check: Is there an active school year?
   ├─ Pass: Render enrollment form
   └─ Fail: Show error card, block form

4. Student Number Generation
   ├─ Before: Check if active school year exists
   ├─ Extract: Year from active SY (e.g., 2025 from "2025-2026")
   ├─ Query: Find max sequence for that year
   ├─ Generate: Year-Sequence (e.g., 2025-0248)
   └─ Validate: Format is YYYY-#### before saving

5. Add User (Student)
   ├─ Validate: Full name required
   ├─ Validate: Email required (school domain)
   ├─ Validate: Student Number generated
   ├─ Validate: LRN optional (12 digits if provided)
   ├─ Validate: School Year selected
   ├─ Validate: Grade Level, Semester, Strand, Section selected
   ├─ Validate: Password generated (8 chars minimum)
   └─ Create: Account with forcePasswordChange = true
```

---

## Security & Access Control

```
┌─────────────────────────────────────────────────────────┐
│                  ACCESS CONTROL MATRIX                  │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  School Year Management                                 │
│  ├─ Create School Year: Principal ✓, Admin ✓          │
│  ├─ Activate School Year: Principal ✓, Admin ✓        │
│  ├─ Deactivate School Year: Principal ✓, Admin ✓      │
│  └─ View School Years: Principal ✓, Admin ✓           │
│                                                         │
│  Student Account Creation                               │
│  ├─ Create Student: Registrar ✓, Admin ✓              │
│  ├─ Generate Student Number: Registrar ✓, Admin ✓     │
│  ├─ Set Password: Registrar ✓, Admin ✓                │
│  └─ Force Password Change: Registrar ✓, Admin ✓       │
│                                                         │
│  Enrollment                                             │
│  ├─ Submit Enrollment: Student ✓                       │
│  ├─ Review Enrollment: Registrar ✓                     │
│  ├─ Approve/Reject: Registrar ✓                        │
│  └─ View Status: Student ✓                             │
│                                                         │
└─────────────────────────────────────────────────────────┘

ENFORCEMENT:
• EnrollmentGuard blocks based on ACTIVE school year
• Route guards block based on USER role
• Context hooks throw errors if used outside provider
```

---

## Error Handling & Edge Cases

```
SCENARIO 1: No Active School Year
├─ User: Student tries to enroll
├─ Guard: EnrollmentGuard blocks
├─ Display: Red error card
├─ Message: "Contact admin to activate school year"
└─ Result: Form does not render

SCENARIO 2: Multiple Active Years (Should Never Happen)
├─ Prevention: setActiveSchoolYear() sets all others to Inactive
├─ Database: Unique constraint on status='Active' (recommended)
└─ Result: System prevents this scenario

SCENARIO 3: Deactivate Last Active Year
├─ User: Admin deactivates the only active year
├─ Confirm: window.confirm() dialog
├─ Result: System has ZERO active years
├─ Impact: All enrollment forms blocked
└─ Recovery: Admin can activate another year

SCENARIO 4: Invalid Student Number Format
├─ Input: User manually enters "2026-247" (3 digits)
├─ Validation: isValidStudentNumber() returns false
├─ Action: Show error message
└─ Result: Form submission blocked

SCENARIO 5: LRN Not 12 Digits
├─ Input: User enters "12345678901" (11 digits)
├─ Validation: isValidLRN() returns false
├─ Action: Show error message
└─ Result: Save as-is (LRN is optional, DepEd reference only)

SCENARIO 6: Context Used Outside Provider
├─ Code: useSchoolYear() called in component
├─ Check: Is component wrapped in SchoolYearProvider?
├─ No: Throw error "must be used within SchoolYearProvider"
└─ Yes: Return context values
```

---

This architecture ensures:
✅ Single source of truth (SchoolYearContext)
✅ Fail-safe validation (EnrollmentGuard)
✅ Consistent UI (SchoolYearFilter)
✅ Clear data hierarchy (School Year → Students)
✅ Strong typing (TypeScript interfaces)
✅ Reusable components (across all portals)
