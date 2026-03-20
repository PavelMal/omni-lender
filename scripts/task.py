#!/usr/bin/env python3
"""Lightweight task manager for MVP pipeline."""

import sys
import yaml
from pathlib import Path

TASKS_FILE = Path("docs/TASKS.yaml")


def load_tasks():
    if not TASKS_FILE.exists():
        print(f"Error: {TASKS_FILE} not found")
        sys.exit(1)
    with open(TASKS_FILE) as f:
        data = yaml.safe_load(f)
    return data.get("tasks", [])


def save_tasks(tasks):
    with open(TASKS_FILE, "w") as f:
        yaml.dump({"tasks": tasks}, f, default_flow_style=False, allow_unicode=True, sort_keys=False)


def cmd_list(tasks):
    if not tasks:
        print("No tasks found.")
        return
    status_icon = {
        "pending": " ",
        "in_progress": ">",
        "completed": "x",
        "blocked": "!",
    }
    for t in tasks:
        icon = status_icon.get(t["status"], "?")
        owner = t.get("owner", "unassigned")
        blocked = ""
        if t.get("blocked_by"):
            blocked = f" [blocked by: {', '.join(t['blocked_by'])}]"
        print(f"  [{icon}] {t['id']} ({t['priority']}) {t['subject']} @{owner}{blocked}")
    total = len(tasks)
    done = sum(1 for t in tasks if t["status"] == "completed")
    print(f"\n  {done}/{total} completed")


def cmd_add(tasks, subject, priority="P1", estimate=0):
    max_id = 0
    for t in tasks:
        num = int(t["id"][1:])
        if num > max_id:
            max_id = num
    new_id = f"T{max_id + 1:03d}"
    tasks.append({
        "id": new_id,
        "subject": subject,
        "status": "pending",
        "priority": priority,
        "estimate_hours": int(estimate),
        "owner": "unassigned",
        "blocked_by": [],
        "tags": [],
        "notes": "",
    })
    save_tasks(tasks)
    print(f"  Added: {new_id} — {subject}")


def cmd_start(tasks, task_id):
    for t in tasks:
        if t["id"] == task_id:
            if t.get("blocked_by"):
                pending_blockers = [b for b in t["blocked_by"]
                                    if any(bt["id"] == b and bt["status"] != "completed" for bt in tasks)]
                if pending_blockers:
                    print(f"  Error: {task_id} is blocked by: {', '.join(pending_blockers)}")
                    return
            t["status"] = "in_progress"
            save_tasks(tasks)
            print(f"  Started: {task_id}")
            return
    print(f"  Error: task {task_id} not found")


def cmd_done(tasks, task_id):
    for t in tasks:
        if t["id"] == task_id:
            t["status"] = "completed"
            save_tasks(tasks)
            print(f"  Completed: {task_id}")
            return
    print(f"  Error: task {task_id} not found")


def cmd_next(tasks):
    for t in tasks:
        if t["status"] == "pending":
            if t.get("blocked_by"):
                pending_blockers = [b for b in t["blocked_by"]
                                    if any(bt["id"] == b and bt["status"] != "completed" for bt in tasks)]
                if pending_blockers:
                    continue
            print(f"  Next: {t['id']} ({t['priority']}) {t['subject']}")
            return
    print("  No available tasks")


def main():
    if len(sys.argv) < 2:
        print("Usage: task.py <command> [args]")
        print("Commands: list, add, start, done, next")
        sys.exit(1)

    cmd = sys.argv[1]
    tasks = load_tasks()

    if cmd == "list":
        cmd_list(tasks)
    elif cmd == "add":
        if len(sys.argv) < 3:
            print("Usage: task.py add 'Task subject' [priority] [estimate_hours]")
            sys.exit(1)
        priority = sys.argv[3] if len(sys.argv) > 3 else "P1"
        estimate = sys.argv[4] if len(sys.argv) > 4 else 0
        cmd_add(tasks, sys.argv[2], priority, estimate)
    elif cmd == "start":
        if len(sys.argv) < 3:
            print("Usage: task.py start T001")
            sys.exit(1)
        cmd_start(tasks, sys.argv[2])
    elif cmd == "done":
        if len(sys.argv) < 3:
            print("Usage: task.py done T001")
            sys.exit(1)
        cmd_done(tasks, sys.argv[2])
    elif cmd == "next":
        cmd_next(tasks)
    else:
        print(f"Unknown command: {cmd}")
        sys.exit(1)


if __name__ == "__main__":
    main()
