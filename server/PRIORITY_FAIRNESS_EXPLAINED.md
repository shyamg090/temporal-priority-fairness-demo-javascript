# 🕒 Temporal Scheduling — Fairness & Priority

This document explains how **Temporal** uses the new **Fairness** and **Priority** features to manage workflow scheduling and task dispatching.

---

## ⚖️ WHAT IS FAIRNESS?

**Fairness** ensures that different tenants or task groups sharing the same task queue receive a balanced share of worker capacity — preventing one tenant from dominating the queue.

### 🧩 Example

**Without Fairness:**

> Tenant A starts 1000 tasks, Tenant B starts 10 tasks.
> Tenant A may block all workers while Tenant B’s tasks sit idle.

**With Fairness:**

```text
fairness_key: "tenantA", weight: 1.0
fairness_key: "tenantB", weight: 1.0
```

➡️ Both tenants receive roughly equal worker capacity (≈50/50 split).

**Weighted Fairness:**

```text
fairness_key: "tenantA", weight: 2.0
fairness_key: "tenantB", weight: 1.0
```

➡️ Tenant A receives ~⅔ of worker capacity, Tenant B receives ~⅓.

> 🧠 **In short:** Fairness protects smaller workloads or tenants from being starved when others produce heavy loads.

---

## 🚀 WHAT IS PRIORITY?

**Priority** defines *which tasks run first* within the same queue — based on urgency or importance.
A **lower priority number** means **higher priority**.

### 🧩 Example

If 100 workflows are queued:

| Workflow Type          | Count | Priority | Description      |
| ---------------------- | ----- | -------- | ---------------- |
| PaymentProcessing      | 50    | 1        | Highest priority |
| EmailNotifications     | 30    | 2        | Medium priority  |
| WeeklyReportGeneration | 20    | 5        | Lowest priority  |

➡️ **Temporal Scheduling Order:**

1. Execute all **priority 1** tasks (PaymentProcessing).
2. When workers are free, pick **priority 2** tasks (EmailNotifications).
3. Finally, execute **priority 5** tasks (WeeklyReports).

> 🧠 **In short:** Priority ensures urgent or time-sensitive workflows execute before less critical ones.

---

## 🧭 FAIRNESS + PRIORITY TOGETHER

When used together:

* **Fairness** ensures each tenant gets fair capacity share.
* **Priority** decides which tasks *within each tenant’s share* are executed first.

**Example Combined Scheduling Order:**

```
A(CRUD - P1) → B(CRUD - P1) → A(Payment - P2) → B(Payment - P2) → A(Stream - P3) → B(Stream - P3)
```

---

## 🧱 Visual Flow (Example Setup)

```
┌──────────────────────────┐
│        Tenant A          │
│──────────────────────────│
│ • CRUD Workflow (P1)     │
│ • Payment Workflow (P2)  │
│ • Stream-Late-Night (P3) │
└────────────┬─────────────┘
             │
             ▼
┌──────────────────────────┐
│        Tenant B          │
│──────────────────────────│
│ • CRUD Workflow (P1)     │
│ • Payment Workflow (P2)  │
│ • Stream-Late-Night (P3) │
└────────────┬─────────────┘
             │
             ▼
──────────────────────────────────────────────
              🧩  SINGLE TASK QUEUE
──────────────────────────────────────────────
|  Total Workflows: 15                       |
|  Fairness → A & B share capacity equally   |
|  Priority → Determines order within share  |
──────────────────────────────────────────────
│
│  Priority Levels:
│   • P1 → CRUD (Highest)
│   • P2 → Payment
│   • P3 → Stream-Late-Night (Lowest)
│
▼
┌───────────────────────────────┐
│ Temporal Scheduler Behavior   │
│───────────────────────────────│
│ 1. Split by fairness (A ≈ B)  │
│ 2. Within each tenant:        │
│    - Run P1 first             │
│    - Then P2                  │
│    - Then P3                  │
│ 3. Interleave execution fairly│
└───────────────────────────────┘
```

---
