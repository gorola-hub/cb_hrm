# Capital Bridge HRM — Complete Operational Guide & End-to-End Walkthrough

> **Audience:** Management, Operations Leadership, and Human Resources  
> **Status:** Official Non-Technical Operational Standard  
> **Companion Document:** TECHNICAL_ARCHITECTURE.md  
> **Date:** October 2026

---

## Executive Summary: The Unified System Vision

Capital Bridge operations rely on a modern, two-pillar digital ecosystem designed to maximize brokerage efficiency while offering seamless employee self-service:

- Capital Bridge HRM: Employee Self-Service Portal (Attendance, Breaks in IST, Leaves)
- Capital Bridge CRM: Freight Brokerage Core (Shipments, Customers, Carriers, Invoicing)
- One Shared Secure Database: Zero duplicate employee onboarding.


+-------------------------------------------------------------------------------+
|                           CAPITAL BRIDGE ECOSYSTEM                            |
+---------------------------------------+---------------------------------------+
|          CAPITAL BRIDGE HRM           |          CAPITAL BRIDGE CRM           |
|    (Employee Self-Service Portal)     |       (Freight Brokerage Core)        |
+---------------------------------------+---------------------------------------+
|  [1] Employee Logs In                 |  [1] Manages Freight, Loads & Trucks  |
|  [2] Live Clock in IST (Indian Time)  |  [2] Customers, Carriers & Invoicing  |
|  [3] Punch In (Date Locked to Today)  |  [3] Sole Master for User Management: |
|  [4] Flexible "Break" & "Back"        |      - Add new employees here         |
|  [5] Submit Leave Requests            |      - Assign roles / permissions     |
|                                       |      - Deactivate former staff        |
|  >>> [ BUTTON: Open CRM ] >>>>>>>>>>>>|  >>> Instant Access (No Password) >>> |
+---------------------------------------+---------------------------------------+
                    |                                       |
                    +-------------------+-------------------+
                                        |
                                        v
+-------------------------------------------------------------------------------+
|                       ONE CENTRAL SECURE DATABASE                             |
|              (Both apps connect to the exact same database)                   |
|                                                                               |
|  * Users & Roles: Maintained solely by CRM (Shared with HRM in real-time)     |
|  * Attendance & Leaves: Recorded and updated by HRM in real-time              |
+-------------------------------------------------------------------------------+


### The Golden Rule: Centralized User Management
All employee onboarding, role assignment, and access deactivation happens in ONE place: the CRM.
- You never have to create an employee twice.
- As soon as an employee is added or granted access in the CRM, they can immediately log in to the HRM portal.
- If an employee leaves the company or is marked inactive in the CRM, their access to both the CRM and the HRM is revoked instantly.

---

## 1. The Employee (Agent) Journey — Step-by-Step

[18:30 IST - Arrive Early]
           |
           v
+-----------------------+
|   Log In to HRM       |  ---> Uses standard CRM email & password
+-----------------------+
           |
           v
+-----------------------+
| Click [ PUNCH IN ]    |  ---> Work date locked to today (e.g., Oct 31)
+-----------------------+       Grace period up to 120 mins before shift
           |
           +-----------------------+
           |                       |
           v                       v
+-----------------------+   +-------------------------------+
|  Active Work Shift    |   | Click [ Open CRM ]            |
|  (Work timer running) |   | Jump straight into CRM loads  |
+-----------------------+   | (Zero login prompts!)         |
     |             ^        +-------------------------------+
     |             |
[TAKE BREAK]  [BACK FROM BREAK]
     |             |
     v             |
+-----------------------+
|      On Break         |  ---> Work timer pauses, break timer starts.
|  (No limit on breaks) |       Take as many breaks as needed.
+-----------------------+
           |
    [03:30 AM Morning]
           |
           v
+-----------------------+
| Click [ PUNCH OUT ]   |  ---> Shift ends for Oct 31 (Nov 1 stays clean)
+-----------------------+
           |
           v
+---------------------------------------------------------------+
|                  Automatic Hours Calculation                  |
|          Total Work Time = (Punch Out - Punch In) - Breaks    |
+---------------------------------------------------------------+
           |
           +-------------> Net >= 7.5 hrs  ----->  [ P ] Present (Full Day)
           |
           +-------------> Net 5 to 7.5 hrs ---->  [ HD ] Half Day
           |
           +-------------> Net < 5.0 hrs  ------>  [ A ] Absent


### Step 1: Logging In to the Portal
- The employee opens `hrm.capitalbridgelogistics.com`.
- They log in using their standard company email and password.
- No separate accounts or credentials are needed.

### Step 2: The Self-Service Attendance Dashboard
- Live Indian Clock: Real-time digital clock displays Indian Standard Time (IST), ensuring accuracy regardless of local computer clocks.
- Assigned Shift: Displays their shift (e.g. 19:00 - 03:30 IST).
- Live Status: Shows OFFLINE until punch-in.
- Large interactive [PUNCH IN] button.

### Step 3: Punching In (Shift Starts)
- Employee clicks [PUNCH IN].
- Early arrival is fully permitted (up to 2 hours early) with zero penalty.
- Today's date is locked as the "Work Date".
- Live work timer starts running.
- Button transforms into [TAKE BREAK] and [PUNCH OUT].

