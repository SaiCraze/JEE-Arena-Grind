# Tuition Hub Rebuild & Homework Submission Engine

Rebuilding the Tuition Hub into a role-tailored workspace for students and teachers with complete submission mechanisms supporting typed responses, file/photo uploads, and external resource links.

## User Review & Confirmed Decisions

> [!IMPORTANT]
> The following choices were confirmed during Phase 1 clarification:

- **Confirmed Issue Cause**: The submit button appears on screen, but clicking it fails to trigger the submission pipeline due to state handler disconnects and unhandled form submission promises.
- **Confirmed Layout Strategy**: Role-tailored workspace with clear action cards for active homework, separating Student actions from Teacher management workflows.
- **Confirmed Submission Formats**: Complete multi-modal submission engine supporting:
  1. Typed solution responses & rich notes
  2. File attachments (PDFs, docs, images, camera captures)
  3. External resource links (Google Drive, GitHub, Notion, web links)

---

## 1. Overview & Core Concept

The rebuilt Tuition Hub provides a clean, role-tailored environment for faculty and students:

- **Student Experience**: Prominent active homework cards organized by subject with status flags (`Pending`, `Submitted`, `Graded`, `Overdue`), 1-click submission drawers supporting multi-format solutions (files, notes, links), and instant resubmission/excuse capabilities.
- **Teacher Experience**: Unified assignment dispatch panel (questions, difficulty, due date, attachments), student submission review queue with 1-click grading, XP awards/penalties, and excuse evaluation.
- **Reliability & Data Flow**: Fully connected Firestore listeners with atomic `updateDoc` transactions, error handling, activity logging, and real-time push notifications.

---

## 2. User Experience & Visual Design

### Key User Flows

1. **Student Assignment Discovery & Submission Flow**:
   - Student enters Tuition Hub and selects subject filter (`ALL` or specific subject).
   - Student views active homework cards with due date counters, XP rewards, and attachments.
   - Student clicks **"Submit Solution"** or **"Submit Late / Resubmit"**.
   - A dedicated multi-format submission modal opens with three input tabs:
     - 📝 **Typed Answer & Notes**: Rich textarea for written solutions or explanations.
     - 📎 **File Attachments & Photos**: Drag-and-drop / file browser for photos, PDFs, or docs with preview thumbnails.
     - 🔗 **Resource Links**: Web URL input for external Google Drive, Notion, or Github links.
   - Student clicks **"Submit Solution to Faculty"**. Button transitions to loading state, uploads data to Firestore `teacher_assignments[id].submissions[studentId]`, logs activity, sends push notification, and updates UI.

2. **Teacher Assignment Dispatch & Grading Flow**:
   - Faculty logs in and sees subject-specific Tuition Hub view.
   - Faculty clicks **"Create New Homework"** or views student submission queue with pending badge indicators.
   - Faculty opens student submission, reviews typed text, attached files, and resource links.
   - Faculty enters marks, feedback, awards XP/penalty, and clicks **"Save Grade & Send Feedback"**.

### Visual Identity & Theme

- **Aesthetic**: Modern, clean, dark-mode educational workspace with high-contrast accenting (`Plus Jakarta Sans` typography, Amber `#F59E0B` and Orange `#F97316` brand accents, Deep Slate `#09090B` canvas).
- **Layout Architecture**: 2-Zone role-tailored layout:
  - Top: Subject selector segmented tabs (`ALL`, `Math`, `Physics`, `Chemistry`, `English`, `LR`, `General`) and pending items counter.
  - Body: Grid of active homework cards with status banners (`🎯 Active`, `⏳ Review Pending`, `✅ Graded (+85 XP)`, `⚠️ Overdue`), teacher profile avatars, and single-line action buttons (`Submit Solution`, `View Submission & Grade`).

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Full State Handler Unification in App.tsx**:
  - *Chosen Approach*: Replace fragmented assignment submission logic with a unified, robust `handleStudentSubmitHomework` form handler that supports typed text, file arrays, and link arrays simultaneously.
  - *Why*: Resolves the bug where button clicks did nothing due to mismatched form `onSubmit` bindings and missing active assignment state variables.

- **Decision 2: Sub-collection Document Schema Alignment**:
  - *Chosen Approach*: Standardize submission schema inside `teacher_assignments[asgId].submissions[studentId]` with typed fields: `submittedAt`, `note`, `proofImages`, `attachedFiles`, `resourceLinks`, `status` (`'pending' | 'graded' | 'overdue_penalized'`).
  - *Why*: Guarantees backward compatibility with existing teacher grading modals while adding new multi-modal submission capabilities.

---

## 4. Technical Architecture & Data Strategy

### System Component Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            TUITION HUB WORKSPACE                            │
└──────────────────────┬───────────────────────────────┬──────────────────────┘
                       │                               │
       ┌───────────────▼──────────────┐   ┌────────────▼──────────────────┐
       │   Student Homework View      │   │     Teacher Workspace View    │
       │  - Active Homework Cards     │   │  - Homework Dispatcher        │
       │  - Action Triggers           │   │  - Student Submission Queue   │
       └───────────────┬──────────────┘   └────────────┬──────────────────┘
                       │                               │
                       └───────────────┬───────────────┘
                                       │
                    ┌──────────────────▼──────────────────┐
                    │ Multi-Format Submission Modal       │
                    │  - Typed Notes & Text               │
                    │  - File Uploads & Photos            │
                    │  - External Links (Drive/Github)    │
                    └──────────────────┬──────────────────┘
                                       │
                    ┌──────────────────▼──────────────────┐
                    │ Firestore Persistence Layer         │
                    │  `teacher_assignments/{asgId}`      │
                    │  `activities/`                      │
                    └─────────────────────────────────────┘
```

### Data Model & State Mapping

- **TeacherAssignment Entity**:
  ```ts
  interface TeacherAssignment {
    id: string;
    teacherId: string;
    teacherName: string;
    subject: string;
    title: string;
    description: string;
    hasQuestions?: boolean;
    questionsCount?: number;
    questionDifficulty?: 'easy' | 'mains' | 'hard' | 'adv';
    xpReward: number;
    doubleXpFullComplete?: boolean;
    dueDate: string;
    assignedTo: string[]; // ['ALL'] or student member IDs
    refLink?: string;
    attachedFiles?: AssignmentFile[];
    archived?: boolean;
    submissions?: {
      [studentId: string]: {
        submittedAt: number;
        status: 'pending' | 'graded' | 'overdue_penalized';
        note?: string;
        proofImages?: string[];
        attachedFiles?: AssignmentFile[];
        resourceLinks?: string[];
        feedback?: string;
        xpAwarded?: number;
        marksAwarded?: number;
        maxMarks?: number;
      };
    };
    createdAt: number;
  }
  ```

---