### Step 4: The One-Click Bridge to the CRM
- In the top navigation bar, the employee clicks [Open CRM].
- A new tab opens directly into the CRM.
- The system automatically authenticates them — NO password required.
- The employee is on their CRM dashboard in under a second.

### Step 5: Taking Breaks During the Night Shift
- To take a break, employee clicks [TAKE BREAK].
  - Work timer pauses. Break timer begins. Button changes to [BACK FROM BREAK].
- Upon returning, employee clicks [BACK FROM BREAK].
  - Work timer resumes; break duration is recorded.
- There are NO rigid limits (e.g., 15-15-30). Breaks can be taken as needed.

### Step 6: Requesting a Leave
- Employee navigates to "My Leaves" (`/leaves`).
- Company leave uses **Paid Leave (`PAID`)**, accruing **+1 day on the 1st of each eligible month** after a **3-month waiting period** based on CRM joining date (`<= 15th` starts `joiningMonth + 3`; `> 15th` starts `joiningMonth + 4`; if no joining date is set, `/leaves` displays `0` and prompts the employee to contact an Administrator).
- Employee selects Paid Leave, dates (evaluating accrued balance up to the leave's end-date month), and enters a reason.
- Submits request -> status shows "Pending Approval".
- Admin is immediately notified on their portal.

### Step 7: Ending the Night Shift (Morning Punch-Out)
- At 03:40 AM the next morning, employee clicks [PUNCH OUT].
- System computes: Total Gross Time minus Total Break Time = Net Work Time.
- If Net Time >= 7.5 hours -> Marked P (Present).
- Shift is recorded under the start date (e.g. Oct 31), leaving the next day (Nov 1) clean and ready.

### Step 8: Personal Attendance Calendar & Break Breakdown
- Monthly Calendar Grid: Color-coded by status (P=Green, HD=Orange, A=Red, LV=Blue, WO=Grey, L=Late tag).
- Clicking any date opens a Day Detail Card showing:
  - Exact punch-in & punch-out times
  - Net hours worked
  - Total Breaks Dropdown: e.g. "Total Breaks: 3 (50 mins total) [v]"
  - Expanding the dropdown reveals every individual break with start/end times and durations.

---

## 2. The Admin & Operations Manager Journey
+-----------------------------------------------+
|             Admin Logs In to HRM              |
+-----------------------------------------------+
                       |
                       +---------------------------------------+
                       |                                       |
                       v                                       v
+-----------------------------------------------+   +-----------------------------+
|            LIVE COMPANY ROSTER                |   |    NOTIFICATION BELL [3]    |
| - Filter by Date, Shift, Department           |   +-----------------------------+
| - See Real-Time Statuses (Working / On Break) |                  |
| - View Break Timelines: [ 45m (3) v ]         |                  v
+-----------------------------------------------+   +-----------------------------+
                       |                            |   Pending Leave Queue       |
              [Need a Correction?]                  |   - Review reason & dates   |
                       |                            +-----------------------------+
                       v                                           |
+-----------------------------------------------+                  v
|         Admin Attendance Edit                 |   +-----------------------------+
| - Adjust In/Out times or status               |   | Click [ Approve ]           |
| - Enter mandatory explanation                 |   +-----------------------------+
| - Automatically logged in Audit History       |                  |
+-----------------------------------------------+                  v
                                                    +-----------------------------+
                                                    |  AUTOMATIC TIMENOTE:        |
                                                    |  Dates are automatically    |
                                                    |  marked as [ LV ] (Leave)   |
                                                    |  on the Attendance Sheet!   |
                                                    +-----------------------------+


### Step 1: Live Command Center (/admin/attendance)
- Real-time KPI metric cards:
  - On Shift Now
  - On Break
  - Late Today (L)
  - On Approved Leave (LV)
  - Offline / Unpunched

### Step 2: Master Tabular Roster
- Comprehensive table listing all employees for any chosen date.
- Columns: Employee Name, Shift, Punch In, Punch Out, Net Work, Total Breaks, Status, Action.
- Expanding the break pill shows the full timeline of breaks for that employee inline.

### Step 3: Admin Attendance Edit & Regularization
- If an employee forgot to punch in/out or had a tech issue:
- Admin clicks [Edit] on any record.
- Can adjust times, breaks, or status.
- Mandatory reason must be provided (e.g., "Home power outage verified").
- Automatically saved with full audit trail.

### Step 4: Notification Bell & Leave Approvals (/admin/leaves)
- Notification Bell in header alerts Admin to new leave requests.
- Admin reviews reason and clicks [Approve] or [Reject].
- Upon Approval: System AUTOMATICALLY marks those dates as [LV - On Leave] on the employee's attendance record so they are not flagged absent.

### Step 5: Shift Master (/admin/shifts)
- Manage shifts (17:00, 17:30, 18:00, 18:30, 19:00, 19:30).
- Assign employees to shifts.

---

## 3. Business Rules Cheat Sheet

- Full Day Present (P): Net work >= 7.5 hours
- Half Day (HD): Net work 5.0 to 7.5 hours
- Absent (A): Net work < 5.0 hours
- Week Off (WO): Saturday / Sunday
- Approved Leave (LV): Automatically assigned upon leave approval
- Late (L): Punch-in > 15 minutes after shift start
- Night Shift Date: Always locked to the first punch-in date
- Employee Management: Exclusively done in CRM; synced automatically to HRM
